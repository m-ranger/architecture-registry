import type { ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import { StatusTag } from '../components/StatusTag'
import type { ArchNodeData } from './types'

interface NodeShellProps {
  data: ArchNodeData
  selected: boolean
  accent: string
  icon?: ReactNode
}

const ISSUE_COLOR: Record<string, string> = {
  ERROR: '#ef4444',
  WARNING: '#f59e0b',
  INFO: '#06b6d4',
}

/**
 * Общая оболочка узла C4: заголовок, технология, ссылка на реестр и статус.
 * Различия между System / Container / Deployment Instance — только в акценте и подписи типа.
 */
export function NodeShell({ data, selected, accent, icon }: NodeShellProps) {
  const node = data.arch
  const variant = String(node.style?.variant || 'application')
  const borderColor = data.issueLevel
    ? ISSUE_COLOR[data.issueLevel]
    : variant === 'primary'
      ? accent
      : '#c7d3e8'

  return (
    <div
      className={`arch-node arch-node--${variant}${selected ? ' arch-node--selected' : ''}`}
      style={{
        width: node.size.width,
        height: node.size.height,
        borderColor,
        boxShadow: selected ? `0 0 0 3px ${accent}22` : undefined,
      }}
      title={node.description || node.name}
    >
      <Handle type="target" position={Position.Left} style={{ background: accent, width: 7, height: 7 }} />

      <div className="arch-node__head">
        {icon}
        <span className="arch-node__title">{node.name}</span>
      </div>

      {node.technology ? <div className="arch-node__tech">{node.technology}</div> : null}

      <div className="arch-node__foot">
        {node.style?.code ? <span className="arch-node__code">{String(node.style.code)}</span> : null}
        {node.style?.status ? <StatusTag status={String(node.style.status)} /> : null}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: accent, width: 7, height: 7 }} />
    </div>
  )
}
