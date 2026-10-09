import type { ArchNode } from '../model/diagramTypes'

/** Данные, которые React Flow передаёт пользовательскому узлу. */
export interface ArchNodeData extends Record<string, unknown> {
  arch: ArchNode
  /** Худшая проблема валидации по узлу — для подсветки (ТЗ §17). */
  issueLevel?: 'ERROR' | 'WARNING' | 'INFO'
  canEdit: boolean
  /** Узел размещения: число экземпляров модулей внутри рамки (ТЗ §10.3). */
  childCount?: number
  /** Экземпляр модуля: наименование узла размещения, на котором он находится. */
  hostName?: string
}
