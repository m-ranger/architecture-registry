import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, DatePicker, Descriptions, Drawer, Input, Select, Space, Spin, Table, Tag, Tooltip, Typography } from 'antd'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import PageHeader from '../components/PageHeader'
import { useApi } from '../api/useApi'
import { auditApi } from '../api'
import type { AuditFilters } from '../api'
import type { AuditEntry } from '../types'
import { fmtDate } from '../utils/format'
import { AUDITED_ENTITY_LABEL, ENTITY_LABEL, OP_LABEL, fieldLabel } from '../utils/labels'

/** Размер страницы выборки журнала (backend ограничивает 1000 записями) */
const PAGE_SIZE = 300

const OP_COLOR: Record<string, string> = { INSERT: 'green', UPDATE: 'blue', DELETE: 'red' }

const OP_OPTIONS = [
  { value: 'INSERT', label: OP_LABEL.INSERT },
  { value: 'UPDATE', label: OP_LABEL.UPDATE },
  { value: 'DELETE', label: OP_LABEL.DELETE },
]

/** Объекты реестра, изменения которых попадают в журнал (триггеры audit_log) */
const ENTITY_OPTIONS = Object.entries(AUDITED_ENTITY_LABEL).map(([value, label]) => ({ value, label }))

/** Служебные колонки, которые меняются автоматически — в diff не показываем */
const SERVICE_FIELDS = ['created_at', 'created_by', 'updated_at', 'updated_by']

/** Значение поля снимка строки для отображения в «было / стало» */
function renderValue(value: unknown) {
  if (value === null || value === undefined || value === '') return <Typography.Text type='secondary'>—</Typography.Text>
  if (typeof value === 'object') return <Typography.Text code>{JSON.stringify(value)}</Typography.Text>
  return <Typography.Text>{String(value)}</Typography.Text>
}

/** Строки «поле — было — стало» для карточки записи журнала */
function diffRows(entry: AuditEntry) {
  const oldValue = entry.oldValue ?? {}
  const newValue = entry.newValue ?? {}
  const keys =
    entry.operation === 'UPDATE'
      ? entry.changedFields ?? []
      : Object.keys(entry.operation === 'DELETE' ? oldValue : newValue)
  return keys
    .filter((key) => !SERVICE_FIELDS.includes(key))
    .map((key) => ({ key, field: key, before: oldValue[key], after: newValue[key] }))
}

