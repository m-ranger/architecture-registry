import {
  getInformationSystem,
  getModulesOfSystem,
  getSystemFlows,
  getSystemDeployments,
  getProject,
  getProjectFlows,
  getProjectModules,
  getSystemsOfModules,
  getModuleDeployments,
  getDeploymentAddresses,
  ownerAddressKey,
  ADDRESS_ROLE_PRIORITY,
} from './registry.js';
import {
  layeredLayout,
  gridLayout,
  deploymentLayout,
  normalizeContainers,
  isBoundaryType,
  isContainerNode,
} from './layout.js';

/**
 * C4 mapping и генератор внутренней графовой модели (ТЗ §6, §10, §13).
 *
 * Внутренняя модель (internal graph model) отделяет семантику реестра от рендерера
 * и является единственным источником для canvas и всех экспортных форматов (ТЗ §3, §15).
 *
 * Соответствие объект реестра -> C4 (ТЗ §6):
 *   information_system  -> SoftwareSystem
 *   application_module  -> Container
 *   module_instance     -> DeploymentInstance
 *   module_deployment   -> размещение Instance на DeploymentNode
 *   server / cluster    -> DeploymentNode
 *   environment         -> EnvironmentBoundary
 *   information_flow    -> Relationship
 *   protocol            -> technology связи
 */

export const C4_TYPE = {
  SOFTWARE_SYSTEM: 'SoftwareSystem',
  CONTAINER: 'Container',
  DEPLOYMENT_NODE: 'DeploymentNode',
  DEPLOYMENT_INSTANCE: 'DeploymentInstance',
  SYSTEM_BOUNDARY: 'SystemBoundary',
  ENVIRONMENT_BOUNDARY: 'EnvironmentBoundary',
  ANNOTATION: 'Annotation',
};

const SIZE = {
  [C4_TYPE.SOFTWARE_SYSTEM]: { width: 240, height: 116 },
  [C4_TYPE.CONTAINER]: { width: 250, height: 112 },
  [C4_TYPE.DEPLOYMENT_NODE]: { width: 270, height: 120 },
  [C4_TYPE.DEPLOYMENT_INSTANCE]: { width: 230, height: 88 },
  [C4_TYPE.SYSTEM_BOUNDARY]: { width: 340, height: 240 },
  [C4_TYPE.ENVIRONMENT_BOUNDARY]: { width: 360, height: 260 },
  [C4_TYPE.ANNOTATION]: { width: 220, height: 80 },
};

/** Стабильный ключ узла = тип+id реестрового объекта (ссылочность, ТЗ §3). */
export const nodeKey = (type, id) => `${type}:${id}`;
export const edgeKey = (flowId) => `information_flow:${flowId}`;

/** Идентификатор связи схемы развертывания между размещениями сторон потока. */
export const deploymentEdgeId = (sourceDeploymentId, targetDeploymentId) =>
  `dep:${sourceDeploymentId}->${targetDeploymentId}`;

/**
 * Пары размещений, которые образует каждый поток области в срезе: размещение
 * источника → размещение приёмника. Тот же алгоритм использует генератор схемы
 * развертывания, поэтому идентификаторы связей совпадают, и панель
 * «Потоки области» находит связь на canvas.
 */
export function flowDeploymentEdges(deployments, flows) {
  const placements = new Map();
  for (const deployment of deployments) {
    if (!placements.has(deployment.module_id)) placements.set(deployment.module_id, []);
    placements.get(deployment.module_id).push(deployment);
  }

  const result = new Map();
  for (const flow of flows) {
    const sources = placements.get(flow.source_id) || [];
    const targets = placements.get(flow.target_id) || [];
    const ids = new Set();
    for (const source of sources) {
      for (const target of targets) {
        if (source.id === target.id) continue;
        ids.add(deploymentEdgeId(source.id, target.id));
      }
    }
    if (ids.size > 0) result.set(flow.id, Array.from(ids));
  }
  return result;
}

