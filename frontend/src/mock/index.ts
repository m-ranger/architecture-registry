// Единая точка доступа к мок-данным + справочные функции для страниц.
// Файлы data*.ts разделены только из-за ограничения размера редактора.
import type {
  InformationSystem, ApplicationModule, ModuleInstance, Server, Cluster, ModuleDeployment,
  NetworkZone, NetworkSegment, NetworkInterface, Router, Firewall, Protocol, InformationFlow,
} from '../types'
import { informationSystems, environments, modules, servers, clusters } from './data'
import { moduleInstances, deployments } from './data2'
import { networkZones, networkSegments, networkInterfaces } from './data3'
import { routers, firewalls, protocols, informationFlows, auditEntries } from './data4'

export * from './data'
export * from './data2'
export * from './data3'
export * from './data4'

export const db = {
  informationSystems, environments, modules, moduleInstances, servers, clusters,
  deployments, networkZones, networkSegments, networkInterfaces, routers, firewalls,
  protocols, informationFlows, auditEntries,
}

export const byId = <T extends { id: string }>(arr: T[]) =>
  (id?: string | null): T | undefined => (id ? arr.find((x) => x.id === id) : undefined)

export const getIs = byId(informationSystems)
export const getModule = byId(modules)
export const getEnv = byId(environments)
export const getInstance = byId(moduleInstances)
export const getServer = byId(servers)
export const getCluster = byId(clusters)
export const getZone = byId(networkZones)
export const getSegment = byId(networkSegments)
export const getProtocol = byId(protocols)
export const getFlow = byId(informationFlows)

// Полное имя модуля с префиксом ИС — для читаемых заголовков и схем
export const moduleLabel = (m?: ApplicationModule) =>
  m ? `${getIs(m.informationSystemId)?.code ?? '?'} / ${m.code}` : '—'

export const instanceLabel = (i?: ModuleInstance) => i?.name ?? '—'

/** Все экземпляры модуля (REQ-022) */
export const instancesOfModule = (moduleId: string) => moduleInstances.filter((i) => i.moduleId === moduleId)

/** Все размещения экземпляра (REQ-023) */
export const deploymentsOfInstance = (instanceId: string) => deployments.filter((d) => d.moduleInstanceId === instanceId)

/** Размещения, задействующие сервер (REQ-024) */
export const deploymentsOnServer = (serverId: string) => deployments.filter((d) => d.serverId === serverId)

/** Объекты, подключенные к сегменту (REQ-025) */
export const interfacesInSegment = (segmentId: string) => networkInterfaces.filter((n) => n.networkSegmentId === segmentId)

/** Сегменты зоны (REQ-026) */
export const segmentsInZone = (zoneId: string) => networkSegments.filter((s) => s.networkZoneId === zoneId)

/** Исходящие потоки модуля (REQ-021) */
export const outgoingFlows = (moduleId: string) => informationFlows.filter((f) => f.sourceModuleId === moduleId)

/** Входящие потоки модуля (REQ-021) */
export const incomingFlows = (moduleId: string) => informationFlows.filter((f) => f.targetModuleId === moduleId)

/** Владелец сетевого интерфейса: ровно один из server/router/firewall (раздел 6.10) */
export function nicOwner(nic: NetworkInterface): { kind: 'server' | 'router' | 'firewall'; name: string } {
  if (nic.serverId) return { kind: 'server', name: getServer(nic.serverId)?.name ?? '—' }
  if (nic.routerId) return { kind: 'router', name: routers.find((r) => r.id === nic.routerId)?.name ?? '—' }
  if (nic.firewallId) return { kind: 'firewall', name: firewalls.find((f) => f.id === nic.firewallId)?.name ?? '—' }
  return { kind: 'server', name: '—' }
}

/** Куда размещён экземпляр: сервер ИЛИ кластер (раздел 10, XOR) */
export function deploymentTarget(d: ModuleDeployment): string {
  if (d.serverId) return getServer(d.serverId)?.name ?? '—'
  if (d.clusterId) return getCluster(d.clusterId)?.name ?? '—'
  return '—'
}

export const flowsByProtocol = () =>
  protocols.map((p) => ({ protocol: p, flows: informationFlows.filter((f) => f.protocolId === p.id) }))
