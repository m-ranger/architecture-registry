import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { diagramsApi, type CreateDiagramInput } from '../api/diagramsApi'
import { registryApi, type ProjectOption, type SystemOption } from '../api/registryApi'
import {
  DIAGRAM_TYPE_HINT,
  DIAGRAM_TYPE_LABEL,
  DIAGRAM_TYPES,
  STATUS_LABEL,
  type DiagramType,
} from '../model/c4Types'
import {
  SCOPE_OPTIONS,
  SCOPE_TYPE_HINT,
  SCOPE_TYPE_LABEL,
  type DiagramListItem,
  type ScopeType,
} from '../model/diagramTypes'

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'orange',
  PUBLISHED: 'green',
  ARCHIVED: 'default',
}

/** Список схем модуля с созданием, открытием и удалением (FR-001, FR-011). */
export function DiagramListPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<DiagramListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [systems, setSystems] = useState<{ value: string; label: string }[]>([])
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([])
  const [form] = Form.useForm<CreateDiagramInput>()
  /** Область схемы: информационная система (по умолчанию) или проект. */
  const scopeType = (Form.useWatch('scopeType', form) ?? 'information_system') as ScopeType

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await diagramsApi.list())
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Не удалось загрузить список схем')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Диалог создания: подгружаем обе области схемы — ИС и проекты (FR-002). */
  const openModal = async () => {
    setModalOpen(true)
    try {
      const [systemList, projectList] = await Promise.all([
        registryApi.systems(),
        registryApi.projects(),
      ])
      setSystems(
        systemList.map((item: SystemOption) => ({ value: item.id, label: `${item.code} · ${item.name}` })),
      )
      setProjects(
        projectList.map((item: ProjectOption) => ({
          value: item.id,
          // Количество потоков проекта подсказывает, что попадёт в схему
          label: `${item.code} · ${item.name} (потоков: ${item.flowsCnt})`,
        })),
      )
    } catch {
      setSystems([])
      setProjects([])
    }
  }

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = await diagramsApi.create(values)
      message.success(`Схема ${payload.diagram.code} создана`)
      setModalOpen(false)
      form.resetFields()
      navigate(`/diagrams/${payload.diagram.id}`)
    } catch (err) {
      if (err instanceof Error) message.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await diagramsApi.remove(id)
      message.success('Схема удалена')
      void load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Не удалось удалить схему')
    }
  }

  return (
    <div className="arch-page">
      <div className="arch-page__head">
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Архитектурные схемы
          </Typography.Title>
          <Typography.Text type="secondary">
            Реестр — источник истины, схема — представление: System Context, Container, Deployment (C4)
          </Typography.Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            Обновить
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => void openModal()}>
            Создать схему
          </Button>
        </Space>
      </div>

      <Card className="arch-card" styles={{ body: { padding: 0 } }}>
        <Table<DiagramListItem>
          rowKey="id"
          loading={loading}
          dataSource={items}
          locale={{ emptyText: <Empty description="Схем пока нет — создайте первую" /> }}
          pagination={{ pageSize: 12, hideOnSinglePage: true }}
          onRow={(record) => ({
            onDoubleClick: () => navigate(`/diagrams/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: 'Код',
              dataIndex: 'code',
              width: 200,
              render: (value: string, record) => (
                <a onClick={() => navigate(`/diagrams/${record.id}`)}>{value}</a>
              ),
            },
            { title: 'Название', dataIndex: 'name', ellipsis: true },
            {
              title: 'Тип',
              dataIndex: 'diagramType',
              width: 150,
              render: (value: DiagramType) => <Tag bordered={false}>{DIAGRAM_TYPE_LABEL[value] || value}</Tag>,
            },
            {
              title: 'Область',
              dataIndex: 'scopeName',
              width: 260,
              ellipsis: true,
              render: (value: string | null, record) =>
                value ? (
                  <Space size={4}>
                    <Tag bordered={false}>{SCOPE_TYPE_LABEL[record.scopeType] ?? record.scopeType}</Tag>
                    {`${record.scopeCode} · ${value}`}
                  </Space>
                ) : (
                  '—'
                ),
            },
            {
              title: 'Статус',
              dataIndex: 'status',
              width: 130,
              render: (value: string) => <Tag color={STATUS_COLOR[value]}>{STATUS_LABEL[value] || value}</Tag>,
            },
            {
              title: 'Версия',
              dataIndex: 'revision',
              width: 140,
              render: (value: number, record) =>
                record.publishedVersion ? `v${record.publishedVersion} / rev ${value}` : `rev ${value}`,
            },
            {
              title: 'Состав',
              dataIndex: 'nodeCount',
              width: 140,
              render: (value: number, record) => `${value} узлов / ${record.edgeCount} связей`,
            },
            {
              title: 'Изменена',
              dataIndex: 'updatedAt',
              width: 170,
              render: (value: string) => new Date(value).toLocaleString('ru-RU'),
            },
            {
              title: '',
              key: 'actions',
              width: 60,
              render: (_: unknown, record) => (
                <Popconfirm title="Удалить схему?" onConfirm={() => handleDelete(record.id)}>
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Новая архитектурная схема"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleCreate()}
        confirmLoading={saving}
        okText="Создать и сгенерировать"
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ diagramType: 'CONTAINER', generate: true, scopeType: 'information_system' }}
        >
          <Form.Item name="code" label="Код схемы" rules={[{ required: true, message: 'Укажите код' }]}>
            <Input placeholder="ARCH-IS-001-CONTAINER" />
          </Form.Item>
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Укажите название' }]}>
            <Input placeholder="Интеграционная система — Container" />
          </Form.Item>
          <Form.Item name="diagramType" label="Тип схемы" rules={[{ required: true }]}>
            <Select
              options={DIAGRAM_TYPES.map((type) => ({
                value: type,
                label: DIAGRAM_TYPE_LABEL[type],
                title: DIAGRAM_TYPE_HINT[type],
              }))}
            />
          </Form.Item>

          {/* Область схемы: по ИС или в разрезе проекта (FR-002) */}
          <Form.Item
            name="scopeType"
            label="Область схемы"
            rules={[{ required: true, message: 'Выберите область схемы' }]}
            tooltip={SCOPE_TYPE_HINT[scopeType]}
          >
            <Select
              options={SCOPE_OPTIONS}
              onChange={() => form.setFieldValue('scopeObjectId', undefined)}
            />
          </Form.Item>

          <Form.Item
            name="scopeObjectId"
            label={
              scopeType === 'project'
                ? 'Проект: все потоки проекта и участвующие модули'
                : 'Информационная система'
            }
            rules={[
              {
                required: true,
                message: scopeType === 'project' ? 'Выберите проект' : 'Выберите ИС',
              },
            ]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={scopeType === 'project' ? 'Выберите проект' : 'Выберите ИС'}
              options={scopeType === 'project' ? projects : systems}
            />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="generate" valuePropName="checked">
            <Checkbox>Сразу сгенерировать схему по данным реестра (FR-002)</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
