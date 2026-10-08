import { useEffect, useState } from 'react'
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
import type { ArchEdge, ArchGraph, IssueSeverity } from '../model/diagramTypes'
import { isBoundary } from '../model/diagramTypes'
import { C4_TYPE } from '../model/c4Types'
import { collectBoxes } from '../layout/layoutService'
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

/** Модель -> элементы React Flow: границы контуров вычисляются из вложенных узлов. */
function buildNodes(
  graph: ArchGraph,
  issueIndex: IssueIndex,
  canEdit: boolean,
  selectedNodeId: string | null,
): Node[] {
  const boxes = collectBoxes(graph.nodes)

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
    .map((node) => ({
      id: node.id,
      type: typeFor(node.c4Type),
      position: { x: node.position.x, y: node.position.y },
      selected: node.id === selectedNodeId,
      data: {
        arch: node,
        issueLevel: issueIndex.nodes[node.id],
        canEdit,
      } as unknown as ArchNodeData,
      style: { width: node.size.width, height: node.size.height },
      zIndex: 1,
    }))

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

  /**
   * Публикация изменений canvas обратно в модель.
   * Координаты узлов считаются ручными данными пользователя (ТЗ §14).
   */
  const emit = (nextNodes: Node[], nextEdges: Edge[]) => {
    const positionById = new Map(nextNodes.map((node) => [node.id, node.position]))
    const aliveNodes = new Set(nextNodes.map((node) => node.id))

    const modelNodes = graph.nodes
      .filter((node) => aliveNodes.has(node.id))
      .map((node) => {
        const position = positionById.get(node.id)
        return position ? { ...node, position: { x: position.x, y: position.y } } : node
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

    onChange({ ...graph, nodes: modelNodes, edges: modelEdges })
  }

  const handleNodesChange = (changes: NodeChange[]) => {
    const next = applyNodeChanges(changes, nodes)
    setNodes(next)

    const removed = changes.some((change) => change.type === 'remove')
    const dragFinished = changes.some((change) => change.type === 'position' && change.dragging === false)
    if (removed || dragFinished) emit(next, edges)
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
        onNodeDragStop={() => emit(nodes, edges)}
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
        </Panel>
      </ReactFlow>
    </div>
  )
}


