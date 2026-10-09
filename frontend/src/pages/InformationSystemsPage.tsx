import { useMemo, useState } from 'react'
import { Button, Card, Descriptions, Drawer, Form, Input, Popconfirm, Select, Space, Table, Tag, Typography, Spin, Alert, App } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { StatusTag, STATUS_OPTIONS } from '../components/StatusTag'
import { informationSystemsApi, modulesApi } from '../api'
import type { InformationSystemInput } from '../api'
import { useApi } from '../api/useApi'
import type { ApiError } from '../api/client'
import type { InformationSystem } from '../types'
import { fmtDate } from '../utils/format'

export default function InformationSystemsPage() {
  const { message } = App.useApp()
  const { data: informationSystems, loading: isLoading, error: isError, refetch } = useApi(informationSystemsApi.getAll)
  const { data: modules } = useApi(modulesApi.getAll)
  const [q, setQ] = useState('')
  const [active, setActive] = useState<InformationSystem | null>(null)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [editingRecord, setEditingRecord] = useState<InformationSystem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form] = Form.useForm<InformationSystemInput>()

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (formMode === 'create') {
        await informationSystemsApi.create(values)
        message.success(`ИС «${values.code}» добавлена`)
      } else if (editingRecord) {
        await informationSystemsApi.update(editingRecord.id, values)
        message.success(`ИС «${values.code}» обновлена`)
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

  const handleEdit = (record: InformationSystem) => {
    setActive(null) // закрыть детали
    setEditingRecord(record)
    setFormMode('edit')
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      status: record.status,
      owner: record.owner,
      description: record.description,
    })
    setFormDrawerOpen(true)
  }

  /** Удаление доступно только в режиме редактирования — из формы изменений */
  const handleDelete = async () => {
    if (!editingRecord) return
    try {
      setDeleting(true)
      await informationSystemsApi.remove(editingRecord.id)
      message.success(`ИС «${editingRecord.code}» удалена`)
      setFormDrawerOpen(false)
      form.resetFields()
      setEditingRecord(null)
      setActive(null)
      refetch()
    } catch (err) {
      message.error((err as ApiError)?.message ?? 'Не удалось удалить информационную систему')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = useMemo(() => {
    if (!informationSystems) return []
    const t = q.trim().toLowerCase()
    if (!t) return informationSystems
    return informationSystems.filter((x) => `${x.code} ${x.name} ${x.description ?? ''} ${x.owner ?? ''}`.toLowerCase().includes(t))
  }, [q, informationSystems])

  const columns: ColumnsType<InformationSystem> = [
    { title: 'Код', dataIndex: 'code', key: 'code', width: 140, sorter: (a, b) => a.code.localeCompare(b.code), render: (v: string) => <Typography.Text strong>{v}</Typography.Text> },
    { title: 'Наименование', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Владелец', dataIndex: 'owner', key: 'owner', width: 170 },
    { title: 'Модулей', key: 'mods', width: 90, render: (_: unknown, r: InformationSystem) => modules?.filter((m) => m.informationSystemId === r.id).length ?? 0 },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 120, render: (v: string) => <StatusTag value={v} />, filters: [{ text: 'Активно', value: 'ACTIVE' }, { text: 'План', value: 'PLANNED' }, { text: 'Выведено', value: 'RETIRED' }], onFilter: (val, rec) => rec.status === val },
    { title: 'Обновлено', dataIndex: 'updatedAt', key: 'updatedAt', width: 150, render: (v: string) => <Typography.Text type='secondary' style={{ fontSize: 12 }}>{fmtDate(v)}</Typography.Text> },
  ]

  if (isError) {
    return <Alert message="Ошибка загрузки" description={isError.message} type="error" showIcon />
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Информационные системы</Typography.Title>
          <Typography.Text type='secondary'>Сущность <Typography.Text code>information_system</Typography.Text> — система верхнего уровня. Код уникален (REQ-002).</Typography.Text>
        </div>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder='Код, название, владелец' value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 280 }} />
          <Button type='primary' icon={<PlusOutlined />} onClick={handleCreate}>Добавить ИС</Button>
        </Space>
      </div>
      <Card size='small' style={{ borderRadius: 10 }}>
        <Spin spinning={isLoading}>
          <Table<InformationSystem> rowKey='id' columns={columns} dataSource={filtered} pagination={{ pageSize: 8, showSizeChanger: true }} onRow={(rec) => ({ onClick: () => setActive(rec), style: { cursor: 'pointer' } })} />
        </Spin>
      </Card>

      <Drawer
        title={active ? `${active.code} — ${active.name}` : ''}
        open={!!active}
        onClose={() => setActive(null)}
        width={560}
        extra={
          <Space>
            <Tag color='blue'>{active?.code}</Tag>
            <Button type='primary' icon={<EditOutlined />} onClick={() => active && handleEdit(active)}>
              Редактировать
            </Button>
          </Space>
        }
      >
        {active && (
          <Space direction='vertical' size={16} style={{ width: '100%' }}>
            <Descriptions size='small' bordered column={1}>
              <Descriptions.Item label='Код'>{active.code}</Descriptions.Item>
              <Descriptions.Item label='Наименование'>{active.name}</Descriptions.Item>
              <Descriptions.Item label='Статус'><StatusTag value={active.status} /></Descriptions.Item>
              <Descriptions.Item label='Владелец'>{active.owner ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Описание'>{active.description ?? '—'}</Descriptions.Item>
              <Descriptions.Item label='Создано'>{fmtDate(active.createdAt)} · {active.createdBy}</Descriptions.Item>
              <Descriptions.Item label='Изменено'>{fmtDate(active.updatedAt)} · {active.updatedBy}</Descriptions.Item>
            </Descriptions>
            <div>
              <Typography.Text strong>Модули этой ИС</Typography.Text>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {modules?.filter((m) => m.informationSystemId === active.id).map((m) => (
                  <Card key={m.id} size='small' style={{ borderRadius: 8 }}><Space><Tag>{m.code}</Tag><Typography.Text>{m.name}</Typography.Text><StatusTag value={m.status} /><Tag>{m.moduleType ?? '—'}</Tag></Space><div style={{ marginTop: 4 }}><Typography.Text type='secondary' style={{ fontSize: 12 }}>{m.purpose}</Typography.Text></div></Card>
                ))}
                {(!modules || modules.filter((m) => m.informationSystemId === active.id).length === 0) && <Typography.Text type='secondary'>Модулей нет</Typography.Text>}
              </div>
            </div>
          </Space>
        )}
      </Drawer>

      <Drawer
        title={formMode === 'create' ? 'Добавить информационную систему' : 'Редактировать информационную систему'}
        open={formDrawerOpen}
        onClose={() => { setFormDrawerOpen(false); form.resetFields() }}
        width={560}
        footer={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            {formMode === 'edit' ? (
              <Popconfirm
                title='Удалить информационную систему?'
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
              <Button type='primary' onClick={handleSave} loading={submitting}>
                {formMode === 'create' ? 'Создать' : 'Сохранить'}
              </Button>
            </Space>
          </Space>
        }
        destroyOnClose
      >
        <Form form={form} layout='vertical'>
          <Form.Item
            label='Код'
            name='code'
            rules={[{ required: true, message: 'Укажите код ИС' }]}
            tooltip='Уникальный код системы (REQ-002), например IS-NEW-SYSTEM'
          >
            <Input placeholder='IS-NEW-SYSTEM' />
          </Form.Item>
          <Form.Item label='Наименование' name='name' rules={[{ required: true, message: 'Укажите наименование' }]}>
            <Input placeholder='Наименование информационной системы' />
          </Form.Item>
          <Form.Item label='Статус' name='status' rules={[{ required: true, message: 'Выберите статус' }]}>
            <Select options={STATUS_OPTIONS.filter((o) => ['PLANNED', 'ACTIVE', 'RETIRED'].includes(o.value))} />
          </Form.Item>
          <Form.Item label='Владелец' name='owner'>
            <Input placeholder='Подразделение / владелец' />
          </Form.Item>
          <Form.Item label='Описание' name='description'>
            <Input.TextArea rows={3} placeholder='Краткое описание назначения системы' />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  )
}
