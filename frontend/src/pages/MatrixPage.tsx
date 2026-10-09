import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Input, Select, Space, Spin, Switch, Table, Tag, Tooltip, Typography } from 'antd'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { reportsApi } from '../api'
import type { FlowMatrixFilters } from '../api'
import type { FlowMatrixFlow, FlowMatrixModule, FlowMatrixReport } from '../types'

/**
 * «Матрица информационных потоков» (раздел «Отчеты»).
 *
 * Строится на данных реестра: оси — модули (application_module с кодом ИС),
 * ячейка — информационные потоки между парой «модуль-источник → модуль-назначение»
 * (information_flow, GET /api/reports/flow-matrix). Это то же производное
 * представление, что и v05_information_flow_matrix (раздел 14 ТЗ), но с
 * идентификаторами модулей, состояниями потоков и средами экземпляров, поэтому
 * матрица фильтруется по ИС, проекту и состояниям. Диагональ матрицы пуста:
 * поток модуля «сам в себя» запрещён (REQ-020).
 */

/** Состояния потока по умолчанию — как в отчёте «Сетевые взаимодействия». */
const DEFAULT_STATUSES = ['ACTIVE', 'PLANNED']

/** Все состояния потока: пустой выбор в фильтре означает «показать все». */
const ALL_STATUSES = ['PLANNED', 'ACTIVE', 'RETIRED']

/** Подпись состояния потока — для подсказки в ячейке. */
const FLOW_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'в эксплуатации',
  PLANNED: 'планируется',
  RETIRED: 'выведен из эксплуатации',
}

/** Цвет метки ячейки: активный поток — зелёный, планируемый — оранжевый. */
const FLOW_TAG_COLOR: Record<string, string> = {
  ACTIVE: 'green',
  PLANNED: 'orange',
  RETIRED: 'default',
}

/** Строка таблицы — ось матрицы: модуль-источник. */
type MatrixRow = { key: string; module: FlowMatrixModule }