function makeNode({ id, registryRef, c4Type, name, technology, description, parent = null, style = {} }) {
  return {
    id,
    registryRef,
    c4Type,
    parent,
    name,
    technology: technology || null,
    description: description || null,
    position: { x: 0, y: 0 },
    size: { ...(SIZE[c4Type] || SIZE[C4_TYPE.CONTAINER]) },
    style,
  };
}

function makeEdge({ id, source, target, registryRef = null, label, technology }) {
  return {
    id,
    source,
    target,
    registryRef,
    label: label || '',
    technology: technology || null,
  };
}

/** Единая технология связи из протокола и порта (ТЗ §10.2). */
export function flowTechnology(flow) {
  const port = flow.target_port || flow.default_port;
  const base = flow.protocol_code || flow.protocol_name || '';
  return port ? `${base}/${port}` : base;
}

// ---------------------------------------------------------------------------
// Сетевые адреса размещения (ТЗ §10.3)
// Адреса развертывания берутся из реестра (network_interface): у сервера —
// адреса сервера, у кластера — адреса кластера (роль в кластере: INGRESS,
// NODE, MANAGEMENT). Адрес отображается на узле размещения и подписывает
// информационный поток («с какого адреса на какой»).
// ---------------------------------------------------------------------------

const addressRoleRank = (role) => {
  const index = ADDRESS_ROLE_PRIORITY.indexOf(String(role || 'OTHER'));
  return index === -1 ? ADDRESS_ROLE_PRIORITY.length : index;
};

/** Адреса узла в порядке значимости: сервисный адрес первым, затем управление. */
export function sortAddresses(addresses = []) {
  return [...addresses].sort((a, b) => {
    const byRole = addressRoleRank(a.address_role) - addressRoleRank(b.address_role);
    if (byRole !== 0) return byRole;
    if (Boolean(a.is_primary) !== Boolean(b.is_primary)) return a.is_primary ? -1 : 1;
    return String(a.ip_address || '').localeCompare(String(b.ip_address || ''));
  });
}

/** Предпочтительный адрес узла — тот, которым подписывается поток. */
export function preferredAddress(addresses = []) {
  return sortAddresses(addresses)[0] || null;
}

/** Адрес без маски подсети и, при наличии, с портом. */
export function addressWithPort(address, port) {
  if (!address) return null;
  const ip = String(address.ip_address || '').replace(/\/\d+$/, '');
  if (!ip) return null;
  return port ? `${ip}:${port}` : ip;
}

/** Краткое описание адресов узла — подсказка узла и текст экспорта. */
export function addressSummary(addresses = [], limit = 4) {
  const list = sortAddresses(addresses)
    .slice(0, limit)
    .map((item) => `${String(item.ip_address || '').replace(/\/\d+$/, '')} (${item.address_role})`);
  const rest = addresses.length - list.length;
  return rest > 0 ? `${list.join(', ')} и ещё ${rest}` : list.join(', ');
}

/** Подпись связи «адрес» по предпочтительным адресам сторон. */
function addressPairText(sourceAddresses) {
  const from = preferredAddress(sourceAddresses);
  const to = preferredAddress(targetAddresses);
  if (!from || !to) return null;
  return `${from} → ${to}`;
}

/**
 * Индекс адресов узлов размещения: server:<id> / cluster:<id> -> список адресов.
 * Узел, у которого адресов нет, в индекс не попадает — это фиксирует валидация.
 * Экспортируется для чтения состава потоков области (server/scopeFlows.js).
 */
export async function loadAddresses(deployments, environmentId) {
  const serverIds = [...new Set(deployments.map((d) => d.server_id).filter(Boolean))];
  const clusterIds = [...new Set(deployments.map((d) => d.cluster_id).filter(Boolean))];
  const rows = await getDeploymentAddresses({ serverIds, clusterIds, environmentId });

  const index = new Map();
  for (const row of rows) {
    const key = ownerAddressKey(row.owner_type, row.owner_id);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(row);
  }
  for (const [key, list] of index) index.set(key, sortAddresses(list));
  return index;
}

