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
  /**
   * Экземпляр модуля (C4 Deployment Instance): адрес, узел размещения и статус —
   * атрибуты размещения в реестре, и на схеме их несёт узел размещения. Поэтому
   * карточка экземпляра показывает назначение модуля (`description`) и его код
   * (`technology`) — без адресов, подписи «на узле», кода и статуса (ADR-023).
   */
  deploymentInstance?: boolean
}

const ISSUE_COLOR: Record<string, string> = {
  ERROR: '#ef4444',
  WARNING: '#f59e0b',
  INFO: '#06b6d4',
}

/**
 * Общая оболочка узла C4: заголовок, назначение, технология, ссылка на реестр и статус.
 * Различия между System / Container / Deployment Node / Deployment Instance —
 * только в акценте, подписи типа и наличии «тела» под состав экземпляров.
 * Счётчик состава на карточке узла размещения не выводится (ADR-024): состав виден
 * по самим экземплярам внутри рамки, а число дублировало схему.
 */
export function NodeShell({
  data,
  selected,
  accent,
  icon,
  container = false,
  deploymentInstance = false,
}: NodeShellProps) {
  const node = data.arch
  const variant = String(node.style?.variant || 'application')
  // Адреса развертывания (ТЗ §10.3): у кластера — набор адресов, у сервера — интерфейсы.
  const addresses = nodeAddresses(node)
  const addressText = addresses.map(formatAddress).filter(Boolean)
  // Состав узла нужен только для подсказки пустого тела узла (ADR-024).
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
      </div>

      {/* Экземпляр модуля: назначение (описание модуля) — сразу под заголовком (ADR-023). */}
      {deploymentInstance && node.description ? (
        <div className="arch-node__desc">{node.description}</div>
      ) : null}

      {node.technology ? <div className="arch-node__tech">{node.technology}</div> : null}

      {addressText.length > 0 && !deploymentInstance ? (
        <div className="arch-node__addr" title={addressText.join('; ')}>
          {addressText.slice(0, 2).join(' · ')}
          {addressText.length > 2 ? ` +${addressText.length - 2}` : ''}
        </div>
      ) : null}

      {/* Адрес, узел размещения и статус — атрибуты узла размещения (ADR-020, ADR-023),
          поэтому карточка экземпляра их не дублирует. */}
      {!deploymentInstance ? (
        <div className="arch-node__foot">
          {node.style?.code ? <span className="arch-node__code">{String(node.style.code)}</span> : null}
          {node.style?.status ? <StatusTag status={String(node.style.status)} /> : null}
        </div>
      ) : null}
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
