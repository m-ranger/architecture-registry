import { Badge, Button, Dropdown, Select, Space, Tag, Tooltip, Typography } from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  HistoryOutlined,
  RedoOutlined,
  ReloadOutlined,
  SaveOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  UndoOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { DIAGRAM_TYPE_LABEL, STATUS_LABEL } from '../model/c4Types'
import type { DiagramMeta, ValidationResult, VersionItem } from '../model/diagramTypes'
import { EXPORT_LABEL, EXPORT_PRIORITY, type ExportFormat } from '../api/exportApi'

interface DiagramToolbarProps {
  meta: DiagramMeta
  dirty: boolean
  saving: boolean
  validation: ValidationResult | null
  versions: VersionItem[]
  canEdit: boolean
  canPublish: boolean
  canUndo: boolean
  canRedo: boolean
  onBack: () => void
  onSave: () => void
  onRegenerate: (mode: 'REBUILD' | 'SYNC') => void
  onValidate: () => void
  onPublish: () => void
  onAutoLayout: () => void
  onUndo: () => void
  onRedo: () => void
  onExport: (format: ExportFormat) => void
  onRestore: (versionNo: number) => void
}

/** Верхняя панель редактора: операции схемы, публикация и экспорт (ТЗ §11). */
export function DiagramToolbar({
  meta,
  dirty,
  saving,
  validation,
  versions,
  canEdit,
  canPublish,
  canUndo,
  canRedo,
  onBack,
  onSave,
  onRegenerate,
  onValidate,
  onPublish,
  onAutoLayout,
  onUndo,
  onRedo,
  onExport,
  onRestore,
}: DiagramToolbarProps) {
  const errors = validation?.summary.errors || 0
  const warnings = validation?.summary.warnings || 0

  return (
    <div className="arch-toolbar">
      <Space size={8} wrap>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
          К списку схем
        </Button>

        <div className="arch-toolbar__title">
          <Typography.Text strong ellipsis style={{ maxWidth: 320 }}>
            {meta.name}
          </Typography.Text>
          <span className="arch-toolbar__meta">
            {meta.code} · {DIAGRAM_TYPE_LABEL[meta.diagramType]} · {STATUS_LABEL[meta.status] || meta.status} ·
            revision {meta.revision}
            {meta.publishedVersion ? ` · опубликовано v${meta.publishedVersion}` : ''}
          </span>
        </div>
      </Space>

      <Space size={6} wrap>
        {dirty ? <Tag color="orange">Есть несохранённые изменения</Tag> : null}
        {meta.dependenciesDirty ? <Tag color="blue">Изменены зависимости реестра</Tag> : null}

        <Tooltip title="Отменить (Ctrl+Z)">
          <Button icon={<UndoOutlined />} disabled={!canUndo} onClick={onUndo} />
        </Tooltip>
        <Tooltip title="Повторить (Ctrl+Y)">
          <Button icon={<RedoOutlined />} disabled={!canRedo} onClick={onRedo} />
        </Tooltip>

        <Dropdown
          menu={{
            items: [
              { key: 'SYNC', label: 'Синхронизировать с реестром (сохраняет layout)' },
              { key: 'REBUILD', label: 'Перестроить схему полностью (сбросит layout)' },
            ],
            onClick: ({ key }) => onRegenerate(key as 'REBUILD' | 'SYNC'),
          }}
          disabled={!canEdit}
        >
          <Button icon={<ReloadOutlined />}>Генерация</Button>
        </Dropdown>

        <Tooltip title="Автоматическая раскладка по текущим связям (ТЗ §14)">
          <Button icon={<ThunderboltOutlined />} disabled={!canEdit} onClick={onAutoLayout}>
            Layout
          </Button>
        </Tooltip>

        <Button loading={saving} icon={<SaveOutlined />} disabled={!canEdit} onClick={onSave}>
          Сохранить
        </Button>

        <Tooltip title="Сохранить и проверить (Ctrl+S)">
          <Button icon={<SyncOutlined />} loading={saving} onClick={onSave}>
            Ctrl+S
          </Button>
        </Tooltip>

        <Badge count={errors} size="small" offset={[-2, 2]} color="#ef4444">
          <Button icon={<CheckCircleOutlined />} onClick={onValidate}>
            Проверить
          </Button>
        </Badge>

        {warnings > 0 ? (
          <Tooltip title={`Предупреждений: ${warnings}`}>
            <WarningOutlined style={{ color: '#f59e0b' }} />
          </Tooltip>
        ) : null}

        <Tooltip title={canPublish ? 'Опубликовать версию' : 'Нет права публикации'}>
          <Button type="primary" icon={<CloudUploadOutlined />} disabled={!canPublish} onClick={onPublish}>
            Опубликовать
          </Button>
        </Tooltip>

        <Dropdown
          menu={{
            items: (['svg', 'png', 'pdf', 'plantuml', 'mermaid', 'json'] as ExportFormat[]).map((format) => ({
              key: format,
              label: `${EXPORT_LABEL[format]} · ${EXPORT_PRIORITY[format]}`,
            })),
            onClick: ({ key }) => onExport(key as ExportFormat),
          }}
        >
          <Button icon={<DownloadOutlined />}>Экспорт</Button>
        </Dropdown>

        <Select
          size="middle"
          placeholder="Версии"
          style={{ width: 130 }}
          suffixIcon={<HistoryOutlined />}
          value={undefined}
          onChange={(value) => onRestore(Number(value))}
          options={versions.map((version) => ({
            value: version.versionNo,
            label: `v${version.versionNo} · ${version.nodeCount}/${version.edgeCount}`,
          }))}
        />
      </Space>
    </div>
  )
}
