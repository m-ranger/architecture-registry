import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Drawer, Skeleton, Space, Tag, Typography, message } from 'antd'
import { AlertOutlined, PartitionOutlined } from '@ant-design/icons'
import { diagramsApi } from '../api/diagramsApi'
import { registryApi, type EnvironmentOption } from '../api/registryApi'
import { runExport } from '../export/exportService'
import type { ExportFormat } from '../api/exportApi'
import { DiagramEditor, type FocusRequest, type IssueIndex } from '../editor/DiagramEditor'
import { DiagramToolbar } from '../editor/DiagramToolbar'
import { Palette } from '../editor/Palette'
import { PropertiesPanel } from '../editor/PropertiesPanel'
import { ValidationPanel } from '../editor/ValidationPanel'
import { FlowsPanel } from '../editor/FlowsPanel'
import { buildIssueIndex, validateDiagram } from '../validation/diagramValidator'
import { localLayeredLayout, nextFreePosition } from '../layout/layoutService'
import { makeAnnotationNode, makeRegistryNode, type SearchItem } from '../model/registryRefs'
import type {
  ArchEdge,
  ArchGraph,
  ArchNode,
  DiagramMeta,
  RegistryRef,
  ScopeFlowsReport,
  ValidationIssue,
  ValidationResult,
  VersionItem,
} from '../model/diagramTypes'
import { registryLink } from '../config'
import { SCOPE_TYPE_LABEL, isBoundary } from '../model/diagramTypes'

const MAX_HISTORY = 60

interface Permissions {
  view: boolean
  edit: boolean
  publish: boolean
  export: boolean
}

function useDiagramState(id: string, navigate: (path: string) => void) {
  const [meta, setMeta] = useState<DiagramMeta | null>(null)
  const [graph, setGraph] = useState<ArchGraph | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await diagramsApi.get(id)
      setMeta(payload.diagram)
      setGraph(payload.graph)
      return payload
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Схема не найдена')
      navigate('/diagrams')
      return null
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  return { meta, setMeta, graph, setGraph, loading, load }
}

