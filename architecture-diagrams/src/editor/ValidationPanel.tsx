import { Alert, Empty, List, Tag, Typography } from 'antd'
import type { ValidationIssue, ValidationResult } from '../model/diagramTypes'

const SEVERITY_COLOR: Record<string, string> = {
  ERROR: 'red',
  WARNING: 'orange',
  INFO: 'blue',
}

interface ValidationPanelProps {
  result: ValidationResult | null
  onSelect: (issue: ValidationIssue) => void
}

/** Результаты проверки схемы (ТЗ §17, FR-015). ERROR блокирует публикацию. */
export function ValidationPanel({ result, onSelect }: ValidationPanelProps) {
  if (!result) {
    return (
      <div className="arch-validation">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Проверка ещё не выполнялась" />
      </div>
    )
  }

  const { summary } = result

  return (
    <div className="arch-validation">
      <Alert
        type={summary.errors > 0 ? 'error' : summary.warnings > 0 ? 'warning' : 'success'}
        showIcon
        message={
          summary.errors > 0
            ? `Найдено ERROR: ${summary.errors} — публикация запрещена`
            : summary.warnings > 0
              ? `Предупреждений: ${summary.warnings}; публикация разрешена`
              : 'Ошибок и предупреждений нет'
        }
        description={`WARNING: ${summary.warnings} · INFO: ${summary.infos}`}
      />

      <List
        size="small"
        className="arch-validation__list"
        dataSource={result.issues}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Замечаний нет" /> }}
        renderItem={(issue) => (
          <List.Item className="arch-validation__item" onClick={() => onSelect(issue)}>
            <Tag color={SEVERITY_COLOR[issue.severity]} style={{ marginInlineEnd: 8 }}>
              {issue.severity}
            </Tag>
            <div className="arch-validation__text">
              <Typography.Text style={{ fontSize: 12 }}>{issue.message}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {issue.code}
                {issue.nodeId ? ` · ${issue.nodeId}` : ''}
                {issue.edgeId ? ` · ${issue.edgeId}` : ''}
              </Typography.Text>
            </div>
          </List.Item>
        )}
      />
    </div>
  )
}
