import type { ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import { StatusTag } from '../components/StatusTag'
import { formatAddress, nodeAddresses } from '../model/diagramTypes'
import { CONTAINER_HEADER } from '../layout/layoutService'
import type { ArchNodeData } from './types'

interface NodeShellProps {
  data: ArchNodeData
  selected: boolean
  accent: string
  icon?: ReactNode
  /** Узел размещения — контейнер: внутри его рамки находятся экземпляры (ТЗ §10.3). */
  container?: boolean
}

const ISSUE_COLOR: Record<string, string> = {
  ERROR: '#ef4444',
  WARNING: '#f59e0b',
  INFO: '#06b6d4',
}

/**
 * Общая оболочка узла C4: заголовок, технология, ссылка на реестр и статус.
 * Различия между System / Container / Deployment Node / Deployment Instance —
 * только в акценте, подписи типа и наличии «тела» под состав экземпляров.
 */
export function NodeShell({ data, selected, accent, icon, container = false }: NodeShellProps) {
  const node = data.arch
  const variant = String(node.style?.variant || 'application')
  // Адреса развертывания (ТЗ §10.3): у кластера — набор адресов, у сервера — интерфейсы.
  const addresses = nodeAddresses(node)
  const addressText = addresses.map(formatAddress).filter(Boolean)
  const childCount = container ? Number(data.childCount || 0) : 0
  const borderColor = data.issueLevel
    ? ISSUE_COLOR[data.issueLevel]
    : variant === 'primary'
      ? accent
      : '#c7d3e8'

  const header = (
    <>
      <div className="arch-node__head">
        {icon}
        <span className="arch-node__title">{node.name}</span>
        {container ? (
          <span className="arch-node__count" title="Экземпляры модулей">
            {childCount}
          </span>
        ) : null}
      </div>

      {node.technology ? <div className="arch-node__tech">{node.technology}</div> : null}

      {addressText.length > 0 ? (
        <div className="arch-node__addr" title={addressText.join('; ')}>
          {addressText.slice(0, 2).join(' · ')}
          {addressText.length > 2 ? ` +${addressText.length - 2}` : ''}
        </div>
      ) : null}

      <div className="arch-node__foot">
        {node.style?.code ? <span className="arch-node__code">{String(node.style.code)}</span> : null}
        {node.style?.status ? <StatusTag status={String(node.style.status)} /> : null}
      </div>
    </>
  )

  return (
    <div
      className={`arch-node arch-node--${variant}${container ? ' arch-node--container' : ''}${
        selected ? ' arch-node--selected' : ''
      }`}
      style={{
        width: node.size.width,
        height: node.size.height,
        borderColor,
        boxShadow: selected ? `0 0 0 3px ${accent}22` : undefined,
      }}
      title={node.description || node.name}
    >
      <Handle type="target" position={Position.Left} style={{ background: accent, width: 7, height: 7 }} />

      {container ? (
        <>
          <div className="arch-node__header" style={{ height: CONTAINER_HEADER }}>
            {header}
          </div>
          <div className="arch-node__body">
            {childCount === 0 ? (
              <div className="arch-node__body-hint">
                Экземпляры модулей размещаются внутри узла
              </div>
            ) : null}
          </div>
        </>
      ) : (
        header
      )}

      <Handle type="source" position={Position.Right} style={{ background: accent, width: 7, height: 7 }} />
    </div>
  )
}
