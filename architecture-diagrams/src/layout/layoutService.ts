import type { ArchEdge, ArchNode } from '../model/diagramTypes'
import { isBoundary } from '../model/diagramTypes'
import { C4_TYPE } from '../model/c4Types'

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

/**
 * Узел размещения — контейнер экземпляров модулей (ТЗ §10.3).
 * Правила совпадают с серверной раскладкой (server/layout.js): рамка узла
 * считается по составу, а состав притягивается внутрь рамки.
 */
export const CONTAINER_PADDING = 16
export const CONTAINER_HEADER = 84
export const CONTAINER_GAP = 12
export const CONTAINER_MIN_WIDTH = 270
export const CONTAINER_MIN_HEIGHT = 120
const CONTAINER_MAX_COLUMNS = 3

export const isContainerNode = (node: ArchNode | null | undefined): boolean =>
  Boolean(node) && node!.c4Type === C4_TYPE.DEPLOYMENT_NODE

/** Экземпляр модуля на узле размещения. */
export const isInstanceNode = (node: ArchNode): boolean => node.c4Type === C4_TYPE.DEPLOYMENT_INSTANCE

/** Размер узла: экземпляр — типовой карточкой, узел размещения — по рамке. */
export function nodeSize(node: ArchNode): { width: number; height: number } {
  return {
    width: node.size?.width || (isContainerNode(node) ? CONTAINER_MIN_WIDTH : 230),
    height: node.size?.height || (isContainerNode(node) ? CONTAINER_MIN_HEIGHT : 88),
  }
}

/** Экземпляры, размещённые на узле (прямые дети-экземпляры). */
export const containerChildren = (nodes: ArchNode[], containerId: string): ArchNode[] =>
  nodes.filter((node) => node.parent === containerId && node.c4Type === C4_TYPE.DEPLOYMENT_INSTANCE)

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

// ---------------------------------------------------------------------------
// Узлы размещения и их состав (ТЗ §10.3)
// Схема развертывания читается как «контур среды → узел размещения → экземпляр»:
// узел размещения расширяется под свой состав, а экземпляры модулей всегда лежат
// внутри рамки узла. Те же правила и константы — на сервере (server/layout.js).
// ---------------------------------------------------------------------------

export interface ContainerFrame {
  x: number
  y: number
  width: number
  height: number
}

export interface ContainerPacking {
  placements: { id: string; x: number; y: number }[]
  width: number
  height: number
  rows: number
  columns: number
}

/**
 * Сетка экземпляров внутри рамки узла: короткий состав — одна колонка («стойка»),
 * длинный — до трёх, чтобы узел не вытягивался в бесконечную полосу.
 */
export function packContainerChildren(children: ArchNode[]): ContainerPacking {
  // Узел без состава имеет типовой размер C4-карточки: рамка растёт только под экземпляры.
  if (children.length === 0) {
    return {
      placements: [],
      rows: 0,
      columns: 0,
      width: CONTAINER_MIN_WIDTH,
      height: CONTAINER_MIN_HEIGHT,
    }
  }

  const sizes = children.map(nodeSize)
  const columns = children.length <= 3 ? 1 : children.length <= 8 ? 2 : CONTAINER_MAX_COLUMNS
  const columnWidth = Math.max(230, ...sizes.map((size) => size.width))
  const rowHeight = Math.max(88, ...sizes.map((size) => size.height))
  const rows = Math.max(1, Math.ceil(children.length / columns))

  return {
    placements: children.map((child, index) => ({
      id: child.id,
      x: CONTAINER_PADDING + (index % columns) * (columnWidth + CONTAINER_GAP),
      y:
        CONTAINER_HEADER +
        CONTAINER_PADDING +
        Math.floor(index / columns) * (rowHeight + CONTAINER_GAP),
    })),
    rows,
    columns,
    width: Math.max(
      CONTAINER_MIN_WIDTH,
      CONTAINER_PADDING * 2 + columns * columnWidth + (columns - 1) * CONTAINER_GAP,
    ),
    height: Math.max(
      CONTAINER_MIN_HEIGHT,
      CONTAINER_HEADER + CONTAINER_PADDING * 2 + rows * rowHeight + (rows - 1) * CONTAINER_GAP,
    ),
  }
}

/**
 * Рамка узла размещения: расширяется под состав экземпляров.
 * Позиция узла — ручная координата пользователя (ТЗ §14), поэтому рамка растёт
 * вправо и вниз, а состав притягивается внутрь за «шапку» и левую границу.
 */
