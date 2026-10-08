import { Tooltip } from 'antd'
import { STATUS_LABEL } from '../model/c4Types'

const COLORS: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: '#e8f7ee', color: '#15803d' },
  PUBLISHED: { bg: '#e8f7ee', color: '#15803d' },
  PLANNED: { bg: '#eef2ff', color: '#3f4ec7' },
  DRAFT: { bg: '#fff7ed', color: '#b45309' },
  RETIRED: { bg: '#f1f5f9', color: '#64748b' },
  ARCHIVED: { bg: '#f1f5f9', color: '#64748b' },
}

/** Статус объекта реестра или схемы в едином корпоративном стиле. */
export function StatusTag({ status }: { status: string }) {
  const palette = COLORS[status] || COLORS.RETIRED
  return (
    <Tooltip title={status}>
      <span
        className="arch-status"
        style={{ background: palette.bg, color: palette.color }}
      >
        {STATUS_LABEL[status] || status}
      </span>
    </Tooltip>
  )
}
