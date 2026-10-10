// Типы данных — соответствуют физической модели Architecture Registry v2.0 (01_ddl.sql)

export interface InformationSystem {
  id: string
  code: string
  name: string
  description?: string
  status: 'PLANNED' | 'ACTIVE' | 'RETIRED'
  owner?: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export interface ApplicationModule {
  id: string
  informationSystemId: string
  code: string
  name: string
  purpose: string
  moduleType?: string
  version?: string
  status: 'PLANNED' | 'ACTIVE' | 'RETIRED'
}

export interface Environment {
  id: string
  code: string
  name: string
  description?: string
  criticality?: string
  status: 'PLANNED' | 'ACTIVE' | 'RETIRED'
}

/** Проект — объект архитектурного реестра (Номер проекта + Наименование) */
export interface Project {
  id: string
  /** Номер проекта */
  code: string
  /** Наименование проекта */
  name: string
  description?: string
  status: 'PLANNED' | 'ACTIVE' | 'RETIRED'
  /** Количество потоков, задействованных в проекте — рассчитывается API */
  flowsCnt?: number
  createdAt?: string
  createdBy?: string
  updatedAt?: string
  updatedBy?: string
}

export interface ModuleInstance {
  id: string
  moduleId: string
  environmentId: string
  name: string
  version?: string
  runtimeType?: string
  status: 'PLANNED' | 'ACTIVE' | 'RETIRED'
  description?: string
}

export interface Server {
  id: string
  name: string
  serverType?: string
  status: 'PLANNED' | 'ACTIVE' | 'RETIRED'
  description?: string
}

export interface Cluster {
  id: string
  name: string
  clusterType: string
  version?: string
  managementAddress?: string
  status: 'PLANNED' | 'ACTIVE' | 'RETIRED'
  description?: string
}

export interface ModuleDeployment {
  id: string
  moduleInstanceId: string
  serverId?: string
  clusterId?: string
  deploymentRole?: string
  deploymentState: 'ACTIVE' | 'STANDBY' | 'RETIRED'
  validFrom?: string
  validTo?: string
}

export interface NetworkZone {
  id: string
  code: string
  name: string
  zoneType?: string
  securityLevel?: string
  parentId?: string
  description?: string
  status: 'PLANNED' | 'ACTIVE' | 'RETIRED'
}

export interface NetworkSegment {
  id: string
  networkZoneId: string
  code: string
  name: string
  cidr?: string
  vlan?: number
  purpose?: string
  status: 'PLANNED' | 'ACTIVE' | 'RETIRED'
}

export interface NetworkInterface {
  id: string
  serverId?: string
  routerId?: string
  firewallId?: string
  /** Кластер — владелец адреса: адреса кластера задаются здесь же (ТЗ §10.3) */
  clusterId?: string
  /** Сегмент не обязателен: адрес можно завести до описания контура */
  networkSegmentId?: string
  name: string
  ipAddress?: string
  macAddress?: string
  /**
   * Роль адреса: у устройства — SERVICE / MANAGEMENT / VIRTUAL / BACKUP / OTHER,
   * у кластера — INGRESS / NODE / MANAGEMENT (роль в кластере).
   */
  interfaceRole?: string
  /** Среда адреса: NULL — адрес действует во всех средах узла размещения */
  environmentId?: string | null
  status: 'PLANNED' | 'ACTIVE' | 'RETIRED'
}

export interface Router {
  id: string
  name: string
  deviceType?: string
  vendor?: string
  model?: string
  managementAddress?: string
  status: 'PLANNED' | 'ACTIVE' | 'RETIRED'
  description?: string
}

export interface Firewall {
  id: string
  name: string
  firewallType?: string
  vendor?: string
  model?: string
  managementAddress?: string
  status: 'PLANNED' | 'ACTIVE' | 'RETIRED'
  description?: string
}

export interface Protocol {
  id: string
  code: string
  name: string
  transport?: string
  layer?: string
  defaultPort?: number
  description?: string
  status: 'ACTIVE' | 'RETIRED'
}

export interface InformationFlow {
  id: string
  code: string
  name: string
  sourceModuleId: string
  targetModuleId: string
  protocolId: string
  description?: string
  status: 'PLANNED' | 'ACTIVE' | 'RETIRED'
  validFrom?: string
  validTo?: string
  /** Проекты, в рамках которых задействован поток (отношение 1:N) */
  projectIds?: string[]
  /** Номера проектов — заполняется API для списка потоков */
  projectCodes?: string[]
}

export interface AuditEntry {
  id: string
  entityType: string
  entityId: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  changedAt: string
  changedBy: string
  /** Код объекта из снимка строки (заполняет API — читается и после удаления объекта) */
  entityCode?: string | null
  /** Наименование объекта из снимка строки */
  entityName?: string | null
  /** Какие поля изменились (jsonb-массив, для операции UPDATE) */
  changedFields?: string[]
  /** Снимок строки до изменения (jsonb) */
  oldValue?: Record<string, unknown> | null
  /** Снимок строки после изменения (jsonb) */
  newValue?: Record<string, unknown> | null
}


/**
 * Архитектурная схема (C4) модуля «Архитектурные схемы».
 * Модуль ведёт собственный диаграммный слой в том же PostgreSQL, поэтому тип
 * описан отдельно от реестровых сущностей; список схем доступен внутри общего
 * приложения по адресу `/diagrams` (API — `/diagrams-api`).
 */
export type DiagramType = 'SYSTEM_CONTEXT' | 'CONTAINER' | 'DEPLOYMENT'

export interface DiagramListItem {
  id: string
  code: string
  name: string
  description?: string | null
  diagramType: DiagramType
  /** Тип области схемы: information_system (по умолчанию) или project */
  scopeType: string
  scopeObjectId?: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  revision: number
  publishedVersion?: number | null
  dependenciesDirty?: boolean
  /** Количество узлов и связей графа — рассчитывает API модуля */
  nodeCount: number
  edgeCount: number
  /** Код и наименование области схемы (ИС или проект) — JOIN в API модуля */
  scopeCode?: string | null
  scopeName?: string | null
  /**
   * Срез схемы развертывания по среде (ТЗ §10.3): у схемы может быть
   * зафиксирована одна среда — тест, прод и т. п.
   */
  scopeEnvironmentId?: string | null
  environmentCode?: string | null
  environmentName?: string | null
  createdAt?: string
  createdBy?: string
  updatedAt?: string
  updatedBy?: string
}

/**
 * Сторона информационного потока в отчёте «Сетевые взаимодействия»:
 * модуль, экземпляр, среда, узел размещения и адрес.
 */
export interface NetworkInteractionSide {
  isCode: string
  isName: string
  moduleCode: string
  moduleName: string
  /** Экземпляр модуля (module_instance) */
  instanceName?: string | null
  /** Среда экземпляра (module_instance.environment_id) */
  envCode?: string | null
  envName?: string | null
  /** Узел размещения: сервер или кластер (module_deployment.server_id/cluster_id) */
  ownerType?: 'server' | 'cluster' | null
  ownerName?: string | null
  /** Зарегистрированный адрес узла (network_interface.ip_address) */
  address?: string | null
  addressRole?: string | null
  addressName?: string | null
  segmentCode?: string | null
  zoneCode?: string | null
}

/**
 * Строка отчёта «Сетевые взаимодействия»: информационный поток в разрезе
 * «с какого адреса на какой». Строка — сочетание размещений источника и
 * получателя; среда, узел и адрес стороны пусты, если экземпляр, размещение или
 * адрес не заведены в реестре (GET /api/reports/network-interactions).
 */
export interface NetworkInteractionRow {
  flowCode: string
  flowName: string
  flowStatus: string
  flowDescription?: string | null
  protocolCode: string
  protocolName: string
  protocolTransport?: string | null
  /** Коды проектов, в рамках которых задействован поток */
  projectCodes?: string | null
  sourceIsId: string
  sourceIsCode: string
  sourceIsName: string
  sourceModuleId: string
  sourceModuleCode: string
  sourceModuleName: string
  sourceInstanceName?: string | null
  sourceEnvCode?: string | null
  sourceEnvName?: string | null
  sourceOwnerType?: 'server' | 'cluster' | null
  sourceOwnerName?: string | null
  sourceAddress?: string | null
  sourceAddressRole?: string | null
  sourceAddressName?: string | null
  sourceSegmentCode?: string | null
  sourceZoneCode?: string | null
  targetIsId: string
  targetIsCode: string
  targetIsName: string
  targetModuleId: string
  targetModuleCode: string
  targetModuleName: string
  targetInstanceName?: string | null
  targetEnvCode?: string | null
  targetEnvName?: string | null
  targetOwnerType?: 'server' | 'cluster' | null
  targetOwnerName?: string | null
  targetAddress?: string | null
  targetAddressRole?: string | null
  targetAddressName?: string | null
  targetSegmentCode?: string | null
  targetZoneCode?: string | null
}

/** Вариант фильтра отчёта: сторона кодируется строкой addr:/node:/module:/instance:/none */
export interface NetworkInteractionOption {
  value: string
  label: string
}

export interface NetworkInteractionReport {
  /** Количество строк в текущей выборке */
  total: number
  rows: NetworkInteractionRow[]
  /**
   * Строки, скрытые правилом «одна среда на поток» (Test только на Test, Prod на
   * Prod): count и разбивка по парам сред «источник → получатель».
   */
  excluded?: {
    crossEnvironment: number
    pairs: { sourceEnvCode: string; targetEnvCode: string; total: number }[]
  }
  options: {
    sources: NetworkInteractionOption[]
    targets: NetworkInteractionOption[]
    environments: NetworkInteractionOption[]
    projects: NetworkInteractionOption[]
    statuses: NetworkInteractionOption[]
  }
}

/**
 * Ось «Матрицы информационных потоков» — модуль реестра: строки и столбцы
 * матрицы (GET /api/reports/flow-matrix).
 */
export interface FlowMatrixModule {
  id: string
  code: string
  name: string
  /** Состояние модуля (application_module.status) */
  status: string
  informationSystemId: string
  isCode: string
  isName: string
  /** Среды, в которых заведён экземпляр модуля (коды через запятую) */
  envCodes?: string | null
}

/** Ячейка матрицы — информационный поток между парой модулей. */
export interface FlowMatrixFlow {
  id: string
  code: string
  name: string
  status: string
  sourceModuleId: string
  targetModuleId: string
  protocolCode: string
  protocolName: string
  protocolTransport?: string | null
  /** Коды проектов, в рамках которых задействован поток */
  projectCodes?: string | null
}

/** Сводка матрицы: размеры осей, ячейки и распределение потоков по состояниям. */
export interface FlowMatrixSummary {
  modules: number
  flows: number
  /** Количество заполненных ячеек (пар «источник → назначение» с потоком) */
  cells: number
  informationSystems: number
  statuses: Record<string, number>
}

export interface FlowMatrixReport {
  modules: FlowMatrixModule[]
  flows: FlowMatrixFlow[]
  summary: FlowMatrixSummary
  options: {
    informationSystems: NetworkInteractionOption[]
    projects: NetworkInteractionOption[]
    statuses: NetworkInteractionOption[]
  }
  applied: {
    statuses: string[]
    project: string | null
    informationSystem: string | null
    q: string | null
    onlyInvolved: boolean
    includeRetired: boolean
  }
}
