import { api, createApiClient, snakeKey } from './client'
import { DIAGRAMS_API_BASE } from '../utils/externalLinks'
import type {
  InformationSystem,
  Environment,
  ApplicationModule,
  Server,
  Cluster,
  ModuleInstance,
  ModuleDeployment,
  NetworkZone,
  NetworkSegment,
  Router,
  Firewall,
  NetworkInterface,
  Protocol,
  InformationFlow,
  Project,
  AuditEntry,
  DiagramListItem,
  DiagramType,
  NetworkInteractionReport,
  FlowMatrixReport,
} from '../types'

// Entity API modules — GET /api/{endpoint} for list operations
/** Тело запроса на создание ИС (camelCase → snake_case выполняется в client.ts) */
export interface InformationSystemInput {
  code: string
  name: string
  status: InformationSystem['status']
  owner?: string
  description?: string
}

/** Тело запроса на создание модуля */
export interface ApplicationModuleInput {
  informationSystemId: string
  code: string
  name: string
  purpose: string
  moduleType?: string
  version?: string
  status: ApplicationModule['status']
}

export const informationSystemsApi = {
  getAll: () => api.get<InformationSystem[]>('/information-systems'),
  create: (payload: InformationSystemInput) => api.post<InformationSystem>('/information-systems', payload),
  update: (id: string, payload: InformationSystemInput) => api.put<InformationSystem>(`/information-systems/${id}`, payload),
}

/** Тело запроса на создание проекта (реестровый объект «Проект») */
export interface ProjectInput {
  /** Номер проекта */
  code: string
  /** Наименование */
  name: string
  description?: string
  status: Project['status']
}

export const projectsApi = {
  getAll: () => api.get<Project[]>('/projects'),
  /** Информационные потоки, задействованные в проекте (1:N) */
  getFlows: (id: string) => api.get<InformationFlow[]>(`/projects/${id}/flows`),
  create: (payload: ProjectInput) => api.post<Project>('/projects', payload),
  update: (id: string, payload: ProjectInput) => api.put<Project>(`/projects/${id}`, payload),
}

/** Тело запроса на создание среды эксплуатации */
export interface EnvironmentInput {
  code: string
  name: string
  description?: string
  criticality?: string
  status: Environment['status']
}

export const environmentsApi = {
  getAll: () => api.get<Environment[]>('/environments'),
  create: (payload: EnvironmentInput) => api.post<Environment>('/environments', payload),
  update: (id: string, payload: EnvironmentInput) => api.put<Environment>(`/environments/${id}`, payload),
}

export const modulesApi = {
  getAll: () => api.get<ApplicationModule[]>('/modules'),
  create: (payload: ApplicationModuleInput) => api.post<ApplicationModule>('/modules', payload),
  update: (id: string, payload: ApplicationModuleInput) => api.put<ApplicationModule>(`/modules/${id}`, payload),
}

/** Тело запроса на создание сервера */
export interface ServerInput {
  name: string
  serverType?: string
  status: Server['status']
  description?: string
}

export const serversApi = {
  getAll: () => api.get<Server[]>('/servers'),
  create: (payload: ServerInput) => api.post<Server>('/servers', payload),
  update: (id: string, payload: ServerInput) => api.put<Server>(`/servers/${id}`, payload),
}

/** Тело запроса на создание кластера */
export interface ClusterInput {
  name: string
  clusterType: string
  version?: string
  managementAddress?: string
  status: Cluster['status']
  description?: string
}

export const clustersApi = {
  getAll: () => api.get<Cluster[]>('/clusters'),
  create: (payload: ClusterInput) => api.post<Cluster>('/clusters', payload),
  update: (id: string, payload: ClusterInput) => api.put<Cluster>(`/clusters/${id}`, payload),
}

/** Тело запроса на создание экземпляра модуля */
export interface ModuleInstanceInput {
  moduleId: string
  environmentId: string
  name: string
  version?: string
  runtimeType?: string
  status: ModuleInstance['status']
  description?: string
}