/**
 * Раскладка графа (ТЗ §14).
 * Схема развертывания укладывается по уровням «контур среды → узел размещения →
 * экземпляр»: экземпляры находятся внутри рамки узла, а рамка растягивается под
 * состав (ТЗ §10.3). Остальные схемы сохраняют прежнее поведение: иерархия —
 * сетка, плоская схема — слоистая раскладка. Границы контуров считаются из
 * состава на клиенте и в экспорте.
 * @returns {Array} узлы графа (возможно, новый массив — состав нормализован)
 */
function applyLayout(nodes, edges, existingPositions = null) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  // Узел размещения среди родителей означает схему развертывания.
  const isDeployment = nodes.some(
    (node) => !isBoundaryType(node.c4Type) && isContainerNode(byId.get(node.parent)),
  );

  if (isDeployment) {
    const { positions, sizes } = deploymentLayout(nodes);
    for (const node of nodes) {
      // Режим SYNC сохраняет ручные координаты пользователя (ТЗ §13).
      const preserved = existingPositions?.[node.id];
      if (preserved) {
        node.position = { x: preserved.x, y: preserved.y };
        continue;
      }
      const computed = positions[node.id];
      if (!computed) {
        node.position = { x: 80, y: 80 };
        continue;
      }
      node.position = computed;
      // Размер узла размещения принадлежит раскладке: он считается по составу.
      if (sizes[node.id]) node.size = { ...sizes[node.id] };
    }
    // Инвариант соблюдается и в режиме SYNC: состав всегда внутри узла.
    return normalizeContainers(nodes);
  }

  const placeable = nodes.filter((n) => !isBoundaryType(n.c4Type));
  const hasHierarchy = placeable.some((n) => n.parent);
  const positions = hasHierarchy
    ? gridLayout(placeable, { columns: 3, colGap: 320, rowGap: 200 })
    : layeredLayout(placeable, edges);

  for (const node of nodes) {
    const computed = positions[node.id];
    if (!computed) {
      node.position = { x: 80, y: 80 };
      continue;
    }
    // Режим SYNC сохраняет ручные координаты пользователя (ТЗ §13).
    const preserved = existingPositions?.[node.id];
    node.position = preserved ? { x: preserved.x, y: preserved.y } : computed;
  }
  return nodes;
}

/** Типы области (scope) схемы: информационная система или проект (ТЗ §10, §12). */
export const SCOPE_TYPES = {
  INFORMATION_SYSTEM: 'information_system',
  PROJECT: 'project',
};

/**
 * Загрузка области схемы.
 * Область описывается единым контекстом, поэтому все генераторы работают и по
 * ИС (модули ИС и её потоки), и по проекту (все информационные потоки проекта и
 * все модули, участвующие в проекте через эти интеграционные потоки).
 */
/**
 * Загрузка области схемы.
 * Область описывается единым контекстом, поэтому все генераторы работают и по
 * ИС (модули ИС и её потоки), и по проекту (все информационные потоки проекта и
 * все модули, участвующие в проекте через эти интеграционные потоки).
 * environmentId — срез по среде (диаграмма развертывания в разрезе среды).
 */
async function loadScope(scopeType, scopeId, { environmentId = null } = {}) {
  if (scopeType === SCOPE_TYPES.PROJECT) {
    const project = await getProject(scopeId);
    if (!project) throw Object.assign(new Error('Scope project not found'), { status: 404 });
    const modules = await getProjectModules(project.id);
    const moduleIds = modules.map((module) => module.id);
    const [flows, deployments, systems] = await Promise.all([
      getProjectFlows(project.id),
      getModuleDeployments(moduleIds, 'ACTIVE', environmentId),
      getSystemsOfModules(moduleIds),
    ]);
    return {
      scopeType: SCOPE_TYPES.PROJECT,
      object: project,
      modules,
      flows,
      deployments,
      systems,
      addresses: await loadAddresses(deployments, environmentId),
      environmentId,
      scopeKey: nodeKey(SCOPE_TYPES.PROJECT, project.id),
    };
  }

  const system = await getInformationSystem(scopeId);
  if (!system) throw Object.assign(new Error('Scope information_system not found'), { status: 404 });
  const [modules, flows, deployments] = await Promise.all([
    getModulesOfSystem(system.id),
    getSystemFlows(system.id),
    getSystemDeployments(system.id, 'ACTIVE', environmentId),
  ]);
  return {
    scopeType: SCOPE_TYPES.INFORMATION_SYSTEM,
    object: system,
    modules,
    flows,
    deployments,
    systems: [system],
    addresses: await loadAddresses(deployments, environmentId),
    environmentId,
    scopeKey: nodeKey(SCOPE_TYPES.INFORMATION_SYSTEM, system.id),
  };
}

