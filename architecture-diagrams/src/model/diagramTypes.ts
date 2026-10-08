import type { C4Type, DiagramType } from './c4Types'
import { C4_TYPE, C4_VISUAL } from './c4Types'

/**
 * Внутренняя графовая модель модуля (ТЗ §8).
 * Совпадает по структуре с серверной моделью: именно она является
 * источником и для canvas, и для экспортных форматов (ТЗ §3, §15).
 */

export interface RegistryRef {
  type: string
  id: string
}

export interface ArchNode {
  id: string
  registryRef: RegistryRef | null
  c4Type: C4Type
  parent: string | null
  name: string
  technology: string | null
  description: string | null
  position: { x: number; y: number }
  size: { width: number; height: number }
  style: {
    variant?: string
    code?: string
    status?: string
    role?: string
    [key: string]: unknown
  }
}

export interface ArchEdge {
  id: string
  source: string
  target: string
  registryRef: RegistryRef | null
  label: string
  technology: string | null
}

export interface ArchGraph {
  schemaVersion: string
  diagram: {
    id?: string
    type: string
    scope: { objectType: string; objectId: string | null }
  }
  nodes: ArchNode[]
  edges: ArchEdge[]
}

/**
 * Тип области (scope) схемы: информационная система или проект.
 * «Проект» — схема в разрезе проекта: в неё попадают все информационные потоки
 * проекта и все модули, участвующие в проекте через эти потоки (FR-002).
 */
export type ScopeType = 'information_system' | 'project'

export const SCOPE_TYPE_LABEL: Record<ScopeType, string> = {
  information_system: 'Информационная система',
  project: 'Проект',
}

export const SCOPE_TYPE_HINT: Record<ScopeType, string> = {
  information_system: 'Схема строится по одной ИС: её модули и потоки с её участием',
  project:
    'В схему попадают все информационные потоки проекта и все модули, участвующие в проекте через эти потоки',
}

/** Варианты области схемы для селектов (ключи соответствуют scope_type). */
export const SCOPE_OPTIONS = (Object.keys(SCOPE_TYPE_LABEL) as ScopeType[]).map((value) => ({
  value,
  label: SCOPE_TYPE_LABEL[value],
  title: SCOPE_TYPE_HINT[value],
}))

export interface DiagramMeta {
  id: string
  code: string
  name: string
  description: string | null
  diagramType: DiagramType
  scopeType: ScopeType
  scopeObjectId: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  revision: number
  publishedVersion: number | null
  dependenciesDirty: boolean
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export interface DiagramListItem extends DiagramMeta {
  nodeCount: number
  edgeCount: number
  scopeName: string | null
  scopeCode: string | null
}

export interface DiagramPayload {
  diagram: DiagramMeta
  graph: ArchGraph
}

export type IssueSeverity = 'ERROR' | 'WARNING' | 'INFO'

export interface ValidationIssue {
  severity: IssueSeverity
  code: string
  message: string
  nodeId?: string
  edgeId?: string
  registryRef?: RegistryRef | null
}

export interface ValidationResult {
  checkedAt: string
  summary: { errors: number; warnings: number; infos: number }
  canPublish: boolean
  issues: ValidationIssue[]
}

export interface VersionItem {
  id: string
  versionNo: number
  createdAt: string
  createdBy: string
  status: string
  nodeCount: number
  edgeCount: number
}

export interface MetaInfo {
  module: string
  version: string
  diagramTypes: DiagramType[]
  exportFormats: string[]
  registryTypes: string[]
  role: string
  permissions: { view: boolean; edit: boolean; publish: boolean; export: boolean }
}

export const isBoundary = (c4Type: string) =>
  c4Type === C4_TYPE.SYSTEM_BOUNDARY || c4Type === C4_TYPE.ENVIRONMENT_BOUNDARY

/** Секция проекта, к которой относится объект реестра — для перехода в карточку (ТЗ §22). */
export const REGISTRY_ROUTE: Record<string, string> = {
  information_system: '/is',
  application_module: '/modules',
  module_instance: '/instances',
  server: '/servers',
  cluster: '/clusters',
  environment: '/environments',
  network_segment: '/segments',
  information_flow: '/flows',
  project: '/projects',
}

export const nodeVisual = (c4Type: C4Type) => C4_VISUAL[c4Type] || C4_VISUAL[C4_TYPE.CONTAINER]