export const instancesApi = {
  getAll: () => api.get<ModuleInstance[]>('/instances'),
  create: (payload: ModuleInstanceInput) => api.post<ModuleInstance>('/instances', payload),
  update: (id: string, payload: ModuleInstanceInput) => api.put<ModuleInstance>(`/instances/${id}`, payload),
}

/** Тело запроса на создание размещения (ровно одна цель: serverId XOR clusterId) */
export interface ModuleDeploymentInput {
  moduleInstanceId: string
  serverId?: string
  clusterId?: string
  deploymentRole?: string
  deploymentState: ModuleDeployment['deploymentState']
  validFrom?: string
  validTo?: string
}

export const deploymentsApi = {
  getAll: () => api.get<ModuleDeployment[]>('/deployments'),
  create: (payload: ModuleDeploymentInput) => api.post<ModuleDeployment>('/deployments', payload),
  update: (id: string, payload: ModuleDeploymentInput) => api.put<ModuleDeployment>(`/deployments/${id}`, payload),
}

/** Тело запроса на создание сетевой зоны */
export interface NetworkZoneInput {
  code: string
  name: string
  zoneType?: string
  securityLevel?: string
  parentId?: string
  description?: string
  status: NetworkZone['status']
}

export const zonesApi = {
  getAll: () => api.get<NetworkZone[]>('/zones'),
  create: (payload: NetworkZoneInput) => api.post<NetworkZone>('/zones', payload),
  update: (id: string, payload: NetworkZoneInput) => api.put<NetworkZone>(`/zones/${id}`, payload),
}

/** Тело запроса на создание сетевого сегмента */
export interface NetworkSegmentInput {
  networkZoneId: string
  code: string
  name: string
  cidr?: string
  vlan?: number
  purpose?: string
  status: NetworkSegment['status']
}

export const segmentsApi = {
  getAll: () => api.get<NetworkSegment[]>('/segments'),
  create: (payload: NetworkSegmentInput) => api.post<NetworkSegment>('/segments', payload),
  update: (id: string, payload: NetworkSegmentInput) => api.put<NetworkSegment>(`/segments/${id}`, payload),
}

/** Тело запроса на создание маршрутизатора */
export interface RouterInput {
  name: string
  deviceType?: string
  vendor?: string
  model?: string
  managementAddress?: string
  status: Router['status']
  description?: string
}

export const routersApi = {
  getAll: () => api.get<Router[]>('/routers'),
  create: (payload: RouterInput) => api.post<Router>('/routers', payload),
  update: (id: string, payload: RouterInput) => api.put<Router>(`/routers/${id}`, payload),
}

/** Тело запроса на создание межсетевого экрана */
export interface FirewallInput {
  name: string
  firewallType?: string
  vendor?: string
  model?: string
  managementAddress?: string
  status: Firewall['status']
  description?: string
}

export const firewallsApi = {
  getAll: () => api.get<Firewall[]>('/firewalls'),
  create: (payload: FirewallInput) => api.post<Firewall>('/firewalls', payload),
  update: (id: string, payload: FirewallInput) => api.put<Firewall>(`/firewalls/${id}`, payload),
}

/** Тело запроса на создание сетевого интерфейса (владелец: server XOR router XOR firewall XOR cluster) */
export interface NetworkInterfaceInput {
  serverId?: string
  routerId?: string
  firewallId?: string
  /** Кластер — владелец адреса развертывания (роль в кластере — interfaceRole) */
  clusterId?: string
  /** Сегмент не обязателен: адрес можно завести до описания контура */
  networkSegmentId?: string
  name: string
  ipAddress?: string
  macAddress?: string
  /**
   * Роль адреса: у устройства — SERVICE / MANAGEMENT / VIRTUAL / BACKUP / OTHER,
   * у кластера — INGRESS / NODE / MANAGEMENT (роль в кластере, ТЗ §10.3)
   */
  interfaceRole?: string
  /** Среда адреса: не задана — адрес действует во всех средах узла размещения */
  environmentId?: string | null
  status: NetworkInterface['status']
}

export const interfacesApi = {
  getAll: () => api.get<NetworkInterface[]>('/interfaces'),
  create: (payload: NetworkInterfaceInput) => api.post<NetworkInterface>('/interfaces', payload),
  update: (id: string, payload: NetworkInterfaceInput) => api.put<NetworkInterface>(`/interfaces/${id}`, payload),
}

