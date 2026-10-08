import type { ArchEdge, ArchNode } from '../model/diagramTypes'
import { isBoundary } from '../model/diagramTypes'

/**
 * Раскладка и геометрия (ТЗ §14).
 * Ручные координаты — пользовательские данные: SYNC и локальная раскладка
 * их не перезаписывают, REBUILD применяет только сервер по явному запросу.
 */

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export const BOUNDARY_PADDING = 26
export const BOUNDARY_HEADER = 24

const unionBox = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  }
}

const ownBox = (node: ArchNode): Box => ({
  x: node.position.x,
  y: node.position.y,
  w: node.size.width,
  h: node.size.height,
})

/** Рекурсивный bbox узла с учётом вложенных элементов (совпадает с серверным экспортом). */
export function collectBoxes(nodes: ArchNode[]): Map<string, Box> {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const childrenOf = new Map<string, ArchNode[]>()
  for (const node of nodes) {
    if (!node.parent) continue
    if (!childrenOf.has(node.parent)) childrenOf.set(node.parent, [])
    childrenOf.get(node.parent)!.push(node)
  }

  const cache = new Map<string, Box>()
  const walk = (nodeId: string): Box | null => {
    if (cache.has(nodeId)) return cache.get(nodeId)!
    const node = byId.get(nodeId)
    if (!node) return null

    const children = childrenOf.get(nodeId) || []
    // Границы контуров описываются только составом вложенных элементов (ТЗ §10.3),
    // поэтому собственная координата границы в расчёт не берётся.
    const childrenOnly = isBoundary(node.c4Type) && children.length > 0
    let box: Box | null = childrenOnly ? null : ownBox(node)

    for (const child of children) {
      const childBox = walk(child.id)
      if (!childBox) continue
      box = box ? unionBox(box, childBox) : { ...childBox }
    }

    if (!box) return null
    cache.set(nodeId, box)
    return box
  }

  const boxes = new Map<string, Box>()
  for (const node of nodes) {
    const box = walk(node.id)
    if (!box) continue
    boxes.set(
      node.id,
      isBoundary(node.c4Type)
        ? {
            x: box.x - BOUNDARY_PADDING,
            y: box.y - BOUNDARY_PADDING - BOUNDARY_HEADER,
            w: box.w + BOUNDARY_PADDING * 2,
            h: box.h + BOUNDARY_PADDING * 2 + BOUNDARY_HEADER,
          }
        : box,
    )
  }
  return boxes
}

export interface BoundaryBox {
  id: string
  name: string
  c4Type: string
  box: Box
}

/** Границы контуров для отрисовки под узлами (ТЗ §10.3). */
export function computeBoundaries(nodes: ArchNode[]): BoundaryBox[] {
  const boxes = collectBoxes(nodes)
  return nodes
    .filter((node) => isBoundary(node.c4Type))
    .map((node) => ({ id: node.id, name: node.name, c4Type: node.c4Type, box: boxes.get(node.id)! }))
    .filter((item) => Boolean(item.box))
}

/** Свободная позиция для нового узла — справа от существующих (ТЗ §14, локальная раскладка). */
export function nextFreePosition(nodes: ArchNode[], size = { width: 250, height: 112 }): { x: number; y: number } {
  const placeable = nodes.filter((node) => !isBoundary(node.c4Type))
  if (placeable.length === 0) return { x: 120, y: 120 }

  const boxes = collectBoxes(nodes)
  let maxRight = 0
  let minTop = Number.POSITIVE_INFINITY
  for (const node of placeable) {
    const box = boxes.get(node.id)
    if (!box) continue
    maxRight = Math.max(maxRight, box.x + box.w)
    minTop = Math.min(minTop, box.y)
  }
  return {
    x: maxRight + 90,
    y: Number.isFinite(minTop) ? minTop : 120,
  }
}

/** Клиентская слоистая раскладка кнопки «Авто-раскладка» (серверная генерация остаётся авторитетной). */
export function localLayeredLayout(
  nodes: ArchNode[],
  edges: ArchEdge[],
): Record<string, { x: number; y: number }> {
  const placeable = nodes.filter((node) => !isBoundary(node.c4Type))
  const ids = new Set(placeable.map((node) => node.id))
  const outgoing = new Map<string, string[]>(placeable.map((node) => [node.id, []]))
  const indegree = new Map<string, number>(placeable.map((node) => [node.id, 0]))

  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target) continue
    outgoing.get(edge.source)!.push(edge.target)
    indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1)
  }

  const rank = new Map<string, number>(placeable.map((node) => [node.id, 0]))
  const queue = placeable.filter((node) => (indegree.get(node.id) || 0) === 0).map((node) => node.id)
  const visited = new Set(queue)
  const remaining = new Map(indegree)

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const next of outgoing.get(current) || []) {
      rank.set(next, Math.max(rank.get(next) || 0, (rank.get(current) || 0) + 1))
      remaining.set(next, (remaining.get(next) || 1) - 1)
      if (remaining.get(next) === 0 && !visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }

  const maxRank = Math.max(0, ...Array.from(rank.values()))
  for (const node of placeable) if (!visited.has(node.id)) rank.set(node.id, maxRank + 1)

  const columns = new Map<number, ArchNode[]>()
  for (const node of placeable) {
    const r = rank.get(node.id) || 0
    if (!columns.has(r)) columns.set(r, [])
    columns.get(r)!.push(node)
  }

  const positions: Record<string, { x: number; y: number }> = {}
  let cursorX = 100
  for (const r of Array.from(columns.keys()).sort((a, b) => a - b)) {
    const column = columns.get(r)!
    let cursorY = 110
    let width = 250
    for (const node of column) {
      positions[node.id] = { x: cursorX, y: cursorY }
      cursorY += node.size.height + 34
      width = Math.max(width, node.size.width)
    }
    cursorX += width + 100
  }
  return positions
}
