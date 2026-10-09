import { DatabaseOutlined } from '@ant-design/icons'
import type { NodeProps } from '@xyflow/react'
import { NodeShell } from './NodeShell'
import type { ArchNodeData } from './types'

/**
 * C4 Deployment Node — server или cluster как узел размещения (ТЗ §6, §10.3).
 * Узел размещения — контейнер: он расширяется под состав, а экземпляры модулей
 * размещаются внутри его рамки.
 */
export function ServerNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as ArchNodeData
  return (
    <NodeShell
      data={nodeData}
      selected={Boolean(selected)}
      accent="#f59e0b"
      icon={<DatabaseOutlined style={{ color: '#f59e0b' }} />}
      container
    />
  )
}
