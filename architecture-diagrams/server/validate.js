import pool from './db.js';
import {
  CONTAINER_HEADER,
  CONTAINER_PADDING,
  containerChildren,
  isContainerNode,
} from './layout.js';

/**
 * Валидация схемы (ТЗ §17).
 * Проверки выполняются на backend — UI не должен строить бизнес-логику
 * на парсинге свободных названий (ТЗ §12).
 */

const REGISTRY_TABLE = {
  information_system: 'information_system',
  application_module: 'application_module',
  module_instance: 'module_instance',
  module_deployment: 'module_deployment',
  server: 'server',
  cluster: 'cluster',
  environment: 'environment',
  network_zone: 'network_zone',
  network_segment: 'network_segment',
  information_flow: 'information_flow',
  protocol: 'protocol',
  project: 'project',
};

/** Соответствие типа реестрового объекта и C4-типа (ТЗ §6). */
const C4_EXPECTED = {
  information_system: ['SoftwareSystem', 'SystemBoundary'],
  application_module: ['Container'],
  module_instance: ['DeploymentInstance'],
  // Размещение экземпляра (module_deployment) — узел Deployment Instance:
  // именно размещение несет сетевой адрес развертывания (ТЗ §10.3).
  module_deployment: ['DeploymentInstance'],
  server: ['DeploymentNode'],
  cluster: ['DeploymentNode'],
  environment: ['EnvironmentBoundary'],
  information_flow: ['Relationship'],
  // Проект — область схемы «в разрезе проекта»: отображается как граница.
  project: ['SystemBoundary'],
};

const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/**
 * Колонка состояния объекта, если она отличается от `status`.
 * У размещения экземпляра (module_deployment) роль состояния играет
 * deployment_state — CHECK-значения совпадают с реестровыми статусами.
 */
const REGISTRY_STATE_COLUMN = {
  module_deployment: 'deployment_state',
};

/** Массовая проверка существования и статуса реестровых объектов. */
async function loadRegistryObjects(refs) {
  const byType = new Map();
  for (const ref of refs) {
    if (!ref || !REGISTRY_TABLE[ref.type] || !isUuid(ref.id)) continue;
    if (!byType.has(ref.type)) byType.set(ref.type, new Set());
    byType.get(ref.type).add(ref.id);
  }

  const result = new Map();
  for (const [type, ids] of byType) {
    const stateColumn = REGISTRY_STATE_COLUMN[type] || 'status';
    const { rows } = await pool.query(
      `SELECT id, ${stateColumn} AS status FROM ${REGISTRY_TABLE[type]} WHERE id = ANY($1::uuid[])`,
      [Array.from(ids)],
    );
    for (const row of rows) result.set(`${type}:${row.id}`, row);
  }
  return result;
}

/** Детали потоков (протокол и его статус) для проверок §17. */
async function loadFlows(flowIds) {
  const ids = flowIds.filter(isUuid);
  if (ids.length === 0) return new Map();
  const { rows } = await pool.query(
    `SELECT fl.id, fl.status, fl.target_port, fl.source_port,
            fl.source_module_id, fl.target_module_id,
            p.status AS protocol_status, p.code AS protocol_code
     FROM information_flow fl
     LEFT JOIN protocol p ON p.id = fl.protocol_id
     WHERE fl.id = ANY($1::uuid[])`,
    [ids],
  );
  return new Map(rows.map((row) => [row.id, row]));
}

/** Проверка иерархии parent на циклы (ТЗ §17, п. 9). */
function findParentCycles(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cycles = [];
  for (const node of nodes) {
    const path = new Set();
    let current = node;
    let guard = 0;
    while (current && guard < 1000) {
      if (path.has(current.id)) {
        cycles.push(node.id);
        break;
      }
      path.add(current.id);
      current = current.parent ? byId.get(current.parent) : null;
      guard += 1;
    }
  }
  return Array.from(new Set(cycles));
}

/**
 * @param {{nodes:Array,edges:Array}} graph внутренняя графовая модель
 * @param {{published?:boolean}} options схема уже опубликована?
 */
