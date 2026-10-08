import type { ArchGraph, IssueSeverity, ValidationIssue, ValidationResult } from '../model/diagramTypes'
import { isBoundary } from '../model/diagramTypes'

/**
 * Клиентская предварительная проверка схемы (ТЗ §17).
 * Авторитетная валидация выполняется на backend — здесь только быстрая
 * обратная связь в редакторе и подсветка узлов/связей.
 */
export function validateDiagram(graph: ArchGraph): ValidationResult {
  const issues: ValidationIssue[] = []
  const nodes = graph.nodes || []
  const edges = graph.edges || []

  const add = (severity: IssueSeverity, code: string, message: string, extra: Partial<ValidationIssue> = {}) =>
    issues.push({ severity, code, message, ...extra })

  if (nodes.length === 0) {
    add('WARNING', 'EMPTY_DIAGRAM', 'Схема не содержит элементов — выполните автогенерацию или добавьте объекты')
  }

  const ids = new Set(nodes.map((node) => node.id))
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      add('ERROR', 'EDGE_ENDPOINT_MISSING', `Связь «${edge.label || edge.id}» ссылается на отсутствующий узел`, {
        edgeId: edge.id,
      })
    }
    if (edge.source === edge.target) {
      add('WARNING', 'EDGE_SELF_LOOP', `Связь «${edge.label || edge.id}» замкнута сама на себя`, {
        edgeId: edge.id,
      })
    }
  }

  const parents = new Map(nodes.map((node) => [node.id, node.parent]))
  for (const node of nodes) {
    const seen = new Set<string>()
    let current: string | null | undefined = node.id
    while (current) {
      if (seen.has(current)) {
        add('ERROR', 'PARENT_CYCLE', `Цикл в иерархии узла «${node.name}»`, { nodeId: node.id })
        break
      }
      seen.add(current)
      current = parents.get(current) || null
    }
  }

  const referenced = new Set<string>()
  for (const edge of edges) {
    referenced.add(edge.source)
    referenced.add(edge.target)
  }
  for (const node of nodes) {
    if (isBoundary(node.c4Type)) continue
    if (!node.registryRef) {
      add('INFO', 'FREE_ELEMENT', `Узел «${node.name}» не связан с объектом реестра`, { nodeId: node.id })
    }
    if (!referenced.has(node.id)) {
      add('INFO', 'ORPHAN_NODE', `Узел «${node.name}» не участвует ни в одной связи`, { nodeId: node.id })
    }
  }

  const summary = {
    errors: issues.filter((issue) => issue.severity === 'ERROR').length,
    warnings: issues.filter((issue) => issue.severity === 'WARNING').length,
    infos: issues.filter((issue) => issue.severity === 'INFO').length,
  }

  return {
    checkedAt: new Date().toISOString(),
    summary,
    canPublish: summary.errors === 0,
    issues,
  }
}

/** Индекс проблем по узлам и связям — для подсветки на canvas (FR-015). */
export function buildIssueIndex(result: ValidationResult | null): {
  nodes: Record<string, IssueSeverity>
  edges: Record<string, IssueSeverity>
} {
  const nodes: Record<string, IssueSeverity> = {}
  const edges: Record<string, IssueSeverity> = {}
  if (!result) return { nodes, edges }

  const weight: Record<IssueSeverity, number> = { ERROR: 3, WARNING: 2, INFO: 1 }
  const push = (store: Record<string, IssueSeverity>, key?: string, severity?: IssueSeverity) => {
    if (!key || !severity) return
    const current = store[key]
    if (!current || weight[severity] > weight[current]) store[key] = severity
  }

  for (const issue of result.issues) {
    push(nodes, issue.nodeId, issue.severity)
    push(edges, issue.edgeId, issue.severity)
  }
  return { nodes, edges }
}
