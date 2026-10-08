import { useMemo, useState } from 'react'
import { Alert, Badge, Button, Empty, List, Segmented, Space, Spin, Tag, Tooltip, Typography } from 'antd'
import { AimOutlined, ExportOutlined } from '@ant-design/icons'
import type { ScopeFlow, ScopeFlowSide, ScopeFlowsReport } from '../model/diagramTypes'

/**
 * Панель «Потоки области» (FR-002, FR-016).
 *
 * Показывает все информационные потоки области схемы — проекта или
 * информационной системы — и отмечает, какие из них отражены на схеме:
 * связи на canvas строятся только между размещениями выбранного среза по среде,
 * поэтому поток, у которого контрагент не развернут в среде, виден здесь
 * с причиной и переходом в карточку реестра.
 */

/** Состояние потока -> цвет тега. */
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green',
  PLANNED: 'orange',
  RETIRED: 'default',
}

type PanelFilter = 'all' | 'onCanvas' | 'inSlice' | 'outOfSlice'

/** Подпись стороны потока: ИС/модуль и размещения в срезе. */
function SideSummary({ side, emptyText }: { side: ScopeFlowSide; emptyText: string }) {
  return (
    <div className="arch-flow-item__side">
      <div className="arch-flow-item__side-head">
        {side.systemCode ? <Tag bordered={false}>{side.systemCode}</Tag> : null}
        <Typography.Text strong style={{ fontSize: 12 }}>{side.moduleCode}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>{side.moduleName}</Typography.Text>
      </div>
      {side.placements.length === 0 ? (
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>{emptyText}</Typography.Text>
      ) : (
        <div className="arch-flow-item__placements">
          {side.placements.map((placement) => (
            <Tooltip
              key={placement.deploymentId}
              title={`${placement.role || 'роль не указана'} · ${placement.nodeName || 'узел не задан'}${
                placement.addressCount > 1 ? ` · адресов: ${placement.addressCount} (${placement.addressText})` : ''
              }`}
            >
              <Tag bordered={false} color={placement.address ? 'blue' : 'orange'} style={{ fontSize: 10 }}>
                {placement.environmentCode} · {placement.instanceName}
                {placement.nodeName ? ` · ${placement.nodeName}` : ''}
                {placement.address ? ` · ${placement.address}` : ' · адрес не зарегистрирован'}
              </Tag>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  )
}

interface FlowsPanelProps {
  report: ScopeFlowsReport | null
  loading: boolean
  /** Показать связь потока на canvas (фокус на связи графа). */
  onFocusEdge: (edgeId: string) => void
  /** Переход в карточку потока в реестре (FR-014). */
  onOpenRegistry: (flowId: string) => void
}

export function FlowsPanel({ report, loading, onFocusEdge, onOpenRegistry }: FlowsPanelProps) {
  const [filter, setFilter] = useState<PanelFilter>('all')

  const flows = report?.flows ?? []
  const summary = report?.summary

  const visible = useMemo(() => {
    switch (filter) {
      case 'onCanvas':
        return flows.filter((flow) => flow.edgeIds.length > 0)
      case 'inSlice':
        return flows.filter((flow) => flow.inSlice)
      case 'outOfSlice':
        return flows.filter((flow) => !flow.inSlice)
      default:
        return flows
    }
  }, [flows, filter])

  if (loading && !report) {
    return (
      <div className="arch-flows__loading">
        <Spin size="small" />
      </div>
    )
  }

  if (!report) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Не удалось получить потоки области схемы" />
  }

  const environment = report.scope.environmentCode
    ? ` Срез схемы: среда ${report.scope.environmentCode}.`
    : ' Срез по среде не задан — схема показывает все среды.'

  return (
    <div className="arch-flows">
      <Alert
        type={summary && summary.outOfSlice > 0 ? 'warning' : 'success'}
        showIcon
        message={`Потоков области: ${summary?.total ?? 0} · на схеме: ${summary?.onCanvas ?? 0} · вне среза: ${summary?.outOfSlice ?? 0}`}
        description={`Область схемы: ${report.scope.type === 'project' ? 'проект' : 'информационная система'} ${
          report.scope.code ? `${report.scope.code} · ` : ''
        }${report.scope.name ?? ''}.${environment} Связи строятся только между размещениями выбранного среза, поэтому потоки с контрагентом вне среза отмечаются причиной.`}
      />

      <div className="arch-flows__toolbar">
        <Segmented<PanelFilter>
          size="small"
          value={filter}
          onChange={(value) => setFilter(value)}
          options={[
            { value: 'all', label: `Все (${summary?.total ?? 0})` },
            { value: 'onCanvas', label: `На схеме (${summary?.onCanvas ?? 0})` },
            { value: 'outOfSlice', label: `Вне среза (${summary?.outOfSlice ?? 0})` },
          ]}
        />
      </div>

      <List
        size="small"
        className="arch-flows__list"
        dataSource={visible}
        locale={{
          emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Потоков по фильтру нет" />,
        }}
        renderItem={(flow: ScopeFlow) => (
          <List.Item className="arch-flow-item">
            <div className="arch-flow-item__head">
              <Space size={6} wrap>
                <Typography.Text strong style={{ fontSize: 12 }}>{flow.code}</Typography.Text>
                <Tag color={STATUS_COLOR[flow.status] || 'default'} bordered={false}>{flow.status}</Tag>
                <Badge
                  status={flow.edgeIds.length > 0 ? 'success' : flow.inSlice ? 'warning' : 'default'}
                  text={
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      {flow.edgeIds.length > 0
                        ? `на схеме: связей ${flow.edgeIds.length}`
                        : flow.inSlice
                          ? 'связь отсутствует на схеме'
                          : 'вне среза'}
                    </Typography.Text>
                  }
                />
              </Space>
              <Space size={6}>
                <Tooltip title="Показать связь на схеме">
                  <Button
                    size="small"
                    icon={<AimOutlined />}
                    disabled={flow.edgeIds.length === 0}
                    onClick={() => onFocusEdge(flow.edgeIds[0])}
                  >
                    Показать
                  </Button>
                </Tooltip>
                <Tooltip title="Открыть карточку потока в реестре">
                  <Button size="small" icon={<ExportOutlined />} onClick={() => onOpenRegistry(flow.id)}>
                    Реестр
                  </Button>
                </Tooltip>
              </Space>
            </div>

            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {flow.name}
              {flow.technology ? ` · ${flow.technology}` : ''}
            </Typography.Text>

            <div className="arch-flow-item__sides">
              <SideSummary side={flow.source} emptyText="Нет размещений в срезе" />
              <span className="arch-flow-item__arrow">→</span>
              <SideSummary side={flow.target} emptyText="Нет размещений в срезе" />
            </div>

            {flow.reason ? (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {flow.reason}
              </Typography.Text>
            ) : null}
          </List.Item>
        )}
      />
    </div>
  )
}
