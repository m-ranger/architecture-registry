import { useMemo, useState } from 'react'
import { Alert, App, Button, Card, Descriptions, Drawer, Form, Input, Popconfirm, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { StatusTag, STATUS_OPTIONS } from '../components/StatusTag'
import { routersApi, interfacesApi, segmentsApi } from '../api'
import type { RouterInput } from '../api'
import { useApi } from '../api/useApi'
import type { ApiError } from '../api/client'
import type { Router } from '../types'

export default function RoutersPage() {
  const { message } = App.useApp()
  const { data: routers, loading: isLoading, error: isError, refetch } = useApi(routersApi.getAll)
  const { data: interfaces } = useApi(interfacesApi.getAll)
  const { data: segments } = useApi(segmentsApi.getAll)
  const [q, setQ] = useState('')
  const [active, setActive] = useState<Router | null>(null)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Router | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form] = Form.useForm<RouterInput>()

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (formMode === 'create') {
        await routersApi.create(values)
        message.success(`Маршрутизатор «${values.name}» добавлен`)
      } else if (editingRecord) {
        await routersApi.update(editingRecord.id, values)
        message.success(`Маршрутизатор «${values.name}» обновлён`)
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

  const handleEdit = (record: Router) => {
    setActive(null)
    setEditingRecord(record)
    setFormMode('edit')
    form.setFieldsValue({
      name: record.name,
      deviceType: record.deviceType,
      vendor: record.vendor,
      model: record.model,
      managementAddress: record.managementAddress,
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
      await routersApi.remove(editingRecord.id)
      message.success(`Маршрутизатор «${editingRecord.name}» удалён`)
      setFormDrawerOpen(false)
      form.resetFields()
      setEditingRecord(null)
      setActive(null)
      refetch()
    } catch (err) {
      message.error((err as ApiError)?.message ?? 'Не удалось удалить маршрутизатор')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = useMemo(() => {
    if (!routers) return []
    const t = q.trim().toLowerCase()
    if (!t) return routers
    return routers.filter((x) => `${x.name} ${x.vendor ?? ''} ${x.model ?? ''} ${x.managementAddress ?? ''}`.toLowerCase().includes(t))
  }, [q, routers])

  const routerInterfaces = active ? interfaces?.filter((n) => n.routerId === active.id) ?? [] : []

  const columns: ColumnsType<Router> = [
    { title: 'Имя', dataIndex: 'name', key: 'name', width: 180, render: (v: string) => <Tag color='purple'>{v}</Tag> },
    { title: 'Тип', dataIndex: 'deviceType', key: 'type', width: 130, render: (v?: string) => v ?? '—' },
    { title: 'Вендор / модель', key: 'vm', width: 200, render: (_: unknown, r: Router) => [r.vendor, r.model].filter(Boolean).join(' / ') || '—' },
    { title: 'Адрес управления', dataIndex: 'managementAddress', key: 'mgmt', width: 170, render: (v?: string) => <Typography.Text type='secondary' style={{ fontSize: 12 }}>{v ?? '—'}</Typography.Text> },
    { title: 'Интерфейсов', key: 'nic', width: 130, render: (_: unknown, r: Router) => interfaces?.filter((n) => n.routerId === r.id).length ?? 0 },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 120, render: (v: string) => <StatusTag value={v} /> },
  ]

  if (isError) {
    return <Alert message="Ошибка загрузки" description={isError.message} type="error" showIcon />
  }

  if (isLoading || !routers) {
    return <Spin spinning />
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Маршрутизаторы</Typography.Title>
          <Typography.Text type='secondary'>
            Сущность <Typography.Text code>router</Typography.Text> · Сетевое оборудование уровня L3; подключается к сегментам через network_interface
          </Typography.Text>
        </div>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder='Имя маршрутизатора' value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <Button type='primary' icon={<PlusOutlined />} onClick={handleCreate}>Добавить маршрутизатор</Button>
        </Space>
      </div>
      <Card size='small' style={{ borderRadius: 10 }}>
        <Table<Router>
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
        extra={<Button type='primary' icon={<EditOutlined />} onClick={() => active && handleEdit(active)}>Редактировать</Button>}
      >
        {active && (
          <Space direction='vertical' size={16} style={{ width: '100%' }}>
            <Descriptions size='small' bordered column={1}>
              <Descriptions.Item label='Имя'>{active.name}</Descriptions.Item>
              <Descriptions.Item label='Тип'>{active.deviceType ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Вендор'>{active.vendor ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Модель'>{active.model ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Адрес управления'>{active.managementAddress ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Статус'><StatusTag value={active.status} /></Descriptions.Item>
              <Descriptions.Item label='Описание'>{active.description ?? '—'}</Descriptions.Item>
            </Descriptions>
            <Card size='small' title={`Интерфейсы (${routerInterfaces.length})`} style={{ borderRadius: 8 }}>
              {routerInterfaces.map((n) => (
                <div key={n.id} style={{ marginBottom: 6 }}>
                  <Space>
                    <Tag>{n.name}</Tag>
                    <Typography.Text style={{ fontSize: 12 }}>
                      {n.ipAddress ?? '—'} · {segments?.find((s) => s.id === n.networkSegmentId)?.code ?? '—'}
                    </Typography.Text>
                    <StatusTag value={n.status} />
                  </Space>
                </div>
              ))}
              {routerInterfaces.length === 0 && <Typography.Text type='secondary'>Интерфейсов нет</Typography.Text>}
            </Card>
          </Space>
        )}
      </Drawer>

      <Drawer
        title={formMode === 'create' ? 'Добавить маршрутизатор' : 'Редактировать маршрутизатор'}
        open={formDrawerOpen}
        onClose={() => { setFormDrawerOpen(false); form.resetFields() }}
        width={560}
        destroyOnClose
        footer={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            {formMode === 'edit' ? (
              <Popconfirm
                title='Удалить маршрутизатор?'
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
              <Button type='primary' loading={submitting} onClick={handleSave}>{formMode === 'create' ? 'Создать' : 'Сохранить'}</Button>
            </Space>
          </Space>
        }
      >
        <Form form={form} layout='vertical'>
          <Form.Item label='Имя' name='name' rules={[{ required: true, message: 'Укажите имя маршрутизатора' }]}>
            <Input placeholder='rtr-core-01' />
          </Form.Item>
          <Form.Item label='Тип устройства' name='deviceType'>
            <Input placeholder='ROUTER / L3-SWITCH' />
          </Form.Item>
          <Form.Item label='Вендор' name='vendor'>
            <Input placeholder='Cisco / Huawei' />
          </Form.Item>
          <Form.Item label='Модель' name='model'>
            <Input placeholder='ISR 4331' />
          </Form.Item>
          <Form.Item label='Адрес управления' name='managementAddress'>
            <Input placeholder='10.0.0.1' />
          </Form.Item>
          <Form.Item label='Статус' name='status' rules={[{ required: true, message: 'Выберите статус' }]}>
            <Select options={STATUS_OPTIONS.filter((o) => ['PLANNED', 'ACTIVE', 'RETIRED'].includes(o.value))} />
          </Form.Item>
          <Form.Item label='Описание' name='description'>
            <Input.TextArea rows={3} placeholder='Описание устройства' />
          </Form.Item>
        </Form>
      </Drawer>

    </>
  )
}
