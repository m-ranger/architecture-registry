import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Input, Select, Space, Spin, Table, Tag, Tooltip, Typography } from 'antd'
import { ReloadOutlined, SearchOutlined, SwapOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { StatusTag } from '../components/StatusTag'
import { reportsApi } from '../api'
import type { NetworkInteractionFilters } from '../api'
import type { NetworkInteractionReport, NetworkInteractionRow, NetworkInteractionSide } from '../types'

/**
 * Отчёт «Сетевые взаимодействия» (раздел «Отчеты»).
 *
 * Показывает информационные потоки в разрезе «с какого адреса на какой»:
 * поток описан на уровне модулей (information_flow), а адрес стороны берётся из
 * размещения экземпляра модуля — сервер или кластер, далее network_interface.
 * Адрес выбирается по приоритету роли (SERVICE → INGRESS → VIRTUAL → NODE →
 * MANAGEMENT), поэтому отчёт совпадает с представлениями v15a/v16 (ТЗ §10.3).
 *
 * Если у стороны нет экземпляра, размещения или адреса, строка остаётся в
 * отчёте и помечается: поток не «теряется» из-за незаведённых данных (Б4/У9).
 */

/** Состояния потока по умолчанию — совпадают с v16_flow_addresses. */
const DEFAULT_STATUSES = ['ACTIVE', 'PLANNED']

/** Все состояния потока: пустой выбор в фильтре означает «показать все». */
const ALL_STATUSES = ['PLANNED', 'ACTIVE', 'RETIRED']

/** Сторона строки отчёта: модуль, экземпляр, среда, узел и адрес. */
function sideOf(row: NetworkInteractionRow, prefix: 'source' | 'target'): NetworkInteractionSide {
  return {
    isCode: row[`${prefix}IsCode`],
    isName: row[`${prefix}IsName`],
    moduleCode: row[`${prefix}ModuleCode`],
    moduleName: row[`${prefix}ModuleName`],
    instanceName: row[`${prefix}InstanceName`],
    envCode: row[`${prefix}EnvCode`],
    envName: row[`${prefix}EnvName`],
    ownerType: row[`${prefix}OwnerType`],
    ownerName: row[`${prefix}OwnerName`],
    address: row[`${prefix}Address`],
    addressRole: row[`${prefix}AddressRole`],
    addressName: row[`${prefix}AddressName`],
    segmentCode: row[`${prefix}SegmentCode`],
    zoneCode: row[`${prefix}ZoneCode`],
  }
}

/** Ячейка стороны потока: модуль и экземпляр сверху, узел и адрес — ниже. */
function SideCell({ side }: { side: NetworkInteractionSide }) {
  const nodeLabel = side.ownerName
    ? `${side.ownerType === 'cluster' ? 'кластер' : 'сервер'}: ${side.ownerName}`
    : null

  return (
    <div className='net-interactions__side'>
      <div className='net-interactions__side-main'>
        <Tag color='geekblue' bordered={false}>{side.isCode}</Tag>
        <Typography.Text strong style={{ fontSize: 12 }}>{side.moduleCode}</Typography.Text>
        <Typography.Text type='secondary' style={{ fontSize: 11 }}>{side.moduleName}</Typography.Text>
      </div>
      <div className='net-interactions__side-meta'>
        {side.envCode ? <Tag bordered={false} color='purple'>{side.envCode}</Tag> : null}
        {side.instanceName ? (
          <span>{side.instanceName}</span>
        ) : (
          <span className='net-interactions__muted'>экземпляр не заведён</span>
        )}
      </div>
      <div className='net-interactions__side-meta'>
        {side.address ? (
          <Tooltip
            title={`${side.addressRole || 'роль не указана'}${side.addressName ? ` · ${side.addressName}` : ''}`}
          >
            <Tag color='green' style={{ fontFamily: 'monospace' }}>{side.address}</Tag>
          </Tooltip>
        ) : (
          <Tooltip title='Адрес берётся из network_interface узла размещения (сервер или кластер)'>
            <Tag color='orange' bordered={false}>адрес не зарегистрирован</Tag>
          </Tooltip>
        )}
        <Typography.Text type='secondary' style={{ fontSize: 11 }}>
          {nodeLabel ?? 'размещение не задано'}
        </Typography.Text>
        {side.zoneCode ? (
          <Typography.Text type='secondary' style={{ fontSize: 11 }}>
            {side.zoneCode}{side.segmentCode ? ` / ${side.segmentCode}` : ''}
          </Typography.Text>
        ) : null}
      </div>
    </div>
  )
}

export default function NetworkInteractionsPage() {
  const [report, setReport] = useState<NetworkInteractionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Фильтры отчёта: источник, получатель, среда, состояние потока, проект, поиск.
  const [source, setSource] = useState<string | undefined>(undefined)
  const [target, setTarget] = useState<string | undefined>(undefined)
  const [environment, setEnvironment] = useState<string | undefined>(undefined)
  const [statuses, setStatuses] = useState<string[]>(DEFAULT_STATUSES)
  const [project, setProject] = useState<string | undefined>(undefined)
  const [q, setQ] = useState('')

  const filters = useMemo<NetworkInteractionFilters>(
    () => ({
      source,
      target,
      environment,
      // Пустой выбор состояний — «все состояния», иначе backend берёт значения по умолчанию.
      statuses: statuses.length > 0 ? statuses : ALL_STATUSES,
      project,
      q: q.trim() || undefined,
    }),
    [source, target, environment, statuses, project, q],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setReport(await reportsApi.networkInteractions(filters))
    } catch (err) {
      setReport(null)
      setError(err instanceof Error ? err.message : 'Не удалось построить отчёт')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void load()
  }, [load])

  const options = report?.options
  const rows = report?.rows ?? []
  const flowCount = useMemo(() => new Set(rows.map((row) => row.flowCode)).size, [rows])
  const unresolvedCount = useMemo(
    () => rows.filter((row) => !row.sourceAddress || !row.targetAddress).length,
    [rows],
  )

  const resetFilters = () => {
    setSource(undefined)
    setTarget(undefined)
    setEnvironment(undefined)
    setStatuses(DEFAULT_STATUSES)
    setProject(undefined)
    setQ('')
  }

  const columns: ColumnsType<NetworkInteractionRow> = [
    {
      title: 'Информационный поток',
      dataIndex: 'flowCode',
      key: 'flow',
      width: 250,
      fixed: 'left',
      render: (_: unknown, row) => (
        <Space direction='vertical' size={2}>
          <Space size={6} wrap>
            <Typography.Text strong style={{ fontSize: 12 }}>{row.flowCode}</Typography.Text>
            <StatusTag value={row.flowStatus} />
          </Space>
          <Typography.Text type='secondary' style={{ fontSize: 11 }}>{row.flowName}</Typography.Text>
          {row.projectCodes ? (
            <Typography.Text type='secondary' style={{ fontSize: 11 }}>
              проекты: {row.projectCodes}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Протокол / порт',
      dataIndex: 'protocolCode',
      key: 'protocol',
      width: 150,
      render: (_: unknown, row) => (
        <Space direction='vertical' size={2}>
          <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.protocolCode}</Typography.Text>
          <Typography.Text type='secondary' style={{ fontSize: 11 }}>
            {row.targetPort ?? row.sourcePort ?? '—'}
            {row.protocolTransport ? ` · ${row.protocolTransport}` : ''}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Источник — с какого адреса',
      dataIndex: 'sourceModuleCode',
      key: 'source',
      width: 300,
      render: (_: unknown, row) => <SideCell side={sideOf(row, 'source')} />,
    },
    {
      title: 'Получатель — на какой адрес',
      dataIndex: 'targetModuleCode',
      key: 'target',
      width: 300,
      render: (_: unknown, row) => <SideCell side={sideOf(row, 'target')} />,
    },
  ]

  return (
    <Space direction='vertical' size={12} style={{ width: '100%' }}>
      <Space size={8} wrap>
        <Typography.Text type='secondary'>
          Взаимодействий: {rows.length} · потоков: {flowCount}
          {unresolvedCount > 0 ? ` · строк без адреса у стороны: ${unresolvedCount}` : ''}
        </Typography.Text>
        <Button size='small' icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
          Обновить
        </Button>
      </Space>

      <Alert
        type='info'
        showIcon
        message='Адрес стороны определяется по реестру: размещение экземпляра модуля → сервер или кластер → network_interface'
        description='Приоритет роли адреса: SERVICE → INGRESS → VIRTUAL → NODE → MANAGEMENT (совпадает с v15a/v16). Если экземпляр, размещение или адрес не заведены, строка остаётся в отчёте с пометкой — так видно, где не хватает данных (ТЗ §10.3, §17).'
      />

      <Card size='small' style={{ borderRadius: 10 }}>
        <Space size={8} wrap>
          <Select
            showSearch
            allowClear
            optionFilterProp='label'
            style={{ width: 280 }}
            placeholder='Источник: адрес, узел, экземпляр, модуль'
            value={source}
            onChange={setSource}
            options={options?.sources ?? []}
          />
          <SwapOutlined style={{ color: '#94a3b8' }} />
          <Select
            showSearch
            allowClear
            optionFilterProp='label'
            style={{ width: 280 }}
            placeholder='Получатель: адрес, узел, экземпляр, модуль'
            value={target}
            onChange={setTarget}
            options={options?.targets ?? []}
          />
          <Select
            allowClear
            style={{ width: 140 }}
            placeholder='Среда'
            value={environment}
            onChange={setEnvironment}
            options={options?.environments ?? []}
          />
          <Select
            mode='multiple'
            allowClear
            style={{ width: 230 }}
            placeholder='Состояние потока'
            value={statuses}
            onChange={(value: string[]) => setStatuses(value)}
            options={options?.statuses ?? []}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp='label'
            style={{ width: 170 }}
            placeholder='Проект'
            value={project}
            onChange={setProject}
            options={options?.projects ?? []}
          />
          <Input
            allowClear
            prefix={<SearchOutlined />}
            style={{ width: 220 }}
            placeholder='Код или имя потока'
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <Button onClick={resetFilters}>Сбросить</Button>
        </Space>
      </Card>

      {error ? <Alert type='error' showIcon message={error} /> : null}

      <Card size='small' style={{ borderRadius: 10 }}>
        <Spin spinning={loading}>
          <Table
            rowKey={(row) =>
              `${row.flowCode}|${row.sourceInstanceName ?? 'none'}|${row.targetInstanceName ?? 'none'}`
            }
            dataSource={rows}
            columns={columns}
            size='small'
            bordered
            scroll={{ x: 'max-content' }}
            pagination={rows.length > 20 ? { pageSize: 20, showSizeChanger: true } : false}
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='По заданным фильтрам взаимодействий нет' />
              ),
            }}
          />
        </Spin>
      </Card>
    </Space>
  )
}
