import { useMemo, useState } from 'react'
import {
  Alert, App, Button, Card, Checkbox, Col, Descriptions, Drawer, Dropdown, Form, Input,
  Popconfirm, Row, Select, Space, Spin, Table, Tag, Tooltip, Typography,
} from 'antd'
import {
  CheckCircleOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, ExportOutlined,
  InboxOutlined, PlusOutlined, ProjectOutlined, ReloadOutlined, SearchOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { diagramsApi, informationSystemsApi, projectsApi } from '../api'
import type { DiagramExportFormat, DiagramInput } from '../api'
import { useApi } from '../api/useApi'
import type { ApiError } from '../api/client'
import { brand } from '../theme'
import KpiCard from '../components/KpiCard'
import { diagramEditorPath, diagramExternalPath, diagramsUrl } from '../utils/externalLinks'
import { fmtDate } from '../utils/format'
import type { DiagramListItem, DiagramType } from '../types'

/** Подписи и подсказки типов схем C4 — совпадают с модулем «Архитектурные схемы». */
const DIAGRAM_TYPE_LABEL: Record<DiagramType, string> = {
  SYSTEM_CONTEXT: 'System Context',
  CONTAINER: 'Container',
  DEPLOYMENT: 'Deployment',
}

const DIAGRAM_TYPE_HINT: Record<DiagramType, string> = {
  SYSTEM_CONTEXT: 'Информационная система и связанные системы (по информационным потокам)',
  CONTAINER: 'Модули ИС как Container, потоки между модулями',
  DEPLOYMENT: 'Контуры, узлы размещения (серверы/кластеры) и экземпляры модулей',
}

const DIAGRAM_TYPE_COLOR: Record<DiagramType, string> = {
  SYSTEM_CONTEXT: 'geekblue',
  CONTAINER: 'blue',
  DEPLOYMENT: 'orange',
}

/**
 * Область (scope) схемы: информационная система или проект.
 * Вариант «Проект» — схема в разрезе проекта: в неё попадают все
 * информационные потоки проекта и все модули, участвующие в проекте через эти
 * потоки (FR-002 модуля «Архитектурные схемы»).
 */
type ScopeType = 'information_system' | 'project'

const SCOPE_LABEL: Record<ScopeType, string> = {
  information_system: 'ИС',
  project: 'Проект',
}

const SCOPE_HINT: Record<ScopeType, string> = {
  information_system: 'Схема строится по одной информационной системе: её модули и потоки с её участием',
  project:
    'В схему попадают все информационные потоки проекта и все модули, участвующие в проекте через эти потоки',
}

const SCOPE_OPTIONS = (Object.keys(SCOPE_LABEL) as ScopeType[]).map((value) => ({
  value,
  label: value === 'project' ? 'Проект (потоки проекта и участвующие модули)' : 'Информационная система',
  title: SCOPE_HINT[value],
}))

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликована',
  ARCHIVED: 'Архив',
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'orange',
  PUBLISHED: 'green',
  ARCHIVED: 'default',
}

/** Форматы выгрузки схемы — модуль отдаёт файл по ссылке /diagrams-api/... */
const EXPORT_OPTIONS: { key: DiagramExportFormat; label: string }[] = [
  { key: 'svg', label: 'SVG' },
  { key: 'plantuml', label: 'PlantUML' },
  { key: 'mermaid', label: 'Mermaid' },
  { key: 'json', label: 'JSON' },
]

/** Варианты типов схем для селектов (ключи Record соответствуют DiagramType) */
const DIAGRAM_TYPE_OPTIONS = (Object.keys(DIAGRAM_TYPE_LABEL) as DiagramType[]).map((t) => ({
  value: t,
  label: DIAGRAM_TYPE_LABEL[t],
  title: DIAGRAM_TYPE_HINT[t],
}))

/**
 * Список архитектурных схем (C4) внутри общего приложения.
 *
 * Модуль схем остаётся отдельным сервисом, но nginx реестра проксирует его на
 * общем origin: список читается из `/diagrams-api`, canvas-редактор открывается
 * по внутреннему маршруту `/diagrams-module/diagrams/<id>` — без второй вкладки
 * и без CORS. Ссылка на модуль на отдельном порту сохранена как резервная.
 */