/**
 * §10.1 System Context «в разрезе проекта»: граница проекта, информационные
 * системы, чьи модули участвуют в его потоках, и агрегированные связи между
 * системами (FR-002).
 */
function generateProjectSystemContext(ctx) {
  const project = ctx.object;
  const nodes = [];
  const edges = [];
  const boundaryKey = ctx.scopeKey;

  // Проект без потоков: узлов нет — граница без детей на клиенте не рисуется.
  if (ctx.systems.length === 0) return { nodes, edges };

  nodes.push(
    makeNode({
      id: boundaryKey,
      registryRef: { type: SCOPE_TYPES.PROJECT, id: project.id },
      c4Type: C4_TYPE.SYSTEM_BOUNDARY,
      name: project.name,
      description: project.description,
      style: { variant: 'boundary', code: project.code, status: project.status },
    }),
  );

  for (const system of ctx.systems) {
    nodes.push(
      makeNode({
        id: nodeKey('information_system', system.id),
        registryRef: { type: 'information_system', id: system.id },
        c4Type: C4_TYPE.SOFTWARE_SYSTEM,
        name: system.name,
        technology: 'information_system',
        description: system.description,
        parent: boundaryKey,
        style: { variant: 'primary', code: system.code, status: system.status },
      }),
    );
  }

  // Связи агрегируются между системами — как в System Context по ИС.
  const aggregated = new Map();
  for (const flow of ctx.flows) {
    if (!flow.source_system_id || !flow.target_system_id) continue;
    if (flow.source_system_id === flow.target_system_id) continue;
    const key = `${flow.source_system_id}->${flow.target_system_id}`;
    const current = aggregated.get(key) || {
      source: nodeKey('information_system', flow.source_system_id),
      target: nodeKey('information_system', flow.target_system_id),
      protocols: new Set(),
      count: 0,
    };
    current.count += 1;
    current.protocols.add(flowTechnology(flow));
    aggregated.set(key, current);
  }

  let index = 0;
  for (const item of aggregated.values()) {
    index += 1;
    edges.push(
      makeEdge({
        id: `agg:${index}`,
        source: item.source,
        target: item.target,
        label: `потоков: ${item.count}`,
        technology: Array.from(item.protocols).filter(Boolean).join(', '),
      }),
    );
  }

  return { nodes, edges };
}

