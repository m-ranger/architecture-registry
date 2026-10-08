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
  networkSegmentId: string
  name: string
  ipAddress?: string
  macAddress?: string
  interfaceRole?: string
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
  targetPort?: number
  sourcePort?: number
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
  createdAt?: string
  createdBy?: string
  updatedAt?: string
  updatedBy?: string
}
