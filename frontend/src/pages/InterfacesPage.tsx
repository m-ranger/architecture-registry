import { useMemo, useState } from 'react'
import { Alert, App, Button, Card, Descriptions, Drawer, Form, Input, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { StatusTag, STATUS_OPTIONS } from '../components/StatusTag'
import { interfacesApi, serversApi, routersApi, firewallsApi, segmentsApi, zonesApi } from '../api'
import type { NetworkInterfaceInput } from '../api'
import { useApi } from '../api/useApi'
import type { ApiError } from '../api/client'
import type { NetworkInterface } from '../types'

/** Значения формы интерфейса: владелец задаётся единым полем server:<id> | router:<id> | firewall:<id> */
type InterfaceFormValues = Omit<NetworkInterfaceInput, 'serverId' | 'routerId' | 'firewallId'> & { owner?: string }

export default function InterfacesPage() {
  const { message } = App.useApp()
  const { data: interfaces, loading: isLoading, error: isError, refetch } = useApi(interfacesApi.getAll)
  const { data: servers } = useApi(serversApi.getAll)
  const { data: routers } = useApi(routersApi.getAll)
  const { data: firewalls } = useApi(firewallsApi.getAll)
  const { data: segments } = useApi(segmentsApi.getAll)
  const { data: zones } = useApi(zonesApi.getAll)
  const [q, setQ] = useState('')
  const [active, setActive] = useState<NetworkInterface | null>(null)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [editingRecord, setEditingRecord] = useState<NetworkInterface | null>(null)
  const [form] = Form.useForm<InterfaceFormValues>()

  const ownerOf = (nic: NetworkInterface): { kind: 'Сервер' | 'Маршрутизатор' | 'МЭ'; name: string } => {
    if (nic.serverId) return { kind: 'Сервер', name: servers?.find((s) => s.id === nic.serverId)?.name ?? '—' }
    if (nic.routerId) return { kind: 'Маршрутизатор', name: routers?.find((r) => r.id === nic.routerId)?.name ?? '—' }
    if (nic.firewallId) return { kind: 'МЭ', name: firewalls?.find((f) => f.id === nic.firewallId)?.name ?? '—' }
    return { kind: 'Сервер', name: '—' }
  }

  const zoneOf = (segmentId: string) => {
    const seg = segments?.find((s) => s.id === segmentId)
    return seg ? zones?.find((z) => z.id === seg.networkZoneId)?.code ?? '—' : '—'
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const { owner, ...rest } = values
      const payload: NetworkInterfaceInput = {
        ...rest,
        serverId: owner?.startsWith('server:') ? owner.slice('server:'.length) : undefined,
        routerId: owner?.startsWith('router:') ? owner.slice('router:'.length) : undefined,
        firewallId: owner?.startsWith('firewall:') ? owner.slice('firewall:'.length) : undefined,
      }
      setSubmitting(true)
      if (formMode === 'create') {
        await interfacesApi.create(payload)
        message.success(`Интерфейс «${payload.name}» добавлен`)
      } else if (editingRecord) {
        await interfacesApi.update(editingRecord.id, payload)
        message.success(`Интерфейс «${payload.name}» обновлён`)
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

  const handleEdit = (record: NetworkInterface) => {
    setActive(null)
    setEditingRecord(record)
    setFormMode('edit')
    form.setFieldsValue({
      owner: record.serverId ? `server:${record.serverId}` : record.routerId ? `router:${record.routerId}` : record.firewallId ? `firewall:${record.firewallId}` : undefined,
      networkSegmentId: record.networkSegmentId,
      name: record.name,
      ipAddress: record.ipAddress,
      macAddress: record.macAddress,
      interfaceRole: record.interfaceRole,
      status: record.status,
    })
    setFormDrawerOpen(true)
  }

  const filtered = useMemo(() => {
    if (!interfaces) return []
    const t = q.trim().toLowerCase()
    if (!t) return interfaces
    return interfaces.filter((x) => {
      const o = ownerOf(x)
      const seg = segments?.find((s) => s.id === x.networkSegmentId)
      return `${x.name} ${x.ipAddress ?? ''} ${x.macAddress ?? ''} ${x.interfaceRole ?? ''} ${o.name} ${seg?.code ?? ''}`.toLowerCase().includes(t)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, interfaces, segments, servers, routers, firewalls])

  const columns: ColumnsType<NetworkInterface> = [
    { title: 'Имя', dataIndex: 'name', key: 'name', width: 160 },
    {
      title: 'Привязан к', key: 'owner', width: 240,
      render: (_: unknown, r: NetworkInterface) => {
        const o = ownerOf(r)
        const color = o.kind === 'Сервер' ? 'green' : o.kind === 'Маршрутизатор' ? 'purple' : 'orange'
        return <Tag color={color}>{o.kind}: {o.name}</Tag>
      },
    },
    {
      title: 'Сегмент / зона', key: 'seg', width: 220,
      render: (_: unknown, r: NetworkInterface) => (
        <>{segments?.find((s) => s.id === r.networkSegmentId)?.code ?? '—'} <Typography.Text type='secondary' style={{ fontSize: 11 }}>({zoneOf(r.networkSegmentId)})</Typography.Text></>
      ),
    },
    { title: 'IP', dataIndex: 'ipAddress', key: 'ip', width: 150, render: (v?: string) => v ?? '—' },
    { title: 'MAC', dataIndex: 'macAddress', key: 'mac', width: 170, render: (v?: string) => v ?? '—' },
    { title: 'Роль', dataIndex: 'interfaceRole', key: 'role', width: 120, render: (v?: string) => v ?? '—' },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 120, render: (v: string) => <StatusTag value={v} /> },
  ]

  if (isError) {
    return <Alert message="Ошибка загрузки" description={isError.message} type="error" showIcon />
  }

  if (isLoading || !interfaces) {
    return <Spin spinning />
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Сетевые интерфейсы</Typography.Title>
          <Typography.Text type='secondary'>
            Сущность <Typography.Text code>network_interface</Typography.Text> · Ровно одна привязка: server_id XOR router_id XOR firewall_id (REQ-018); сегмент обязателен
          </Typography.Text>
        </div>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder='Имя, IP или MAC' value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <Button type='primary' icon={<PlusOutlined />} onClick={handleCreate}>Добавить интерфейс</Button>
        </Space>
      </div>
      <Card size='small' style={{ borderRadius: 10 }}>
        <Table<NetworkInterface>
          rowKey='id'
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Всего: ${t}` }}
          onRow={(rec) => ({ onClick: () => setActive(rec), style: { cursor: 'pointer' } })}
        />
      </Card>
      <Drawer
        title={active ? `Интерфейс ${active.name}` : ''}
        open={!!active}
        onClose={() => setActive(null)}
        width={640}
        extra={<Button icon={<EditOutlined />} size='small' onClick={() => active && handleEdit(active)}>Редактировать</Button>}
      >
        {active && (
          <Space direction='vertical' size={16} style={{ width: '100%' }}>
            <Descriptions size='small' bordered column={1}>
              <Descriptions.Item label='Имя'>{active.name}</Descriptions.Item>
              <Descriptions.Item label='Привязан к'>{ownerOf(active).kind}: {ownerOf(active).name}</Descriptions.Item>
              <Descriptions.Item label='Сегмент'>{segments?.find((s) => s.id === active.networkSegmentId)?.code ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Зона'>{zoneOf(active.networkSegmentId)}</Descriptions.Item>
              <Descriptions.Item label='IP-адрес'>{active.ipAddress ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='MAC-адрес'>{active.macAddress ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Роль интерфейса'>{active.interfaceRole ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Статус'><StatusTag value={active.status} /></Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Drawer>

      <Drawer
        title={formMode === 'create' ? 'Добавить интерфейс' : 'Редактировать интерфейс'}
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
          <Form.Item
            label='Владелец интерфейса'
            name='owner'
            rules={[{ required: true, message: 'Выберите сервер, маршрутизатор или МЭ' }]}
            tooltip='Ровно одна привязка: сервер XOR маршрутизатор XOR МЭ (REQ-018)'
          >
            <Select
              showSearch
              optionFilterProp='label'
              placeholder='Сервер, маршрутизатор или МЭ'
              options={[
                { label: 'Серверы', options: (servers ?? []).map((s) => ({ label: `Сервер: ${s.name}`, value: `server:${s.id}` })) },
                { label: 'Маршрутизаторы', options: (routers ?? []).map((r) => ({ label: `Маршрутизатор: ${r.name}`, value: `router:${r.id}` })) },
                { label: 'Межсетевые экраны', options: (firewalls ?? []).map((f) => ({ label: `МЭ: ${f.name}`, value: `firewall:${f.id}` })) },
              ]}
            />
          </Form.Item>
          <Form.Item label='Сегмент' name='networkSegmentId' rules={[{ required: true, message: 'Выберите сегмент' }]}>
            <Select
              showSearch
              optionFilterProp='label'
              placeholder='Выберите сегмент'
              options={(segments ?? []).map((s) => ({
                label: `${s.code} – ${s.name} (${zones?.find((z) => z.id === s.networkZoneId)?.code ?? '—'})`,
                value: s.id,
              }))}
            />
          </Form.Item>
          <Form.Item label='Имя интерфейса' name='name' rules={[{ required: true, message: 'Укажите имя интерфейса' }]}>
            <Input placeholder='eth0' />
          </Form.Item>
          <Form.Item label='IP-адрес' name='ipAddress'>
            <Input placeholder='10.10.20.15' />
          </Form.Item>
          <Form.Item label='MAC-адрес' name='macAddress'>
            <Input placeholder='00:1A:2B:3C:4D:5E' />
          </Form.Item>
          <Form.Item label='Роль интерфейса' name='interfaceRole'>
            <Input placeholder='UPLINK / SERVICE / MANAGEMENT' />
          </Form.Item>
          <Form.Item label='Статус' name='status' rules={[{ required: true, message: 'Выберите статус' }]}>
            <Select options={STATUS_OPTIONS.filter((o) => ['PLANNED', 'ACTIVE', 'RETIRED'].includes(o.value))} />
          </Form.Item>
        </Form>
      </Drawer>

    </>
  )
}