/** Рабочее место редактора архитектурных схем (ТЗ §11). */
export function DiagramEditorPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { meta, setMeta, graph, setGraph, loading, load } = useDiagramState(id, navigate)

  const [saving, setSaving] = useState(false)
  // Среды для среза схемы развертывания: отдельная схема на каждую среду (ТЗ §10.3).
  const [environments, setEnvironments] = useState<EnvironmentOption[]>([])

  // Справочник сред нужен только схеме развертывания — для выбора среза (ТЗ §10.3).
  useEffect(() => {
    if (meta?.diagramType !== 'DEPLOYMENT') return
    let cancelled = false
    registryApi
      .environments()
      .then((list) => {
        if (!cancelled) setEnvironments(list)
      })
      .catch(() => {
        // справочник сред недоступен — селектор среза останется пустым
      })
    return () => {
      cancelled = true
    }
  }, [meta?.diagramType])
  const [dirty, setDirty] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
  const [validationOpen, setValidationOpen] = useState(false)
  // Потоки области схемы: панель показывает и потоки вне среза (см. FR-002).
  const [scopeFlows, setScopeFlows] = useState<ScopeFlowsReport | null>(null)
  const [scopeFlowsLoading, setScopeFlowsLoading] = useState(false)
  const [scopeFlowsOpen, setScopeFlowsOpen] = useState(false)
  const [history, setHistory] = useState<ArchGraph[]>([])
  const [future, setFuture] = useState<ArchGraph[]>([])
  const [permissions, setPermissions] = useState<Permissions>({
    view: true,
    edit: true,
    publish: true,
    export: true,
  })

  const canEdit = permissions.edit
  const canPublish = permissions.publish

  const refreshVersions = useCallback(async () => {
    try {
      setVersions(await diagramsApi.versions(id))
    } catch {
      setVersions([])
    }
  }, [id])

  /**
   * Потоки области схемы (панель «Потоки области»): список потоков проекта или ИС
   * с отметкой попадания в срез и связями схемы, образованными каждым потоком.
   */
  const refreshScopeFlows = useCallback(async () => {
    if (!id) return
    setScopeFlowsLoading(true)
    try {
      setScopeFlows(await diagramsApi.flows(id))
    } catch {
      setScopeFlows(null)
    } finally {
      setScopeFlowsLoading(false)
    }
  }, [id])

  useEffect(() => {
    void (async () => {
      const payload = await load()
      if (payload) {
        setValidation(validateDiagram(payload.graph))
        await Promise.all([refreshVersions(), refreshScopeFlows()])
      }
    })()
  }, [load, refreshVersions, refreshScopeFlows])

  // RBAC приходит с backend: UI лишь скрывает недоступные операции (ТЗ §16).
  useEffect(() => {
    diagramsApi
      .meta()
      .then((info) => setPermissions(info.permissions))
      .catch(() => undefined)
  }, [])

  const issueIndex: IssueIndex = useMemo(() => buildIssueIndex(validation), [validation])

  /** Фиксация пользовательского изменения с историей для Ctrl+Z / Ctrl+Y. */
  const commit = (next: ArchGraph) => {
    if (!graph) return
    setHistory((stack) => [...stack.slice(-MAX_HISTORY), graph])
    setFuture([])
    setGraph(next)
    setValidation(validateDiagram(next))
    setDirty(true)
  }

  const undo = () => {
    if (history.length === 0 || !graph) return
    const previous = history[history.length - 1]
    setHistory((stack) => stack.slice(0, -1))
    setFuture((stack) => [graph, ...stack])
    setGraph(previous)
    setValidation(validateDiagram(previous))
    setDirty(true)
  }

  const redo = () => {
    if (future.length === 0 || !graph) return
    const next = future[0]
    setFuture((stack) => stack.slice(1))
    setHistory((stack) => [...stack, graph])
    setGraph(next)
    setValidation(validateDiagram(next))
    setDirty(true)
  }

  const applyPayload = (payload: { diagram: DiagramMeta; graph: ArchGraph }) => {
    setMeta(payload.diagram)
    setGraph(payload.graph)
    setValidation(validateDiagram(payload.graph))
    setDirty(false)
    setHistory([])
    setFuture([])
  }

  /** Сохранение при несохранённых правках — общий шаг для validate/publish/export. */
  const persist = async (): Promise<DiagramMeta | null> => {
    if (!graph || !meta || !dirty || !canEdit) return meta
    const payload = await diagramsApi.save(meta.id, graph, meta.revision)
    applyPayload(payload)
    return payload.diagram
  }

  const handleSave = async () => {
    if (!graph || !meta || !canEdit) return
    setSaving(true)
    try {
      const payload = await diagramsApi.save(meta.id, graph, meta.revision)
      applyPayload(payload)
      message.success(`Схема сохранена (revision ${payload.diagram.revision})`)
    } catch (err) {
      const apiError = err as { status?: number; message?: string }
      if (apiError.status === 409) {
        message.error('Конфликт версий: схему изменил другой пользователь. Откройте схему заново.')
      } else {
        message.error(apiError.message || 'Не удалось сохранить схему')
      }
    } finally {
      setSaving(false)
    }
  }

  /** FR-018 / ТЗ §13: SYNC сохраняет layout, REBUILD перестраивает полностью. */
  const handleGenerate = async (mode: 'REBUILD' | 'SYNC') => {
    if (!meta || !canEdit) return
    if (mode === 'REBUILD' && !window.confirm('Перестроить схему полностью? Ручная раскладка будет сброшена.')) {
      return
    }
    setSaving(true)
    try {
      const payload = await diagramsApi.generate(meta.id, mode)
      applyPayload(payload)
      await refreshScopeFlows()
      message.success(mode === 'REBUILD' ? 'Схема перестроена' : 'Схема синхронизирована с реестром')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Не удалось выполнить генерацию')
    } finally {
      setSaving(false)
    }
  }

  /**
   * Срез схемы развертывания по среде (ТЗ §10.3): после смены среды граф
   * перестраивается по данным реестра — адреса берутся из размещений среды.
   */
  const handleEnvironmentChange = async (environmentId: string | null) => {
    if (!meta || !canEdit) return
    setSaving(true)
    try {
      const payload = await diagramsApi.patchSlice(meta.id, environmentId)
      applyPayload(payload)
      await refreshScopeFlows()
      const code = environments.find((environment) => environment.id === environmentId)?.code
      message.success(
        environmentId
          ? `Схема построена по среде ${code ?? environmentId.slice(0, 8)}`
          : 'Срез по среде снят: схема показывает все среды',
      )
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Не удалось изменить срез по среде')
    } finally {
      setSaving(false)
    }
  }

  const handleValidate = async () => {
    if (!meta) return
    try {
      const current = await persist()
      if (!current) return
      const result = await diagramsApi.validate(current.id)
      setValidation(result)
      setValidationOpen(true)
      if (result.summary.errors > 0) message.error(`Ошибок валидации: ${result.summary.errors}`)
      else message.success('Проверка пройдена, публикация разрешена')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Не удалось выполнить проверку')
    }
  }

  const handlePublish = async () => {
    if (!meta || !canPublish) return
    setSaving(true)
    try {
      const current = await persist()
      if (!current) return
      const result = await diagramsApi.publish(current.id, current.revision)
      setMeta(result.diagram)
      setValidation(result.validation)
      await refreshVersions()
      message.success(`Опубликована версия v${result.versionNo}`)
    } catch (err) {
      const apiError = err as { status?: number; message?: string; payload?: { validation?: ValidationResult } }
      if (apiError.status === 422 && apiError.payload?.validation) {
        setValidation(apiError.payload.validation)
        setValidationOpen(true)
      }
      message.error(apiError.message || 'Не удалось опубликовать схему')
    } finally {
      setSaving(false)
    }
  }

  const handleRestore = async (versionNo: number) => {
    if (!meta || !canEdit) return
    if (!window.confirm(`Восстановить версию v${versionNo}? Текущее состояние черновика будет заменено.`)) {
      return
    }
    setSaving(true)
    try {
      const payload = await diagramsApi.restore(meta.id, versionNo, meta.revision)
      applyPayload(payload)
      message.success(`Восстановлена версия v${versionNo}`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Не удалось восстановить версию')
    } finally {
      setSaving(false)
    }
  }

  /** Экспорт строится из сохранённого snapshot: сначала сохраняем правки (ТЗ §15). */
  const handleExport = async (format: ExportFormat) => {
    if (!meta || !permissions.export) return
    try {
      const current = (await persist()) || meta
      await runExport(
        { id: current.id, code: current.code, version: current.publishedVersion ?? current.revision },
        format,
      )
      message.success(`Экспорт ${format.toUpperCase()} выполнен`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Не удалось выполнить экспорт')
    }
  }

  /** FR-005/FR-006: добавление объекта реестра; поток превращается в связь. */
  const handleAddRegistryObject = async (item: SearchItem) => {
    if (!graph || !canEdit) return
    const key = `${item.objectType}:${item.id}`
    if (graph.nodes.some((node) => node.id === key)) {
      message.info('Объект уже присутствует на схеме')
      return
    }

    if (item.objectType === 'information_flow') {
      try {
        const flow = (await registryApi.object('information_flow', item.id)) as {
          sourceModuleId?: string
          targetModuleId?: string
          code?: string
          name?: string
          targetPort?: number | null
        }
        const sourceKey = `application_module:${flow.sourceModuleId}`
        const targetKey = `application_module:${flow.targetModuleId}`
        const hasBoth =
          graph.nodes.some((node) => node.id === sourceKey) &&
          graph.nodes.some((node) => node.id === targetKey)
        if (!hasBoth) {
          message.warning('Сначала добавьте на схему модули источника и приёмника потока')
          return
        }
        const edgeId = `information_flow:${item.id}`
        if (graph.edges.some((edge) => edge.id === edgeId)) {
          message.info('Поток уже присутствует на схеме')
          return
        }
        commit({
          ...graph,
          edges: [
            ...graph.edges,
            {
              id: edgeId,
              source: sourceKey,
              target: targetKey,
              registryRef: { type: 'information_flow', id: item.id },
              label: flow.name || flow.code || item.name,
              technology: flow.targetPort ? `порт ${flow.targetPort}` : null,
            },
          ],
        })
        message.success('Поток добавлен как связь между модулями')
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Не удалось получить поток из реестра')
      }
      return
    }

    commit({ ...graph, nodes: [...graph.nodes, makeRegistryNode(item, nextFreePosition(graph.nodes))] })
  }

  const handleAddAnnotation = () => {
    if (!graph || !canEdit) return
    let index = 1
    while (graph.nodes.some((node) => node.id === `annotation:${index}`)) index += 1
    const annotation = makeAnnotationNode(`annotation:${index}`, 'Комментарий архитектора')
    commit({
      ...graph,
      nodes: [...graph.nodes, { ...annotation, position: nextFreePosition(graph.nodes) }],
    })
  }

  const handleUpdateNode = (nodeId: string, patch: Partial<ArchNode>) => {
    if (!graph) return
    commit({ ...graph, nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)) })
  }

  const handleUpdateEdge = (edgeId: string, patch: Partial<ArchEdge>) => {
    if (!graph) return
    commit({ ...graph, edges: graph.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...patch } : edge)) })
  }

  const handleRemove = (kind: 'node' | 'edge', itemId: string) => {
    if (!graph) return
    if (kind === 'node') {
      commit({
        ...graph,
        nodes: graph.nodes.filter((node) => node.id !== itemId),
        edges: graph.edges.filter((edge) => edge.source !== itemId && edge.target !== itemId),
      })
      setSelectedNodeId(null)
      return
    }
    commit({ ...graph, edges: graph.edges.filter((edge) => edge.id !== itemId) })
    setSelectedEdgeId(null)
  }

  /** Локальная раскладка кнопки «Layout» (ТЗ §14). */
  const handleAutoLayout = () => {
    if (!graph || !canEdit) return
    const positions = localLayeredLayout(graph.nodes, graph.edges)
    commit({
      ...graph,
      nodes: graph.nodes.map((node) =>
        positions[node.id] ? { ...node, position: positions[node.id] } : node,
      ),
    })
  }

  const handleOpenRegistry = (ref: RegistryRef) => {
    const link = registryLink(ref)
    if (!link) {
      message.info('Для этого типа объекта карточка реестра недоступна')
      return
    }
    window.open(link, '_blank', 'noopener')
  }

  const handleSelectIssue = (issue: ValidationIssue) => {
    setSelectedNodeId(issue.nodeId ?? null)
    setSelectedEdgeId(issue.edgeId ?? null)
    setFocusRequest({ key: Date.now(), nodeId: issue.nodeId, edgeId: issue.edgeId })
  }

  /** Панель «Потоки области»: показать связь потока на схеме и уйти к карточке. */
  const handleFocusScopeEdge = (edgeId: string) => {
    setSelectedNodeId(null)
    setSelectedEdgeId(edgeId)
    setFocusRequest({ key: Date.now(), nodeId: null, edgeId })
    setScopeFlowsOpen(false)
  }

  // Горячие клавиши: Ctrl+S, Ctrl+Z, Ctrl+Y (ТЗ §11).
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        void handleSave()
      } else if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  if (loading || !graph || !meta) {
    return (
      <div className="arch-page">
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    )
  }

  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? null
  const selectedEdge = graph.edges.find((edge) => edge.id === selectedEdgeId) ?? null
  const boundaryCount = graph.nodes.filter((node) => isBoundary(node.c4Type)).length
  /** Подсказка об области схемы: информационная система или проект (FR-002). */
  /** Срез по среде: код среды в подсказке области схемы (ТЗ §10.3). */
  const sliceCode = environments.find((environment) => environment.id === meta.scopeEnvironmentId)?.code
  const scopeHint = meta.scopeObjectId
    ? [
        `${SCOPE_TYPE_LABEL[meta.scopeType] ?? meta.scopeType} · ${meta.scopeObjectId.slice(0, 8)}`,
        sliceCode ? `срез: ${sliceCode}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null

  return (
    <div className="arch-editor">
      <DiagramToolbar
        meta={meta}
        dirty={dirty}
        saving={saving}
        validation={validation}
        versions={versions}
        canEdit={canEdit}
        canPublish={canPublish}
        canUndo={history.length > 0}
        canRedo={future.length > 0}
        onBack={() => navigate('/diagrams')}
        onSave={() => void handleSave()}
        onRegenerate={(mode) => void handleGenerate(mode)}
        showEnvironment={meta.diagramType === 'DEPLOYMENT'}
        environments={environments}
        environmentId={meta.scopeEnvironmentId ?? null}
        onChangeEnvironment={(environmentId) => void handleEnvironmentChange(environmentId)}
        onValidate={() => void handleValidate()}
        onPublish={() => void handlePublish()}
        onAutoLayout={handleAutoLayout}
        onUndo={undo}
        onRedo={redo}
        onExport={(format) => void handleExport(format)}
        onRestore={(versionNo) => void handleRestore(versionNo)}
      />

      <div className="arch-editor__body">
        <aside className="arch-editor__side arch-editor__side--left">
          <Palette
            canEdit={canEdit}
            scopeHint={scopeHint}
            onAddRegistryObject={(item) => void handleAddRegistryObject(item)}
            onAddAnnotation={handleAddAnnotation}
          />
        </aside>

        <main className="arch-editor__canvas">
          <DiagramEditor
            graph={graph}
            issueIndex={issueIndex}
            canEdit={canEdit}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            focusRequest={focusRequest}
            onSelect={(nodeId, edgeId) => {
              setSelectedNodeId(nodeId)
              setSelectedEdgeId(edgeId)
            }}
            onChange={commit}
          />
        </main>

        <aside className="arch-editor__side arch-editor__side--right">
          <PropertiesPanel
            node={selectedNode}
            edge={selectedEdge}
            canEdit={canEdit}
            onUpdateNode={handleUpdateNode}
            onUpdateEdge={handleUpdateEdge}
            onRemove={handleRemove}
            onOpenRegistry={handleOpenRegistry}
          />
        </aside>
      </div>

      <div className="arch-editor__status">
        <Space size={12} wrap>
          <span>
            {graph.nodes.filter((node) => !isBoundary(node.c4Type)).length} узлов / {graph.edges.length} связей
          </span>
          <span>контуров: {boundaryCount}</span>
          {scopeFlows ? (
            <Tag color={scopeFlows.summary.outOfSlice > 0 ? 'orange' : 'blue'}>
              потоки области: {scopeFlows.summary.total} · на схеме: {scopeFlows.summary.onCanvas}
            </Tag>
          ) : null}
          {validation ? (
            <Tag color={validation.summary.errors ? 'red' : validation.summary.warnings ? 'orange' : 'green'}>
              ERROR {validation.summary.errors} · WARNING {validation.summary.warnings} · INFO{' '}
              {validation.summary.infos}
            </Tag>
          ) : null}
          <Typography.Text type="secondary">
            роль: {canEdit ? 'редактирование' : 'только просмотр'}
          </Typography.Text>
        </Space>
        <Space size={8}>
          <Badge count={scopeFlows?.summary.outOfSlice ?? 0} size="small" offset={[-4, 2]}>
            <Button size="small" icon={<PartitionOutlined />} onClick={() => setScopeFlowsOpen(true)}>
              Потоки области
            </Button>
          </Badge>
          <Button size="small" icon={<AlertOutlined />} onClick={() => setValidationOpen(true)}>
            Валидация
          </Button>
        </Space>
      </div>

      <Drawer
        title="Валидация схемы"
        width={480}
        open={validationOpen}
        onClose={() => setValidationOpen(false)}
      >
        <ValidationPanel result={validation} onSelect={handleSelectIssue} />
      </Drawer>

      <Drawer
        title="Потоки области схемы"
        width={660}
        open={scopeFlowsOpen}
        onClose={() => setScopeFlowsOpen(false)}
      >
        <FlowsPanel
          report={scopeFlows}
          loading={scopeFlowsLoading}
          onFocusEdge={handleFocusScopeEdge}
          onOpenRegistry={(flowId) => handleOpenRegistry({ type: 'information_flow', id: flowId })}
        />
      </Drawer>
    </div>
  )
}



