import { useMemo, useState } from 'react'
import { Alert, App, Button, Card, Descriptions, Drawer, Form, Input, Popconfirm, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { StatusTag, STATUS_OPTIONS } from '../components/StatusTag'
import { clustersApi, deploymentsApi, instancesApi } from '../api'
import type { ClusterInput } from '../api'
import { useApi } from '../api/useApi'
import type { ApiError } from '../api/client'
import type { Cluster } from '../types'

export default function ClustersPage() {
  const { message } = App.useApp()
  const { data: clusters, loading: isLoading, error: isError, refetch } = useApi(clustersApi.getAll)
  const { data: deployments } = useApi(deploymentsApi.getAll)
  const { data: instances } = useApi(instancesApi.getAll)
  const [q, setQ] = useState('')
  const [active, setActive] = useState<Cluster | null>(null)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Cluster | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form] = Form.useForm<ClusterInput>()

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (formMode === 'create') {
        await clustersApi.create(values)
        message.success(`Кластер «${values.name}» добавлен`)
      } else if (editingRecord) {
        await clustersApi.update(editingRecord.id, values)
        message.success(`Кластер «${values.name}» обновлён`)
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

  const handleEdit = (record: Cluster) => {
    setActive(null)
    setEditingRecord(record)
    setFormMode('edit')
    form.setFieldsValue({
      name: record.name,
      clusterType: record.clusterType,
      version: record.version,
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
      await clustersApi.remove(editingRecord.id)
      message.success(`Кластер «${editingRecord.name}» удалён`)
      setFormDrawerOpen(false)
      form.resetFields()
      setEditingRecord(null)
      setActive(null)
      refetch()
    } catch (err) {
      message.error((err as ApiError)?.message ?? 'Не удалось удалить кластер')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = useMemo(() => {
    if (!clusters) return []
    const t = q.trim().toLowerCase()
    if (!t) return clusters
    return clusters.filter((x) => `${x.name} ${x.clusterType} ${x.version ?? ''} ${x.managementAddress ?? ''}`.toLowerCase().includes(t))
  }, [q, clusters])

  const columns: ColumnsType<Cluster> = [
    { title: 'Имя', dataIndex: 'name', key: 'name', width: 220, render: (v: string) => <Tag color='purple'>{v}</Tag> },
    { title: 'Тип', dataIndex: 'clusterType', key: 'type', width: 140 },
    { title: 'Версия', dataIndex: 'version', key: 'version', width: 110, render: (v?: string) => v ?? '—' },
    { title: 'Управление', dataIndex: 'managementAddress', key: 'mgmt', render: (v?: string) => <Typography.Text type='secondary' style={{ fontSize: 12 }}>{v ?? '—'}</Typography.Text> },
    { title: 'Размещений', key: 'dep', width: 120, render: (_: unknown, r: Cluster) => deployments?.filter((d) => d.clusterId === r.id).length ?? 0 },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 120, render: (v: string) => <StatusTag value={v} /> },
  ]

  if (isError) {
    return <Alert message="Ошибка загрузки" description={isError.message} type="error" showIcon />
  }

  if (isLoading || !clusters) {
    return <Spin spinning />
  }

  const clusterDeployments = active ? deployments?.filter((d) => d.clusterId === active.id) ?? [] : []

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Кластеры</Typography.Title>
          <Typography.Text type='secondary'>
            Сущность <Typography.Text code>cluster</Typography.Text> · Один кластер обслуживает несколько сред (REQ-012)
          </Typography.Text>
        </div>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder='Имя или тип кластера' value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <Button type='primary' icon={<PlusOutlined />} onClick={handleCreate}>Добавить кластер</Button>
        </Space>
      </div>
      <Card size='small' style={{ borderRadius: 10 }}>
        <Table<Cluster>
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
              <Descriptions.Item label='Тип'>{active.clusterType}</Descriptions.Item>
              <Descriptions.Item label='Версия'>{active.version ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Адрес управления'>{active.managementAddress ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Статус'><StatusTag value={active.status} /></Descriptions.Item>
              <Descriptions.Item label='Описание'>{active.description ?? '—'}</Descriptions.Item>
            </Descriptions>
            <Card size='small' title={`Размещения в кластере (${clusterDeployments.length})`} style={{ borderRadius: 8 }}>
              {clusterDeployments.map((d) => (
                <div key={d.id} style={{ marginBottom: 6 }}>
                  <Space>
                    <Tag color='blue'>{instances?.find((i) => i.id === d.moduleInstanceId)?.name ?? '—'}</Tag>
                    <Tag>{d.deploymentRole ?? '—'}</Tag>
                    <StatusTag value={d.deploymentState} />
                  </Space>
                </div>
              ))}
              {clusterDeployments.length === 0 && <Typography.Text type='secondary'>Размещений нет</Typography.Text>}
            </Card>
          </Space>
        )}
      </Drawer>

      <Drawer
        title={formMode === 'create' ? 'Добавить кластер' : 'Редактировать кластер'}
        open={formDrawerOpen}
        onClose={() => { setFormDrawerOpen(false); form.resetFields() }}
        width={560}
        destroyOnClose
        footer={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            {formMode === 'edit' ? (
              <Popconfirm
                title='Удалить кластер?'
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
          <Form.Item label='Имя' name='name' rules={[{ required: true, message: 'Укажите имя кластера' }]}>
            <Input placeholder='K8S-PROD-01' />
          </Form.Item>
          <Form.Item label='Тип кластера' name='clusterType' rules={[{ required: true, message: 'Укажите тип кластера' }]}>
            <Input placeholder='KUBERNETES / PROXMOX' />
          </Form.Item>
          <Form.Item label='Версия' name='version'>
            <Input placeholder='1.29' />
          </Form.Item>
          <Form.Item label='Адрес управления' name='managementAddress'>
            <Input placeholder='https://k8s-prod-01:6443' />
          </Form.Item>
          <Form.Item label='Статус' name='status' rules={[{ required: true, message: 'Выберите статус' }]}>
            <Select options={STATUS_OPTIONS.filter((o) => ['PLANNED', 'ACTIVE', 'RETIRED'].includes(o.value))} />
          </Form.Item>
          <Form.Item label='Описание' name='description'>
            <Input.TextArea rows={3} placeholder='Описание кластера' />
          </Form.Item>
        </Form>
      </Drawer>

    </>
  )
}
