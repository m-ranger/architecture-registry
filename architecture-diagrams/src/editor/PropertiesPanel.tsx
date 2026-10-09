import { Button, Descriptions, Divider, Empty, Input, InputNumber, Select, Space, Tag, Tooltip, Typography } from 'antd'
import { DeleteOutlined, ExportOutlined } from '@ant-design/icons'
import type { ArchEdge, ArchNode, RegistryRef } from '../model/diagramTypes'
import { formatAddress, nodeAddresses } from '../model/diagramTypes'
import { C4_TYPE, C4_VISUAL } from '../model/c4Types'
import { containerChildren, isContainerNode } from '../layout/layoutService'
import { registryTypeLabel } from '../model/registryRefs'

const VARIANT_OPTIONS = [
  { value: 'primary', label: 'Основная система' },
  { value: 'external', label: 'Внешняя система' },
  { value: 'application', label: 'Приложение' },
  { value: 'infrastructure', label: 'Инфраструктура' },
  { value: 'annotation', label: 'Аннотация' },
]

interface PropertiesPanelProps {
  node: ArchNode | null
  edge: ArchEdge | null
  /** Все узлы схемы: состав узла размещения и узел размещения экземпляра (ТЗ §10.3). */
  nodes: ArchNode[]
  canEdit: boolean
  onUpdateNode: (id: string, patch: Partial<ArchNode>) => void
  onUpdateEdge: (id: string, patch: Partial<ArchEdge>) => void
  onRemove: (kind: 'node' | 'edge', id: string) => void
  onOpenRegistry: (ref: RegistryRef) => void
}

