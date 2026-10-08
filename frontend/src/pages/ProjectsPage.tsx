import { useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Card, Descriptions, Drawer, Form, Input, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { StatusTag, STATUS_OPTIONS } from '../components/StatusTag'
import { projectsApi } from '../api'
import type { ProjectInput } from '../api'
import { useApi } from '../api/useApi'
import type { ApiError } from '../api/client'
import type { InformationFlow, Project } from '../types'

/** Строка списка потоков проекта — API дополняет карточку JOIN-полями */
type ProjectFlow = InformationFlow & {
  sourceModuleCode?: string
  targetModuleCode?: string
  protocolCode?: string
}

/**
 * Реестровый объект «Проект»: обязательные параметры — Номер проекта и Наименование.
 * В карточке проекта видны информационные потоки, задействованные в рамках проекта (1:N).
 */
export default function ProjectsPage() {
  const { message } = App.useApp()
  const { data: projects, loading: isLoading, error: isError, refetch } = useApi(projectsApi.getAll)
  const [q, setQ] = useState('')
  const [active, setActive] = useState<Project | null>(null)
  const [activeFlows, setActiveFlows] = useState<ProjectFlow[]>([])
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Project | null>(null)
  const [form] = Form.useForm<ProjectInput>()

  /** Потоки, задействованные в выбранном проекте */
  useEffect(() => {
    let cancelled = false
    if (!active) {
      setActiveFlows([])
      return
    }
    projectsApi
      .getFlows(active.id)
      .then((rows) => { if (!cancelled) setActiveFlows(rows as ProjectFlow[]) })
      .catch(() => { if (!cancelled) setActiveFlows([]) })
    return () => { cancelled = true }
  }, [active])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (formMode === 'create') {
        await projectsApi.create(values)
        message.success(`Проект «${values.code}» добавлен`)
      } else if (editingRecord) {
        await projectsApi.update(editingRecord.id, values)
        message.success(`Проект «${values.code}» обновлён`)
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

  const handleEdit = (record: Project) => {
    setActive(null)
    setEditingRecord(record)
    setFormMode('edit')
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      description: record.description,
      status: record.status,
    })
    setFormDrawerOpen(true)
  }

  const filtered = useMemo(() => {
    if (!projects) return []
    const t = q.trim().toLowerCase()
    if (!t) return projects
    return projects.filter((x) => `${x.code} ${x.name} ${x.description ?? ''}`.toLowerCase().includes(t))
  }, [q, projects])

  const columns: ColumnsType<Project> = [
    { title: 'Номер проекта', dataIndex: 'code', key: 'code', width: 170, render: (v: string) => <Tag color='geekblue'>{v}</Tag> },
    { title: 'Наименование', dataIndex: 'name', key: 'name' },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 130, render: (v: string) => <StatusTag value={v} /> },
    { title: 'Потоков', dataIndex: 'flowsCnt', key: 'flowsCnt', width: 100, render: (v?: number) => v ?? 0 },
    { title: 'Описание', dataIndex: 'description', key: 'desc', render: (v?: string) => <Typography.Text type='secondary' style={{ fontSize: 12 }}>{v ?? '—'}</Typography.Text> },
  ]

  if (isError) {
    return <Alert message="Ошибка загрузки" description={isError.message} type="error" showIcon />
  }

  if (isLoading || !projects) {
    return <Spin spinning />
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Проекты</Typography.Title>
          <Typography.Text type='secondary'>
            Сущность <Typography.Text code>project</Typography.Text> · Объект реестра: Номер проекта и Наименование · информационные потоки задействуются в проектах (1:N)
          </Typography.Text>
        </div>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder='Номер или наименование проекта' value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <Button type='primary' icon={<PlusOutlined />} onClick={handleCreate}>Добавить проект</Button>
        </Space>
      </div>
      <Card size='small' style={{ borderRadius: 10 }}>
        <Table<Project>
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
              <Descriptions.Item label='Номер проекта'>{active.code}</Descriptions.Item>
              <Descriptions.Item label='Наименование'>{active.name}</Descriptions.Item>
              <Descriptions.Item label='Статус'><StatusTag value={active.status} /></Descriptions.Item>
              <Descriptions.Item label='Описание'>{active.description ?? '—'}</Descriptions.Item>
            </Descriptions>
            <Card size='small' title={`Информационные потоки проекта (${activeFlows.length})`} style={{ borderRadius: 8 }}>
              {activeFlows.map((f) => (
                <div key={f.id} style={{ marginBottom: 6 }}>
                  <Space wrap>
                    <Tag color='blue'>{f.code}</Tag>
                    <Typography.Text strong>{f.name}</Typography.Text>
                    <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                      {(f.sourceModuleCode ?? '—')} → {(f.targetModuleCode ?? '—')}{f.protocolCode ? ` · ${f.protocolCode}` : ''}
                    </Typography.Text>
                    <StatusTag value={f.status} />
                  </Space>
                </div>
              ))}
              {activeFlows.length === 0 && (
                <Typography.Text type='secondary'>
                  Потоки не задействованы — укажите проекты в карточке информационного потока
                </Typography.Text>
              )}
            </Card>
          </Space>
        )}
      </Drawer>

      <Drawer
        title={formMode === 'create' ? 'Добавить проект' : 'Редактировать проект'}
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
          <Form.Item label='Номер проекта' name='code' rules={[{ required: true, message: 'Укажите номер проекта' }]} tooltip='Номер проекта уникален, например PRJ-2026-004'>
            <Input placeholder='PRJ-2026-004' />
          </Form.Item>
          <Form.Item label='Наименование' name='name' rules={[{ required: true, message: 'Укажите наименование проекта' }]}>
            <Input placeholder='Наименование проекта' />
          </Form.Item>
          <Form.Item label='Статус' name='status' rules={[{ required: true, message: 'Выберите статус' }]}>
            <Select options={STATUS_OPTIONS.filter((o) => ['PLANNED', 'ACTIVE', 'RETIRED'].includes(o.value))} />
          </Form.Item>
          <Form.Item label='Описание' name='description'>
            <Input.TextArea rows={3} placeholder='Цели и границы проекта' />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  )
}
