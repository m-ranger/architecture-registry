import {
  getInformationSystem,
  getSystemFlows,
  getProject,
  getProjectFlows,
  getSystemsOfModules,
  getModuleDeployments,
  ownerAddressKey,
} from './registry.js';
import { loadAddresses, flowDeploymentEdges, flowTechnology, preferredAddress } from './graph.js';

/**
 * Состав потоков области схемы — данные панели «Потоки области» в редакторе.
 *
 * Панель показывает все потоки области (проекта или информационной системы) и
 * отмечает, какие из них отражены на схеме развертывания. Связь схемы строится
 * между размещениями сторон потока в выбранной среде схемы (ADR-026), поэтому
 * поток, у которого сторона не развёрнута в этой среде, остаётся в списке со
 * статусом «не развёрнут» и причиной — иначе он был бы не виден нигде
 * (ТЗ §10.3, §17). Контуром схемы остаётся сетевой сегмент узла размещения
 * (ADR-025).
 */

const ipOf = (address) => (address ? String(address.ip_address || '').replace(/\/\d+$/, '') : null);

/** Список адресов узла размещения одной строкой (для подсказки панели). */
function placementAddress(deployment, addresses) {
  const ownerType = deployment.server_id ? 'server' : 'cluster';
  const ownerId = deployment.server_id || deployment.cluster_id;
  const list = addresses.get(ownerAddressKey(ownerType, ownerId)) || [];
  const best = preferredAddress(list);
  return {
    nodeType: ownerType,
    nodeName: deployment.server_name || deployment.cluster_name || null,
    address: ipOf(best),
    addressRole: best?.address_role || null,
    addressCount: list.length,
    addressText: list.map((item) => ipOf(item)).filter(Boolean).join(', '),
  };
}

/** Причина, по которой поток не отражён на схеме развертывания. */
function missingReason(source, target) {
  const title = (value) => `${value.systemCode ? `${value.systemCode}/` : ''}${value.moduleCode}`;

  if (source.placements.length === 0 && target.placements.length === 0) {
    return 'Ни одна сторона потока не развёрнута в среде схемы: у модулей нет действующих размещений';
  }
  const missing = source.placements.length === 0 ? source : target;
  return `Контрагент не развёрнут в среде схемы: у модуля ${title(missing)} нет действующего размещения`;
}

/**
 * Описание потоков области схемы: стороны, их размещения и связи схемы.
 * @param {object} diagram карточка схемы (scopeType, scopeObjectId)
 * @param {object} graph   сохранённый граф схемы — для списка существующих связей
 */
export async function describeScopeFlows(diagram, graph) {
  const scopeType = String(diagram.scopeType || 'information_system');
  const scopeId = diagram.scopeObjectId || null;

  const scope = {
    type: scopeType,
    id: scopeId,
    name: null,
    code: null,
    // Среда схемы развертывания: размещения сторон ищутся только в ней (ADR-026).
    environmentId: diagram.scopeEnvironmentId || null,
    environmentCode: diagram.environmentCode || null,
  };

  let flows = [];
  if (scopeId) {
    if (scopeType === 'project') {
      const project = await getProject(scopeId);
      scope.name = project?.name || null;
      scope.code = project?.code || null;
      flows = await getProjectFlows(scopeId);
    } else {
      const system = await getInformationSystem(scopeId);
      scope.name = system?.name || null;
      scope.code = system?.code || null;
      flows = await getSystemFlows(scopeId);
    }
  }

  const moduleIds = [...new Set(flows.flatMap((flow) => [flow.source_id, flow.target_id]))];
  const systems = await getSystemsOfModules(moduleIds);
  const systemById = new Map(systems.map((system) => [system.id, system]));

  // Размещения сторон и адреса узлов: server/cluster -> network_interface.
  // Состав ограничен средой схемы: панель показывает развёрнутость сторон именно
  // в этой среде (ADR-026).
  const deployments = await getModuleDeployments(moduleIds, 'ACTIVE', diagram.scopeEnvironmentId || null);
  const addresses = await loadAddresses(deployments);

  const placementsByModule = new Map();
  for (const deployment of deployments) {
    if (!placementsByModule.has(deployment.module_id)) placementsByModule.set(deployment.module_id, []);
    placementsByModule.get(deployment.module_id).push({
      deploymentId: deployment.id,
      instanceId: deployment.instance_id,
      instanceName: deployment.instance_name,
      environmentId: deployment.environment_id,
      environmentCode: deployment.environment_code,
      environmentName: deployment.environment_name,
      role: deployment.deployment_role,
      state: deployment.deployment_state,
      ...placementAddress(deployment, addresses),
    });
  }

  // Связи, которые образует каждый поток на схеме (алгоритм генератора схемы).
  const flowEdges = flowDeploymentEdges(deployments, flows);
  const graphEdges = new Set(((graph && graph.edges) || []).map((edge) => edge.id));

  const sideOf = (flow, prefix) => ({
    moduleId: flow[`${prefix}_id`],
    moduleCode: flow[`${prefix}_code`],
    moduleName: flow[`${prefix}_name`],
    systemId: flow[`${prefix}_system_id`] || null,
    systemCode: systemById.get(flow[`${prefix}_system_id`])?.code || null,
    systemName: systemById.get(flow[`${prefix}_system_id`])?.name || null,
    placements: placementsByModule.get(flow[`${prefix}_id`]) || [],
  });

  const items = flows.map((flow) => {
    const detected = flowEdges.get(flow.id) || [];
    const onCanvas = detected.filter((edgeId) => graphEdges.has(edgeId));
    const source = sideOf(flow, 'source');
    const target = sideOf(flow, 'target');
    // Обе стороны развёрнуты в среде схемы: у каждой есть действующее размещение,
    // поэтому связь между размещениями существует и поток попадает на схему.
    const deployed = detected.length > 0;

    return {
      id: flow.id,
      code: flow.code,
      name: flow.name,
      status: flow.status,
      technology: flowTechnology(flow) || null,
      protocolCode: flow.protocol_code || null,
      sourcePort: flow.source_port || flow.default_port || null,
      targetPort: flow.target_port || flow.default_port || null,
      source,
      target,
      /** Обе стороны потока развёрнуты в среде схемы (ADR-026). */
      deployed,
      /** Связи потока, присутствующие в графе схемы (можно показать на canvas). */
      edgeIds: onCanvas,
      /** Причина, по которой поток не отражён на схеме. */
      reason: deployed
        ? onCanvas.length === 0
          ? 'Связь удалена со схемы: выполните синхронизацию с реестром'
          : null
        : missingReason(source, target),
    };
  });

  return {
    scope,
    flows: items,
    summary: {
      total: items.length,
      deployed: items.filter((item) => item.deployed).length,
      notDeployed: items.filter((item) => !item.deployed).length,
      onCanvas: items.filter((item) => item.edgeIds.length > 0).length,
    },
  };
}
