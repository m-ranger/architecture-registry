import { api } from './client'
import type { SearchItem } from '../model/registryRefs'

export interface SystemOption {
  id: string
  code: string
  name: string
  status: string
  description: string | null
}

/**
 * Проект — вторая область (scope) схемы: схема в разрезе проекта.
 * `flowsCnt` — количество потоков, задействованных в проекте, считает SQL.
 */
export interface ProjectOption {
  id: string
  code: string
  name: string
  status: string
  description: string | null
  flowsCnt: number
}

export interface FlowRow {
  id: string
  code: string
  name: string
  status: string
  targetPort: number | null
  sourcePort: number | null
  sourceId: string
  sourceCode: string
  sourceName: string
  sourceSystemId: string
  targetId: string
  targetCode: string
  targetName: string
  targetSystemId: string
  protocolId: string
  protocolCode: string
  protocolName: string
  protocolTransport: string | null
  defaultPort: number | null
}

const q = (value: string) => encodeURIComponent(value)

/** Клиент Registry API модуля (ТЗ §12: /api/registry/*). */
export const registryApi = {
  systems: (query = '') => api.get<SystemOption[]>(`/registry/systems?q=${q(query)}`),

  /** Проекты для выбора области схемы «в разрезе проекта» (FR-002). */
  projects: (query = '') => api.get<ProjectOption[]>(`/registry/projects?q=${q(query)}`),

  /** Поиск ИС, модулей, экземпляров, серверов, кластеров и потоков (FR-006). */
  search: (query = '', types?: string[]) => {
    const typesParam = types && types.length > 0 ? `&types=${q(types.join(','))}` : ''
    return api.get<SearchItem[]>(`/registry/search?q=${q(query)}${typesParam}`)
  },

  flows: (systemId: string) => api.get<FlowRow[]>(`/registry/flows?systemId=${q(systemId)}`),

  object: (type: string, objectId: string) =>
    api.get<Record<string, unknown>>(`/registry/objects/${q(type)}/${q(objectId)}`),
}
