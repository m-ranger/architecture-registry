import type { ReactNode } from 'react'
import { ArrowUpOutlined } from '@ant-design/icons'

export interface KpiCardProps {
  title: string
  value: ReactNode
  icon: ReactNode
  /** Акцентный цвет иконки и подложки (любой CSS-цвет) */
  color: string
  /** Прирост за период (например 2 «за месяц») */
  trend?: number
  trendLabel?: string
  /** Дополнительная подпись, если прирост недоступен (например «18 активных») */
  hint?: ReactNode
}

/** Карточка ключевого показателя на дашборде (макет: «Информационные системы / 24 / ↑ 2 за месяц»). */
export default function KpiCard({ title, value, icon, color, trend, trendLabel = 'за месяц', hint }: KpiCardProps) {
  return (
    <div className='kpi-card'>
      <span className='kpi-icon' style={{ background: color, color: '#fff' }}>{icon}</span>
      <div className='kpi-body'>
        <div className='kpi-title'>{title}</div>
        <div className='kpi-value'>{value}</div>
        {typeof trend === 'number' ? (
          <div className={`kpi-trend${trend < 0 ? ' is-down' : ''}`}>
            <ArrowUpOutlined style={{ fontSize: 11 }} />
            <span>{Math.abs(trend)} {trendLabel}</span>
          </div>
        ) : hint ? (
          <div className='kpi-hint'>{hint}</div>
        ) : null}
      </div>
    </div>
  )
}