export function containerFrame(container: ArchNode, children: ArchNode[]): ContainerFrame {
  const base = nodeSize(container)
  let width = Math.max(CONTAINER_MIN_WIDTH, base.width)
  let height = Math.max(CONTAINER_MIN_HEIGHT, base.height)
  for (const child of children) {
    const size = nodeSize(child)
    width = Math.max(width, child.position.x + size.width + CONTAINER_PADDING - container.position.x)
    height = Math.max(
      height,
      child.position.y + size.height + CONTAINER_PADDING - container.position.y,
    )
  }
  return { x: container.position.x, y: container.position.y, width, height }
}

/**
 * Нормализация состава узлов размещения (ТЗ §10.3): экземпляры внутри рамки узла,
 * рамка растянута под состав. Идемпотентна — на согласованной схеме ничего не меняет.
 */
export function normalizeContainers(nodes: ArchNode[]): ArchNode[] {
  if (!nodes.some((node) => isContainerNode(node))) return nodes

  const result = nodes.map((node) => ({
    ...node,
    position: { x: node.position.x, y: node.position.y },
    size: { ...nodeSize(node) },
  }))

  for (const container of result.filter((node) => isContainerNode(node))) {
    const children = containerChildren(result, container.id)
    for (const child of children) {
      // Экземпляр не входит в «шапку» узла и не выходит за его левую границу.
      child.position.x = Math.max(child.position.x, container.position.x + CONTAINER_PADDING)
      child.position.y = Math.max(child.position.y, container.position.y + CONTAINER_HEADER)
    }
    const frame = containerFrame(container, children)
    container.size = { width: frame.width, height: frame.height }
  }
  return result
}

/**
 * Раскладка схемы развертывания: контуры сред → узлы размещения → экземпляры.
 * Совпадает с серверной раскладкой (server/layout.js, deploymentLayout).
 */
export function localDeploymentLayout(nodes: ArchNode[]): {
  positions: Record<string, { x: number; y: number }>
  sizes: Record<string, { width: number; height: number }>
} {
  const marginX = 80
  const marginY = 80
  const nodeGap = 90
  const groupGap = 90
  const maxPerRow = 3

  const positions: Record<string, { x: number; y: number }> = {}
  const sizes: Record<string, { width: number; height: number }> = {}

  // Узел размещения принадлежит контуру среды: контур задаёт полосу раскладки.
  const groups = new Map<string, ArchNode[]>()
  for (const container of nodes.filter((node) => isContainerNode(node))) {
    const key = container.parent || '__root__'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(container)
  }

  let cursorY = marginY
  for (const group of groups.values()) {
    let cursorX = marginX
    let rowY = cursorY
    let rowHeight = 0
    let placed = 0
    for (const container of group) {
      const packed = packContainerChildren(containerChildren(nodes, container.id))
      positions[container.id] = { x: cursorX, y: rowY }
      sizes[container.id] = { width: packed.width, height: packed.height }
      for (const placement of packed.placements) {
        positions[placement.id] = { x: cursorX + placement.x, y: rowY + placement.y }
      }
      rowHeight = Math.max(rowHeight, packed.height)
      cursorX += packed.width + nodeGap
      placed += 1
      if (placed % maxPerRow === 0) {
        rowY += rowHeight + groupGap
        rowHeight = 0
        cursorX = marginX
      }
    }
    cursorY = rowY + rowHeight + groupGap
  }

  // Элементы вне узлов размещения (аннотации, свободные экземпляры) — ниже полос сред.
  let orphanY = cursorY
  for (const node of nodes) {
    if (isBoundary(node.c4Type) || positions[node.id]) continue
    positions[node.id] = { x: marginX, y: orphanY }
    orphanY += nodeSize(node).height + 30
  }

  return { positions, sizes }
}

/**
 * Локальная раскладка кнопки «Авто-раскладка» (ТЗ §14).
 * Схема развертывания укладывается по узлам размещения, остальные схемы —
 * прежней слоистой раскладкой.
 */
export function localLayout(nodes: ArchNode[], edges: ArchEdge[]): ArchNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const isDeployment = nodes.some((node) => node.parent && isContainerNode(byId.get(node.parent)))

  if (isDeployment) {
    const { positions, sizes } = localDeploymentLayout(nodes)
    return normalizeContainers(
      nodes.map((node) => ({
        ...node,
        position: positions[node.id] ?? node.position,
        size: sizes[node.id] ?? node.size,
      })),
    )
  }

  const positions = localLayeredLayout(nodes, edges)
  return nodes.map((node) => (positions[node.id] ? { ...node, position: positions[node.id] } : node))
}

