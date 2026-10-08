import { api } from './client'
import type { DiagramType } from '../model/c4Types'
import type {
  ArchGraph,
  DiagramListItem,
  DiagramMeta,
  DiagramPayload,
  MetaInfo,
  ValidationResult,
  VersionItem,
} from '../model/diagramTypes'

/** Клиент Diagrams API (ТЗ §12). */
export interface CreateDiagramInput {
  code: string
  name: string
  description?: string
  diagramType: DiagramType
  scopeType?: string
  scopeObjectId?: string | null
  /** false — создать пустую схему без автогенерации (FR-001/FR-002). */
  generate?: boolean
}

export interface PublishResult {
  diagram: DiagramMeta
  versionNo: number
  validation: ValidationResult
}

export interface VersionSnapshot {
  diagramId: string
  versionNo: number
  createdBy: string
  createdAt: string
  status: string
  snapshot: { nodes?: ArchGraph['nodes']; edges?: ArchGraph['edges'] } | null
}

const id = (value: string) => encodeURIComponent(value)

export const diagramsApi = {
  meta: () => api.get<MetaInfo>('/meta'),

  list: () => api.get<DiagramListItem[]>('/diagrams'),

  get: (diagramId: string) => api.get<DiagramPayload>(`/diagrams/${id(diagramId)}`),

  create: (input: CreateDiagramInput) => api.post<DiagramPayload>('/diagrams', input),

  /** PUT с optimistic locking: конфликт ревизий -> HTTP 409 (ТЗ §12). */
  save: (diagramId: string, graph: ArchGraph, revision: number) =>
    api.put<DiagramPayload>(`/diagrams/${id(diagramId)}`, { graph, revision }),

  remove: (diagramId: string) => api.delete<{ deleted: boolean }>(`/diagrams/${id(diagramId)}`),

  /** mode=REBUILD перестраивает layout, mode=SYNC сохраняет ручные координаты (ТЗ §13). */
  generate: (diagramId: string, mode: 'REBUILD' | 'SYNC' = 'SYNC') =>
    api.post<DiagramPayload>(`/diagrams/${id(diagramId)}/generate`, { mode }),

  validate: (diagramId: string) =>
    api.post<ValidationResult>(`/diagrams/${id(diagramId)}/validate`),

  publish: (diagramId: string, revision: number) =>
    api.post<PublishResult>(`/diagrams/${id(diagramId)}/publish`, { revision }),

  versions: (diagramId: string) => api.get<VersionItem[]>(`/diagrams/${id(diagramId)}/versions`),

  version: (diagramId: string, versionNo: number) =>
    api.get<VersionSnapshot>(`/diagrams/${id(diagramId)}/versions/${versionNo}`),

  restore: (diagramId: string, versionNo: number, revision: number) =>
    api.post<DiagramPayload>(`/diagrams/${id(diagramId)}/versions/${versionNo}/restore`, {
      revision,
    }),
}
