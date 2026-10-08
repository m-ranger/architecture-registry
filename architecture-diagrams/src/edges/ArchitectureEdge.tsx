import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

/**
 * Связь архитектурной схемы.
 * Подпись — имя потока, дополнительная строка — протокол/порт из реестра (ТЗ §10.2).
 */
export function ArchitectureEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  label,
  data,
  selected,
}: EdgeProps) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
  })

  const technology = (data as { technology?: string | null } | undefined)?.technology
  const issueLevel = (data as { issueLevel?: string } | undefined)?.issueLevel
  const stroke = issueLevel === 'ERROR' ? '#ef4444' : issueLevel === 'WARNING' ? '#f59e0b' : '#94a3b8'

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ stroke, strokeWidth: selected ? 2.4 : 1.4 }}
      />
      {label || technology ? (
        <EdgeLabelRenderer>
          <div
            className="arch-edge__label"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {label ? <span>{String(label)}</span> : null}
            {technology ? <em>{technology}</em> : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
