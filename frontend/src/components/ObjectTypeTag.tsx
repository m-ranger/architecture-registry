import { Select, Space, Tag, Tooltip, Typography } from 'antd'
import type { ObjectType } from '../types'

/**
 * Тип объекта реестра (ADR-027): «Тип» — INTERNAL или EXTERNAL.
 *
 * Признак задаётся у ИС, сервера и кластера (формы соответствующих страниц), а
 * модуль, размещение и сетевой адрес наследуют его от родителя — в этих списках
 * колонка «Тип» подписана «унаследован от …» и не редактируется.
 */

/** Русские подписи типов объектов */
export const OBJECT_TYPE_LABEL: Record<ObjectType, string> = {
  INTERNAL: 'Внутренний',
  EXTERNAL: 'Внешний',
}

/** Опции выбора типа объекта в формах ИС, сервера и кластера */
export const OBJECT_TYPE_OPTIONS = [
  { value: 'INTERNAL', label: 'Внутренний (INTERNAL)' },
  { value: 'EXTERNAL', label: 'Внешний (EXTERNAL)' },
]

/** Значение фильтра списка: ALL — без ограничения по типу объекта */
export type ObjectTypeFilter = ObjectType | 'ALL'

/** Опции фильтра «Типы» в списках реестра */
export const OBJECT_TYPE_FILTER_OPTIONS: { value: ObjectTypeFilter; label: string }[] = [
  { value: 'ALL', label: 'Все' },
  { value: 'INTERNAL', label: 'Только внутренние' },
  { value: 'EXTERNAL', label: 'Только внешние' },
]

/** Фильтр по умолчанию: список показывает только внутренние объекты (ADR-027) */
export const DEFAULT_OBJECT_TYPE_FILTER: ObjectTypeFilter = 'INTERNAL'

/**
 * Тип объекта строки с учётом значения по умолчанию: колонка появилась миграцией,
 * поэтому у старых записей без значения объект считается внутренним.
 */
export const objectTypeOf = (value?: ObjectType | null): ObjectType => value ?? 'INTERNAL'

/** Проходит ли объект фильтр «Типы» */
export function matchesObjectType(value: ObjectType | null | undefined, filter: ObjectTypeFilter): boolean {
  if (filter === 'ALL') return true
  return objectTypeOf(value) === filter
}

/** Тег типа объекта; подсказка поясняет, откуда признак берётся */
export function ObjectTypeTag({ value, source }: { value?: ObjectType | null; source?: string }) {
  const type = objectTypeOf(value)
  const tag = <Tag color={type === 'EXTERNAL' ? 'orange' : 'blue'}>{OBJECT_TYPE_LABEL[type]}</Tag>
  if (!source) return tag
  return <Tooltip title={`${OBJECT_TYPE_LABEL[type]} (${type}). Тип ${source}`}>{tag}</Tooltip>
}

/** Фильтр «Типы» — селектор в тулбаре списка; используется всеми страницами реестра */
export function ObjectTypeFilterSelect({
  value,
  onChange,
}: {
  value: ObjectTypeFilter
  onChange: (value: ObjectTypeFilter) => void
}) {
  return (
    <Space size={6}>
      <Typography.Text type='secondary'>Типы:</Typography.Text>
      <Select value={value} onChange={onChange} options={OBJECT_TYPE_FILTER_OPTIONS} style={{ width: 190 }} />
    </Space>
  )
}
