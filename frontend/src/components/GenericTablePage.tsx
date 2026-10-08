import { useMemo, useState } from 'react'
import { Button, Card, Input, Space, Table, Typography } from 'antd'
import { SearchOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { ReactNode } from 'react'

export interface GenericPageProps<T extends { id: string }> {
  title: string
  entity: string
  hint?: ReactNode
  searchPlaceholder?: string
  searchFields?: (row: T) => string
  addLabel?: string
  columns: ColumnsType<T>
  data: T[]
  extra?: ReactNode
  rowActions?: (row: T) => ReactNode
  footer?: ReactNode
}

/**
 * Универсальная страница списка для «плоских» сущностей реестра.
 * Специфичная логика (потоки, размещения, матрица) реализуется отдельными страницами.
 */
export default function GenericTablePage<T extends { id: string }>(props: GenericPageProps<T>) {
  const { title, entity, hint, searchPlaceholder = 'Поиск', searchFields, addLabel, columns, data, extra, rowActions, footer } = props
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t || !searchFields) return data
    return data.filter((r) => searchFields(r).toLowerCase().includes(t))
  }, [q, data, searchFields])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>{title}</Typography.Title>
          <Typography.Text type='secondary'>
            Сущность <Typography.Text code>{entity}</Typography.Text>
            {hint ? <> · {hint}</> : null}
          </Typography.Text>
        </div>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder={searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          {extra}
          <Button type='primary' icon={<PlusOutlined />}>{addLabel ?? 'Добавить'}</Button>
        </Space>
      </div>
      <Card size='small' style={{ borderRadius: 10 }}>
        <Table<T>
          rowKey='id'
          columns={rowActions ? [...columns, { title: '', key: 'actions', width: 60, align: 'right' as const, render: (_: unknown, r: T) => rowActions(r) }] : columns}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Всего: ${t}` }}
        />
      </Card>
      {footer}
    </>
  )
}
