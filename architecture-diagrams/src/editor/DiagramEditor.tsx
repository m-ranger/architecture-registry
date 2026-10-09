import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  addEdge as rfAddEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { SystemNode } from '../nodes/SystemNode'
import { ContainerNode } from '../nodes/ContainerNode'
import { DeploymentNode } from '../nodes/DeploymentNode'
import { ServerNode } from '../nodes/ServerNode'
import { BoundaryNode } from '../nodes/BoundaryNode'
import { ArchitectureEdge } from '../edges/ArchitectureEdge'
import type { ArchEdge, ArchGraph, ArchNode, IssueSeverity } from '../model/diagramTypes'
import { isBoundary } from '../model/diagramTypes'
import { C4_TYPE } from '../model/c4Types'
import {
  CONTAINER_HEADER,
  CONTAINER_PADDING,
  collectBoxes,
  containerChildren,
  containerFrame,
  isContainerNode,
  nodeSize,
  normalizeContainers,
} from '../layout/layoutService'
import { makeEdge } from '../model/registryRefs'
import type { ArchNodeData } from '../nodes/types'

const nodeTypes = {
  system: SystemNode,
  container: ContainerNode,
  deployment: DeploymentNode,
  server: ServerNode,
  boundary: BoundaryNode,
}

const edgeTypes = { arch: ArchitectureEdge }

const EDGE_STYLE = {
  type: 'arch' as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
}

const typeFor = (c4Type: string) => {
  switch (c4Type) {
    case C4_TYPE.SOFTWARE_SYSTEM:
      return 'system'
    case C4_TYPE.DEPLOYMENT_NODE:
      return 'server'
    case C4_TYPE.DEPLOYMENT_INSTANCE:
      return 'deployment'
    default:
      return 'container'
  }
}

export interface IssueIndex {
  nodes: Record<string, IssueSeverity>
  edges: Record<string, IssueSeverity>
}

export interface FocusRequest {
  key: number
  nodeId?: string | null
  edgeId?: string | null
}

interface DiagramEditorProps {
  graph: ArchGraph
  issueIndex: IssueIndex
  canEdit: boolean
  selectedNodeId: string | null
  selectedEdgeId: string | null
  focusRequest?: FocusRequest | null
  onSelect: (nodeId: string | null, edgeId: string | null) => void
  onChange: (graph: ArchGraph) => void
}

/**
 * Модель -> элементы React Flow.
 * Границы контуров вычисляются из вложенных узлов, узел размещения расширяется
 * под состав (ТЗ §10.3): экземпляры модулей лежат внутри рамки своего узла.
 */
function buildNodes(
  graph: ArchGraph,
  issueIndex: IssueIndex,
  canEdit: boolean,
  selectedNodeId: string | null,
): Node[] {
  const boxes = collectBoxes(graph.nodes)
  const containerIds = new Set(
    graph.nodes.filter((node) => isContainerNode(node)).map((node) => node.id),
  )
  const containerNames = new Map(
    graph.nodes.filter((node) => isContainerNode(node)).map((node) => [node.id, node.name]),
  )
  // Состав узлов размещения: сколько экземпляров лежит внутри каждого узла.
  const childCountById = new Map<string, number>()
  for (const node of graph.nodes) {
    if (!node.parent || !containerIds.has(node.parent)) continue
    childCountById.set(node.parent, (childCountById.get(node.parent) || 0) + 1)
  }

  const boundaryNodes: Node[] = graph.nodes
    .filter((node) => isBoundary(node.c4Type))
    .map((node) => {
      const box = boxes.get(node.id)!
      return {
        id: node.id,
        type: 'boundary',
        position: { x: box.x, y: box.y },
        data: { arch: node, canEdit: false } as unknown as ArchNodeData,
        draggable: false,
        selectable: false,
        deletable: false,
        zIndex: 0,
        style: { width: box.w, height: box.h },
      }
    })

  const regularNodes: Node[] = graph.nodes
    .filter((node) => !isBoundary(node.c4Type))
    .map((node) => {
      const container = containerIds.has(node.id)
      // Рамка узла размещения растягивается под состав экземпляров (ТЗ §10.3).
      const frame = container ? containerFrame(node, containerChildren(graph.nodes, node.id)) : null
      return {
        id: node.id,
        type: typeFor(node.c4Type),
        position: frame ? { x: frame.x, y: frame.y } : { x: node.position.x, y: node.position.y },
        selected: node.id === selectedNodeId,
        data: {
          arch: node,
          issueLevel: issueIndex.nodes[node.id],
          canEdit,
          // Узел размещения: число экземпляров внутри рамки — для шапки узла.
          childCount: container ? childCountById.get(node.id) || 0 : undefined,
          // Экземпляр: на каком узле размещения он находится.
          hostName: node.parent ? containerNames.get(node.parent) : undefined,
        } as unknown as ArchNodeData,
        style: frame
          ? { width: frame.width, height: frame.height }
          : { width: node.size.width, height: node.size.height },
        // Экземпляры рисуются поверх рамки своего узла размещения.
        zIndex: container ? 1 : 2,
      }
    })

  return [...boundaryNodes, ...regularNodes]
}

