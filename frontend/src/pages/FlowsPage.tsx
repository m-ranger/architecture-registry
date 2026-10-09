import { useMemo, useState } from 'react'
import { Alert, App, Button, Card, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Popconfirm, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import { StatusTag, STATUS_OPTIONS } from '../components/StatusTag'
import { flowsApi, modulesApi, protocolsApi, informationSystemsApi, projectsApi } from '../api'
import type { InformationFlowInput } from '../api'
import { useApi } from '../api/useApi'
import type { ApiError } from '../api/client'
import type { InformationFlow } from '../types'
import { fmtDateShort } from '../utils/format'

/** Значения формы потока: даты вводятся через DatePicker */
type FlowFormValues = Omit<InformationFlowInput, 'validFrom' | 'validTo'> & {
  validFrom?: Dayjs
  validTo?: Dayjs
}

export default function FlowsPage() {
  const { message } = App.useApp()
  const { data: flows, loading: isLoading, error: isError, refetch } = useApi(flowsApi.getAll)
  const { data: modules } = useApi(modulesApi.getAll)
  const { data: protocols } = useApi(protocolsApi.getAll)
  const { data: informationSystems } = useApi(informationSystemsApi.getAll)
  const { data: projects } = useApi(projectsApi.getAll)
  const [q, setQ] = useState('')
  const [active, setActive] = useState<InformationFlow | null>(null)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [editingRecord, setEditingRecord] = useState<InformationFlow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form] = Form.useForm<FlowFormValues>()

  /** Полное имя модуля с префиксом ИС для читаемых подписей */
  const moduleLabel = (moduleId?: string) => {
    const m = modules?.find((x) => x.id === moduleId)
    if (!m) return '—'
    return `${informationSystems?.find((is) => is.id === m.informationSystemId)?.code ?? '?'} / ${m.code}`
  }

  /** Проекты, в рамках которых задействован поток (отношение 1:N) */
  const flowProjects = (flow: InformationFlow) =>
    flow.projectCodes ?? (flow.projectIds ?? []).map((id) => projects?.find((p) => p.id === id)?.code ?? '?')

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const { validFrom, validTo, ...rest } = values
      const payload: InformationFlowInput = {
        ...rest,
        validFrom: validFrom ? validFrom.format('YYYY-MM-DD') : undefined,
        validTo: validTo ? validTo.format('YYYY-MM-DD') : undefined,
      }
      setSubmitting(true)
      if (formMode === 'create') {
        await flowsApi.create(payload)
        message.success(`Поток «${payload.code}» добавлен`)
      } else if (editingRecord) {
        await flowsApi.update(editingRecord.id, payload)
        message.success(`Поток «${payload.code}» обновлён`)
      }
      setFormDrawerOpen(false)
      form.resetFields()
      setEditingRecord(null)
      refetch()
      setActive(null)
    } catch (err) {
      if ((err as ApiError)?.message) {
        message.error((err as ApiError).message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreate = () => {
    setFormMode('create')
    form.resetFields()
    form.setFieldsValue({ status: 'PLANNED' })
    setEditingRecord(null)
    setFormDrawerOpen(true)
  }

  const handleEdit = (record: InformationFlow) => {
    setActive(null)
    setEditingRecord(record)
    setFormMode('edit')
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      sourceModuleId: record.sourceModuleId,
      targetModuleId: record.targetModuleId,
      protocolId: record.protocolId,
      targetPort: record.targetPort,
      projectIds: record.projectIds ?? [],
      description: record.description,
      status: record.status,
    })
    setFormDrawerOpen(true)
  }

  /** Удаление доступно только в режиме редактирования — из формы изменений */
  const handleDelete = async () => {
    if (!editingRecord) return
    try {
      setDeleting(true)
      await flowsApi.remove(editingRecord.id)
      message.success(`Поток «${editingRecord.code}» удалён`)
      setFormDrawerOpen(false)
      form.resetFields()
      setEditingRecord(null)
      setActive(null)
      refetch()
    } catch (err) {
      message.error((err as ApiError)?.message ?? 'Не удалось удалить информационный поток')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = useMemo(() => {
    if (!flows) return []
    const t = q.trim().toLowerCase()
    if (!t) return flows
    return flows.filter((f) => {
      const p = protocols?.find((x) => x.id === f.protocolId)
      return `${f.code} ${f.name} ${f.description ?? ''} ${moduleLabel(f.sourceModuleId)} ${moduleLabel(f.targetModuleId)} ${p?.code ?? ''} ${flowProjects(f).join(' ')}`.toLowerCase().includes(t)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, flows, modules, protocols, informationSystems, projects])

  const columns: ColumnsType<InformationFlow> = [
    { title: 'Код', dataIndex: 'code', key: 'code', width: 120, render: (v: string) => <Tag color='blue'>{v}</Tag> },
    { title: 'Источник', key: 'src', width: 240, render: (_: unknown, r: InformationFlow) => moduleLabel(r.sourceModuleId) },
    { title: 'Назначение', key: 'tgt', width: 240, render: (_: unknown, r: InformationFlow) => moduleLabel(r.targetModuleId) },
    { title: 'Наименование', dataIndex: 'name', key: 'name', render: (v?: string) => v ?? '—' },
    { title: 'Протокол', key: 'proto', width: 120, render: (_: unknown, r: InformationFlow) => <Tag color='magenta'>{protocols?.find((p) => p.id === r.protocolId)?.code ?? '—'}</Tag> },
    { title: 'Порт', dataIndex: 'targetPort', key: 'port', width: 90, render: (v?: number) => v ?? '—' },
    {
      title: 'Проекты',
      key: 'projects',
      width: 210,
      render: (_: unknown, r: InformationFlow) => {
        const codes = flowProjects(r)
        if (codes.length === 0) return <Typography.Text type='secondary'>—</Typography.Text>
        return <Space size={4} wrap>{codes.map((c) => <Tag key={c} color='geekblue'>{c}</Tag>)}</Space>
      },
    },
    { title: 'Описание', dataIndex: 'description', key: 'desc', render: (v?: string) => <Typography.Text type='secondary' style={{ fontSize: 12 }}>{v ?? '—'}</Typography.Text> },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 110, render: (v: string) => <StatusTag value={v} /> },
  ]

  if (isError) {
    return <Alert message="Ошибка загрузки" description={isError.message} type="error" showIcon />
  }

  if (isLoading || !flows) {
    return <Spin spinning />
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Информационные потоки</Typography.Title>
          <Typography.Text type='secondary'>
            Сущность <Typography.Text code>information_flow</Typography.Text> · Логическая связь между модулями (REQ-020); source_module_id ≠ target_module_id
          </Typography.Text>
        </div>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder='Код, модуль или протокол' value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <Button type='primary' icon={<PlusOutlined />} onClick={handleCreate}>Добавить поток</Button>
        </Space>
      </div>
      <Card size='small' style={{ borderRadius: 10 }}>
        <Table<InformationFlow>
          rowKey='id'
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Всего: ${t}` }}
          onRow={(rec) => ({ onClick: () => setActive(rec), style: { cursor: 'pointer' } })}
        />
      </Card>
      <Drawer
        title={active ? `${active.code} — ${active.name}` : ''}
        open={!!active}
        onClose={() => setActive(null)}
        width={640}
        extra={<Button type='primary' icon={<EditOutlined />} onClick={() => active && handleEdit(active)}>Редактировать</Button>}
      >
        {active && (
          <Space direction='vertical' size={16} style={{ width: '100%' }}>
            <Descriptions size='small' bordered column={1}>
              <Descriptions.Item label='Код'>{active.code}</Descriptions.Item>
              <Descriptions.Item label='Наименование'>{active.name}</Descriptions.Item>
              <Descriptions.Item label='Источник'>{moduleLabel(active.sourceModuleId)}</Descriptions.Item>
              <Descriptions.Item label='Назначение'>{moduleLabel(active.targetModuleId)}</Descriptions.Item>
              <Descriptions.Item label='Протокол'><Tag color='magenta'>{protocols?.find((p) => p.id === active.protocolId)?.code ?? '—'}</Tag></Descriptions.Item>
              <Descriptions.Item label='Порт назначения'>{active.targetPort ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Статус'><StatusTag value={active.status} /></Descriptions.Item>
              <Descriptions.Item label='Действует с'>{fmtDateShort(active.validFrom)}</Descriptions.Item>
              <Descriptions.Item label='Действует до'>{fmtDateShort(active.validTo)}</Descriptions.Item>
              <Descriptions.Item label='Задействован в проектах'>
                {flowProjects(active).length === 0
                  ? '—'
                  : <Space size={4} wrap>{flowProjects(active).map((c) => <Tag key={c} color='geekblue'>{c}</Tag>)}</Space>}
              </Descriptions.Item>
              <Descriptions.Item label='Описание'>{active.description ?? '—'}</Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Drawer>

      <Drawer
        title={formMode === 'create' ? 'Добавить информационный поток' : 'Редактировать информационный поток'}
        open={formDrawerOpen}
        onClose={() => { setFormDrawerOpen(false); form.resetFields() }}
        width={560}
        destroyOnClose
        footer={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            {formMode === 'edit' ? (
              <Popconfirm
                title='Удалить информационный поток?'
                description={editingRecord?.code}
                okText='Удалить'
                cancelText='Отмена'
                okButtonProps={{ danger: true }}
                onConfirm={handleDelete}
              >
                <Button danger icon={<DeleteOutlined />} loading={deleting}>Удалить</Button>
              </Popconfirm>
            ) : (
              <span />
            )}
            <Space>
              <Button onClick={() => { setFormDrawerOpen(false); form.resetFields() }}>Отмена</Button>
              <Button type='primary' loading={submitting} onClick={handleSave}>{formMode === 'create' ? 'Создать' : 'Сохранить'}</Button>
            </Space>
          </Space>
        }
      >
        <Form form={form} layout='vertical'>
          <Form.Item label='Код' name='code' rules={[{ required: true, message: 'Укажите код потока' }]} tooltip='Уникальный код потока (REQ-020), например FL-ORDER-TO-PAYMENT'>
            <Input placeholder='FL-CODE' />
          </Form.Item>
          <Form.Item label='Наименование' name='name' rules={[{ required: true, message: 'Укажите наименование' }]}>
            <Input placeholder='Наименование потока' />
          </Form.Item>
          <Form.Item label='Модуль-источник' name='sourceModuleId' rules={[{ required: true, message: 'Выберите модуль-источник' }]}>
            <Select
              showSearch
              optionFilterProp='label'
              placeholder='Выберите модуль'
              options={(modules ?? []).map((m) => ({
                label: `${informationSystems?.find((is) => is.id === m.informationSystemId)?.code ?? '?'} / ${m.code} – ${m.name}`,
                value: m.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            label='Модуль-назначение'
            name='targetModuleId'
            dependencies={['sourceModuleId']}
            rules={[
              { required: true, message: 'Выберите модуль-назначение' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || value !== getFieldValue('sourceModuleId')) return Promise.resolve()
                  return Promise.reject(new Error('Источник и назначение должны различаться'))
                },
              }),
            ]}
          >
            <Select
              showSearch
              optionFilterProp='label'
              placeholder='Выберите модуль'
              options={(modules ?? []).map((m) => ({
                label: `${informationSystems?.find((is) => is.id === m.informationSystemId)?.code ?? '?'} / ${m.code} – ${m.name}`,
                value: m.id,
              }))}
            />
          </Form.Item>
          <Form.Item label='Протокол' name='protocolId' rules={[{ required: true, message: 'Выберите протокол' }]}>
            <Select
              showSearch
              optionFilterProp='label'
              placeholder='Выберите протокол'
              options={(protocols ?? []).map((p) => ({ label: `${p.code} – ${p.name}`, value: p.id }))}
            />
          </Form.Item>
          <Form.Item label='Порт назначения' name='targetPort'>
            <InputNumber min={0} max={65535} style={{ width: '100%' }} placeholder='443' />
          </Form.Item>
          <Form.Item
            label='Проекты'
            name='projectIds'
            tooltip='В рамках каких проектов задействован поток — можно указать несколько проектов (отношение 1:N)'
          >
            <Select
              mode='multiple'
              allowClear
              showSearch
              optionFilterProp='label'
              placeholder='Проекты, в рамках которых задействован поток'
              options={(projects ?? []).map((p) => ({ label: `${p.code} – ${p.name}`, value: p.id }))}
            />
          </Form.Item>
          <Form.Item label='Статус' name='status' rules={[{ required: true, message: 'Выберите статус' }]}>
            <Select options={STATUS_OPTIONS.filter((o) => ['PLANNED', 'ACTIVE', 'RETIRED'].includes(o.value))} />
          </Form.Item>
          <Form.Item label='Действует с' name='validFrom'>
            <DatePicker style={{ width: '100%' }} format='DD.MM.YYYY' placeholder='Дата начала' />
          </Form.Item>
          <Form.Item label='Действует до' name='validTo'>
            <DatePicker style={{ width: '100%' }} format='DD.MM.YYYY' placeholder='Дата окончания' />
          </Form.Item>
          <Form.Item label='Описание' name='description'>
            <Input.TextArea rows={3} placeholder='Описание потока' />
          </Form.Item>
        </Form>
      </Drawer>

    </>
  )
}