export async function validateGraph(graph, options = {}) {
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const issues = [];

  const add = (severity, code, message, extra = {}) =>
    issues.push({ severity, code, message, ...extra });

  const nodeIds = new Set(nodes.map((n) => n.id));

  // 3. source/target каждого edge существуют.
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      add('ERROR', 'EDGE_ENDPOINT_MISSING', `Связь ${edge.id} имеет несуществующий узел`, {
        edgeId: edge.id,
      });
    }
    if (edge.source === edge.target) {
      add('WARNING', 'EDGE_SELF_LOOP', `Связь ${edge.id} соединяет узел сам с собой`, {
        edgeId: edge.id,
      });
    }
  }

  // 9. parent hierarchy не содержит циклов.
  for (const nodeId of findParentCycles(nodes)) {
    add('ERROR', 'PARENT_CYCLE', `Обнаружен цикл в иерархии узла ${nodeId}`, { nodeId });
  }

  const refs = [
    ...nodes.map((n) => n.registryRef).filter(Boolean),
    ...edges.map((e) => e.registryRef).filter(Boolean),
  ];
  const objects = await loadRegistryObjects(refs);
  const flows = await loadFlows(
    edges
      .map((e) => (e.registryRef?.type === 'information_flow' ? e.registryRef.id : null))
      .filter(Boolean),
  );

  // 1. registry reference существует и доступна; 2. соответствие C4-типу.
  for (const node of nodes) {
    const ref = node.registryRef;
    if (!ref) {
      add('INFO', 'FREE_ELEMENT', `Узел «${node.name}» не связан с объектом реестра`, {
        nodeId: node.id,
      });
      continue;
    }
    if (!REGISTRY_TABLE[ref.type]) {
      add('ERROR', 'UNKNOWN_REGISTRY_TYPE', `Неизвестный тип реестрового объекта: ${ref.type}`, {
        nodeId: node.id,
      });
      continue;
    }
    const object = objects.get(`${ref.type}:${ref.id}`);
    if (!object) {
      add('ERROR', 'REGISTRY_OBJECT_MISSING', `Объект реестра ${ref.type}/${ref.id} не найден`, {
        nodeId: node.id,
        registryRef: ref,
      });
      continue;
    }
    if (object.status === 'RETIRED') {
      add(
        options.published ? 'ERROR' : 'WARNING',
        'REGISTRY_OBJECT_RETIRED',
        `Объект «${node.name}» выведен из эксплуатации`,
        { nodeId: node.id, registryRef: ref },
      );
    }
    const expected = C4_EXPECTED[ref.type];
    if (expected && !expected.includes(node.c4Type)) {
      add('ERROR', 'C4_TYPE_MISMATCH', `C4 type ${node.c4Type} не соответствует ${ref.type}`, {
        nodeId: node.id,
        registryRef: ref,
      });
    }
  }

  // 4-8. Проверки потоков: существование, статус, порты, протокол, loopback.
  for (const edge of edges) {
    const ref = edge.registryRef;
    if (!ref || ref.type !== 'information_flow') {
      if (!ref) {
        add('INFO', 'FREE_RELATIONSHIP', `Связь ${edge.id} не связана с information_flow`, {
          edgeId: edge.id,
        });
      }
      continue;
    }
    const flow = flows.get(ref.id);
    if (!flow) {
      add('ERROR', 'FLOW_MISSING', `Поток ${ref.id} не найден в реестре`, {
        edgeId: edge.id,
        registryRef: ref,
      });
      continue;
    }
    if (options.published && flow.status === 'RETIRED') {
      add('ERROR', 'FLOW_RETIRED', `Поток ${ref.id} закрыт, схема опубликована`, { edgeId: edge.id });
    }
    for (const [field, value] of [
      ['target_port', flow.target_port],
      ['source_port', flow.source_port],
    ]) {
      if (value != null && (value < 1 || value > 65535)) {
        add('ERROR', 'PORT_OUT_OF_RANGE', `${field}=${value} вне диапазона 1..65535`, {
          edgeId: edge.id,
        });
      }
    }
    if (flow.protocol_status && flow.protocol_status !== 'ACTIVE') {
      add('WARNING', 'PROTOCOL_INACTIVE', `Протокол ${flow.protocol_code} не активен`, {
        edgeId: edge.id,
      });
    }
    if (flow.source_module_id === flow.target_module_id) {
      add('WARNING', 'LOOPBACK_FLOW', `Поток ${ref.id} замкнут на один модуль`, {
        edgeId: edge.id,
      });
    }
  }

  // Изолированные узлы — информационное сообщение (ТЗ §17, класс INFO).
  const usedNodes = new Set();
  for (const edge of edges) {
    usedNodes.add(edge.source);
    usedNodes.add(edge.target);
  }
  for (const node of nodes) {
    if (node.c4Type === 'SystemBoundary' || node.c4Type === 'EnvironmentBoundary') continue;
    if (!usedNodes.has(node.id)) {
      add('INFO', 'ORPHAN_NODE', `Узел «${node.name}» не участвует ни в одной связи`, {
        nodeId: node.id,
      });
    }
  }

  // 10-12. Схема развертывания: адреса размещений и срез по среде (ТЗ §10.3).
  // Диаграмма развертывания показывает, с какого адреса на какой выполняется
  // поток, поэтому отсутствие адреса у узла размещения — предупреждение.
  if (String(graph.diagram?.type || '').toUpperCase() === 'DEPLOYMENT') {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const sliceEnvironmentId = graph.diagram?.scope?.environmentId || null;

    /** Ближайшая граница среды в цепочке parent — среда размещения. */
    const environmentOf = (node) => {
      let current = node.parent ? byId.get(node.parent) : null;
      let guard = 0;
      while (current && guard < 100) {
        if (current.c4Type === 'EnvironmentBoundary') return current.registryRef?.id || null;
        current = current.parent ? byId.get(current.parent) : null;
        guard += 1;
      }
      return null;
    };

    for (const node of nodes) {
      if (node.c4Type !== 'DeploymentNode' && node.c4Type !== 'DeploymentInstance') continue;
      const addresses = Array.isArray(node.style?.addresses) ? node.style.addresses : [];
      if (addresses.length === 0) {
        add(
          'WARNING',
          'DEPLOYMENT_ADDRESS_MISSING',
          `Узел «${node.name}» не имеет сетевого адреса развертывания`,
          { nodeId: node.id },
        );
      }
      if (node.c4Type === 'DeploymentInstance' && sliceEnvironmentId) {
        const nodeEnvironmentId = environmentOf(node);
        if (nodeEnvironmentId && nodeEnvironmentId !== sliceEnvironmentId) {
          add(
            'ERROR',
            'ENVIRONMENT_SLICE_MISMATCH',
            `Размещение «${node.name}» относится к другой среде, чем срез схемы`,
            { nodeId: node.id },
          );
        }
      }
    }

    // Инвариант схемы развертывания (ТЗ §10.3): экземпляр модуля находится внутри
    // рамки своего узла размещения. Нарушение означает, что состав узла не
    // согласован с рамкой — схему нужно перестроить автогенерацией.
    for (const node of nodes) {
      if (node.c4Type !== 'DeploymentInstance') continue;
      const parent = node.parent ? byId.get(node.parent) : null;
      if (!parent) {
        add(
          'WARNING',
          'INSTANCE_WITHOUT_NODE',
          `Экземпляр «${node.name}» не размещён на узле размещения`,
          { nodeId: node.id },
        );
        continue;
      }
      if (!isContainerNode(parent)) continue;

      const frame = {
        x: parent.position.x,
        y: parent.position.y,
        width: parent.size?.width ?? 0,
        height: parent.size?.height ?? 0,
      };
      const tolerance = 2;
      const outside =
        node.position.x < frame.x + CONTAINER_PADDING - tolerance ||
        node.position.y < frame.y + CONTAINER_HEADER - tolerance ||
        node.position.x + (node.size?.width ?? 0) >
          frame.x + frame.width - CONTAINER_PADDING + tolerance ||
        node.position.y + (node.size?.height ?? 0) >
          frame.y + frame.height - CONTAINER_PADDING + tolerance;

      if (outside) {
        add(
          'WARNING',
          'INSTANCE_OUTSIDE_NODE',
          `Экземпляр «${node.name}» выходит за рамку узла размещения «${parent.name}»`,
          { nodeId: node.id },
        );
      }

      // Рамка узла должна быть растянута под состав: иначе узел не «расширяется»
      // под свои экземпляры и схема читается неверно.
      const frameRequired = containerChildren(parent, nodes).length > 0;
      if (frameRequired && frame.height < CONTAINER_HEADER + CONTAINER_PADDING * 2) {
        add(
          'INFO',
          'NODE_FRAME_COLLAPSED',
          `Рамка узла «${parent.name}» не растянута под состав экземпляров`,
          { nodeId: parent.id },
        );
      }
    }

    // Подпись связи схемы развертывания — адреса: «с какого адреса на какой».
    for (const edge of edges) {
      if (!String(edge.label || '').includes('→')) {
        add('WARNING', 'EDGE_ADDRESS_UNRESOLVED', `У связи ${edge.id} не определены адреса`, {
          edgeId: edge.id,
        });
      }
    }
  }

  const summary = {
    errors: issues.filter((i) => i.severity === 'ERROR').length,
    warnings: issues.filter((i) => i.severity === 'WARNING').length,
    infos: issues.filter((i) => i.severity === 'INFO').length,
  };

  return {
    checkedAt: new Date().toISOString(),
    summary,
    /** ERROR блокирует публикацию (ТЗ §17, §27). */
    canPublish: summary.errors === 0,
    issues,
  };
}