/** Модель -> связи React Flow. */
function buildEdges(graph: ArchGraph, issueIndex: IssueIndex): Edge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label || undefined,
    data: { technology: edge.technology, issueLevel: issueIndex.edges[edge.id] },
    ...EDGE_STYLE,
  }))
}

/**
 * Перенос экземпляра модуля на другой узел размещения (ТЗ §10.3): узлом считается
 * тот, внутри рамки которого оказался экземпляр после перетаскивания. Экземпляр,
 * оставшийся в прежнем узле, узел не меняет — состав узла не выносится из рамки.
 */
function reparentInstances(nodes: ArchNode[], movedIds?: string[]): ArchNode[] {
  const containers = nodes.filter((node) => isContainerNode(node))
  if (containers.length === 0) return nodes

  const frames = containers.map((container) => ({
    id: container.id,
    frame: containerFrame(container, containerChildren(nodes, container.id)),
  }))

  return nodes.map((node) => {
    if (node.c4Type !== C4_TYPE.DEPLOYMENT_INSTANCE) return node
    // Узел размещения меняется только у экземпляра, перетащенного пользователем:
    // сдвиг узла вместе с составом экземпляры не переносит.
    if (!movedIds || movedIds.length === 0 || !movedIds.includes(node.id)) return node
    const size = nodeSize(node)
    const center = { x: node.position.x + size.width / 2, y: node.position.y + size.height / 2 }
    // Последняя рамка в списке — та, что нарисована поверх остальных.
    const target = [...frames]
      .reverse()
      .find(
        ({ frame }) =>
          center.x >= frame.x &&
          center.x <= frame.x + frame.width &&
          center.y >= frame.y + CONTAINER_HEADER &&
          center.y <= frame.y + frame.height,
      )
    if (target && target.id !== node.parent) return { ...node, parent: target.id }
    return node
  })
}

/** Диаграммный редактор модуля (ТЗ §11). Обёрнут в ReactFlowProvider. */
export function DiagramEditor(props: DiagramEditorProps) {
  return (
    <ReactFlowProvider>
      <DiagramCanvas {...props} />
    </ReactFlowProvider>
  )
}