export default function AuditPage() {
  const [entityType, setEntityType] = useState<string>()
  const [operation, setOperation] = useState<string>()
  const [changedBy, setChangedBy] = useState('')
  const [q, setQ] = useState('')
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [active, setActive] = useState<AuditEntry | null>(null)

  const filters = useMemo<AuditFilters>(
    () => ({
      entityType: entityType || undefined,
      operation: (operation as AuditEntry['operation']) || undefined,
      changedBy: changedBy.trim() || undefined,
      q: q.trim() || undefined,
      from: range?.[0] ? range[0].startOf('day').toISOString() : undefined,
      to: range?.[1] ? range[1].endOf('day').toISOString() : undefined,
      limit: PAGE_SIZE,
    }),
    [entityType, operation, changedBy, q, range],
  )

  const { data: entries, loading, error, refetch } = useApi(() => auditApi.getAll(filters))

  // useApi перезагружает данные только по refetch(), поэтому при изменении
  // фильтров повторяем запрос уже с новыми параметрами.
  const filterKey = JSON.stringify(filters)
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    refetch()
  }, [filterKey, refetch])

  const stats = useMemo(() => {
    const list = entries ?? []
    const count = (op: string) => list.filter((e) => e.operation === op).length
    return { total: list.length, INSERT: count('INSERT'), UPDATE: count('UPDATE'), DELETE: count('DELETE') }
  }, [entries])

  const resetFilters = () => {
    setEntityType(undefined)
    setOperation(undefined)
    setChangedBy('')
    setQ('')
    setRange(null)
  }

  const columns: ColumnsType<AuditEntry> = [
    { title: 'Дата и время', dataIndex: 'changedAt', key: 'at', width: 160, render: (v: string) => fmtDate(v) },
    {
      title: 'Объект',
      key: 'entity',
      render: (_: unknown, r: AuditEntry) => (
        <Space direction='vertical' size={0}>
          <Tag color='geekblue'>{ENTITY_LABEL[r.entityType] ?? r.entityType}</Tag>
          <Typography.Text style={{ fontSize: 12 }}>
            {r.entityCode ? <Typography.Text code>{r.entityCode}</Typography.Text> : null}
            {r.entityName ? ` · ${r.entityName}` : r.entityCode ? '' : r.entityId}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Операция',
      dataIndex: 'operation',
      key: 'op',
      width: 130,
      render: (v: string) => <Tag color={OP_COLOR[v] ?? 'default'}>{OP_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'Изменённые поля',
      key: 'fields',
      width: 280,
      render: (_: unknown, r: AuditEntry) => {
        const fields = (r.changedFields ?? []).filter((f) => !SERVICE_FIELDS.includes(f))
        if (!fields.length) return <Typography.Text type='secondary'>—</Typography.Text>
        const shown = fields.slice(0, 3)
        return (
          <Space size={4} wrap>
            {shown.map((f) => (
              <Tag key={f}>{fieldLabel(f)}</Tag>
            ))}
            {fields.length > shown.length ? (
              <Tooltip title={fields.slice(3).map(fieldLabel).join(', ')}>
                <Tag>+{fields.length - shown.length}</Tag>
              </Tooltip>
            ) : null}
          </Space>
        )
      },
    },
    { title: 'Пользователь', dataIndex: 'changedBy', key: 'by', width: 170, render: (v?: string) => v ?? '—' },
    {
      title: '',
      key: 'action',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, r: AuditEntry) => (
        <Button type='link' size='small' onClick={() => setActive(r)}>
          Детали
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title='Журнал изменений'
        subtitle='Аудит изменений объектов реестра на основе триггеров audit_log (раздел 11): создание, изменение и удаление информационных систем, модулей, экземпляров модулей, проектов и информационных потоков.'
        extra={
          <Button icon={<ReloadOutlined />} onClick={refetch} loading={loading}>
            Обновить
          </Button>
        }
      />
      {error && <Alert type='error' showIcon message={error.message} />}
      <Card size='small' style={{ borderRadius: 10, marginBottom: 12 }}>
        <Space wrap size={12}>
          <Select
            allowClear
            placeholder='Тип объекта'
            options={ENTITY_OPTIONS}
            value={entityType}
            onChange={setEntityType}
            style={{ width: 260 }}
          />
          <Select allowClear placeholder='Операция' options={OP_OPTIONS} value={operation} onChange={setOperation} style={{ width: 160 }} />
          <DatePicker.RangePicker
            value={range}
            onChange={(dates) => setRange((dates as [Dayjs, Dayjs] | null) ?? null)}
            format='DD.MM.YYYY'
            placeholder={['Период с', 'по']}
          />
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder='Код или наименование объекта'
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 260 }}
          />
          <Input allowClear placeholder='Пользователь' value={changedBy} onChange={(e) => setChangedBy(e.target.value)} style={{ width: 200 }} />
          <Button onClick={resetFilters}>Сбросить</Button>
        </Space>
      </Card>

      <Card className='section-card' size='small' style={{ borderRadius: 10 }}>
        <Space size={16} wrap style={{ marginBottom: 12 }}>
          <Typography.Text type='secondary'>Записей в выборке: {stats.total}</Typography.Text>
          <Tag color='green'>Создано: {stats.INSERT}</Tag>
          <Tag color='blue'>Изменено: {stats.UPDATE}</Tag>
          <Tag color='red'>Удалено: {stats.DELETE}</Tag>
          {stats.total >= PAGE_SIZE ? (
            <Typography.Text type='secondary'>Показаны последние {PAGE_SIZE} записей — уточните фильтры или период</Typography.Text>
          ) : null}
        </Space>
        <Spin spinning={loading}>
          <Table<AuditEntry>
            rowKey='id'
            dataSource={entries ?? []}
            columns={columns}
            pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `Всего: ${t}` }}
            scroll={{ x: 1100 }}
          />
        </Spin>
      </Card>

      <Drawer
        title={active ? `${OP_LABEL[active.operation] ?? active.operation} · ${ENTITY_LABEL[active.entityType] ?? active.entityType}` : ''}
        open={!!active}
        onClose={() => setActive(null)}
        width={720}
      >
        {active && (
          <Space direction='vertical' size={16} style={{ width: '100%' }}>
            <Descriptions size='small' bordered column={1}>
              <Descriptions.Item label='Дата и время'>{fmtDate(active.changedAt)}</Descriptions.Item>
              <Descriptions.Item label='Объект'>
                <Space wrap size={6}>
                  <Tag color='geekblue'>{ENTITY_LABEL[active.entityType] ?? active.entityType}</Tag>
                  {active.entityCode ? <Tag>{active.entityCode}</Tag> : null}
                  {active.entityName ? <Typography.Text>{active.entityName}</Typography.Text> : null}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label='Идентификатор объекта'>
                <Typography.Text code copyable>
                  {active.entityId}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label='Операция'>
                <Tag color={OP_COLOR[active.operation] ?? 'default'}>{OP_LABEL[active.operation] ?? active.operation}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label='Пользователь'>{active.changedBy ?? '—'}</Descriptions.Item>
            </Descriptions>

            <Card size='small' title='Изменения по полям' style={{ borderRadius: 8 }}>
              <Table<{ key: string; field: string; before: unknown; after: unknown }>
                rowKey='key'
                size='small'
                pagination={false}
                dataSource={diffRows(active)}
                columns={[
                  { title: 'Поле', dataIndex: 'field', key: 'field', width: 200, render: (v: string) => fieldLabel(v) },
                  { title: 'Было', dataIndex: 'before', key: 'before', render: (v: unknown) => renderValue(v) },
                  { title: 'Стало', dataIndex: 'after', key: 'after', render: (v: unknown) => renderValue(v) },
                ]}
              />
            </Card>

            <Card size='small' title='Снимки объекта (jsonb)' style={{ borderRadius: 8 }}>
              <Space direction='vertical' size={8} style={{ width: '100%' }}>
                <div>
                  <Typography.Text type='secondary'>До изменения (old_value)</Typography.Text>
                  <pre style={{ margin: '4px 0 0', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                    {active.oldValue ? JSON.stringify(active.oldValue, null, 2) : '—'}
                  </pre>
                </div>
                <div>
                  <Typography.Text type='secondary'>После изменения (new_value)</Typography.Text>
                  <pre style={{ margin: '4px 0 0', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                    {active.newValue ? JSON.stringify(active.newValue, null, 2) : '—'}
                  </pre>
                </div>
              </Space>
            </Card>
          </Space>
        )}
      </Drawer>
    </>
  )
}

