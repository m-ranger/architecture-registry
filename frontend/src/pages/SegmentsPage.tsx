import { useMemo, useState } from 'react'
import { Alert, App, Button, Card, Descriptions, Drawer, Form, Input, InputNumber, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { StatusTag, STATUS_OPTIONS } from '../components/StatusTag'
import { segmentsApi, zonesApi, interfacesApi } from '../api'
import type { NetworkSegmentInput } from '../api'
import { useApi } from '../api/useApi'
import type { ApiError } from '../api/client'
import type { NetworkSegment } from '../types'

export default function SegmentsPage() {
  const { message } = App.useApp()
  const { data: segments, loading: isLoading, error: isError, refetch } = useApi(segmentsApi.getAll)
  const { data: zones } = useApi(zonesApi.getAll)
  const { data: interfaces } = useApi(interfacesApi.getAll)
  const [q, setQ] = useState('')
  const [active, setActive] = useState<NetworkSegment | null>(null)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [editingRecord, setEditingRecord] = useState<NetworkSegment | null>(null)
  const [form] = Form.useForm<NetworkSegmentInput>()

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (formMode === 'create') {
        await segmentsApi.create(values)
        message.success(`Сегмент «${values.code}» добавлен`)
      } else if (editingRecord) {
        await segmentsApi.update(editingRecord.id, values)
        message.success(`Сегмент «${values.code}» обновлён`)
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

  const handleEdit = (record: NetworkSegment) => {
    setActive(null)
    setEditingRecord(record)
    setFormMode('edit')
    form.setFieldsValue({
      networkZoneId: record.networkZoneId,
      code: record.code,
      name: record.name,
      cidr: record.cidr,
      vlan: record.vlan,
      purpose: record.purpose,
      status: record.status,
    })
    setFormDrawerOpen(true)
  }

  const filtered = useMemo(() => {
    if (!segments) return []
    const t = q.trim().toLowerCase()
    if (!t) return segments
    return segments.filter((x) => `${x.code} ${x.name} ${x.cidr ?? ''} ${x.purpose ?? ''}`.toLowerCase().includes(t))
  }, [q, segments])

  const segmentInterfaces = active ? interfaces?.filter((n) => n.networkSegmentId === active.id) ?? [] : []

  const columns: ColumnsType<NetworkSegment> = [
    { title: 'Код', dataIndex: 'code', key: 'code', width: 150, render: (v: string) => <Tag color='geekblue'>{v}</Tag> },
    { title: 'Зона', dataIndex: 'networkZoneId', key: 'zone', width: 140, render: (v: string) => <Tag color='volcano'>{zones?.find((z) => z.id === v)?.code ?? v}</Tag> },
    { title: 'Наименование', dataIndex: 'name', key: 'name' },
    { title: 'CIDR', dataIndex: 'cidr', key: 'cidr', width: 160, render: (v?: string) => v ?? '—' },
    { title: 'VLAN', dataIndex: 'vlan', key: 'vlan', width: 100, render: (v?: number) => v ?? '—' },
    { title: 'Интерфейсов', key: 'nic', width: 130, render: (_: unknown, r: NetworkSegment) => interfaces?.filter((n) => n.networkSegmentId === r.id).length ?? 0 },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 120, render: (v: string) => <StatusTag value={v} /> },
  ]

  if (isError) {
    return <Alert message="Ошибка загрузки" description={isError.message} type="error" showIcon />
  }

  if (isLoading || !segments) {
    return <Spin spinning />
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Сетевые сегменты</Typography.Title>
          <Typography.Text type='secondary'>
            Сущность <Typography.Text code>network_segment</Typography.Text> · Сегмент принадлежит одной зоне (REQ-017); CIDR и VLAN необязательны
          </Typography.Text>
        </div>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder='Код или CIDR' value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <Button type='primary' icon={<PlusOutlined />} onClick={handleCreate}>Добавить сегмент</Button>
        </Space>
      </div>
      <Card size='small' style={{ borderRadius: 10 }}>
        <Table<NetworkSegment>
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
              <Descriptions.Item label='Зона'>{zones?.find((z) => z.id === active.networkZoneId)?.code ?? active.networkZoneId}</Descriptions.Item>
              <Descriptions.Item label='CIDR'>{active.cidr ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='VLAN'>{active.vlan ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Назначение'>{active.purpose ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Статус'><StatusTag value={active.status} /></Descriptions.Item>
            </Descriptions>
            <Card size='small' title={`Интерфейсы в сегменте (${segmentInterfaces.length})`} style={{ borderRadius: 8 }}>
              {segmentInterfaces.map((n) => (
                <div key={n.id} style={{ marginBottom: 6 }}>
                  <Space>
                    <Tag>{n.name}</Tag>
                    <Typography.Text style={{ fontSize: 12 }}>{n.ipAddress ?? '—'}</Typography.Text>
                    <StatusTag value={n.status} />
                  </Space>
                </div>
              ))}
              {segmentInterfaces.length === 0 && <Typography.Text type='secondary'>Интерфейсов нет</Typography.Text>}
            </Card>
          </Space>
        )}
      </Drawer>

      <Drawer
        title={formMode === 'create' ? 'Добавить сегмент' : 'Редактировать сегмент'}
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
          <Form.Item label='Зона' name='networkZoneId' rules={[{ required: true, message: 'Выберите зону' }]}>
            <Select
              placeholder='Выберите зону'
              options={(zones ?? []).map((z) => ({ label: `${z.code} – ${z.name}`, value: z.id }))}
            />
          </Form.Item>
          <Form.Item label='Код' name='code' rules={[{ required: true, message: 'Укажите код сегмента' }]} tooltip='Код сегмента (REQ-017), например SEG-DMZ-WEB'>
            <Input placeholder='SEG-DMZ-WEB' />
          </Form.Item>
          <Form.Item label='Наименование' name='name' rules={[{ required: true, message: 'Укажите наименование' }]}>
            <Input placeholder='Web-сегмент DMZ' />
          </Form.Item>
          <Form.Item label='CIDR' name='cidr'>
            <Input placeholder='10.10.20.0/24' />
          </Form.Item>
          <Form.Item label='VLAN' name='vlan'>
            <InputNumber min={1} max={4094} style={{ width: '100%' }} placeholder='120' />
          </Form.Item>
          <Form.Item label='Назначение' name='purpose'>
            <Input.TextArea rows={2} placeholder='Назначение сегмента' />
          </Form.Item>
          <Form.Item label='Статус' name='status' rules={[{ required: true, message: 'Выберите статус' }]}>
            <Select options={STATUS_OPTIONS.filter((o) => ['PLANNED', 'ACTIVE', 'RETIRED'].includes(o.value))} />
          </Form.Item>
        </Form>
      </Drawer>

    </>
  )
}
