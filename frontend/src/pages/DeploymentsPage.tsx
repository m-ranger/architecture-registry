import { useMemo, useState } from 'react'
import { Alert, App, Button, Card, DatePicker, Descriptions, Drawer, Form, Input, Popconfirm, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import { StatusTag, STATUS_OPTIONS } from '../components/StatusTag'
import { deploymentsApi, instancesApi, modulesApi, environmentsApi, serversApi, clustersApi } from '../api'
import type { ModuleDeploymentInput } from '../api'
import { useApi } from '../api/useApi'
import type { ApiError } from '../api/client'
import type { ModuleDeployment } from '../types'
import { fmtDateShort } from '../utils/format'

/** Значения формы размещения: цель задаётся единым полем server:<id> | cluster:<id> (XOR) */
type DeploymentFormValues = Omit<ModuleDeploymentInput, 'serverId' | 'clusterId' | 'validFrom' | 'validTo'> & {
  target?: string
  validFrom?: Dayjs
  validTo?: Dayjs
}

export default function DeploymentsPage() {
  const { message } = App.useApp()
  const { data: deployments, loading: isLoading, error: isError, refetch } = useApi(deploymentsApi.getAll)
  const { data: instances } = useApi(instancesApi.getAll)
  const { data: modules } = useApi(modulesApi.getAll)
  const { data: environments } = useApi(environmentsApi.getAll)
  const { data: servers } = useApi(serversApi.getAll)
  const { data: clusters } = useApi(clustersApi.getAll)
  const [q, setQ] = useState('')
  const [active, setActive] = useState<ModuleDeployment | null>(null)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ModuleDeployment | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form] = Form.useForm<DeploymentFormValues>()

  const instanceOf = (d: ModuleDeployment) => instances?.find((i) => i.id === d.moduleInstanceId)
  const targetOf = (d: ModuleDeployment) =>
    d.serverId ? `Сервер: ${servers?.find((s) => s.id === d.serverId)?.name ?? d.serverId}`
      : d.clusterId ? `Кластер: ${clusters?.find((c) => c.id === d.clusterId)?.name ?? d.clusterId}`
        : '—'

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const { target, validFrom, validTo, ...rest } = values
      const payload: ModuleDeploymentInput = {
        ...rest,
        serverId: target?.startsWith('server:') ? target.slice('server:'.length) : undefined,
        clusterId: target?.startsWith('cluster:') ? target.slice('cluster:'.length) : undefined,
        validFrom: validFrom ? validFrom.format('YYYY-MM-DD') : undefined,
        validTo: validTo ? validTo.format('YYYY-MM-DD') : undefined,
      }
      setSubmitting(true)
      const label = instances?.find((i) => i.id === payload.moduleInstanceId)?.name ?? payload.moduleInstanceId
      if (formMode === 'create') {
        await deploymentsApi.create(payload)
        message.success(`Размещение «${label}» добавлено`)
      } else if (editingRecord) {
        await deploymentsApi.update(editingRecord.id, payload)
        message.success(`Размещение «${label}» обновлено`)
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
    form.setFieldsValue({ deploymentState: 'ACTIVE' })
    setEditingRecord(null)
    setFormDrawerOpen(true)
  }

  const handleEdit = (record: ModuleDeployment) => {
    setActive(null)
    setEditingRecord(record)
    setFormMode('edit')
    form.setFieldsValue({
      moduleInstanceId: record.moduleInstanceId,
      target: record.serverId ? `server:${record.serverId}` : record.clusterId ? `cluster:${record.clusterId}` : undefined,
      deploymentRole: record.deploymentRole,
      deploymentState: record.deploymentState,
    })
    setFormDrawerOpen(true)
  }

  /** Удаление доступно только в режиме редактирования — из формы изменений */
  const handleDelete = async () => {
    if (!editingRecord) return
    try {
      setDeleting(true)
      const label = instanceOf(editingRecord)?.name ?? 'Размещение'
      await deploymentsApi.remove(editingRecord.id)
      message.success(`Размещение «${label}» удалено`)
      setFormDrawerOpen(false)
      form.resetFields()
      setEditingRecord(null)
      setActive(null)
      refetch()
    } catch (err) {
      message.error((err as ApiError)?.message ?? 'Не удалось удалить размещение')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = useMemo(() => {
    if (!deployments) return []
    const t = q.trim().toLowerCase()
    if (!t) return deployments
    return deployments.filter((d) => {
      const inst = instances?.find((i) => i.id === d.moduleInstanceId)
      const mod = inst ? modules?.find((m) => m.id === inst.moduleId) : undefined
      const env = inst ? environments?.find((e) => e.id === inst.environmentId) : undefined
      return `${inst?.name ?? ''} ${mod?.code ?? ''} ${env?.code ?? ''} ${targetOf(d)} ${d.deploymentRole ?? ''}`.toLowerCase().includes(t)
    })
  }, [q, deployments, instances, modules, environments, servers, clusters])

  const columns: ColumnsType<ModuleDeployment> = [
    { title: 'Экземпляр', key: 'inst', width: 220, render: (_: unknown, r: ModuleDeployment) => <Typography.Text strong>{instanceOf(r)?.name ?? '—'}</Typography.Text> },
    {
      title: 'Модуль', key: 'module', width: 160,
      render: (_: unknown, r: ModuleDeployment) => {
        const inst = instanceOf(r)
        const m = inst ? modules?.find((x) => x.id === inst.moduleId) : undefined
        return m ? <Tag color='geekblue'>{m.code}</Tag> : '—'
      },
    },
    {
      title: 'Среда', key: 'env', width: 100,
      render: (_: unknown, r: ModuleDeployment) => {
        const inst = instanceOf(r)
        return inst ? <Tag color='blue'>{environments?.find((e) => e.id === inst.environmentId)?.code ?? '—'}</Tag> : '—'
      },
    },
    { title: 'Цель размещения', key: 'target', width: 220, render: (_: unknown, r: ModuleDeployment) => <Tag color={r.serverId ? 'green' : r.clusterId ? 'purple' : 'default'}>{targetOf(r)}</Tag> },
    { title: 'Роль', dataIndex: 'deploymentRole', key: 'role', width: 120, render: (v?: string) => v ?? '—' },
    { title: 'Статус размещения', dataIndex: 'deploymentState', key: 'state', width: 150, render: (v: string) => <StatusTag value={v} /> },
    { title: 'Действует с', dataIndex: 'validFrom', key: 'from', width: 120, render: (v?: string) => fmtDateShort(v) },
    { title: 'Действует до', dataIndex: 'validTo', key: 'to', width: 120, render: (v?: string) => fmtDateShort(v) },
  ]

  if (isError) {
    return <Alert message="Ошибка загрузки" description={isError.message} type="error" showIcon />
  }

  if (isLoading || !deployments) {
    return <Spin spinning />
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Размещения модулей</Typography.Title>
          <Typography.Text type='secondary'>
            Сущность <Typography.Text code>module_deployment</Typography.Text> · Ровно один из server_id / cluster_id (XOR, REQ-010)
          </Typography.Text>
        </div>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder='Экземпляр, модуль, среда' value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <Button type='primary' icon={<PlusOutlined />} onClick={handleCreate}>Добавить размещение</Button>
        </Space>
      </div>
      <Card size='small' style={{ borderRadius: 10 }}>
        <Table<ModuleDeployment>
          rowKey='id'
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Всего: ${t}` }}
          onRow={(rec) => ({ onClick: () => setActive(rec), style: { cursor: 'pointer' } })}
        />
      </Card>
      <Drawer
        title={active ? `Размещение: ${instanceOf(active)?.name ?? ''}` : ''}
        open={!!active}
        onClose={() => setActive(null)}
        width={640}
        extra={<Button type='primary' icon={<EditOutlined />} onClick={() => active && handleEdit(active)}>Редактировать</Button>}
      >
        {active && (
          <Space direction='vertical' size={16} style={{ width: '100%' }}>
            <Descriptions size='small' bordered column={1}>
              <Descriptions.Item label='Экземпляр'>{instanceOf(active)?.name ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Модуль'>
                {(() => { const inst = instanceOf(active); return inst ? modules?.find((m) => m.id === inst.moduleId)?.code ?? '—' : '—' })()}
              </Descriptions.Item>
              <Descriptions.Item label='Среда'>
                {(() => { const inst = instanceOf(active); return inst ? environments?.find((e) => e.id === inst.environmentId)?.code ?? '—' : '—' })()}
              </Descriptions.Item>
              <Descriptions.Item label='Цель размещения'><Tag color={active.serverId ? 'green' : active.clusterId ? 'purple' : 'default'}>{targetOf(active)}</Tag></Descriptions.Item>
              <Descriptions.Item label='Роль'>{active.deploymentRole ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Статус размещения'><StatusTag value={active.deploymentState} /></Descriptions.Item>
              <Descriptions.Item label='Действует с'>{fmtDateShort(active.validFrom)}</Descriptions.Item>
              <Descriptions.Item label='Действует до'>{fmtDateShort(active.validTo)}</Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Drawer>

      <Drawer
        title={formMode === 'create' ? 'Добавить размещение' : 'Редактировать размещение'}
        open={formDrawerOpen}
        onClose={() => { setFormDrawerOpen(false); form.resetFields() }}
        width={560}
        destroyOnClose
        footer={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            {formMode === 'edit' ? (
              <Popconfirm
                title='Удалить размещение?'
                description={editingRecord ? instanceOf(editingRecord)?.name : undefined}
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
          <Form.Item label='Экземпляр модуля' name='moduleInstanceId' rules={[{ required: true, message: 'Выберите экземпляр модуля' }]}>
            <Select
              showSearch
              optionFilterProp='label'
              placeholder='Выберите экземпляр'
              options={(instances ?? []).map((i) => ({
                label: `${i.name} · ${modules?.find((m) => m.id === i.moduleId)?.code ?? ''} · ${environments?.find((e) => e.id === i.environmentId)?.code ?? ''}`,
                value: i.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            label='Цель размещения'
            name='target'
            rules={[{ required: true, message: 'Выберите сервер или кластер' }]}
            tooltip='Указывается ровно одна цель: сервер либо кластер (XOR, REQ-010)'
          >
            <Select
              showSearch
              optionFilterProp='label'
              placeholder='Сервер или кластер'
              options={[
                { label: 'Серверы', options: (servers ?? []).map((s) => ({ label: `Сервер: ${s.name}`, value: `server:${s.id}` })) },
                { label: 'Кластеры', options: (clusters ?? []).map((c) => ({ label: `Кластер: ${c.name}`, value: `cluster:${c.id}` })) },
              ]}
            />
          </Form.Item>
          <Form.Item label='Роль размещения' name='deploymentRole'>
            <Input placeholder='PRIMARY / STANDBY' />
          </Form.Item>
          <Form.Item label='Статус размещения' name='deploymentState' rules={[{ required: true, message: 'Выберите статус размещения' }]}>
            <Select options={STATUS_OPTIONS.filter((o) => ['ACTIVE', 'STANDBY', 'RETIRED'].includes(o.value))} />
          </Form.Item>
          <Form.Item label='Действует с' name='validFrom'>
            <DatePicker style={{ width: '100%' }} format='DD.MM.YYYY' placeholder='Дата начала' />
          </Form.Item>
          <Form.Item label='Действует до' name='validTo'>
            <DatePicker style={{ width: '100%' }} format='DD.MM.YYYY' placeholder='Дата окончания' />
          </Form.Item>
        </Form>
      </Drawer>

    </>
  )
}


