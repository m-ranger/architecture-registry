import type { NodeProps } from '@xyflow/react'
import { BOUNDARY_HEADER } from '../layout/layoutService'
import { C4_TYPE } from '../model/c4Types'
import type { ArchNodeData } from './types'

/**
 * Граница контура: System Boundary, Environment Boundary (ручной контур) и
 * Network Segment Boundary — контур схемы развертывания (ADR-025).
 * Рисуется под узлами, не перетаскивается и не выбирается: геометрия
 * вычисляется из вложенных элементов (ТЗ §10.1, §10.3).
 */
export function BoundaryNode({ data }: NodeProps) {
  const nodeData = data as unknown as ArchNodeData
  const arch = nodeData.arch
  // Контур схемы развертывания — сетевой сегмент узла размещения: своя рамка,
  // код сегмента и его сетевая зона.
  const segment = arch.c4Type === C4_TYPE.NETWORK_SEGMENT_BOUNDARY

  return (
    <div className={`arch-boundary${segment ? ' arch-boundary--segment' : ''}`}>
      <div className="arch-boundary__label" style={{ top: -(BOUNDARY_HEADER - 4) }}>
        {arch.name}
        {arch.style?.code ? <span className="arch-boundary__code">{String(arch.style.code)}</span> : null}
        {segment && arch.style?.zone ? (
          <span className="arch-boundary__code">{String(arch.style.zone)}</span>
        ) : null}
      </div>
    </div>
  )
}