/** Тело запроса на создание протокола */
export interface ProtocolInput {
  code: string
  name: string
  transport?: string
  layer?: string
  defaultPort?: number
  description?: string
  status: Protocol['status']
}

export const protocolsApi = {
  getAll: () => api.get<Protocol[]>('/protocols'),
  create: (payload: ProtocolInput) => api.post<Protocol>('/protocols', payload),
  update: (id: string, payload: ProtocolInput) => api.put<Protocol>(`/protocols/${id}`, payload),
}

/** Тело запроса на создание информационного потока */
export interface InformationFlowInput {
  code: string
  name: string
  sourceModuleId: string
  targetModuleId: string
  protocolId: string
  targetPort?: number
  /** Проекты, в рамках которых задействован поток (отношение 1:N) */
  projectIds?: string[]
  description?: string
  status: InformationFlow['status']
  validFrom?: string
  validTo?: string
}

export const flowsApi = {
  getAll: () => api.get<InformationFlow[]>('/flows'),
  create: (payload: InformationFlowInput) => api.post<InformationFlow>('/flows', payload),
  update: (id: string, payload: InformationFlowInput) => api.put<InformationFlow>(`/flows/${id}`, payload),
}

/**
 * Фильтры журнала изменений (аудит). Тип объекта, операция, автор, период
 * и поиск по коду/наименованию объекта.
 */
export interface AuditFilters {
  /** Тип объекта реестра, например information_system или module_instance */
  entityType?: string
  /** Идентификатор конкретного объекта */
  entityId?: string
  operation?: AuditEntry['operation']
  /** Автор изменения (поиск по подстроке) */
  changedBy?: string
  /** Начало периода (ISO) */
  from?: string
  /** Конец периода (ISO) */
  to?: string
  /** Поиск по коду/наименованию объекта */
  q?: string
  /** Размер страницы (по умолчанию 200, максимум 1000) */
  limit?: number
  offset?: number
}

/** Query-строка фильтров журнала в snake_case (формат параметров backend) */
function auditQuery(filters?: AuditFilters): string {
  if (!filters) return ''
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(snakeKey(key), String(value))
  })
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const auditApi = {
  getAll: (filters?: AuditFilters) => api.get<AuditEntry[]>(`/audit${auditQuery(filters)}`),
  getById: (id: string) => api.get<AuditEntry>(`/audit/${id}`),
};


// ---------------------------------------------------------------------------
// Раздел «Отчеты»: отчёт «Сетевые взаимодействия».
// Информационные потоки в разрезе «с какого адреса на какой»: адрес стороны
// берётся из размещения экземпляра модуля (сервер/кластер → network_interface).
// ---------------------------------------------------------------------------

/**
 * Фильтры отчёта. Сторона потока кодируется строкой:
 * `addr:<ip>` | `node:<узел>` | `instance:<экземпляр>` | `module:<ИС/КОД>` | `none`
 * (none — сторона без зарегистрированного адреса).
 */
export interface NetworkInteractionFilters {
  /** Источник потока: адрес, узел, экземпляр или модуль */
  source?: string
  /** Получатель потока: адрес, узел, экземпляр или модуль */
  target?: string
  /** Код среды (PROD, TEST…) — учитываются обе стороны потока */
  environment?: string
  /** Состояния потока; по умолчанию backend берёт ACTIVE и PLANNED */
  statuses?: string[]
  /** Код проекта: потоки, задействованные в проекте */
  project?: string
  /** Поиск по коду и наименованию потока */
  q?: string
}

