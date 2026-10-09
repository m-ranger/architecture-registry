import { useMemo, useState } from 'react'
import { Button, Card, Descriptions, Drawer, Form, Input, Popconfirm, Select, Space, Table, Tag, Typography, Spin, Alert, App } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { StatusTag, STATUS_OPTIONS } from '../components/StatusTag'
import { serversApi, deploymentsApi, interfacesApi } from '../api'
import type { ServerInput } from '../api'
import { useApi } from '../api/useApi'
import type { ApiError } from '../api/client'
import type { Server } from '../types'

export default function ServersPage() {
  const { message } = App.useApp()
  const { data: servers, loading: isLoading, error: isError, refetch } = useApi(serversApi.getAll)
  const { data: deployments } = useApi(deploymentsApi.getAll)
  const { data: interfaces } = useApi(interfacesApi.getAll)
  const [q, setQ] = useState('')
  const [active, setActive] = useState<Server | null>(null)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Server | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form] = Form.useForm<ServerInput>()

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (formMode === 'create') {
        await serversApi.create(values)
        message.success(`Сервер «${values.name}» добавлен`)
      } else if (editingRecord) {
        await serversApi.update(editingRecord.id, values)
        message.success(`Сервер «${values.name}» обновлён`)
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

  const handleEdit = (record: Server) => {
    setActive(null) // закрыть детали
    setEditingRecord(record)
    setFormMode('edit')
    form.setFieldsValue({
      name: record.name,
      serverType: record.serverType,
      status: record.status,
      description: record.description,
    })
    setFormDrawerOpen(true)
  }

  /** Удаление доступно только в режиме редактирования — из формы изменений */
  const handleDelete = async () => {
    if (!editingRecord) return
    try {
      setDeleting(true)
      await serversApi.remove(editingRecord.id)
      message.success(`Сервер «${editingRecord.name}» удалён`)
      setFormDrawerOpen(false)
      form.resetFields()
      setEditingRecord(null)
      setActive(null)
      refetch()
    } catch (err) {
      message.error((err as ApiError)?.message ?? 'Не удалось удалить сервер')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = useMemo(() => {
    if (!servers) return []
    const t = q.trim().toLowerCase()
    if (!t) return servers
    return servers.filter((x) => `${x.name} ${x.serverType ?? ''} ${x.description ?? ''}`.toLowerCase().includes(t))
  }, [q, servers])

  const columns: ColumnsType<Server> = [
    { title: 'Имя', dataIndex: 'name', key: 'name', width: 220, render: (v: string) => <Tag color='green'>{v}</Tag> },
    { title: 'Тип', dataIndex: 'serverType', key: 'type', width: 120, render: (v?: string) => v ?? '—' },
    { title: 'Размещений', key: 'dep', width: 120, render: (_: unknown, r: Server) => deployments?.filter((d) => d.serverId === r.id).length ?? 0 },
    { title: 'Интерфейсов', key: 'nic', width: 120, render: (_: unknown, r: Server) => interfaces?.filter((n) => n.serverId === r.id).length ?? 0 },
    { title: 'Описание', dataIndex: 'description', key: 'description' },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 120, render: (v: string) => <StatusTag value={v} /> },
  ]

  if (isError) {
    return <Alert message="Ошибка загрузки" description={isError.message} type="error" showIcon />
  }

  if (isLoading || !servers) {
    return <Spin spinning />
  }

  const serverDeployments = active ? deployments?.filter((d) => d.serverId === active.id) ?? [] : []
  const serverInterfaces = active ? interfaces?.filter((n) => n.serverId === active.id) ?? [] : []

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Серверы</Typography.Title>
          <Typography.Text type='secondary'>
            Сущность <Typography.Text code>server</Typography.Text> · Физический или виртуальный хост (REQ-011)
          </Typography.Text>
        </div>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder='Имя сервера' value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <Button type='primary' icon={<PlusOutlined />} onClick={handleCreate}>Добавить сервер</Button>
        </Space>
      </div>
      <Card size='small' style={{ borderRadius: 10 }}>
        <Table<Server>
          rowKey='id'
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Всего: ${t}` }}
          onRow={(rec) => ({ onClick: () => setActive(rec), style: { cursor: 'pointer' } })}
        />
      </Card>
      <Drawer
        title={active ? active.name : ''}
        open={!!active}
        onClose={() => setActive(null)}
        width={640}
        extra={
          <Button type='primary' icon={<EditOutlined />} onClick={() => active && handleEdit(active)}>
            Редактировать
          </Button>
        }
      >
        {active && (
          <Space direction='vertical' size={16} style={{ width: '100%' }}>
            <Descriptions size='small' bordered column={1}>
              <Descriptions.Item label='Имя'>{active.name}</Descriptions.Item>
              <Descriptions.Item label='Тип'>{active.serverType ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Статус'><StatusTag value={active.status} /></Descriptions.Item>
              <Descriptions.Item label='Описание'>{active.description ?? '—'}</Descriptions.Item>
            </Descriptions>
            <Card size='small' title={`Размещения (${serverDeployments.length})`} style={{ borderRadius: 8 }}>
              {serverDeployments.map((d) => (
                <div key={d.id} style={{ marginBottom: 6 }}>
                  <Space><Tag>{d.deploymentRole ?? '—'}</Tag><StatusTag value={d.deploymentState} /></Space>
                </div>
              ))}
              {serverDeployments.length === 0 && <Typography.Text type='secondary'>Размещений нет</Typography.Text>}
            </Card>
            <Card size='small' title={`Сетевые интерфейсы (${serverInterfaces.length})`} style={{ borderRadius: 8 }}>
              {serverInterfaces.map((n) => (
                <div key={n.id} style={{ marginBottom: 6 }}>
                  <Space><Tag color='purple'>{n.name}</Tag><Typography.Text>{n.ipAddress ?? '—'}</Typography.Text><StatusTag value={n.status} /></Space>
                </div>
              ))}
              {serverInterfaces.length === 0 && <Typography.Text type='secondary'>Интерфейсов нет</Typography.Text>}
            </Card>
          </Space>
        )}
      </Drawer>
      <Drawer
        title={formMode === 'create' ? 'Добавить сервер' : 'Редактировать сервер'}
        open={formDrawerOpen}
        onClose={() => { setFormDrawerOpen(false); form.resetFields() }}
        width={560}
        footer={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            {formMode === 'edit' ? (
              <Popconfirm
                title='Удалить сервер?'
                description={editingRecord?.name}
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
              <Button type='primary' onClick={handleSave} loading={submitting}>
                {formMode === 'create' ? 'Создать' : 'Сохранить'}
              </Button>
            </Space>
          </Space>
        }
        destroyOnClose
      >
        <Form form={form} layout='vertical'>
          <Form.Item label='Имя' name='name' rules={[{ required: true, message: 'Укажите имя сервера' }]}>
            <Input placeholder='srv-app-01' />
          </Form.Item>
          <Form.Item label='Тип' name='serverType'>
            <Input placeholder='VM / BAREMETAL' />
          </Form.Item>
          <Form.Item label='Статус' name='status' rules={[{ required: true, message: 'Выберите статус' }]}>
            <Select options={STATUS_OPTIONS.filter((o) => ['PLANNED', 'ACTIVE', 'RETIRED'].includes(o.value))} />
          </Form.Item>
          <Form.Item label='Описание' name='description'>
            <Input.TextArea rows={3} placeholder='Описание сервера' />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  )
}