/** §10.1 System Context: ИС — Software System, связи агрегируются между системами. */
async function generateSystemContext(ctx) {
  if (ctx.scopeType === SCOPE_TYPES.PROJECT) return generateProjectSystemContext(ctx);

  const system = ctx.object;
  const flows = ctx.flows;
  const nodes = [];
  const edges = [];

  const rootKey = nodeKey('information_system', system.id);
  nodes.push(
    makeNode({
      id: rootKey,
      registryRef: { type: 'information_system', id: system.id },
      c4Type: C4_TYPE.SOFTWARE_SYSTEM,
      name: system.name,
      technology: 'information_system',
      description: system.description,
      style: { variant: 'primary', status: system.status, code: system.code },
    }),
  );

  // Связанные системы и агрегированные связи между системами.
  const external = new Map();
  const aggregated = new Map();

  for (const flow of flows) {
    const sourceSystemId = flow.source_system_id;
    const targetSystemId = flow.target_system_id;
    if (sourceSystemId === targetSystemId) continue;

    for (const [sysId, code, name] of [
      [sourceSystemId, flow.source_code, flow.source_name],
      [targetSystemId, flow.target_code, flow.target_name],
    ]) {
      if (sysId === system.id || external.has(sysId)) continue;
      external.set(sysId, { code, name });
    }

    const key = `${sourceSystemId}->${targetSystemId}`;
    const current = aggregated.get(key) || {
      source: nodeKey('information_system', sourceSystemId),
      target: nodeKey('information_system', targetSystemId),
      protocols: new Set(),
      count: 0,
    };
    current.count += 1;
    current.protocols.add(flowTechnology(flow));
    aggregated.set(key, current);
  }

  for (const [sysId, info] of external) {
    nodes.push(
      makeNode({
        id: nodeKey('information_system', sysId),
        registryRef: { type: 'information_system', id: sysId },
        c4Type: C4_TYPE.SOFTWARE_SYSTEM,
        name: info.name,
        technology: 'external system',
        style: { variant: 'external', code: info.code },
      }),
    );
  }

  let index = 0;
  for (const item of aggregated.values()) {
    index += 1;
    const technologies = Array.from(item.protocols).filter(Boolean);
    edges.push(
      makeEdge({
        id: `agg:${index}`,
        source: item.source,
        target: item.target,
        label: `потоков: ${item.count}`,
        technology: technologies.join(', '),
      }),
    );
  }

  return { nodes, edges };
}

/**
 * §10.2 Container: application_module отображается как Container внутри границы.
 * Для схемы «в разрезе проекта» границей служит проект: в неё попадают все
 * модули, участвующие в потоках проекта, и все информационные потоки проекта
 * (FR-002).
 */
async function generateContainer(ctx) {
  const scope = ctx.object;
  const modules = ctx.modules;
  const flows = ctx.flows;
  const nodes = [];
  const edges = [];

  const boundaryKey = ctx.scopeKey;
  // Граница без детей не рисуется: её размер вычисляется по детям на клиенте.
  if (modules.length > 0) {
    nodes.push(
      makeNode({
        id: boundaryKey,
        registryRef: { type: ctx.scopeType, id: scope.id },
        c4Type: C4_TYPE.SYSTEM_BOUNDARY,
        name: scope.name,
        description: scope.description,
        style: { variant: 'boundary', code: scope.code, status: scope.status },
      }),
    );
  }

  const moduleIds = new Set(modules.map((m) => m.id));
  for (const module of modules) {
    nodes.push(
      makeNode({
        id: nodeKey('application_module', module.id),
        registryRef: { type: 'application_module', id: module.id },
        c4Type: C4_TYPE.CONTAINER,
        name: module.name,
        technology: module.module_type || 'Application',
        description: module.purpose,
        parent: boundaryKey,
        style: { variant: 'application', code: module.code, status: module.status },
      }),
    );
  }

  // Внешние системы подтягиваются только если в них есть участник потока.
  const externalSystems = new Map();
  const ensureExternal = (sysId, code, name) => {
    if (!sysId || externalSystems.has(sysId)) return;
    // ИС-область схемы не подтягивается как внешняя система.
    if (ctx.scopeType === SCOPE_TYPES.INFORMATION_SYSTEM && sysId === scope.id) return;
    externalSystems.set(sysId, true);
    nodes.push(
      makeNode({
        id: nodeKey('information_system', sysId),
        registryRef: { type: 'information_system', id: sysId },
        c4Type: C4_TYPE.SOFTWARE_SYSTEM,
        name: name || code,
        technology: 'external system',
        style: { variant: 'external', code },
      }),
    );
  };

  const seenEdges = new Set();
  for (const flow of flows) {
    const sourceInside = moduleIds.has(flow.source_id);
    const targetInside = moduleIds.has(flow.target_id);

    let sourceKey;
    let targetKey;
    if (sourceInside) {
      sourceKey = nodeKey('application_module', flow.source_id);
    } else {
      ensureExternal(flow.source_system_id, flow.source_code, flow.source_name);
      sourceKey = nodeKey('information_system', flow.source_system_id);
    }
    if (targetInside) {
      targetKey = nodeKey('application_module', flow.target_id);
    } else {
      ensureExternal(flow.target_system_id, flow.target_code, flow.target_name);
      targetKey = nodeKey('information_system', flow.target_system_id);
    }
    if (!sourceKey || !targetKey || sourceKey === targetKey) continue;

    const id = edgeKey(flow.id);
    if (seenEdges.has(id)) continue;
    seenEdges.add(id);

    edges.push(
      makeEdge({
        id,
        source: sourceKey,
        target: targetKey,
        registryRef: { type: 'information_flow', id: flow.id },
        label: flow.name || flow.code,
        technology: flowTechnology(flow),
      }),
    );
  }

  return { nodes, edges };
}

