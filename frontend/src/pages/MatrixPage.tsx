import { useMemo } from 'react'
import { Card, Table, Tag, Tooltip, Typography } from 'antd'
import { modules, informationFlows, getIs, getProtocol } from '../mock'

/**
 * Матрица потоков — производное представление V05 (раздел 14): строки/столбцы — модули,
 * ячейка — список потоков источник→назначение. Диагональ запрещена (source != target, REQ-020).
 */
export default function MatrixPage() {
  const activeModules = useMemo(() => modules.filter((m) => m.status !== 'RETIRED'), [])

  const cellFlows = (srcId: string, tgtId: string) =>
    informationFlows.filter((f) => f.sourceModuleId === srcId && f.targetModuleId === tgtId)

  const columns = [
    {
      title: 'Источник \\ Назначение',
      dataIndex: 'rowModuleId',
      key: 'row',
      fixed: 'left' as const,
      width: 160,
      render: (id: string) => {
        const m = modules.find((x) => x.id === id)!
        return <Tag color='geekblue'>{getIs(m.informationSystemId)?.code} / {m.code}</Tag>
      },
    },
    ...activeModules.map((tgt) => ({
      title: <Typography.Text style={{ fontSize: 11 }}>{tgt.code}</Typography.Text>,
      dataIndex: tgt.id,
      key: tgt.id,
      width: 130,
      render: (_: unknown, row: { rowModuleId: string }) => {
        if (row.rowModuleId === tgt.id) return <span style={{ color: '#d9d9d9' }}>—</span>
        const flows = cellFlows(row.rowModuleId, tgt.id)
        if (flows.length === 0) return null
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {flows.map((f) => (
              <Tooltip key={f.id} title={`${f.name} · ${getProtocol(f.protocolId)?.code}:${f.targetPort ?? '—'}`}>
                <Tag color={f.status === 'ACTIVE' ? 'green' : 'orange'} style={{ fontSize: 10, margin: 0 }}>{f.code}</Tag>
              </Tooltip>
            ))}
          </div>
        )
      },
    })),
  ]

  const dataSource = activeModules.map((m) => ({ key: m.id, rowModuleId: m.id }))

  return (
    <>
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>Матрица информационных потоков</Typography.Title>
        <Typography.Text type='secondary'>
          Производное представление (аналог V05) на базе <Typography.Text code>information_flow</Typography.Text>. Строка — источник, столбец — назначение.
        </Typography.Text>
      </div>
      <Card size='small' style={{ borderRadius: 10 }}>
        <Table
          dataSource={dataSource}
          columns={columns}
          pagination={false}
          scroll={{ x: 'max-content' }}
          size='small'
          bordered
        />
      </Card>
    </>
  )
}
