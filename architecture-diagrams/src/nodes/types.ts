import type { ArchNode } from '../model/diagramTypes'

/** Данные, которые React Flow передаёт пользовательскому узлу. */
export interface ArchNodeData extends Record<string, unknown> {
  arch: ArchNode
  /** Худшая проблема валидации по узлу — для подсветки (ТЗ §17). */
  issueLevel?: 'ERROR' | 'WARNING' | 'INFO'
  canEdit: boolean
}