/**
 * §10.3 Deployment: environment — граница контура (срез схемы по среде),
 * server/cluster — Deployment Node, module_deployment — размещение экземпляра.
 *
 * Каждое размещение (module_deployment) отображается отдельным узлом, поэтому
 * экземпляр, развернутый на нескольких серверах, показывает адрес каждого
 * размещения; для экземпляров в кластере адресом служит адрес кластера.
 * Связи агрегируются из information_flow уровня модулей и подписываются
 * адресами: с какого адреса на какой выполняется поток.
 * Для проекта в схему попадают размещения модулей, участвующих в его потоках.
 */
async function generateDeployment(ctx) {
  const deployments = ctx.deployments;
  const flows = ctx.flows;
  const nodes = [];
  const edges = [];

  const environmentKeys = new Map();
  const ownerKeys = new Map();
  const modulePlacements = new Map();

  for (const d of deployments) {
    let envKey = environmentKeys.get(d.environment_id);
    if (!envKey) {
      envKey = nodeKey('environment', d.environment_id);
      environmentKeys.set(d.environment_id, envKey);
      nodes.push(
        makeNode({
          id: envKey,
          registryRef: { type: 'environment', id: d.environment_id },
          c4Type: C4_TYPE.ENVIRONMENT_BOUNDARY,
          name: d.environment_name,
          style: { variant: 'boundary', code: d.environment_code },
        }),
      );
    }

    const ownerType = d.server_id ? 'server' : 'cluster';
    const ownerId = d.server_id || d.cluster_id;
    const ownerAddresses = ctx.addresses?.get(ownerAddressKey(ownerType, ownerId)) || [];

    let ownerKey = ownerKeys.get(ownerId);
    if (!ownerKey) {
      ownerKey = nodeKey(ownerType, ownerId);
      ownerKeys.set(ownerId, ownerKey);
      nodes.push(
        makeNode({
          id: ownerKey,
          registryRef: { type: ownerType, id: ownerId },
          c4Type: C4_TYPE.DEPLOYMENT_NODE,
          name: d.server_name || d.cluster_name,
          technology:
            ownerType === 'cluster'
              ? `cluster · ${d.cluster_type || 'KUBERNETES'}`
              : 'server',
          // Адреса узла идут отдельным атрибутом (style.addresses), поэтому
          // описание не дублирует их в экспортируемых форматах (ТЗ §10.3).
          description: null,
          parent: envKey,
          style: {
            variant: 'infrastructure',
            status: d.server_status || d.cluster_status,
            // Адреса узла размещения: у сервера — интерфейсы, у кластера — адреса кластера
            addresses: ownerAddresses,
          },
        }),
      );
    }

    // Размещение экземпляра: своя запись module_deployment — свой адрес.
    const placementKey = nodeKey('module_deployment', d.id);
    nodes.push(
      makeNode({
        id: placementKey,
        registryRef: { type: 'module_deployment', id: d.id },
        c4Type: C4_TYPE.DEPLOYMENT_INSTANCE,
        name: d.instance_name,
        technology: d.module_code,
        description: d.module_name,
        parent: ownerKey,
        style: {
          variant: 'application',
          code: d.module_code,
          status: d.instance_status,
          role: d.deployment_role,
          instanceId: d.instance_id,
          environmentCode: d.environment_code,
          addresses: ownerAddresses,
        },
      }),
    );

    if (!modulePlacements.has(d.module_id)) modulePlacements.set(d.module_id, new Map());
    modulePlacements.get(d.module_id).set(d.id, { key: placementKey, addresses: ownerAddresses });
  }

  // Связи между размещениями агрегируются из information_flow уровня модулей,
  // подпись — адреса: «с какого адреса на какой» выполняется поток.
  const aggregated = new Map();
  for (const flow of flows) {
    const sources = modulePlacements.get(flow.source_id);
    const targets = modulePlacements.get(flow.target_id);
    if (!sources || !targets) continue;

    for (const [sourceDeploymentId, source] of sources) {
      for (const [targetDeploymentId, target] of targets) {
        if (source.key === target.key) continue;
        const key = `${sourceDeploymentId}->${targetDeploymentId}`;
        const item = aggregated.get(key) || {
          id: deploymentEdgeId(sourceDeploymentId, targetDeploymentId),
          source: source.key,
          target: target.key,
          count: 0,
          technologies: new Set(),
          pairs: new Set(),
          flowIds: [],
        };
        item.count += 1;
        item.technologies.add(flowTechnology(flow));
        item.flowIds.push(flow.id);
        const pair = addressPairText(
          source.addresses,
          flow.source_port || flow.default_port,
          target.addresses,
          flow.target_port || flow.default_port,
        );
        if (pair) item.pairs.add(pair);
        aggregated.set(key, item);
      }
    }
  }

  for (const item of aggregated.values()) {
    const pairs = Array.from(item.pairs);
    const label =
      pairs.length === 0
        ? `потоков: ${item.count}`
        : `${pairs.slice(0, 2).join(' · ')}${pairs.length > 2 ? ` +${pairs.length - 2}` : ''}`;
    edges.push(
      makeEdge({
        id: item.id,
        source: item.source,
        target: item.target,
        // Ссылка на поток сохраняется, только если связь не агрегирует несколько потоков.
        registryRef:
          item.flowIds.length === 1 ? { type: 'information_flow', id: item.flowIds[0] } : null,
        label,
        technology: Array.from(item.technologies).filter(Boolean).join(', '),
      }),
    );
  }

  return { nodes, edges };
}

