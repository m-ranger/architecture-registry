import { useMemo } from 'react'
import { Row, Col, Card, Table } from 'antd'
import {
  AppstoreOutlined, ClusterOutlined, DeploymentUnitOutlined, CloudServerOutlined,
  ApiOutlined, FileTextOutlined, CalendarOutlined, RightOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import KpiCard from '../components/KpiCard'
import DonutChart from '../components/DonutChart'
import { brand } from '../theme'
import { useApi } from '../api/useApi'
import {
  informationSystemsApi, modulesApi, instancesApi, serversApi, clustersApi,
  segmentsApi, zonesApi, flowsApi, protocolsApi, auditApi,
} from '../api'
import { fmtDate } from '../utils/format'
import { OP_LABEL, ENTITY_LABEL, MODULE_TYPE_LABEL } from '../utils/labels'
import type { InformationFlow, AuditEntry } from '../types'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data: informationSystems } = useApi(informationSystemsApi.getAll)
  const { data: modules } = useApi(modulesApi.getAll)
  const { data: instances } = useApi(instancesApi.getAll)
  const { data: servers } = useApi(serversApi.getAll)
  const { data: clusters } = useApi(clustersApi.getAll)
  const { data: segments } = useApi(segmentsApi.getAll)
  const { data: zones } = useApi(zonesApi.getAll)
  const { data: flows } = useApi(flowsApi.getAll)
  const { data: protocols } = useApi(protocolsApi.getAll)
  const { data: audit } = useApi(auditApi.getAll)

  const activeCount = (arr: { status: string }[] | null | undefined) => (arr ? arr.filter((x) => x.status === 'ACTIVE').length : 0)
  const activePct = (arr: { status: string }[] | null | undefined) =>
    arr && arr.length ? Math.round((activeCount(arr) / arr.length) * 100) : 0

  const moduleById = (id?: string) => modules?.find((m) => m.id === id)
  const protocolById = (id?: string) => protocols?.find((p) => p.id === id)

  const moduleTypes = useMemo(() => {
    const colors = [brand.blue, brand.violet, brand.green, brand.orange, brand.cyan, brand.red]
    const counts = new Map<string, number>()
    modules?.forEach((m) => {
      const key = m.moduleType ?? 'OTHER'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, value], i) => ({ label: MODULE_TYPE_LABEL[key] ?? key, value, color: colors[i % colors.length] }))
  }, [modules])

  const infraStatus = useMemo(
    () => [
      { label: 'Серверы', value: activePct(servers), color: brand.green },
      { label: 'Кластеры', value: activePct(clusters), color: brand.blue },
      { label: 'Сетевые сегменты', value: activePct(segments), color: brand.orange },
      { label: 'Сетевые зоны', value: activePct(zones), color: brand.cyan },
    ],
    [servers, clusters, segments, zones],
  )

  const infraAverage = infraStatus.length
    ? Math.round(infraStatus.reduce((acc, x) => acc + x.value, 0) / infraStatus.length)
    : 0

  const flowRows = useMemo(() => (flows ?? []).slice(0, 6), [flows])
  const changeRows = useMemo(
    () =>
      audit
        ? [...audit].sort((a, b) => dayjs(b.changedAt).valueOf() - dayjs(a.changedAt).valueOf()).slice(0, 6)
        : [],
    [audit],
  )

  const flowColumns: ColumnsType<InformationFlow> = [
    { title: 'Наименование потока', dataIndex: 'name', key: 'name', ellipsis: true },
    {
      title: 'Источник → Получатель',
      key: 'route',
      render: (_: unknown, r: InformationFlow) => (
        <span>{moduleById(r.sourceModuleId)?.code ?? '—'} → {moduleById(r.targetModuleId)?.code ?? '—'}</span>
      ),
    },
    { title: 'Порт', dataIndex: 'targetPort', key: 'port', width: 80, render: (v?: number) => v ?? '—' },
    { title: 'Протокол', key: 'proto', width: 100, render: (_: unknown, r: InformationFlow) => protocolById(r.protocolId)?.code ?? '—' },
  ]

  const changeColumns: ColumnsType<AuditEntry> = [
    { title: 'Дата и время', dataIndex: 'changedAt', key: 'at', width: 160, render: (v: string) => fmtDate(v) },
    { title: 'Тип объекта', dataIndex: 'entityType', key: 'type', render: (v: string) => ENTITY_LABEL[v] ?? v },
    { title: 'Объект', dataIndex: 'entityId', key: 'obj' },
    { title: 'Событие', dataIndex: 'operation', key: 'op', width: 120, render: (v: string) => OP_LABEL[v] ?? v },
    { title: 'Пользователь', dataIndex: 'changedBy', key: 'by', width: 140 },
  ]

  const quickActions = [
    { label: 'Добавить информационную систему', icon: <AppstoreOutlined />, path: '/is' },
    { label: 'Добавить модуль', icon: <ClusterOutlined />, path: '/modules' },
    { label: 'Добавить сервер', icon: <CloudServerOutlined />, path: '/servers' },
    { label: 'Добавить информационный поток', icon: <ApiOutlined />, path: '/flows' },
    { label: 'Создать отчёт', icon: <FileTextOutlined />, path: '/matrix' },
  ]

  return (
    <>
      <div className='page-head'>
        <div className='page-head-text'>
          <h1 className='page-title'>Добро пожаловать в архитектурный реестры</h1>
          <div className='page-sub'>
            Единый источник данных о приложениях, модулях, инфраструктуре и взаимосвязях информационных систем.
          </div>
        </div>
        <div className='updated-at'>
          <CalendarOutlined />
          <span>
            <strong>{dayjs().format('DD.MM.YYYY HH:mm')}</strong>
            <br />
            Последнее обновление
          </span>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard title='Информационные системы' value={informationSystems?.length ?? 0} icon={<AppstoreOutlined />} color={brand.blue} hint={`${activeCount(informationSystems)} активных`} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard title='Модули' value={modules?.length ?? 0} icon={<ClusterOutlined />} color={brand.violet} hint={`${activeCount(modules)} активных`} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard title='Экземпляры модулей' value={instances?.length ?? 0} icon={<DeploymentUnitOutlined />} color={brand.green} hint={`${activeCount(instances)} активных`} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard title='Серверы' value={servers?.length ?? 0} icon={<CloudServerOutlined />} color={brand.orange} hint={`${activeCount(servers)} активных`} />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card className='section-card' style={{ height: '100%' }} title='Распределение модулей по типам'>
            <DonutChart data={moduleTypes} centerValue={modules?.length ?? 0} centerLabel='модулей' />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card
            className='section-card'
            style={{ height: '100%' }}
            title={
              <span className='section-title'>
                Информационные потоки
                <span className='link-more' onClick={() => navigate('/flows')}>Все потоки →</span>
              </span>
            }
          >
            <Table<InformationFlow> rowKey='id' size='small' pagination={false} dataSource={flowRows} columns={flowColumns} />
          </Card>
        </Col>
        <Col xs={24} xl={6}>
          <Card className='section-card' style={{ height: '100%' }} title='Статус инфраструктуры'>
            <DonutChart
              data={infraStatus}
              size={160}
              thickness={20}
              centerValue={`${infraAverage}%`}
              centerLabel='активных'
              legendFormat='percent'
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card
            className='section-card'
            title={
              <span className='section-title'>
                Последние изменения
                <span className='link-more' onClick={() => navigate('/audit')}>Все изменения →</span>
              </span>
            }
          >
            <Table<AuditEntry> rowKey='id' size='small' pagination={false} dataSource={changeRows} columns={changeColumns} />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className='section-card' title='Быстрые действия'>
            <div className='quick-actions'>
              {quickActions.map((action) => (
                <div key={action.label} className='quick-item' onClick={() => navigate(action.path)}>
                  <span className='quick-icon'>{action.icon}</span>
                  <span className='quick-label'>{action.label}</span>
                  <RightOutlined className='quick-arrow' />
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </>
  )
}

