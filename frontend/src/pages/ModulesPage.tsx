import { useMemo, useState } from 'react'
import { Alert, Button, Card, Drawer, Form, Input, Select, Space, Table, Tag, Typography, Spin, App } from 'antd'
import { SearchOutlined, PlusOutlined, ExportOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { StatusTag, STATUS_OPTIONS } from '../components/StatusTag'
import { modulesApi, instancesApi, flowsApi, informationSystemsApi, environmentsApi, protocolsApi } from '../api'
import type { ApplicationModuleInput } from '../api'
import { useApi } from '../api/useApi'
import type { ApiError } from '../api/client'
import type { ApplicationModule } from '../types'

export default function ModulesPage() {
  const { message } = App.useApp()
  const { data: modules, loading, error, refetch } = useApi(modulesApi.getAll)
  const { data: instances } = useApi(instancesApi.getAll)
  const { data: flows } = useApi(flowsApi.getAll)
  const { data: informationSystems } = useApi(informationSystemsApi.getAll)
  const { data: environments } = useApi(environmentsApi.getAll)
  const { data: protocols } = useApi(protocolsApi.getAll)

  const [q, setQ] = useState('')
  const [type, setType] = useState<string | undefined>(undefined)
  const [active, setActive] = useState<ApplicationModule | null>(null)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ApplicationModule | null>(null)
  const [form] = Form.useForm<ApplicationModuleInput>()
const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (formMode === 'create') {
        await modulesApi.create(values)
        message.success(`Модуль «${values.code}» добавлен`)
      } else if (editingRecord) {
        await modulesApi.update(editingRecord.id, values)
        message.success(`Модуль «${values.code}» обновлён`)
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
      // ошибки валидации формы antd игнорируем — они уже показаны инлайн
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

  const handleEdit = (record: ApplicationModule) => {
    setActive(null) // закрыть детали
    setEditingRecord(record)
    setFormMode('edit')
    form.setFieldsValue({
      informationSystemId: record.informationSystemId,
      code: record.code,
      name: record.name,
      purpose: record.purpose,
      moduleType: record.moduleType,
      version: record.version,
      status: record.status,
    })
    setFormDrawerOpen(true)
  }

  const filtered = useMemo(() => {
    if (!modules || !informationSystems) return []
    const t = q.trim().toLowerCase()
    return modules.filter((m) => {
      const isName = informationSystems.find((is) => is.id === m.informationSystemId)?.code ?? ''
      const matchesQ = !t || `${m.code} ${m.name} ${m.purpose} ${isName}`.toLowerCase().includes(t)
      const matchesType = !type || m.moduleType === type
      return matchesQ && matchesType
    })
  }, [q, type, modules, informationSystems])

  const typeOptions = ['FRONTEND', 'BACKEND', 'API', 'INTEGRATION', 'DATABASE', 'BATCH', 'ADAPTER']

  const columns: ColumnsType<ApplicationModule> = [
    { title: 'Код', dataIndex: 'code', key: 'code', width: 160, render: (v: string) => <Typography.Text strong>{v}</Typography.Text> },
    { title: 'ИС', key: 'is', width: 150, render: (_: unknown, r: ApplicationModule) => informationSystems?.find((is) => is.id === r.informationSystemId)?.code },
    { title: 'Наименование', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Тип', dataIndex: 'moduleType', key: 'type', width: 130, render: (v?: string) => (v ? <Tag color='geekblue'>{v}</Tag> : '—'), filters: typeOptions.map((x) => ({ text: x, value: x })), onFilter: (v, r) => r.moduleType === v },
    { title: 'Версия', dataIndex: 'version', key: 'version', width: 100 },
    { title: 'Потоков ↑/↓', key: 'flows', width: 120, render: (_: unknown, r: ApplicationModule) => <Tag color='purple'>{flows?.filter((f) => f.sourceModuleId === r.id).length ?? 0} / {flows?.filter((f) => f.targetModuleId === r.id).length ?? 0}</Tag> },
    { title: 'Экземпляров', key: 'inst', width: 110, render: (_: unknown, r: ApplicationModule) => instances?.filter((i) => i.moduleId === r.id).length ?? 0 },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 120, render: (v: string) => <StatusTag value={v} />, filters: [{ text: 'Активно', value: 'ACTIVE' }, { text: 'План', value: 'PLANNED' }, { text: 'Выведено', value: 'RETIRED' }], onFilter: (v, r) => r.status === v },
  ]

  if (error) {
    return <Alert message="Ошибка загрузки" description={error.message} type="error" showIcon />
  }

  const outgoingFlows = active ? flows?.filter((f) => f.sourceModuleId === active.id) ?? [] : []
  const incomingFlows = active ? flows?.filter((f) => f.targetModuleId === active.id) ?? [] : []
  const moduleInstances = active ? instances?.filter((i) => i.moduleId === active.id) ?? [] : []

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Модули ИС</Typography.Title>
          <Typography.Text type='secondary'>Сущность <Typography.Text code>application_module</Typography.Text>. Уникальность (ИС, код) — REQ-003.</Typography.Text>
        </div>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder='Код, название, ИС' value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <Button onClick={() => setType(type ? undefined : typeOptions[0])} icon={<ExportOutlined />}>{type ?? 'Все типы'}</Button>
          <Button type='primary' icon={<PlusOutlined />} onClick={handleCreate}>Добавить модуль</Button>
        </Space>
      </div>
      <Alert type='info' showIcon style={{ borderRadius: 10 }} message='Потоки считаются от модуля, не от экземпляров' description='Числа ↑/↓ получены из information_flow по source_module_id / target_module_id (REQ-021).' />
      <Card size='small' style={{ borderRadius: 10 }}>
        <Spin spinning={loading}>
          <Table<ApplicationModule> rowKey='id' columns={columns} dataSource={filtered} pagination={{ pageSize: 8 }} onRow={(rec) => ({ onClick: () => setActive(rec), style: { cursor: 'pointer' } })} />
        </Spin>
      </Card>
      <Drawer
        title={active ? `${active.code} — ${active.name}` : ''}
        open={!!active}
        onClose={() => setActive(null)}
        width={640}
        extra={
          <Space>
            <Tag color='blue'>{active?.code}</Tag>
            <Button icon={<EditOutlined />} onClick={() => active && handleEdit(active)} size='small'>
              Редактировать
            </Button>
          </Space>
        }
      >
        {active && (
          <Space direction='vertical' size={16} style={{ width: '100%' }}>
            <Typography.Paragraph type='secondary' style={{ marginBottom: 0 }}>{active.purpose}</Typography.Paragraph>
            <Card size='small' title='Экземпляры по средам (REQ-022)' style={{ borderRadius: 8 }}>
              <Table rowKey='id' size='small' pagination={false} dataSource={moduleInstances} columns={[
                { title: 'Экземпляр', dataIndex: 'name', key: 'name', render: (v: string) => <Typography.Text copyable>{v}</Typography.Text> },
                { title: 'Среда', dataIndex: 'environmentId', key: 'env', render: (v: string) => <Tag color='blue'>{environments?.find((e) => e.id === v)?.code}</Tag> },
                { title: 'Статус', dataIndex: 'status', key: 'status', render: (v: string) => <StatusTag value={v} /> },
              ]} />
            </Card>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Card size='small' title='Исходящие потоки' style={{ borderRadius: 8 }}>
                {outgoingFlows.map((f) => <div key={f.id} style={{ marginBottom: 6 }}><Tag color='geekblue'>{f.code}</Tag><Typography.Text style={{ fontSize: 12 }}>{protocols?.find((p) => p.id === f.protocolId)?.code} : {f.targetPort ?? '—'} → {modules?.find((m) => m.id === f.targetModuleId)?.code}</Typography.Text></div>)}
                {outgoingFlows.length === 0 && <Typography.Text type='secondary'>Нет исходящих</Typography.Text>}
              </Card>
              <Card size='small' title='Входящие потоки' style={{ borderRadius: 8 }}>
                {incomingFlows.map((f) => <div key={f.id} style={{ marginBottom: 6 }}><Tag color='purple'>{f.code}</Tag><Typography.Text style={{ fontSize: 12 }}>{protocols?.find((p) => p.id === f.protocolId)?.code} : {f.targetPort ?? '—'} ← {modules?.find((m) => m.id === f.sourceModuleId)?.code}</Typography.Text></div>)}
                {incomingFlows.length === 0 && <Typography.Text type='secondary'>Нет входящих</Typography.Text>}
              </Card>
            </div>
          </Space>
        )}
      </Drawer>
<Drawer
        title={formMode === 'create' ? 'Добавить модуль' : 'Редактировать модуль'}
        open={formDrawerOpen}
        onClose={() => { setFormDrawerOpen(false); form.resetFields() }}
        width={560}
        footer={
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => { setFormDrawerOpen(false); form.resetFields() }}>Отмена</Button>
            <Button type='primary' onClick={handleSave} loading={submitting}>
              {formMode === 'create' ? 'Создать' : 'Сохранить'}
            </Button>
          </Space>
        }
        destroyOnClose
      >
        <Form form={form} layout='vertical'>
          <Form.Item label='Информационная система' name='informationSystemId' rules={[{ required: true, message: 'Выберите ИС' }]}>
            <Select
              placeholder='Выберите ИС'
              options={informationSystems?.map(is => ({ label: `${is.code} – ${is.name}`, value: is.id })) ?? []}
            />
          </Form.Item>
          <Form.Item label='Код' name='code' rules={[{ required: true, message: 'Укажите код модуля' }]}>
            <Input placeholder='MOD-CODE' />
          </Form.Item>
          <Form.Item label='Наименование' name='name' rules={[{ required: true, message: 'Укажите наименование' }]}>
            <Input placeholder='Наименование модуля' />
          </Form.Item>
          <Form.Item label='Назначение' name='purpose' rules={[{ required: true, message: 'Укажите назначение модуля' }]}>
            <Input.TextArea rows={2} placeholder='Краткое описание назначения модуля' />
          </Form.Item>
          <Form.Item label='Тип модуля' name='moduleType'>
            <Input placeholder='Тип модуля' />
          </Form.Item>
          <Form.Item label='Версия' name='version'>
            <Input placeholder='Версия' />
          </Form.Item>
          <Form.Item label='Статус' name='status' rules={[{ required: true, message: 'Выберите статус' }]}>
            <Select options={STATUS_OPTIONS.filter((o) => ['PLANNED', 'ACTIVE', 'RETIRED'].includes(o.value))} />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  )
}
