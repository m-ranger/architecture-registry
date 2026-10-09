import { useMemo, useState } from 'react'
import { Alert, App, Button, Card, Descriptions, Drawer, Form, Input, Popconfirm, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { StatusTag, STATUS_OPTIONS } from '../components/StatusTag'
import { zonesApi, segmentsApi } from '../api'
import type { NetworkZoneInput } from '../api'
import { useApi } from '../api/useApi'
import type { ApiError } from '../api/client'
import type { NetworkZone } from '../types'

const SECURITY_LEVEL_OPTIONS = [
  { value: 'LOW', label: 'LOW' },
  { value: 'MEDIUM', label: 'MEDIUM' },
  { value: 'HIGH', label: 'HIGH' },
  { value: 'CRITICAL', label: 'CRITICAL' },
]

const SECURITY_LEVEL_COLOR: Record<string, string> = { CRITICAL: 'red', HIGH: 'orange', MEDIUM: 'blue', LOW: 'default' }

export default function ZonesPage() {
  const { message } = App.useApp()
  const { data: zones, loading: isLoading, error: isError, refetch } = useApi(zonesApi.getAll)
  const { data: segments } = useApi(segmentsApi.getAll)
  const [q, setQ] = useState('')
  const [active, setActive] = useState<NetworkZone | null>(null)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [editingRecord, setEditingRecord] = useState<NetworkZone | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form] = Form.useForm<NetworkZoneInput>()

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (formMode === 'create') {
        await zonesApi.create(values)
        message.success(`Зона «${values.code}» добавлена`)
      } else if (editingRecord) {
        await zonesApi.update(editingRecord.id, values)
        message.success(`Зона «${values.code}» обновлена`)
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

  const handleEdit = (record: NetworkZone) => {
    setActive(null)
    setEditingRecord(record)
    setFormMode('edit')
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      zoneType: record.zoneType,
      securityLevel: record.securityLevel,
      parentId: record.parentId,
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
      await zonesApi.remove(editingRecord.id)
      message.success(`Зона «${editingRecord.code}» удалена`)
      setFormDrawerOpen(false)
      form.resetFields()
      setEditingRecord(null)
      setActive(null)
      refetch()
    } catch (err) {
      message.error((err as ApiError)?.message ?? 'Не удалось удалить зону')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = useMemo(() => {
    if (!zones) return []
    const t = q.trim().toLowerCase()
    if (!t) return zones
    return zones.filter((x) => `${x.code} ${x.name} ${x.zoneType ?? ''} ${x.description ?? ''}`.toLowerCase().includes(t))
  }, [q, zones])

  const zoneSegments = active ? segments?.filter((s) => s.networkZoneId === active.id) ?? [] : []

  const columns: ColumnsType<NetworkZone> = [
    { title: 'Код', dataIndex: 'code', key: 'code', width: 140, render: (v: string) => <Tag color='volcano'>{v}</Tag> },
    { title: 'Наименование', dataIndex: 'name', key: 'name' },
    { title: 'Тип зоны', dataIndex: 'zoneType', key: 'type', width: 140, render: (v?: string) => v ?? '—' },
    { title: 'Уровень безопасности', dataIndex: 'securityLevel', key: 'sec', width: 170, render: (v?: string) => (v ? <Tag color={SECURITY_LEVEL_COLOR[v] ?? 'default'}>{v}</Tag> : '—') },
    { title: 'Родительская зона', dataIndex: 'parentId', key: 'parent', width: 170, render: (v?: string) => (v ? <Tag>{zones?.find((z) => z.id === v)?.code ?? v}</Tag> : '—') },
    { title: 'Сегментов', key: 'seg', width: 110, render: (_: unknown, r: NetworkZone) => segments?.filter((s) => s.networkZoneId === r.id).length ?? 0 },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 120, render: (v: string) => <StatusTag value={v} /> },
  ]

  if (isError) {
    return <Alert message="Ошибка загрузки" description={isError.message} type="error" showIcon />
  }

  if (isLoading || !zones) {
    return <Spin spinning />
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Сетевые зоны</Typography.Title>
          <Typography.Text type='secondary'>
            Сущность <Typography.Text code>network_zone</Typography.Text> · Зона может включать сегменты и подчиняться другой зоне (REQ-015, REQ-016)
          </Typography.Text>
        </div>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder='Код зоны' value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <Button type='primary' icon={<PlusOutlined />} onClick={handleCreate}>Добавить зону</Button>
        </Space>
      </div>
      <Card size='small' style={{ borderRadius: 10 }}>
        <Table<NetworkZone>
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
              <Descriptions.Item label='Тип зоны'>{active.zoneType ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Уровень безопасности'>{active.securityLevel ? <Tag color={SECURITY_LEVEL_COLOR[active.securityLevel] ?? 'default'}>{active.securityLevel}</Tag> : '—'}</Descriptions.Item>
              <Descriptions.Item label='Родительская зона'>{active.parentId ? (zones?.find((z) => z.id === active.parentId)?.code ?? active.parentId) : '—'}</Descriptions.Item>
              <Descriptions.Item label='Статус'><StatusTag value={active.status} /></Descriptions.Item>
              <Descriptions.Item label='Описание'>{active.description ?? '—'}</Descriptions.Item>
            </Descriptions>
            <Card size='small' title='Подчинённые зоны' style={{ borderRadius: 8 }}>
              {(zones?.filter((z) => z.parentId === active.id) ?? []).map((z) => (
                <div key={z.id} style={{ marginBottom: 6 }}><Space><Tag color='volcano'>{z.code}</Tag><Typography.Text>{z.name}</Typography.Text></Space></div>
              ))}
              {(zones?.filter((z) => z.parentId === active.id) ?? []).length === 0 && <Typography.Text type='secondary'>Нет</Typography.Text>}
            </Card>
            <Card size='small' title={`Сегменты зоны (${zoneSegments.length})`} style={{ borderRadius: 8 }}>
              {zoneSegments.map((s) => (
                <div key={s.id} style={{ marginBottom: 6 }}><Space><Tag color='geekblue'>{s.code}</Tag><Typography.Text style={{ fontSize: 12 }}>{s.cidr ?? '—'}</Typography.Text></Space></div>
              ))}
              {zoneSegments.length === 0 && <Typography.Text type='secondary'>Сегментов нет</Typography.Text>}
            </Card>
          </Space>
        )}
      </Drawer>

      <Drawer
        title={formMode === 'create' ? 'Добавить зону' : 'Редактировать зону'}
        open={formDrawerOpen}
        onClose={() => { setFormDrawerOpen(false); form.resetFields() }}
        width={560}
        destroyOnClose
        footer={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            {formMode === 'edit' ? (
              <Popconfirm
                title='Удалить зону?'
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
          <Form.Item label='Код' name='code' rules={[{ required: true, message: 'Укажите код зоны' }]} tooltip='Код зоны (REQ-015), например ZONE-DMZ'>
            <Input placeholder='ZONE-DMZ' />
          </Form.Item>
          <Form.Item label='Наименование' name='name' rules={[{ required: true, message: 'Укажите наименование' }]}>
            <Input placeholder='Демилитаризованная зона' />
          </Form.Item>
          <Form.Item label='Тип зоны' name='zoneType'>
            <Input placeholder='DMZ / LAN / WAN' />
          </Form.Item>
          <Form.Item label='Уровень безопасности' name='securityLevel'>
            <Select allowClear options={SECURITY_LEVEL_OPTIONS} placeholder='Уровень безопасности' />
          </Form.Item>
          <Form.Item label='Родительская зона' name='parentId'>
            <Select
              allowClear
              placeholder='Без родительской зоны'
              options={(zones ?? []).filter((z) => z.id !== editingRecord?.id).map((z) => ({ label: `${z.code} – ${z.name}`, value: z.id }))}
            />
          </Form.Item>
          <Form.Item label='Статус' name='status' rules={[{ required: true, message: 'Выберите статус' }]}>
            <Select options={STATUS_OPTIONS.filter((o) => ['PLANNED', 'ACTIVE', 'RETIRED'].includes(o.value))} />
          </Form.Item>
          <Form.Item label='Описание' name='description'>
            <Input.TextArea rows={3} placeholder='Описание зоны' />
          </Form.Item>
        </Form>
      </Drawer>

    </>
  )
}