/** Подсказка ячейки: наименование потока, протокол с портом, состояние, проекты. */
function flowTooltip(flow: FlowMatrixFlow): string {
  return [
    flow.name,
    `${flow.protocolCode}:${flow.targetPort ?? flow.sourcePort ?? '—'}`,
    FLOW_STATUS_LABEL[flow.status] ?? flow.status,
    flow.projectCodes ? `проекты: ${flow.projectCodes}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export default function MatrixPage() {
  const [report, setReport] = useState<FlowMatrixReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Фильтры матрицы: ИС (оси), проект, состояния потоков, поиск по потоку.
  const [informationSystem, setInformationSystem] = useState<string | undefined>(undefined)
  const [project, setProject] = useState<string | undefined>(undefined)
  const [statuses, setStatuses] = useState<string[]>(DEFAULT_STATUSES)
  const [q, setQ] = useState('')
  const [onlyInvolved, setOnlyInvolved] = useState(false)
  const [includeRetired, setIncludeRetired] = useState(false)

  const filters = useMemo<FlowMatrixFilters>(
    () => ({
      informationSystem,
      project,
      // Пустой выбор состояний — «все состояния», иначе backend берёт значения по умолчанию.
      statuses: statuses.length > 0 ? statuses : ALL_STATUSES,
      q: q.trim() || undefined,
      onlyInvolved: onlyInvolved || undefined,
      includeRetired: includeRetired || undefined,
    }),
    [informationSystem, project, statuses, q, onlyInvolved, includeRetired],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setReport(await reportsApi.flowMatrix(filters))
    } catch (err) {
      setReport(null)
      setError(err instanceof Error ? err.message : 'Не удалось построить матрицу')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void load()
  }, [load])

  const modules = report?.modules ?? []
  const options = report?.options
  const summary = report?.summary

  /** Оси матрицы: строки и столбцы — один и тот же список модулей (квадратная матрица). */
  const moduleById = useMemo(() => new Map(modules.map((module) => [module.id, module])), [modules])

  /**
   * Ячейки матрицы: пара «источник → назначение» → потоки между этими модулями.
   * Поток с отсутствующей осью пропускается — backend всегда добавляет такие модули
   * в оси, проверка страхует от рассинхронизации данных.
   */
  const cells = useMemo(() => {
    const map = new Map<string, FlowMatrixFlow[]>()
    for (const flow of report?.flows ?? []) {
      if (!moduleById.has(flow.sourceModuleId) || !moduleById.has(flow.targetModuleId)) continue
      const key = `${flow.sourceModuleId}|${flow.targetModuleId}`
      const list = map.get(key)
      if (list) list.push(flow)
      else map.set(key, [flow])
    }
    return map
  }, [report, moduleById])

  const resetFilters = () => {
    setInformationSystem(undefined)
    setProject(undefined)
    setStatuses(DEFAULT_STATUSES)
    setQ('')
    setOnlyInvolved(false)
    setIncludeRetired(false)
  }

  const columns: ColumnsType<MatrixRow> = [
    {
      title: 'Источник \\ Назначение',
      dataIndex: 'key',
      key: 'row',
      fixed: 'left',
      width: 200,
      render: (_: unknown, row) => (
        <Space direction='vertical' size={0}>
          <Space size={6} wrap>
            <Tag color='geekblue' bordered={false}>{row.module.isCode}</Tag>
            <Typography.Text strong style={{ fontSize: 12 }}>{row.module.code}</Typography.Text>
          </Space>
          <Typography.Text type='secondary' style={{ fontSize: 11 }}>{row.module.name}</Typography.Text>
          <Typography.Text type='secondary' style={{ fontSize: 11 }}>
            {row.module.envCodes ? `среды: ${row.module.envCodes}` : 'экземпляры не заведены'}
          </Typography.Text>
        </Space>
      ),
    },
    ...modules.map((target) => ({
      title: (
        <Tooltip title={`${target.isCode} / ${target.name}`}>
          <Typography.Text style={{ fontSize: 11 }}>{target.code}</Typography.Text>
        </Tooltip>
      ),
      dataIndex: target.id,
      key: target.id,
      width: 130,
      render: (_: unknown, row: MatrixRow) => {
        // Диагональ: поток модуля «сам в себя» запрещён (REQ-020).
        if (row.module.id === target.id) return <span className='flow-matrix__diagonal'>—</span>
        const flows = cells.get(`${row.module.id}|${target.id}`)
        if (!flows || flows.length === 0) return null
        return (
          <div className='flow-matrix__cell'>
            {flows.map((flow) => (
              <Tooltip key={flow.id} title={flowTooltip(flow)}>
                <Tag
                  color={FLOW_TAG_COLOR[flow.status] ?? 'default'}
                  bordered={false}
                  className='flow-matrix__tag'
                >
                  {flow.code}
                </Tag>
              </Tooltip>
            ))}
          </div>
        )
      },
    })),
  ]

  const dataSource: MatrixRow[] = modules.map((module) => ({ key: module.id, module }))

  return (
    <Space direction='vertical' size={12} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>Матрица информационных потоков</Typography.Title>
        <Typography.Text type='secondary'>
          Строится на данных реестра: строка — модуль-источник, столбец — модуль-назначение,
          ячейка — информационные потоки между модулями (аналог{' '}
          <Typography.Text code>v05_information_flow_matrix</Typography.Text>). Поток модуля
          «сам в себя» запрещён, поэтому диагональ матрицы пуста (REQ-020).
        </Typography.Text>
      </div>

      <Space size={8} wrap>
        <Typography.Text type='secondary'>
          Модулей: {summary?.modules ?? 0} · потоков: {summary?.flows ?? 0} ·
          заполненных ячеек: {summary?.cells ?? 0} · ИС: {summary?.informationSystems ?? 0}
        </Typography.Text>
        <Button size='small' icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
          Обновить
        </Button>
      </Space>

      <Card size='small' style={{ borderRadius: 10 }}>
        <Space size={8} wrap>
          <Select
            allowClear
            showSearch
            optionFilterProp='label'
            style={{ width: 230 }}
            placeholder='Информационная система'
            value={informationSystem}
            onChange={setInformationSystem}
            options={options?.informationSystems ?? []}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp='label'
            style={{ width: 200 }}
            placeholder='Проект'
            value={project}
            onChange={setProject}
            options={options?.projects ?? []}
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
          <Input
            allowClear
            prefix={<SearchOutlined />}
            style={{ width: 220 }}
            placeholder='Код или имя потока'
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <Space size={6}>
            <Switch size='small' checked={onlyInvolved} onChange={setOnlyInvolved} />
            <Typography.Text style={{ fontSize: 12 }}>только модули с потоками</Typography.Text>
          </Space>
          <Space size={6}>
            <Switch size='small' checked={includeRetired} onChange={setIncludeRetired} />
            <Typography.Text style={{ fontSize: 12 }}>выведенные из эксплуатации</Typography.Text>
          </Space>
          <Button onClick={resetFilters}>Сбросить</Button>
        </Space>
      </Card>

      <Space size={12} wrap>
        <Typography.Text type='secondary' style={{ fontSize: 12 }}>Потоки:</Typography.Text>
        <Space size={4}>
          <Tag color='green' bordered={false}>в эксплуатации</Tag>
          <Typography.Text type='secondary' style={{ fontSize: 12 }}>
            {summary?.statuses?.ACTIVE ?? 0}
          </Typography.Text>
        </Space>
        <Space size={4}>
          <Tag color='orange' bordered={false}>планируется</Tag>
          <Typography.Text type='secondary' style={{ fontSize: 12 }}>
            {summary?.statuses?.PLANNED ?? 0}
          </Typography.Text>
        </Space>
        <Space size={4}>
          <Tag bordered={false}>выведен</Tag>
          <Typography.Text type='secondary' style={{ fontSize: 12 }}>
            {summary?.statuses?.RETIRED ?? 0}
          </Typography.Text>
        </Space>
        <Typography.Text type='secondary' style={{ fontSize: 12 }}>
          В ячейке — код потока: наведите курсор, чтобы увидеть наименование, протокол, порт и проекты.
        </Typography.Text>
      </Space>

      {error ? <Alert type='error' showIcon message={error} /> : null}

      <Card size='small' style={{ borderRadius: 10 }}>
        <Spin spinning={loading}>
          <Table
            rowKey='key'
            dataSource={dataSource}
            columns={columns}
            pagination={false}
            size='small'
            bordered
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description='По заданным фильтрам модулей нет'
                />
              ),
            }}
          />
        </Spin>
      </Card>
    </Space>
  )
}