export default function DiagramsPage() {
  const { message } = App.useApp()
  const { data: diagrams, loading: isLoading, error: isError, refetch } = useApi(diagramsApi.getAll)
  const { data: informationSystems } = useApi(informationSystemsApi.getAll)
  /** Проекты реестра — для варианта области «Проект» (FR-002) */
  const { data: projects } = useApi(projectsApi.getAll)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<DiagramType | undefined>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [active, setActive] = useState<DiagramListItem | null>(null)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<DiagramInput>()
  /** Выбранная область схемы: информационная система (по умолчанию) или проект */
  const scopeType = (Form.useWatch('scopeType', form) ?? 'information_system') as ScopeType

  const items = diagrams ?? []
  const published = items.filter((d) => d.status === 'PUBLISHED').length
  const drafts = items.filter((d) => d.status === 'DRAFT').length
  const archived = items.filter((d) => d.status === 'ARCHIVED').length

  /** Редактор схемы — внутри общего приложения (тот же origin, SPA модуля) */
  const openEditor = (diagram: DiagramListItem) => window.location.assign(diagramEditorPath(diagram.id))

  /** Резервный вход: страница модуля на его собственном порту (DIAGRAMS_PORT) */
  const openModuleWindow = (diagram?: DiagramListItem) => {
    const url = diagram ? diagramExternalPath(diagram.id) : diagramsUrl()
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const exportDiagram = (diagram: DiagramListItem, format: DiagramExportFormat) =>
    window.open(diagramsApi.exportUrl(diagram.id, format), '_blank', 'noopener')

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const created = await diagramsApi.create({ ...values, scopeType: values.scopeType ?? 'information_system' })
      message.success(`Схема «${created.diagram.code}» создана`)
      setFormDrawerOpen(false)
      form.resetFields()
      refetch()
      openEditor(created.diagram)
    } catch (err) {
      if ((err as ApiError)?.message) message.error((err as ApiError).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record: DiagramListItem) => {
    try {
      await diagramsApi.remove(record.id)
      message.success(`Схема «${record.code}» удалена`)
      setActive(null)
      refetch()
    } catch (err) {
      message.error((err as ApiError)?.message ?? 'Не удалось удалить схему')
    }
  }

  const filtered = useMemo(() => {
    if (!diagrams) return []
    const t = q.trim().toLowerCase()
    return diagrams.filter((d) => {
      if (typeFilter && d.diagramType !== typeFilter) return false
      if (statusFilter && d.status !== statusFilter) return false
      if (!t) return true
      return `${d.code} ${d.name} ${d.description ?? ''} ${d.scopeCode ?? ''} ${d.scopeName ?? ''}`
        .toLowerCase()
        .includes(t)
    })
  }, [diagrams, q, typeFilter, statusFilter])

  const columns: ColumnsType<DiagramListItem> = [
    {
      title: 'Код схемы',
      dataIndex: 'code',
      key: 'code',
      width: 200,
      // Ссылка ведёт на встроенный маршрут модуля: тот же origin, без новой вкладки
      render: (v: string, record) => (
        <a href={diagramEditorPath(record.id)} onClick={(e) => e.stopPropagation()}>{v}</a>
      ),
    },
    {
      title: 'Наименование',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (v: string, record) => (
        <Space direction='vertical' size={0}>
          <Typography.Text>{v}</Typography.Text>
          {record.description ? (
            <Typography.Text type='secondary' style={{ fontSize: 12 }}>{record.description}</Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Тип',
      dataIndex: 'diagramType',
      key: 'type',
      width: 150,
      render: (v: DiagramType) => (
        <Tooltip title={DIAGRAM_TYPE_HINT[v]}>
          <Tag color={DIAGRAM_TYPE_COLOR[v]}>{DIAGRAM_TYPE_LABEL[v]}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Область',
      key: 'scope',
      width: 260,
      render: (_: unknown, record) =>
        record.scopeCode ? (
          <Space size={4}>
            <Tag color={record.scopeType === 'project' ? 'purple' : 'cyan'}>
              {SCOPE_LABEL[record.scopeType as ScopeType] ?? record.scopeType}
            </Tag>
            {`${record.scopeCode} · ${record.scopeName ?? ''}`}
          </Space>
        ) : (
          '—'
        ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (v: string) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'Версия',
      key: 'version',
      width: 140,
      render: (_: unknown, record) =>
        record.publishedVersion ? `v${record.publishedVersion} / rev ${record.revision}` : `rev ${record.revision}`,
    },
    {
      title: 'Состав',
      key: 'size',
      width: 160,
      render: (_: unknown, record) => `${record.nodeCount} узлов / ${record.edgeCount} связей`,
    },
    {
      title: 'Изменена',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 150,
      render: (v?: string) => fmtDate(v),
    },
    {
      title: '',
      key: 'actions',
      width: 150,
      render: (_: unknown, record) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          <Button size='small' type='link' style={{ padding: 0 }} onClick={() => openEditor(record)}>
            Открыть
          </Button>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                ...EXPORT_OPTIONS.map((o) => ({ key: o.key, label: `Выгрузить ${o.label}` })),
                { type: 'divider' as const },
                { key: 'window', label: 'Редактор в отдельном окне' },
              ],
              onClick: ({ key }) => {
                if (key === 'window') openModuleWindow(record)
                else exportDiagram(record, key as DiagramExportFormat)
              },
            }}
          >
            <Button size='small' type='text' icon={<DownloadOutlined />} />
          </Dropdown>
          <Popconfirm
            title='Удалить схему?'
            description={record.code}
            okText='Удалить'
            cancelText='Отмена'
            onConfirm={() => handleDelete(record)}
          >
            <Button size='small' type='text' danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (isError) {
    return (
      <Alert
        type='error'
        showIcon
        message='Не удалось загрузить список архитектурных схем'
        description={
          <Space direction='vertical' size={8}>
            <span>{isError.message}</span>
            <Typography.Text type='secondary'>
              Список отдаёт модуль «Архитектурные схемы» (сервис diagrams, {diagramsUrl()}). Проверьте,
              что контейнер поднят: <Typography.Text code>docker compose up -d diagrams</Typography.Text>
            </Typography.Text>
            <Space>
              <Button size='small' onClick={refetch}>Повторить</Button>
              <Button size='small' icon={<ExportOutlined />} onClick={() => openModuleWindow()}>
                Открыть модуль на отдельном порту
              </Button>
            </Space>
          </Space>
        }
      />
    )
  }

  if (isLoading || !diagrams) {
    return <Spin spinning />
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Архитектурные схемы</Typography.Title>
          <Typography.Text type='secondary'>
            Реестр — источник истины, схема — представление: System Context, Container, Deployment (C4).
            Список и редактор встроены в приложение
          </Typography.Text>
        </div>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder='Код, наименование, ИС'
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 230 }}
          />
          <Select
            allowClear
            placeholder='Тип схемы'
            style={{ width: 180 }}
            value={typeFilter}
            onChange={(v?: DiagramType) => setTypeFilter(v)}
            options={DIAGRAM_TYPE_OPTIONS}
          />
          <Select
            allowClear
            placeholder='Статус'
            style={{ width: 170 }}
            value={statusFilter}
            onChange={(v?: string) => setStatusFilter(v)}
            options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading}>Обновить</Button>
          <Button icon={<ExportOutlined />} onClick={() => openModuleWindow()}>В отдельном окне</Button>
          <Button type='primary' icon={<PlusOutlined />} onClick={() => setFormDrawerOpen(true)}>Создать схему</Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard title='Схем всего' value={items.length} icon={<ProjectOutlined />} color={brand.blue} hint={`${informationSystems?.length ?? 0} ИС в реестре`} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard title='Опубликовано' value={published} icon={<CheckCircleOutlined />} color={brand.green} hint='неизменяемые версии' />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard title='Черновики' value={drafts} icon={<EditOutlined />} color={brand.orange} hint='в работе архитектора' />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard title='Архив' value={archived} icon={<InboxOutlined />} color={brand.violet} hint='выведены из актуальных' />
        </Col>
      </Row>

      <Card size='small' style={{ borderRadius: 10, marginTop: 12 }}>
        <Table<DiagramListItem>
          rowKey='id'
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Всего: ${t}` }}
          onRow={(rec) => ({ onClick: () => setActive(rec), style: { cursor: 'pointer' } })}
          locale={{ emptyText: 'Схем нет — создайте первую схему по данным реестра' }}
        />
      </Card>

      <Drawer
        title={active ? `${active.code} — ${active.name}` : ''}
        open={!!active}
        onClose={() => setActive(null)}
        width={640}
        extra={
          active ? (
            <Space>
              <Button size='small' type='primary' onClick={() => openEditor(active)}>Открыть в редакторе</Button>
              <Button size='small' icon={<ExportOutlined />} onClick={() => openModuleWindow(active)}>В новом окне</Button>
            </Space>
          ) : null
        }
      >
        {active && (
          <Space direction='vertical' size={16} style={{ width: '100%' }}>
            <Descriptions size='small' bordered column={1}>
              <Descriptions.Item label='Код схемы'>{active.code}</Descriptions.Item>
              <Descriptions.Item label='Наименование'>{active.name}</Descriptions.Item>
              <Descriptions.Item label='Тип схемы'>
                <Tooltip title={DIAGRAM_TYPE_HINT[active.diagramType]}>
                  <Tag color={DIAGRAM_TYPE_COLOR[active.diagramType]}>{DIAGRAM_TYPE_LABEL[active.diagramType]}</Tag>
                </Tooltip>
              </Descriptions.Item>
              <Descriptions.Item label='Область'>
                {active.scopeCode
                  ? `${SCOPE_LABEL[active.scopeType as ScopeType] ?? active.scopeType}: ${active.scopeCode} · ${active.scopeName ?? ''}`
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label='Статус'>
                <Tag color={STATUS_COLOR[active.status]}>{STATUS_LABEL[active.status] ?? active.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label='Версия'>
                {active.publishedVersion
                  ? `v${active.publishedVersion} / revision ${active.revision}`
                  : `revision ${active.revision}`}
              </Descriptions.Item>
              <Descriptions.Item label='Состав'>
                {`${active.nodeCount} узлов / ${active.edgeCount} связей`}
              </Descriptions.Item>
              <Descriptions.Item label='Описание'>{active.description ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Создана'>{fmtDate(active.createdAt)}</Descriptions.Item>
              <Descriptions.Item label='Изменена'>{fmtDate(active.updatedAt)}</Descriptions.Item>
            </Descriptions>

            <Card size='small' title='Выгрузка схемы' style={{ borderRadius: 8 }}>
              <Space wrap>
                {EXPORT_OPTIONS.map((o) => (
                  <Button key={o.key} size='small' icon={<DownloadOutlined />} onClick={() => exportDiagram(active, o.key)}>
                    {o.label}
                  </Button>
                ))}
              </Space>
            </Card>

            <Typography.Text type='secondary' style={{ fontSize: 12 }}>
              Схема открывается внутри общего приложения по адресу{' '}
              <Typography.Text code>{diagramEditorPath(active.id)}</Typography.Text>. Граф хранится в том же
              PostgreSQL, что и реестр, и пересобирается по данным реестра (FR-002).
            </Typography.Text>
          </Space>
        )}
      </Drawer>

      <Drawer
        title='Новая архитектурная схема'
        open={formDrawerOpen}
        onClose={() => { setFormDrawerOpen(false); form.resetFields() }}
        width={560}
        destroyOnClose
        footer={
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => { setFormDrawerOpen(false); form.resetFields() }}>Отмена</Button>
            <Button type='primary' loading={submitting} onClick={handleCreate}>Создать и открыть</Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout='vertical'
          initialValues={{ diagramType: 'CONTAINER', generate: true, scopeType: 'information_system' }}
        >
          <Form.Item
            label='Код схемы'
            name='code'
            rules={[{ required: true, message: 'Укажите код схемы' }]}
            tooltip='Код уникален, например ARCH-IS-001-CONTAINER'
          >
            <Input placeholder='ARCH-IS-001-CONTAINER' />
          </Form.Item>
          <Form.Item label='Наименование' name='name' rules={[{ required: true, message: 'Укажите наименование' }]}>
            <Input placeholder='Интеграционная система — Container' />
          </Form.Item>
          <Form.Item label='Тип схемы' name='diagramType' rules={[{ required: true, message: 'Выберите тип схемы' }]}>
            <Select options={DIAGRAM_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            label='Область схемы'
            name='scopeType'
            rules={[{ required: true, message: 'Выберите область схемы' }]}
            tooltip={SCOPE_HINT[scopeType]}
          >
            <Select
              options={SCOPE_OPTIONS}
              onChange={() => form.setFieldValue('scopeObjectId', undefined)}
            />
          </Form.Item>
          <Form.Item
            label={scopeType === 'project' ? 'Проект: все потоки проекта и участвующие модули' : 'Информационная система'}
            name='scopeObjectId'
            rules={[{ required: true, message: scopeType === 'project' ? 'Выберите проект' : 'Выберите ИС' }]}
          >
            <Select
              showSearch
              optionFilterProp='label'
              placeholder={scopeType === 'project' ? 'Выберите проект' : 'Выберите ИС'}
              options={
                scopeType === 'project'
                  ? (projects ?? []).map((p) => ({
                      value: p.id,
                      // Количество потоков проекта подсказывает, что попадёт в схему
                      label: `${p.code} · ${p.name}${p.flowsCnt ? ` (потоков: ${p.flowsCnt})` : ''}`,
                    }))
                  : (informationSystems ?? []).map((is) => ({ value: is.id, label: `${is.code} · ${is.name}` }))
              }
            />
          </Form.Item>
          <Form.Item label='Описание' name='description'>
            <Input.TextArea rows={2} placeholder='Что показывает схема' />
          </Form.Item>
          <Form.Item name='generate' valuePropName='checked'>
            <Checkbox>Сразу сгенерировать схему по данным реестра (FR-002)</Checkbox>
          </Form.Item>
        </Form>
      </Drawer>
    </>
  )
}