/** Правая панель свойств: Registry ref, C4 type, Label, Style (ТЗ §11). */
export function PropertiesPanel({
  node,
  edge,
  nodes,
  canEdit,
  onUpdateNode,
  onUpdateEdge,
  onRemove,
  onOpenRegistry,
}: PropertiesPanelProps) {
  if (!node && !edge) {
    return (
      <div className="arch-props">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Выберите элемент или связь, чтобы увидеть свойства"
        />
      </div>
    )
  }

  if (edge) {
    return (
      <div className="arch-props">
        <Typography.Text strong className="arch-props__title">
          Связь
        </Typography.Text>
        <Descriptions column={1} size="small" colon={false} className="arch-props__desc">
          <Descriptions.Item label="Ключ">{edge.id}</Descriptions.Item>
          <Descriptions.Item label="Источник">{edge.source}</Descriptions.Item>
          <Descriptions.Item label="Приёмник">{edge.target}</Descriptions.Item>
          <Descriptions.Item label="Registry ref">
            {edge.registryRef ? (
              <a onClick={() => onOpenRegistry(edge.registryRef!)}>
                {registryTypeLabel(edge.registryRef.type)} <ExportOutlined />
              </a>
            ) : (
              <Tag>свободная связь</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '12px 0' }} />

        <label className="arch-props__field">
          <span>Label</span>
          <Input
            disabled={!canEdit}
            value={edge.label}
            onChange={(event) => onUpdateEdge(edge.id, { label: event.target.value })}
          />
        </label>
        <label className="arch-props__field">
          <span>Технология</span>
          <Input
            disabled={!canEdit}
            placeholder="REST/HTTPS"
            value={edge.technology || ''}
            onChange={(event) => onUpdateEdge(edge.id, { technology: event.target.value || null })}
          />
        </label>

        <Tooltip title={canEdit ? 'Удалить связь' : 'Нет права редактирования'}>
          <Button
            danger
            block
            style={{ marginTop: 14 }}
            icon={<DeleteOutlined />}
            disabled={!canEdit}
            onClick={() => onRemove('edge', edge.id)}
          >
            Удалить связь
          </Button>
        </Tooltip>
      </div>
    )
  }

  const current = node as ArchNode
  const visual = C4_VISUAL[current.c4Type] || C4_VISUAL[C4_TYPE.CONTAINER]
  // Адреса развертывания узла: у кластера — набор адресов, у сервера — интерфейсы.
  const addresses = nodeAddresses(current)
  // Схема развертывания (ТЗ §10.3): состав узла размещения и узел у экземпляра.
  const containers = nodes.filter((item) => isContainerNode(item))
  const container = isContainerNode(current)
  const children = container ? containerChildren(nodes, current.id) : []
  const host = current.parent ? containers.find((item) => item.id === current.parent) : undefined

  return (
    <div className="arch-props">
      <Typography.Text strong className="arch-props__title">
        {visual.label}
      </Typography.Text>

      <Descriptions column={1} size="small" colon={false} className="arch-props__desc">
        <Descriptions.Item label="Ключ">{current.id}</Descriptions.Item>
        <Descriptions.Item label="C4 type">{current.c4Type}</Descriptions.Item>
        <Descriptions.Item label="Registry ref">
          {current.registryRef ? (
            <a onClick={() => onOpenRegistry(current.registryRef!)}>
              {registryTypeLabel(current.registryRef.type)} <ExportOutlined />
            </a>
          ) : (
            <Tag>свободный элемент</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Родитель">{current.parent || '—'}</Descriptions.Item>
        {host ? (
          <Descriptions.Item label="Узел размещения">{host.name}</Descriptions.Item>
        ) : null}
        {container ? (
          <Descriptions.Item label="Состав">
            {children.length > 0 ? (
              <Space direction="vertical" size={0}>
                {children.map((child) => (
                  <Typography.Text key={child.id} style={{ fontSize: 12 }}>
                    {child.name}
                  </Typography.Text>
                ))}
              </Space>
            ) : (
              <Tag>экземпляров нет</Tag>
            )}
          </Descriptions.Item>
        ) : null}
        {current.c4Type === C4_TYPE.DEPLOYMENT_NODE ||
        current.c4Type === C4_TYPE.DEPLOYMENT_INSTANCE ? (
          <Descriptions.Item label="Адреса">
            {addresses.length > 0 ? (
              <Space direction="vertical" size={0}>
                {addresses.map((address, index) => (
                  <Typography.Text key={index} code style={{ fontSize: 12 }}>
                    {formatAddress(address)}
                  </Typography.Text>
                ))}
              </Space>
            ) : (
              <Tag color="orange">адрес не заведён</Tag>
            )}
          </Descriptions.Item>
        ) : null}
      </Descriptions>

      <Divider style={{ margin: '12px 0' }} />

      {current.c4Type === C4_TYPE.DEPLOYMENT_INSTANCE && containers.length > 0 ? (
        <label className="arch-props__field">
          <span>Узел размещения</span>
          <Select
            style={{ width: '100%' }}
            disabled={!canEdit}
            placeholder="выберите узел размещения"
            value={containers.some((item) => item.id === current.parent) ? current.parent! : undefined}
            options={containers.map((item) => ({ value: item.id, label: item.name }))}
            onChange={(value) => onUpdateNode(current.id, { parent: value })}
          />
        </label>
      ) : null}

      <label className="arch-props__field">
        <span>Название</span>
        <Input
          disabled={!canEdit}
          value={current.name}
          onChange={(event) => onUpdateNode(current.id, { name: event.target.value })}
        />
      </label>

      <label className="arch-props__field">
        <span>Технология</span>
        <Input
          disabled={!canEdit}
          value={current.technology || ''}
          onChange={(event) => onUpdateNode(current.id, { technology: event.target.value || null })}
        />
      </label>

      <label className="arch-props__field">
        <span>Описание</span>
        <Input.TextArea
          rows={2}
          disabled={!canEdit}
          value={current.description || ''}
          onChange={(event) => onUpdateNode(current.id, { description: event.target.value || null })}
        />
      </label>

      <label className="arch-props__field">
        <span>Стиль</span>
        <Select
          style={{ width: '100%' }}
          disabled={!canEdit}
          value={String(current.style?.variant || 'application')}
          options={VARIANT_OPTIONS}
          onChange={(value) => onUpdateNode(current.id, { style: { ...current.style, variant: value } })}
        />
      </label>

      <div className="arch-props__grid">
        <label className="arch-props__field">
          <span>X</span>
          <InputNumber
            disabled={!canEdit}
            value={Math.round(current.position.x)}
            onChange={(value) =>
              onUpdateNode(current.id, { position: { ...current.position, x: Number(value) || 0 } })
            }
          />
        </label>
        <label className="arch-props__field">
          <span>Y</span>
          <InputNumber
            disabled={!canEdit}
            value={Math.round(current.position.y)}
            onChange={(value) =>
              onUpdateNode(current.id, { position: { ...current.position, y: Number(value) || 0 } })
            }
          />
        </label>
        <label className="arch-props__field">
          <span>Ширина</span>
          <InputNumber
            min={120}
            disabled={!canEdit || container}
            value={current.size.width}
            onChange={(value) =>
              onUpdateNode(current.id, { size: { ...current.size, width: Number(value) || 240 } })
            }
          />
        </label>
        <label className="arch-props__field">
          <span>Высота</span>
          <InputNumber
            min={60}
            disabled={!canEdit || container}
            value={current.size.height}
            onChange={(value) =>
              onUpdateNode(current.id, { size: { ...current.size, height: Number(value) || 100 } })
            }
          />
        </label>
      </div>

      {container ? (
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Рамка узла размещения рассчитывается по составу: узел расширяется под экземпляры модулей.
        </Typography.Text>
      ) : null}

      <Tooltip title={canEdit ? 'Удалить узел' : 'Нет права редактирования'}>
        <Button
          danger
          block
          style={{ marginTop: 14 }}
          icon={<DeleteOutlined />}
          disabled={!canEdit}
          onClick={() => onRemove('node', current.id)}
        >
          Удалить элемент
        </Button>
      </Tooltip>
    </div>
  )
}