function DiagramCanvas({
  graph,
  issueIndex,
  canEdit,
  selectedNodeId,
  selectedEdgeId,
  focusRequest,
  onSelect,
  onChange,
}: DiagramEditorProps) {
  const rf = useReactFlow()
  const [nodes, setNodes] = useState<Node[]>(() => buildNodes(graph, issueIndex, canEdit, selectedNodeId))
  const [edges, setEdges] = useState<Edge[]>(() => buildEdges(graph, issueIndex))

  // Ресинхронизация канвы с моделью схемы: координаты берутся из модели,
  // поэтому перерисовка безопасна и не теряет ручной layout (ТЗ §14).
  useEffect(() => {
    setNodes(buildNodes(graph, issueIndex, canEdit, selectedNodeId))
    setEdges(buildEdges(graph, issueIndex))
  }, [graph, issueIndex, canEdit, selectedNodeId])

  // Переход к проблемному элементу из панели валидации.
  useEffect(() => {
    if (!focusRequest) return
    const target = focusRequest.nodeId || focusRequest.edgeId
    if (!target) return
    rf.fitView({ nodes: [{ id: target }], duration: 450, padding: 0.45, maxZoom: 1.4 })
  }, [focusRequest, rf])

  // Узлы модели и состав узлов размещения: правила берутся из модели, координаты —
  // с canvas (ТЗ §10.3, §14).
  const modelById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes])
  const containerIds = useMemo(
    () => new Set(graph.nodes.filter((node) => isContainerNode(node)).map((node) => node.id)),
    [graph.nodes],
  )
  const childrenIndex = useMemo(() => {
    const index = new Map<string, string[]>()
    for (const node of graph.nodes) {
      if (!node.parent || !containerIds.has(node.parent)) continue
      if (!index.has(node.parent)) index.set(node.parent, [])
      index.get(node.parent)!.push(node.id)
    }
    return index
  }, [graph.nodes, containerIds])

  // Экземпляры, перетащенные пользователем в текущем действии: только они могут
  // сменить узел размещения при переносе.
  const lastMovedRef = useRef<string[]>([])

  /** Узел модели по элементу canvas: тип и родитель из модели, координаты — с canvas. */
  const archFromCanvas = (node: Node): ArchNode | null => {
    const model = modelById.get(node.id)
    if (!model) return null
    return {
      ...model,
      position: { x: node.position.x, y: node.position.y },
      size: {
        width: Number(node.style?.width) || model.size.width,
        height: Number(node.style?.height) || model.size.height,
      },
    }
  }

  /** Рамки узлов размещения на canvas: узел растягивается и сжимается под состав. */
  const fitContainers = (next: Node[]): Node[] => {
    if (containerIds.size === 0) return next
    const archNodes = next.map(archFromCanvas).filter((node): node is ArchNode => Boolean(node))
    return next.map((node) => {
      if (!containerIds.has(node.id)) return node
      const arch = archNodes.find((item) => item.id === node.id)
      if (!arch) return node
      const frame = containerFrame(arch, containerChildren(archNodes, node.id))
      return { ...node, style: { ...node.style, width: frame.width, height: frame.height } }
    })
  }

  /**
   * Изменения canvas по правилам схемы развертывания (ТЗ §10.3): удаление узла
   * размещения снимает его состав, перенос узла переносит экземпляры, а экземпляр
   * не выходит за «шапку» и левую границу своего узла — рамка растягивается вправо
   * и вниз, поэтому состав всегда остаётся внутри узла.
   */
  const resolveChanges = (changes: NodeChange[]): { changes: NodeChange[]; movedIds: string[] } => {
    if (containerIds.size === 0) return { changes, movedIds: [] }

    // 1. Узел размещения удаляется вместе со своим составом.
    const extra: NodeChange[] = []
    for (const change of changes) {
      if (change.type !== 'remove') continue
      for (const childId of childrenIndex.get(change.id) || []) {
        extra.push({ type: 'remove', id: childId })
      }
    }

    const positions = new Map(nodes.map((node) => [node.id, node.position]))
    const ordered: NodeChange[] = []
    // Экземпляры, которые пользователь перетащил сам: только они могут сменить узел.
    const movedIds: string[] = []

    const accept = (change: NodeChange, userMove: boolean) => {
      ordered.push(change)
      if (change.type !== 'position' || !change.position) return
      if (userMove) movedIds.push(change.id)

      const previous = positions.get(change.id)
      positions.set(change.id, change.position)

      // 2. Состав — часть узла: экземпляры следуют за своим узлом размещения.
      if (!userMove || !previous || !containerIds.has(change.id)) return
      const dx = change.position.x - previous.x
      const dy = change.position.y - previous.y
      if (dx === 0 && dy === 0) return
      for (const childId of childrenIndex.get(change.id) || []) {
        const childPosition = positions.get(childId)
        if (!childPosition) continue
        const moved = { x: childPosition.x + dx, y: childPosition.y + dy }
        positions.set(childId, moved)
        ordered.push({ type: 'position', id: childId, position: moved, dragging: true })
      }
    }

    for (const change of changes) accept(change, true)
    for (const change of extra) accept(change, false)

    // 3. Экземпляр прижат к «шапке» и левой границе своего узла размещения.
    return {
      changes: ordered.map((change) => {
        if (change.type !== 'position' || !change.position) return change
        const model = modelById.get(change.id)
        const parent = model?.parent ? modelById.get(model.parent) : null
        if (!parent || !containerIds.has(parent.id)) return change
        const parentPosition = positions.get(parent.id) || parent.position
        return {
          ...change,
          position: {
            x: Math.max(change.position.x, parentPosition.x + CONTAINER_PADDING),
            y: Math.max(change.position.y, parentPosition.y + CONTAINER_HEADER),
          },
        }
      }),
      movedIds,
    }
  }

  /**
   * Публикация изменений canvas обратно в модель.
   * Координаты узлов считаются ручными данными пользователя (ТЗ §14), а состав
   * узлов размещения нормализуется: экземпляры остаются внутри рамки своего узла
   * (ТЗ §10.3).
   */
  const emit = (nextNodes: Node[], nextEdges: Edge[], movedIds?: string[]) => {
    const positionById = new Map(nextNodes.map((node) => [node.id, node.position]))
    const aliveNodes = new Set(nextNodes.map((node) => node.id))

    const modelNodes = graph.nodes
      .filter((node) => aliveNodes.has(node.id))
      .map((node) => {
        const position = positionById.get(node.id)
        return position ? { ...node, position: { x: position.x, y: position.y } } : { ...node }
      })

    const modelEdges: ArchEdge[] = nextEdges.map((edge) => {
      const original = graph.edges.find((item) => item.id === edge.id)
      if (original) return original
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        registryRef: null,
        label: String(edge.label ?? 'Связь'),
        technology: null,
      }
    })

    onChange({
      ...graph,
      nodes: normalizeContainers(reparentInstances(modelNodes, movedIds)),
      edges: modelEdges,
    })
  }

  const handleNodesChange = (changes: NodeChange[]) => {
    const resolved = resolveChanges(changes)
    const next = fitContainers(applyNodeChanges(resolved.changes, nodes))
    setNodes(next)

    const removed = resolved.changes.some((change) => change.type === 'remove')
    const dragFinished = resolved.changes.some(
      (change) => change.type === 'position' && change.dragging === false,
    )
    if (removed || dragFinished) {
      // Экземпляры, перетащенные пользователем, могут сменить узел размещения (ТЗ §10.3).
      lastMovedRef.current = removed ? [] : resolved.movedIds
      emit(next, edges, lastMovedRef.current)
    }
  }

  const handleEdgesChange = (changes: EdgeChange[]) => {
    const next = applyEdgeChanges(changes, edges)
    setEdges(next)
    if (changes.some((change) => change.type === 'remove')) emit(nodes, next)
  }

  const handleConnect = (connection: Connection) => {
    if (!canEdit || !connection.source || !connection.target) return
    if (connection.source === connection.target) return

    const created = makeEdge(connection.source, connection.target, graph.edges)
    const nextEdges = rfAddEdge(
      {
        id: created.id,
        source: connection.source,
        target: connection.target,
        label: created.label,
        data: { technology: null },
        ...EDGE_STYLE,
      },
      edges,
    )
    setEdges(nextEdges)
    emit(nodes, nextEdges)
  }

  const handleSelectionChange = (params: OnSelectionChangeParams) => {
    onSelect(params.nodes[0]?.id ?? null, params.edges[0]?.id ?? null)
  }

  return (
    <div className="arch-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeDragStop={() => emit(nodes, edges, lastMovedRef.current)}
        onSelectionChange={handleSelectionChange}
        nodesDraggable={canEdit}
        nodesConnectable={canEdit}
        elementsSelectable
        deleteKeyCode={canEdit ? ['Delete', 'Backspace'] : null}
        selectionOnDrag
        panOnScroll
        panOnDrag={[1, 2]}
        multiSelectionKeyCode="Shift"
        fitView
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={EDGE_STYLE}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#dbe3ef" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeStrokeWidth={2} style={{ background: '#ffffff' }} />
        <Panel position="bottom-left" className="arch-canvas__hint">
          Ctrl+S — сохранить · Delete — удалить · Ctrl+Z / Ctrl+Y — отмена и повтор · Shift — мультивыбор
          {selectedEdgeId ? ' · выделена связь' : ''}
          {containerIds.size > 0
            ? ' · узел размещения расширяется под состав, экземпляры лежат внутри'
            : ''}
        </Panel>
      </ReactFlow>
    </div>
  )
}


