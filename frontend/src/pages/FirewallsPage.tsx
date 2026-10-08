import { useMemo, useState } from 'react'
import { Alert, App, Button, Card, Descriptions, Drawer, Form, Input, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { StatusTag, STATUS_OPTIONS } from '../components/StatusTag'
import { firewallsApi, interfacesApi, segmentsApi } from '../api'
import type { FirewallInput } from '../api'
import { useApi } from '../api/useApi'
import type { ApiError } from '../api/client'
import type { Firewall } from '../types'

export default function FirewallsPage() {
  const { message } = App.useApp()
  const { data: firewalls, loading: isLoading, error: isError, refetch } = useApi(firewallsApi.getAll)
  const { data: interfaces } = useApi(interfacesApi.getAll)
  const { data: segments } = useApi(segmentsApi.getAll)
  const [q, setQ] = useState('')
  const [active, setActive] = useState<Firewall | null>(null)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Firewall | null>(null)
  const [form] = Form.useForm<FirewallInput>()

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (formMode === 'create') {
        await firewallsApi.create(values)
        message.success(`МЭ «${values.name}» добавлен`)
      } else if (editingRecord) {
        await firewallsApi.update(editingRecord.id, values)
        message.success(`МЭ «${values.name}» обновлён`)
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

  const handleEdit = (record: Firewall) => {
    setActive(null)
    setEditingRecord(record)
    setFormMode('edit')
    form.setFieldsValue({
      name: record.name,
      firewallType: record.firewallType,
      vendor: record.vendor,
      model: record.model,
      managementAddress: record.managementAddress,
      description: record.description,
      status: record.status,
    })
    setFormDrawerOpen(true)
  }

  const filtered = useMemo(() => {
    if (!firewalls) return []
    const t = q.trim().toLowerCase()
    if (!t) return firewalls
    return firewalls.filter((x) => `${x.name} ${x.vendor ?? ''} ${x.model ?? ''} ${x.managementAddress ?? ''}`.toLowerCase().includes(t))
  }, [q, firewalls])

  const firewallInterfaces = active ? interfaces?.filter((n) => n.firewallId === active.id) ?? [] : []

  const columns: ColumnsType<Firewall> = [
    { title: 'Имя', dataIndex: 'name', key: 'name', width: 180, render: (v: string) => <Tag color='orange'>{v}</Tag> },
    { title: 'Тип', dataIndex: 'firewallType', key: 'type', width: 130, render: (v?: string) => v ?? '—' },
    { title: 'Вендор / модель', key: 'vm', width: 200, render: (_: unknown, r: Firewall) => [r.vendor, r.model].filter(Boolean).join(' / ') || '—' },
    { title: 'Адрес управления', dataIndex: 'managementAddress', key: 'mgmt', width: 170, render: (v?: string) => <Typography.Text type='secondary' style={{ fontSize: 12 }}>{v ?? '—'}</Typography.Text> },
    { title: 'Интерфейсов', key: 'nic', width: 130, render: (_: unknown, r: Firewall) => interfaces?.filter((n) => n.firewallId === r.id).length ?? 0 },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 120, render: (v: string) => <StatusTag value={v} /> },
  ]

  if (isError) {
    return <Alert message="Ошибка загрузки" description={isError.message} type="error" showIcon />
  }

  if (isLoading || !firewalls) {
    return <Spin spinning />
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Межсетевые экраны</Typography.Title>
          <Typography.Text type='secondary'>
            Сущность <Typography.Text code>firewall</Typography.Text> · Фиксируется как объект инфраструктуры; правила/маршрут потока не привязаны к firewall
          </Typography.Text>
        </div>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder='Имя МЭ' value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <Button type='primary' icon={<PlusOutlined />} onClick={handleCreate}>Добавить МЭ</Button>
        </Space>
      </div>
      <Card size='small' style={{ borderRadius: 10 }}>
        <Table<Firewall>
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
        extra={<Button icon={<EditOutlined />} size='small' onClick={() => active && handleEdit(active)}>Редактировать</Button>}
      >
        {active && (
          <Space direction='vertical' size={16} style={{ width: '100%' }}>
            <Descriptions size='small' bordered column={1}>
              <Descriptions.Item label='Имя'>{active.name}</Descriptions.Item>
              <Descriptions.Item label='Тип'>{active.firewallType ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Вендор'>{active.vendor ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Модель'>{active.model ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Адрес управления'>{active.managementAddress ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Статус'><StatusTag value={active.status} /></Descriptions.Item>
              <Descriptions.Item label='Описание'>{active.description ?? '—'}</Descriptions.Item>
            </Descriptions>
            <Card size='small' title={`Интерфейсы (${firewallInterfaces.length})`} style={{ borderRadius: 8 }}>
              {firewallInterfaces.map((n) => (
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
              {firewallInterfaces.length === 0 && <Typography.Text type='secondary'>Интерфейсов нет</Typography.Text>}
            </Card>
          </Space>
        )}
      </Drawer>

      <Drawer
        title={formMode === 'create' ? 'Добавить межсетевой экран' : 'Редактировать межсетевой экран'}
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
          <Form.Item label='Имя' name='name' rules={[{ required: true, message: 'Укажите имя МЭ' }]}>
            <Input placeholder='fw-perimeter-01' />
          </Form.Item>
          <Form.Item label='Тип МЭ' name='firewallType'>
            <Input placeholder='NGFW / WAF' />
          </Form.Item>
          <Form.Item label='Вендор' name='vendor'>
            <Input placeholder='Check Point / Palo Alto' />
          </Form.Item>
          <Form.Item label='Модель' name='model'>
            <Input placeholder='PA-3220' />
          </Form.Item>
          <Form.Item label='Адрес управления' name='managementAddress'>
            <Input placeholder='10.0.0.254' />
          </Form.Item>
          <Form.Item label='Статус' name='status' rules={[{ required: true, message: 'Выберите статус' }]}>
            <Select options={STATUS_OPTIONS.filter((o) => ['PLANNED', 'ACTIVE', 'RETIRED'].includes(o.value))} />
          </Form.Item>
          <Form.Item label='Описание' name='description'>
            <Input.TextArea rows={3} placeholder='Описание межсетевого экрана' />
          </Form.Item>
        </Form>
      </Drawer>

    </>
  )
}
