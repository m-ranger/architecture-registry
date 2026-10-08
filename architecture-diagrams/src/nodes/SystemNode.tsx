import { ApartmentOutlined } from '@ant-design/icons'
import type { NodeProps } from '@xyflow/react'
import { NodeShell } from './NodeShell'
import type { ArchNodeData } from './types'

/** C4 Software System — центральный объект System Context (ТЗ §6). */
export function SystemNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as ArchNodeData
  const accent = nodeData.arch.style?.variant === 'external' ? '#94a3b8' : '#2f6bff'
  return (
    <NodeShell
      data={nodeData}
      selected={Boolean(selected)}
      accent={accent}
      icon={<ApartmentOutlined style={{ color: accent }} />}
    />
  )
}
