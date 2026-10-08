import { useEffect, useMemo, useState } from 'react'
import { Empty, Input, Select, Spin, Tag, Tooltip, Typography } from 'antd'
import {
  ApartmentOutlined,
  AppstoreOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { registryApi } from '../api/registryApi'
import { registryTypeLabel, type SearchItem } from '../model/registryRefs'
import { REGISTRY_ROUTE } from '../model/diagramTypes'

const SEARCHABLE_TYPES = [
  'information_system',
  'application_module',
  'module_instance',
  'server',
  'cluster',
  'environment',
  'network_segment',
  'information_flow',
]

/** Легенда C4-палитры (ТЗ §6, §11). */
const C4_LEGEND = [
  { icon: <ApartmentOutlined style={{ color: '#2f6bff' }} />, label: 'Software System', hint: 'information_system' },
  { icon: <AppstoreOutlined style={{ color: '#2f6bff' }} />, label: 'Container', hint: 'application_module' },
  { icon: <ClusterOutlined style={{ color: '#7c5cff' }} />, label: 'Deployment Instance', hint: 'module_instance' },
  { icon: <DatabaseOutlined style={{ color: '#f59e0b' }} />, label: 'Deployment Node', hint: 'server / cluster' },
  { icon: <FileTextOutlined style={{ color: '#b45309' }} />, label: 'Annotation', hint: 'свободный элемент' },
]

interface PaletteProps {
  canEdit: boolean
  /** Текстовая подсказка об области схемы (ИС или проект) — без обращения к API. */
  scopeHint: string | null
  onAddRegistryObject: (item: SearchItem) => void
  onAddAnnotation: () => void
}

/** Левая панель: палитра C4 и поиск объектов реестра (ТЗ §11, FR-006). */
export function Palette({ canEdit, scopeHint, onAddRegistryObject, onAddAnnotation }: PaletteProps) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [items, setItems] = useState<SearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await registryApi.search(query, typeFilter.length > 0 ? typeFilter : SEARCHABLE_TYPES)
        if (!cancelled) setItems(result)
      } catch (err) {
        if (!cancelled) {
          setItems([])
          setError(err instanceof Error ? err.message : 'Ошибка поиска')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 320)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, typeFilter])

  const legend = useMemo(() => C4_LEGEND, [])

  return (
    <div className="arch-palette">
      <section className="arch-palette__section">
        <Typography.Text strong className="arch-palette__title">
          Поиск реестра
        </Typography.Text>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="ИС, модуль, экземпляр, сервер, кластер…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          mode="multiple"
          allowClear
          placeholder="Тип объекта"
          size="small"
          style={{ width: '100%', marginTop: 8 }}
          value={typeFilter}
          onChange={setTypeFilter}
          options={SEARCHABLE_TYPES.map((type) => ({ value: type, label: registryTypeLabel(type) }))}
        />

        <div className="arch-palette__results">
          {loading ? (
            <div className="arch-palette__loading">
              <Spin size="small" />
            </div>
          ) : error ? (
            <Typography.Text type="danger" style={{ fontSize: 12 }}>
              {error}
            </Typography.Text>
          ) : items.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Ничего не найдено" />
          ) : (
            items.map((item) => {
              const route = REGISTRY_ROUTE[item.objectType]
              return (
                <div key={`${item.objectType}:${item.id}`} className="arch-palette__item">
                  <div className="arch-palette__item-main">
                    <div className="arch-palette__item-name">{item.name}</div>
                    <div className="arch-palette__item-meta">
                      <Tag bordered={false} style={{ marginInlineEnd: 6 }}>
                        {item.code}
                      </Tag>
                      {registryTypeLabel(item.objectType)}
                    </div>
                  </div>
                  <Tooltip title={canEdit ? 'Добавить на схему' : 'Нет права редактирования'}>
                    <PlusOutlined
                      className={`arch-palette__add${canEdit ? '' : ' arch-palette__add--disabled'}`}
                      onClick={() => canEdit && onAddRegistryObject(item)}
                    />
                  </Tooltip>
                  {route ? <span className="arch-palette__route">{route}</span> : null}
                </div>
              )
            })
          )}
        </div>
      </section>

      <section className="arch-palette__section">
        <Typography.Text strong className="arch-palette__title">
          Палитра C4
        </Typography.Text>
        <ul className="arch-legend">
          {legend.map((row) => (
            <li key={row.label}>
              <span className="arch-legend__icon">{row.icon}</span>
              <span className="arch-legend__label">{row.label}</span>
              <span className="arch-legend__hint">{row.hint}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="arch-legend__action" disabled={!canEdit} onClick={onAddAnnotation}>
          <PlusOutlined /> Добавить аннотацию
        </button>
        {scopeHint ? (
          <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
            Область схемы: {scopeHint}. Генерация и синхронизация выполняются в границах этой области.
          </Typography.Text>
        ) : null}
      </section>

      <section className="arch-palette__section arch-palette__section--compact">
        <Typography.Text strong className="arch-palette__title">
          Границы производительности
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Интерактивная работа до 100 узлов / 200 связей, целевой диапазон до 500 / 1000 (ТЗ §20).
        </Typography.Text>
      </section>
    </div>
  )
}
