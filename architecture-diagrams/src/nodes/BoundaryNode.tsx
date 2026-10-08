import type { NodeProps } from '@xyflow/react'
import { BOUNDARY_HEADER } from '../layout/layoutService'
import type { ArchNodeData } from './types'

/**
 * Граница контура (System Boundary / Environment Boundary).
 * Рисуется под узлами, не перетаскивается и не выбирается: геометрия
 * вычисляется из вложенных элементов (ТЗ §10.1, §10.3).
 */
export function BoundaryNode({ data }: NodeProps) {
  const nodeData = data as unknown as ArchNodeData
  const arch = nodeData.arch

  return (
    <div className="arch-boundary">
      <div className="arch-boundary__label" style={{ top: -(BOUNDARY_HEADER - 4) }}>
        {arch.name}
        {arch.style?.code ? <span className="arch-boundary__code">{String(arch.style.code)}</span> : null}
      </div>
    </div>
  )
}