const GENERATORS = {
  SYSTEM_CONTEXT: generateSystemContext,
  CONTAINER: generateContainer,
  DEPLOYMENT: generateDeployment,
};

/**
 * Генерация внутренней графовой модели схемы (ТЗ §13).
 * mode=REBUILD — полная перестройка, включая layout;
 * mode=SYNC — сохраняет существующие позиции, обновляет состав и атрибуты.
 * scopeType — область схемы: information_system (по умолчанию) или project.
 */
export async function generateGraph({
  diagramType,
  scopeId,
  scopeType = SCOPE_TYPES.INFORMATION_SYSTEM,
  environmentId = null,
  mode = 'REBUILD',
  existingPositions = null,
}) {
  const generator = GENERATORS[diagramType];
  if (!generator) {
    throw Object.assign(new Error(`Unsupported diagramType: ${diagramType}`), { status: 400 });
  }
  if (!scopeId) {
    throw Object.assign(new Error('scopeObjectId is required for generation'), { status: 400 });
  }
  if (!Object.values(SCOPE_TYPES).includes(scopeType)) {
    throw Object.assign(new Error(`Unsupported scopeType: ${scopeType}`), { status: 400 });
  }

  const ctx = await loadScope(scopeType, scopeId, { environmentId });
  const { nodes, edges } = await generator(ctx);
  // Раскладка возвращает узлы: для схемы развертывания состав узлов нормализуется
  // (экземпляры оказываются внутри рамки своего узла размещения, ТЗ §10.3).
  const laidOutNodes = applyLayout(nodes, edges, mode === 'SYNC' ? existingPositions : null);

  return {
    schemaVersion: '1.0',
    diagram: {
      type: diagramType.toLowerCase(),
      scope: { objectType: scopeType, objectId: scopeId },
    },
    nodes: laidOutNodes,
    edges,
  };
}

export { applyLayout };


