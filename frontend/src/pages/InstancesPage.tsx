import { useMemo, useState } from 'react'
import { Alert, App, Button, Card, Descriptions, Drawer, Form, Input, Popconfirm, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { StatusTag, STATUS_OPTIONS } from '../components/StatusTag'
import { instancesApi, deploymentsApi, modulesApi, environmentsApi, serversApi, clustersApi } from '../api'
import type { ModuleInstanceInput } from '../api'
import { useApi } from '../api/useApi'
import type { ApiError } from '../api/client'
import type { ModuleInstance } from '../types'

export default function InstancesPage() {
  const { message } = App.useApp()
  const { data: instances, loading: isLoading, error: isError, refetch } = useApi(instancesApi.getAll)
  const { data: deployments } = useApi(deploymentsApi.getAll)
  const { data: modules } = useApi(modulesApi.getAll)
  const { data: environments } = useApi(environmentsApi.getAll)
  const { data: servers } = useApi(serversApi.getAll)
  const { data: clusters } = useApi(clustersApi.getAll)
  const [q, setQ] = useState('')
  const [active, setActive] = useState<ModuleInstance | null>(null)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ModuleInstance | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form] = Form.useForm<ModuleInstanceInput>()

  const getDeploymentTarget = (instanceId: string): string => {
    const deps = deployments?.filter((d) => d.moduleInstanceId === instanceId) ?? []
    return deps.map((d) => {
      if (d.serverId) return servers?.find((s) => s.id === d.serverId)?.name ?? d.serverId
      if (d.clusterId) return clusters?.find((c) => c.id === d.clusterId)?.name ?? d.clusterId
      return '—'
    }).join(', ') || '—'
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (formMode === 'create') {
        await instancesApi.create(values)
        message.success(`Экземпляр «${values.name}» добавлен`)
      } else if (editingRecord) {
        await instancesApi.update(editingRecord.id, values)
        message.success(`Экземпляр «${values.name}» обновлён`)
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

  const handleEdit = (record: ModuleInstance) => {
    setActive(null)
    setEditingRecord(record)
    setFormMode('edit')
    form.setFieldsValue({
      moduleId: record.moduleId,
      environmentId: record.environmentId,
      name: record.name,
      version: record.version,
      runtimeType: record.runtimeType,
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
      await instancesApi.remove(editingRecord.id)
      message.success(`Экземпляр «${editingRecord.name}» удалён`)
      setFormDrawerOpen(false)
      form.resetFields()
      setEditingRecord(null)
      setActive(null)
      refetch()
    } catch (err) {
      message.error((err as ApiError)?.message ?? 'Не удалось удалить экземпляр модуля')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = useMemo(() => {
    if (!instances) return []
    const t = q.trim().toLowerCase()
    if (!t) return instances
    return instances.filter((x) => {
      const mm = modules?.find((m) => m.id === x.moduleId)
      const ee = environments?.find((e) => e.id === x.environmentId)
      return `${x.name} ${x.version ?? ''} ${x.runtimeType ?? ''} ${mm?.code ?? ''} ${ee?.code ?? ''}`.toLowerCase().includes(t)
    })
  }, [q, instances, modules, environments])

  const columns: ColumnsType<ModuleInstance> = [
    { title: 'Экземпляр', dataIndex: 'name', key: 'name', width: 250, render: (v: string) => <Typography.Text strong copyable>{v}</Typography.Text> },
    { title: 'Модуль', key: 'module', width: 220, render: (_: unknown, r: ModuleInstance) => { const m = modules?.find((x) => x.id === r.moduleId); return m ? <Tag color='geekblue'>{m.code}</Tag> : '—' } },
    { title: 'Среда', dataIndex: 'environmentId', key: 'env', width: 110, render: (v: string) => <Tag color='blue'>{environments?.find((e) => e.id === v)?.code ?? v}</Tag> },
    { title: 'Тип / версия', key: 'rv', width: 160, render: (_: unknown, r: ModuleInstance) => <Typography.Text type='secondary' style={{ fontSize: 12 }}>{[r.runtimeType, r.version].filter(Boolean).join(' · ') || '—'}</Typography.Text> },
    { title: 'Размещений', key: 'dep', width: 120, render: (_: unknown, r: ModuleInstance) => deployments?.filter((d) => d.moduleInstanceId === r.id).length ?? 0 },
    { title: 'Где размещён', key: 'target', render: (_: unknown, r: ModuleInstance) => <Typography.Text style={{ fontSize: 12 }}>{getDeploymentTarget(r.id)}</Typography.Text> },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 120, render: (v: string) => <StatusTag value={v} /> },
  ]

  if (isError) {
    return <Alert message="Ошибка загрузки" description={isError.message} type="error" showIcon />
  }

  if (isLoading || !instances) {
    return <Spin spinning />
  }

  const instanceDeployments = active ? deployments?.filter((d) => d.moduleInstanceId === active.id) ?? [] : []

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Экземпляры модулей</Typography.Title>
          <Typography.Text type='secondary'>
            Сущность <Typography.Text code>module_instance</Typography.Text> · Экземпляр модуля в заданной среде; ключ (module_id, environment_id, name) уникален (REQ-007)
          </Typography.Text>
        </div>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder='Имя, модуль или среда' value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <Button type='primary' icon={<PlusOutlined />} onClick={handleCreate}>Добавить экземпляр</Button>
        </Space>
      </div>
      <Card size='small' style={{ borderRadius: 10 }}>
        <Table<ModuleInstance>
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
              <Descriptions.Item label='Экземпляр'>{active.name}</Descriptions.Item>
              <Descriptions.Item label='Модуль'>{modules?.find((m) => m.id === active.moduleId)?.code ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Среда'>{environments?.find((e) => e.id === active.environmentId)?.code ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Версия'>{active.version ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Тип среды выполнения'>{active.runtimeType ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Статус'><StatusTag value={active.status} /></Descriptions.Item>
              <Descriptions.Item label='Описание'>{active.description ?? '—'}</Descriptions.Item>
            </Descriptions>
            <Card size='small' title={`Размещения (${instanceDeployments.length})`} style={{ borderRadius: 8 }}>
              {instanceDeployments.map((d) => (
                <div key={d.id} style={{ marginBottom: 6 }}>
                  <Space>
                    <Tag color={d.serverId ? 'green' : d.clusterId ? 'purple' : 'default'}>
                      {d.serverId
                        ? `Сервер: ${servers?.find((s) => s.id === d.serverId)?.name ?? d.serverId}`
                        : d.clusterId ? `Кластер: ${clusters?.find((c) => c.id === d.clusterId)?.name ?? d.clusterId}` : '—'}
                    </Tag>
                    <Tag>{d.deploymentRole ?? '—'}</Tag>
                    <StatusTag value={d.deploymentState} />
                  </Space>
                </div>
              ))}
              {instanceDeployments.length === 0 && <Typography.Text type='secondary'>Размещений нет</Typography.Text>}
            </Card>
          </Space>
        )}
      </Drawer>

      <Drawer
        title={formMode === 'create' ? 'Добавить экземпляр модуля' : 'Редактировать экземпляр модуля'}
        open={formDrawerOpen}
        onClose={() => { setFormDrawerOpen(false); form.resetFields() }}
        width={560}
        destroyOnClose
        footer={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            {formMode === 'edit' ? (
              <Popconfirm
                title='Удалить экземпляр модуля?'
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
          <Form.Item label='Модуль' name='moduleId' rules={[{ required: true, message: 'Выберите модуль' }]}>
            <Select
              showSearch
              optionFilterProp='label'
              placeholder='Выберите модуль'
              options={(modules ?? []).map((m) => ({ label: `${m.code} – ${m.name}`, value: m.id }))}
            />
          </Form.Item>
          <Form.Item label='Среда' name='environmentId' rules={[{ required: true, message: 'Выберите среду' }]}>
            <Select
              placeholder='Выберите среду'
              options={(environments ?? []).map((e) => ({ label: `${e.code} – ${e.name}`, value: e.id }))}
            />
          </Form.Item>
          <Form.Item label='Имя экземпляра' name='name' rules={[{ required: true, message: 'Укажите имя экземпляра' }]} tooltip='Ключ (module_id, environment_id, name) уникален (REQ-007)'>
            <Input placeholder='order-service-prod-01' />
          </Form.Item>
          <Form.Item label='Версия' name='version'>
            <Input placeholder='1.4.2' />
          </Form.Item>
          <Form.Item label='Тип среды выполнения' name='runtimeType'>
            <Input placeholder='JAVA / DOTNET / NODE' />
          </Form.Item>
          <Form.Item label='Статус' name='status' rules={[{ required: true, message: 'Выберите статус' }]}>
            <Select options={STATUS_OPTIONS.filter((o) => ['PLANNED', 'ACTIVE', 'RETIRED'].includes(o.value))} />
          </Form.Item>
          <Form.Item label='Описание' name='description'>
            <Input.TextArea rows={3} placeholder='Описание экземпляра' />
          </Form.Item>
        </Form>
      </Drawer>

    </>
  )
}

