import {
  getInformationSystem,
  getSystemFlows,
  getProject,
  getProjectFlows,
  getSystemsOfModules,
  getModuleDeployments,
  getEnvironment,
  ownerAddressKey,
} from './registry.js';
import { loadAddresses, flowDeploymentEdges, flowTechnology, preferredAddress } from './graph.js';

/**
 * Состав потоков области схемы — данные панели «Потоки области» в редакторе.
 *
 * Панель показывает все потоки области (проекта или информационной системы) и
 * отмечает, какие из них отражены на схеме развертывания. Связи на canvas, как и
 * прежде, строятся только между размещениями выбранного среза по среде, поэтому
 * поток, у которого контрагент не развернут в срезе, остаётся в списке со
 * статусом «вне среза» и причиной — иначе он был бы не виден нигде (ТЗ §10.3,
 * §17; вариант «связи только в срезе + панель потоков области»).
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
function missingReason(source, target, environmentCode) {
  const environment = environmentCode ? `среде ${environmentCode}` : 'ни одной среде';
  const title = (value) => `${value.systemCode ? `${value.systemCode}/` : ''}${value.moduleCode}`;

  if (source.placements.length === 0 && target.placements.length === 0) {
    return `Ни одна сторона не развернута в ${environment}`;
  }
  const missing = source.placements.length === 0 ? source : target;
  return `Контрагент не развернут в ${environment}: ${title(missing)}`;
}

/**
 * Описание потоков области схемы: стороны, их размещения в срезе и связи схемы.
 * @param {object} diagram карточка схемы (scopeType, scopeObjectId, scopeEnvironmentId)
 * @param {object} graph   сохранённый граф схемы — для списка существующих связей
 */
export async function describeScopeFlows(diagram, graph) {
  const scopeType = String(diagram.scopeType || 'information_system');
  const scopeId = diagram.scopeObjectId || null;
  const environmentId = diagram.scopeEnvironmentId || null;
  const environment = environmentId ? await getEnvironment(environmentId) : null;

  const scope = {
    type: scopeType,
    id: scopeId,
    name: null,
    code: null,
    environmentId,
    environmentCode: environment?.code || null,
    environmentName: environment?.name || null,
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

  // Размещения сторон в срезе и адреса узлов: server/cluster -> network_interface.
  const deployments = await getModuleDeployments(moduleIds, 'ACTIVE', environmentId);
  const addresses = await loadAddresses(deployments, environmentId);

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

  // Связи, которые образует каждый поток в срезе (алгоритм генератора схемы).
  const sliceEdges = flowDeploymentEdges(deployments, flows);
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
    const detected = sliceEdges.get(flow.id) || [];
    const onCanvas = detected.filter((edgeId) => graphEdges.has(edgeId));
    const source = sideOf(flow, 'source');
    const target = sideOf(flow, 'target');
    const inSlice = detected.length > 0;

    return {
      id: flow.id,
      code: flow.code,
      name: flow.name,
      status: flow.status,
      technology: flowTechnology(flow) || null,
      protocolCode: flow.protocol_code || null,
      source,
      target,
      /** Поток развернут в срезе: размещения обеих сторон есть в выбранной среде. */
      inSlice,
      /** Связи потока, присутствующие в графе схемы (можно показать на canvas). */
      edgeIds: onCanvas,
      /** Причина, по которой поток не отражён на схеме. */
      reason: inSlice
        ? onCanvas.length === 0
          ? 'Связь удалена со схемы: выполните синхронизацию с реестром'
          : null
        : missingReason(source, target, scope.environmentCode),
    };
  });

  return {
    scope,
    flows: items,
    summary: {
      total: items.length,
      inSlice: items.filter((item) => item.inSlice).length,
      outOfSlice: items.filter((item) => !item.inSlice).length,
      onCanvas: items.filter((item) => item.edgeIds.length > 0).length,
    },
  };
}
