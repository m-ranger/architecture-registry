import { useMemo, useState } from 'react'
import { Alert, App, Button, Card, Descriptions, Drawer, Form, Input, InputNumber, Popconfirm, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { StatusTag, STATUS_OPTIONS } from '../components/StatusTag'
import { protocolsApi, flowsApi, modulesApi } from '../api'
import type { ProtocolInput } from '../api'
import { useApi } from '../api/useApi'
import type { ApiError } from '../api/client'
import type { Protocol } from '../types'

export default function ProtocolsPage() {
  const { message } = App.useApp()
  const { data: protocols, loading: isLoading, error: isError, refetch } = useApi(protocolsApi.getAll)
  const { data: flows } = useApi(flowsApi.getAll)
  const { data: modules } = useApi(modulesApi.getAll)
  const [q, setQ] = useState('')
  const [active, setActive] = useState<Protocol | null>(null)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Protocol | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form] = Form.useForm<ProtocolInput>()

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (formMode === 'create') {
        await protocolsApi.create(values)
        message.success(`Протокол «${values.code}» добавлен`)
      } else if (editingRecord) {
        await protocolsApi.update(editingRecord.id, values)
        message.success(`Протокол «${values.code}» обновлён`)
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
    form.setFieldsValue({ status: 'ACTIVE' })
    setEditingRecord(null)
    setFormDrawerOpen(true)
  }

  const handleEdit = (record: Protocol) => {
    setActive(null)
    setEditingRecord(record)
    setFormMode('edit')
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      transport: record.transport,
      layer: record.layer,
      defaultPort: record.defaultPort,
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
      await protocolsApi.remove(editingRecord.id)
      message.success(`Протокол «${editingRecord.code}» удалён`)
      setFormDrawerOpen(false)
      form.resetFields()
      setEditingRecord(null)
      setActive(null)
      refetch()
    } catch (err) {
      message.error((err as ApiError)?.message ?? 'Не удалось удалить протокол')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = useMemo(() => {
    if (!protocols) return []
    const t = q.trim().toLowerCase()
    if (!t) return protocols
    return protocols.filter((x) => `${x.code} ${x.name} ${x.transport ?? ''} ${x.layer ?? ''}`.toLowerCase().includes(t))
  }, [q, protocols])

  const columns: ColumnsType<Protocol> = [
    { title: 'Код', dataIndex: 'code', key: 'code', width: 130, render: (v: string) => <Tag color='magenta'>{v}</Tag> },
    { title: 'Наименование', dataIndex: 'name', key: 'name' },
    { title: 'Транспорт', dataIndex: 'transport', key: 'transport', width: 110, render: (v?: string) => v ?? '—' },
    { title: 'Уровень', dataIndex: 'layer', key: 'layer', width: 100, render: (v?: string) => v ?? '—' },
    { title: 'Порт по умолч.', dataIndex: 'defaultPort', key: 'port', width: 130, render: (v?: number) => v ?? '—' },
    { title: 'Исп. в потоках', key: 'flows', width: 140, render: (_: unknown, r: Protocol) => flows?.filter((f) => f.protocolId === r.id).length ?? 0 },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 110, render: (v: string) => <StatusTag value={v} /> },
  ]

  if (isError) {
    return <Alert message="Ошибка загрузки" description={isError.message} type="error" showIcon />
  }

  if (isLoading || !protocols) {
    return <Spin spinning />
  }

  const protocolFlows = active ? flows?.filter((f) => f.protocolId === active.id) ?? [] : []

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Протоколы</Typography.Title>
          <Typography.Text type='secondary'>
            Сущность <Typography.Text code>protocol</Typography.Text> · Справочник протоколов для information_flow (REQ-019)
          </Typography.Text>
        </div>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder='Код протокола' value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <Button type='primary' icon={<PlusOutlined />} onClick={handleCreate}>Добавить протокол</Button>
        </Space>
      </div>
      <Card size='small' style={{ borderRadius: 10 }}>
        <Table<Protocol>
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
              <Descriptions.Item label='Транспорт'>{active.transport ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Уровень'>{active.layer ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Порт по умолчанию'>{active.defaultPort ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Статус'><StatusTag value={active.status} /></Descriptions.Item>
              <Descriptions.Item label='Описание'>{active.description ?? '—'}</Descriptions.Item>
            </Descriptions>
            <Card size='small' title={`Потоки с этим протоколом (${protocolFlows.length})`} style={{ borderRadius: 8 }}>
              {protocolFlows.map((f) => (
                <div key={f.id} style={{ marginBottom: 6 }}>
                  <Space>
                    <Tag color='blue'>{f.code}</Tag>
                    <Typography.Text style={{ fontSize: 12 }}>
                      {modules?.find((m) => m.id === f.sourceModuleId)?.code ?? '—'} → {modules?.find((m) => m.id === f.targetModuleId)?.code ?? '—'} : {f.targetPort ?? '—'}
                    </Typography.Text>
                    <StatusTag value={f.status} />
                  </Space>
                </div>
              ))}
              {protocolFlows.length === 0 && <Typography.Text type='secondary'>Потоков нет</Typography.Text>}
            </Card>
          </Space>
        )}
      </Drawer>

      <Drawer
        title={formMode === 'create' ? 'Добавить протокол' : 'Редактировать протокол'}
        open={formDrawerOpen}
        onClose={() => { setFormDrawerOpen(false); form.resetFields() }}
        width={560}
        destroyOnClose
        footer={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            {formMode === 'edit' ? (
              <Popconfirm
                title='Удалить протокол?'
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
          <Form.Item label='Код' name='code' rules={[{ required: true, message: 'Укажите код протокола' }]} tooltip='Уникальный код протокола (REQ-019), например HTTPS'>
            <Input placeholder='HTTPS' />
          </Form.Item>
          <Form.Item label='Наименование' name='name' rules={[{ required: true, message: 'Укажите наименование' }]}>
            <Input placeholder='HTTP over TLS' />
          </Form.Item>
          <Form.Item label='Транспорт' name='transport'>
            <Input placeholder='TCP / UDP' />
          </Form.Item>
          <Form.Item label='Уровень' name='layer'>
            <Input placeholder='L7' />
          </Form.Item>
          <Form.Item label='Порт по умолчанию' name='defaultPort'>
            <InputNumber min={0} max={65535} style={{ width: '100%' }} placeholder='443' />
          </Form.Item>
          <Form.Item label='Статус' name='status' rules={[{ required: true, message: 'Выберите статус' }]}>
            <Select options={STATUS_OPTIONS.filter((o) => ['ACTIVE', 'RETIRED'].includes(o.value))} />
          </Form.Item>
          <Form.Item label='Описание' name='description'>
            <Input.TextArea rows={3} placeholder='Описание протокола' />
          </Form.Item>
        </Form>
      </Drawer>

    </>
  )
}
