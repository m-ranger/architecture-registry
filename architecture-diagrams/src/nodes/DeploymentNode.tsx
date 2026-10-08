import { ClusterOutlined } from '@ant-design/icons'
import type { NodeProps } from '@xyflow/react'
import { NodeShell } from './NodeShell'
import type { ArchNodeData } from './types'

/** C4 Deployment Instance — module_instance на узле размещения (ТЗ §10.3). */
export function DeploymentNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as ArchNodeData
  return (
    <NodeShell
      data={nodeData}
      selected={Boolean(selected)}
      accent="#7c5cff"
      icon={<ClusterOutlined style={{ color: '#7c5cff' }} />}
    />
  )
}