/** Query-строка отчёта: имена параметров совпадают с backend отчётов. */
function reportQuery(filters?: NetworkInteractionFilters): string {
  if (!filters) return ''
  const params = new URLSearchParams()
  if (filters.source) params.set('source', filters.source)
  if (filters.target) params.set('target', filters.target)
  if (filters.environment) params.set('environment', filters.environment)
  if (filters.project) params.set('project', filters.project)
  if (filters.q) params.set('q', filters.q)
  if (filters.statuses && filters.statuses.length > 0) params.set('statuses', filters.statuses.join(','))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const reportsApi = {
  /**
   * Отчёт «Сетевые взаимодействия»: строки «с какого адреса на какой»,
   * варианты фильтров источника и получателя.
   */
  networkInteractions: (filters?: NetworkInteractionFilters) =>
    api.get<NetworkInteractionReport>(`/reports/network-interactions${reportQuery(filters)}`),
  /**
   * «Матрица информационных потоков» на данных реестра: оси — модули,
   * ячейки — потоки между парой «источник → назначение».
   */
  flowMatrix: (filters?: FlowMatrixFilters) =>
    api.get<FlowMatrixReport>(`/reports/flow-matrix${matrixQuery(filters)}`),
}

/** Фильтры «Матрицы информационных потоков» (/matrix). */
export interface FlowMatrixFilters {
  /** Состояния потока; по умолчанию backend берёт ACTIVE и PLANNED */
  statuses?: string[]
  /** Код проекта: потоки, задействованные в проекте */
  project?: string
  /** Код ИС: матрица внутри одной информационной системы */
  informationSystem?: string
  /** Поиск по коду и наименованию потока */
  q?: string
  /** Только модули, между которыми есть отобранные потоки */
  onlyInvolved?: boolean
  /** Показывать выведенные из эксплуатации модули */
  includeRetired?: boolean
}

/** Query-строка матрицы: имена параметров совпадают с backend отчётов. */
function matrixQuery(filters?: FlowMatrixFilters): string {
  if (!filters) return ''
  const params = new URLSearchParams()
  if (filters.statuses && filters.statuses.length > 0) params.set('statuses', filters.statuses.join(','))
  if (filters.project) params.set('project', filters.project)
  if (filters.informationSystem) params.set('is', filters.informationSystem)
  if (filters.q) params.set('q', filters.q)
  if (filters.onlyInvolved) params.set('onlyInvolved', '1')
  if (filters.includeRetired) params.set('includeRetired', '1')
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}


// ---------------------------------------------------------------------------
// Модуль «Архитектурные схемы» (C4).
// Источник данных — сервис `diagrams` (отдельный контейнер), доступный внутри
// общего приложения через прокси nginx: /diagrams-api → diagrams:3002/api.
// Контракт модуля — camelCase и в запросах, и в ответах (snake_case-приведение
// клиента отключено), поэтому список схем читается напрямую.
// ---------------------------------------------------------------------------

/** Тело запроса на создание архитектурной схемы (FR-001/FR-002) */
export interface DiagramInput {
  code: string
  name: string
  diagramType: DiagramType
  /** Область схемы: information_system (по умолчанию) или project */
  scopeType?: string
  scopeObjectId?: string | null
  description?: string
  /**
   * Срез схемы развертывания по среде (ТЗ §10.3): отдельная схема на тест,
   * прод и т. п. Схема без среза показывает все среды.
   */
  environmentId?: string | null
  /** false — создать пустую схему без автогенерации по данным реестра */
  generate?: boolean
}

/** Ответ модуля на создание схемы: карточка + сгенерированный граф */
export interface DiagramCreateResult {
  diagram: DiagramListItem
  graph: unknown
}

/** Форматы экспорта схемы, поддерживаемые модулем */
export type DiagramExportFormat = 'svg' | 'plantuml' | 'mermaid' | 'json'

const diagramsClient = createApiClient(DIAGRAMS_API_BASE, { snakeCaseBody: false })

export const diagramsApi = {
  /** Список схем с количеством узлов/связей и ИС-областью (FR-001, FR-011) */
  getAll: () => diagramsClient.get<DiagramListItem[]>('/diagrams'),
  create: (payload: DiagramInput) => diagramsClient.post<DiagramCreateResult>('/diagrams', payload),
  remove: (id: string) => diagramsClient.delete<{ deleted: boolean }>(`/diagrams/${encodeURIComponent(id)}`),
  /** Ссылка на выгрузку схемы: модуль отдаёт файл (Content-Disposition) */
  exportUrl: (id: string, format: DiagramExportFormat) =>
    `${DIAGRAMS_API_BASE}/diagrams/${encodeURIComponent(id)}/export?format=${format}`,
}
