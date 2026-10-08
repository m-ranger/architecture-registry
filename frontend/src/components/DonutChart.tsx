import type { ReactNode } from 'react'

export interface DonutSlice {
  label: string
  value: number
  color: string
}

export interface DonutChartProps {
  data: DonutSlice[]
  size?: number
  thickness?: number
  centerValue?: ReactNode
  centerLabel?: ReactNode
  showLegend?: boolean
  /** Формат подписи в легенде: «48 (50%)» или «50%» */
  legendFormat?: 'value-percent' | 'percent'
}

/**
 * Кольцевая диаграмма без внешних зависимостей (чистый SVG).
 * Используется на дашборде, чтобы не тянуть тяжёлые библиотеки графиков.
 */
export default function DonutChart({
  data,
  size = 180,
  thickness = 22,
  centerValue,
  centerLabel,
  showLegend = true,
  legendFormat = 'value-percent',
}: DonutChartProps) {
  const total = data.reduce((acc, s) => acc + (Number.isFinite(s.value) ? s.value : 0), 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  let offset = 0
  const arcs = data.map((slice, i) => {
    const value = Number.isFinite(slice.value) ? slice.value : 0
    const fraction = total > 0 ? value / total : 0
    const length = fraction * circumference
    const arc = (
      <circle
        key={`${slice.label}-${i}`}
        cx={center}
        cy={center}
        r={radius}
        fill='none'
        stroke={slice.color}
        strokeWidth={thickness}
        strokeDasharray={`${length} ${circumference - length}`}
        strokeDashoffset={-offset}
      />
    )
    offset += length
    return arc
  })

  return (
    <div className='donut'>
      <div className='donut-graphic' style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role='img'>
          <circle cx={center} cy={center} r={radius} fill='none' stroke='#eef1f6' strokeWidth={thickness} />
          <g transform={`rotate(-90 ${center} ${center})`}>{arcs}</g>
        </svg>
        <div className='donut-center'>
          {centerValue != null && <div className='donut-center-value'>{centerValue}</div>}
          {centerLabel != null && <div className='donut-center-label'>{centerLabel}</div>}
        </div>
      </div>

      {showLegend && (
        <ul className='donut-legend'>
          {data.map((slice, i) => {
            const fraction = total > 0 ? (Number.isFinite(slice.value) ? slice.value : 0) / total : 0
            const percent = Math.round(fraction * 100)
            return (
              <li key={`${slice.label}-${i}`}>
                <span className='donut-dot' style={{ background: slice.color }} />
                <span className='donut-legend-label'>{slice.label}</span>
                <span className='donut-legend-value'>
                  {legendFormat === 'percent' ? `${percent}%` : `${slice.value} (${percent}%)`}
                </span>
              </li>
            )
          })}
          {data.length === 0 && <li className='donut-legend-empty'>Нет данных</li>}
        </ul>
      )}
    </div>
  )
}
