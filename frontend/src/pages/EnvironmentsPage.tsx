import { useMemo, useState } from 'react'
import { Alert, App, Button, Card, Descriptions, Drawer, Form, Input, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { StatusTag, STATUS_OPTIONS } from '../components/StatusTag'
import { environmentsApi, instancesApi, modulesApi } from '../api'
import type { EnvironmentInput } from '../api'
import { useApi } from '../api/useApi'
import type { ApiError } from '../api/client'
import type { Environment } from '../types'

const CRITICALITY_OPTIONS = [
  { value: 'LOW', label: 'LOW' },
  { value: 'MEDIUM', label: 'MEDIUM' },
  { value: 'HIGH', label: 'HIGH' },
  { value: 'CRITICAL', label: 'CRITICAL' },
]

const CRITICALITY_COLOR: Record<string, string> = { CRITICAL: 'red', HIGH: 'orange', MEDIUM: 'blue', LOW: 'default' }

export default function EnvironmentsPage() {
  const { message } = App.useApp()
  const { data: environments, loading: isLoading, error: isError, refetch } = useApi(environmentsApi.getAll)
  const { data: instances } = useApi(instancesApi.getAll)
  const { data: modules } = useApi(modulesApi.getAll)
  const [q, setQ] = useState('')
  const [active, setActive] = useState<Environment | null>(null)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Environment | null>(null)
  const [form] = Form.useForm<EnvironmentInput>()

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (formMode === 'create') {
        await environmentsApi.create(values)
        message.success(`Среда «${values.code}» добавлена`)
      } else if (editingRecord) {
        await environmentsApi.update(editingRecord.id, values)
        message.success(`Среда «${values.code}» обновлена`)
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

  const handleEdit = (record: Environment) => {
    setActive(null)
    setEditingRecord(record)
    setFormMode('edit')
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      criticality: record.criticality,
      description: record.description,
      status: record.status,
    })
    setFormDrawerOpen(true)
  }

  const filtered = useMemo(() => {
    if (!environments) return []
    const t = q.trim().toLowerCase()
    if (!t) return environments
    return environments.filter((x) => `${x.code} ${x.name} ${x.criticality ?? ''} ${x.description ?? ''}`.toLowerCase().includes(t))
  }, [q, environments])

  const columns: ColumnsType<Environment> = [
    { title: 'Код', dataIndex: 'code', key: 'code', width: 120, render: (v: string) => <Tag color='cyan'>{v}</Tag> },
    { title: 'Наименование', dataIndex: 'name', key: 'name' },
    { title: 'Критичность', dataIndex: 'criticality', key: 'criticality', width: 140, render: (v?: string) => (v ? <Tag color={CRITICALITY_COLOR[v] ?? 'default'}>{v}</Tag> : '—') },
    { title: 'Экземпляров', key: 'inst', width: 140, render: (_: unknown, r: Environment) => instances?.filter((i) => i.environmentId === r.id).length ?? 0 },
    { title: 'Описание', dataIndex: 'description', key: 'description', render: (v?: string) => <Typography.Text type='secondary' style={{ fontSize: 12 }}>{v ?? '—'}</Typography.Text> },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 120, render: (v: string) => <StatusTag value={v} /> },
  ]

  if (isError) {
    return <Alert message="Ошибка загрузки" description={isError.message} type="error" showIcon />
  }

  if (isLoading || !environments) {
    return <Spin spinning />
  }

  const envInstances = active ? instances?.filter((i) => i.environmentId === active.id) ?? [] : []

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Среды эксплуатации</Typography.Title>
          <Typography.Text type='secondary'>
            Сущность <Typography.Text code>environment</Typography.Text> · Экземпляр модуля привязан ровно к одной среде (REQ-008, REQ-022)
          </Typography.Text>
        </div>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder='Код или наименование' value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <Button type='primary' icon={<PlusOutlined />} onClick={handleCreate}>Добавить среду</Button>
        </Space>
      </div>
      <Card size='small' style={{ borderRadius: 10 }}>
        <Table<Environment>
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
        extra={<Button icon={<EditOutlined />} size='small' onClick={() => active && handleEdit(active)}>Редактировать</Button>}
      >
        {active && (
          <Space direction='vertical' size={16} style={{ width: '100%' }}>
            <Descriptions size='small' bordered column={1}>
              <Descriptions.Item label='Код'>{active.code}</Descriptions.Item>
              <Descriptions.Item label='Наименование'>{active.name}</Descriptions.Item>
              <Descriptions.Item label='Критичность'>{active.criticality ? <Tag color={CRITICALITY_COLOR[active.criticality] ?? 'default'}>{active.criticality}</Tag> : '—'}</Descriptions.Item>
              <Descriptions.Item label='Статус'><StatusTag value={active.status} /></Descriptions.Item>
              <Descriptions.Item label='Описание'>{active.description ?? '—'}</Descriptions.Item>
            </Descriptions>
            <Card size='small' title={`Экземпляры модулей (${envInstances.length})`} style={{ borderRadius: 8 }}>
              {envInstances.map((i) => (
                <div key={i.id} style={{ marginBottom: 6 }}>
                  <Space>
                    <Tag color='blue'>{i.name}</Tag>
                    <Tag color='geekblue'>{modules?.find((m) => m.id === i.moduleId)?.code ?? '—'}</Tag>
                    <StatusTag value={i.status} />
                  </Space>
                </div>
              ))}
              {envInstances.length === 0 && <Typography.Text type='secondary'>Экземпляров нет</Typography.Text>}
            </Card>
          </Space>
        )}
      </Drawer>

      <Drawer
        title={formMode === 'create' ? 'Добавить среду' : 'Редактировать среду'}
        open={formDrawerOpen}
        onClose={() => { setFormDrawerOpen(false); form.resetFields() }}
        width={560}
        destroyOnClose
        footer={
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => { setFormDrawerOpen(false); form.resetFields() }}>Отмена</Button>
            <Button type='primary' loading={submitting} onClick={handleSave}>{formMode === 'create' ? 'Создать' : 'Сохранить'}</Button>
          </Space>
        }
      >
        <Form form={form} layout='vertical'>
          <Form.Item label='Код' name='code' rules={[{ required: true, message: 'Укажите код среды' }]} tooltip='Код уникален (REQ-008), например DEV / TEST / QUA / PROD'>
            <Input placeholder='DEV' />
          </Form.Item>
          <Form.Item label='Наименование' name='name' rules={[{ required: true, message: 'Укажите наименование' }]}>
            <Input placeholder='Development' />
          </Form.Item>
          <Form.Item label='Критичность' name='criticality'>
            <Select allowClear options={CRITICALITY_OPTIONS} placeholder='Уровень критичности' />
          </Form.Item>
          <Form.Item label='Статус' name='status' rules={[{ required: true, message: 'Выберите статус' }]}>
            <Select options={STATUS_OPTIONS.filter((o) => ['PLANNED', 'ACTIVE', 'RETIRED'].includes(o.value))} />
          </Form.Item>
          <Form.Item label='Описание' name='description'>
            <Input.TextArea rows={3} placeholder='Описание среды эксплуатации' />
          </Form.Item>
        </Form>
      </Drawer>

    </>
  )
}
