import { Button, Descriptions, Divider, Empty, Input, InputNumber, Select, Tag, Tooltip, Typography } from 'antd'
import { DeleteOutlined, ExportOutlined } from '@ant-design/icons'
import type { ArchEdge, ArchNode, RegistryRef } from '../model/diagramTypes'
import { C4_TYPE, C4_VISUAL } from '../model/c4Types'
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
      </Descriptions>

      <Divider style={{ margin: '12px 0' }} />

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
            disabled={!canEdit}
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
            disabled={!canEdit}
            value={current.size.height}
            onChange={(value) =>
              onUpdateNode(current.id, { size: { ...current.size, height: Number(value) || 100 } })
            }
          />
        </label>
      </div>

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
