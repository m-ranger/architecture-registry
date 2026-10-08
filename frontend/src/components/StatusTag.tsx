import { Tag } from 'antd'
import type { TagProps } from 'antd'

const STATUS_COLOR: Record<string, { color: TagProps['color']; label: string }> = {
  ACTIVE: { color: 'success', label: 'Активен' },
  PLANNED: { color: 'processing', label: 'Запланирован' },
  RETIRED: { color: 'default', label: 'Выведен' },
  STANDBY: { color: 'warning', label: 'Резерв' },
  INACTIVE: { color: 'error', label: 'Отключён' },
}

export function StatusTag({ value }: { value: string }) {
  const c = STATUS_COLOR[value]
  if (!c) return <Tag>{value}</Tag>
  return <Tag color={c.color}>{c.label}</Tag>
}

export const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Активен' },
  { value: 'PLANNED', label: 'Запланирован' },
  { value: 'RETIRED', label: 'Выведен' },
  { value: 'STANDBY', label: 'Резерв' },
]

