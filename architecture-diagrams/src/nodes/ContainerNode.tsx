import { AppstoreOutlined } from '@ant-design/icons'
import type { NodeProps } from '@xyflow/react'
import { NodeShell } from './NodeShell'
import type { ArchNodeData } from './types'

/** C4 Container — application_module внутри информационной системы (ТЗ §6, §10.2). */
export function ContainerNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as ArchNodeData
  return (
    <NodeShell
      data={nodeData}
      selected={Boolean(selected)}
      accent="#2f6bff"
      icon={<AppstoreOutlined style={{ color: '#2f6bff' }} />}
    />
  )
}
