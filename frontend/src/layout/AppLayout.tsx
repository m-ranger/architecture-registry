import { useEffect, useMemo, useState } from 'react'
import { Layout, Menu, Badge, Breadcrumb, Avatar, Dropdown, AutoComplete, App } from 'antd'
import { useNavigate, useLocation, Outlet, Link } from 'react-router-dom'
import {
  MenuFoldOutlined, MenuUnfoldOutlined, BellOutlined, SearchOutlined, DownOutlined,
  UserOutlined, LogoutOutlined, SettingOutlined, DeploymentUnitOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { menuItems, pageMeta, parentGroups } from './menuItems'
import { useApi } from '../api/useApi'
import { informationSystemsApi, modulesApi, serversApi, segmentsApi, flowsApi, auditApi, diagramsApi } from '../api'
import { fmtDate } from '../utils/format'
import { OP_LABEL, ENTITY_LABEL } from '../utils/labels'
import { CURRENT_USER } from '../utils/currentUser'


const { Header, Sider, Content } = Layout

interface SearchHit {
  group: string
  value: string
  path: string
}

function resolveSelectedKey(pathname: string): string {
  if (pathname === '/') return '/'
  const keys = Object.keys(pageMeta).filter((k) => k !== '/')
  return keys.find((k) => pathname.startsWith(k)) ?? pathname
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [searchText, setSearchText] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const { message } = App.useApp()

  const selectedKey = resolveSelectedKey(location.pathname)
  const [openKeys, setOpenKeys] = useState<string[]>(() => parentGroups(selectedKey))

  useEffect(() => {
    setOpenKeys((prev) => Array.from(new Set([...prev, ...parentGroups(selectedKey)])))
  }, [selectedKey])

  // Данные для глобального поиска и панели уведомлений загружаются один раз при монтировании оболочки.
  const { data: informationSystems } = useApi(informationSystemsApi.getAll)
  const { data: modules } = useApi(modulesApi.getAll)
  const { data: servers } = useApi(serversApi.getAll)
  const { data: segments } = useApi(segmentsApi.getAll)
  const { data: flows } = useApi(flowsApi.getAll)
  const { data: audit } = useApi(auditApi.getAll)
  // Список архитектурных схем отдаёт встроенный модуль C4 (прокси /diagrams-api)
  const { data: diagrams } = useApi(diagramsApi.getAll)

  const catalog = useMemo<SearchHit[]>(() => {
    const items: SearchHit[] = []
    informationSystems?.forEach((x) => items.push({ group: 'Информационные системы', value: `ИС · ${x.code} — ${x.name}`, path: '/is' }))
    modules?.forEach((x) => items.push({ group: 'Модули', value: `Модуль · ${x.code} — ${x.name}`, path: '/modules' }))
    servers?.forEach((x) => items.push({ group: 'Инфраструктура', value: `Сервер · ${x.name}`, path: '/servers' }))
    segments?.forEach((x) => items.push({ group: 'Инфраструктура', value: `Сегмент · ${x.code} — ${x.name}`, path: '/segments' }))
    flows?.forEach((x) => items.push({ group: 'Информационные потоки', value: `Поток · ${x.code} — ${x.name}`, path: '/flows' }))
    diagrams?.forEach((x) => items.push({ group: 'Архитектурные схемы', value: `Схема · ${x.code} — ${x.name}`, path: '/diagrams' }))
    return items
  }, [informationSystems, modules, servers, segments, flows, diagrams])

  const searchOptions = useMemo(() => {
    const grouped = new Map<string, { value: string }[]>()
    catalog.forEach((hit) => {
      if (!grouped.has(hit.group)) grouped.set(hit.group, [])
      grouped.get(hit.group)!.push({ value: hit.value })
    })
    return Array.from(grouped.entries()).map(([label, options]) => ({ label, options }))
  }, [catalog])

  const notifications: MenuProps['items'] = [
    ...(audit ?? []).slice(0, 6).map((a) => ({
      key: a.id,
      label: (
        <div style={{ minWidth: 280, whiteSpace: 'normal' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {OP_LABEL[a.operation] ?? a.operation} · {ENTITY_LABEL[a.entityType] ?? a.entityType}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            {a.entityCode ?? a.entityId} · {fmtDate(a.changedAt)} · {a.changedBy}
          </div>
        </div>
      ),
    })),
    { type: 'divider' as const },
    { key: 'audit-all', label: <span style={{ color: '#2f6bff' }}>Все изменения</span> },
  ]

  const userMenu: MenuProps['items'] = [
    { key: 'profile', icon: <UserOutlined />, label: 'Профиль' },
    { key: 'settings', icon: <SettingOutlined />, label: 'Настройки и справочники' },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Выход' },
  ]

  const meta = pageMeta[selectedKey] ?? { title: location.pathname }
  const crumbs =
    selectedKey === '/'
      ? [{ title: 'Главная' }]
      : [
          { title: <Link to='/'>Главная</Link> },
          ...(meta.section ? [{ title: meta.section }] : []),
          { title: meta.title },
        ]

  return (
    <Layout className='app-shell'>
      <Sider
        className='app-sider'
        width={252}
        collapsedWidth={64}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint='lg'
        theme='dark'
      >
        <div className='app-brand'>
          <span className='app-brand-logo'><DeploymentUnitOutlined /></span>
          {!collapsed && (
            <div>
              <div className='app-brand-title'>Архитектурный<br />реестр</div>
              <div className='app-brand-sub'>Architecture Registry</div>
            </div>
          )}
        </div>
        <Menu
          theme='dark'
          mode='inline'
          items={menuItems}
          selectedKeys={[selectedKey]}
          {...(collapsed ? {} : { openKeys, onOpenChange: (keys: string[]) => setOpenKeys(keys) })}
          onClick={({ key }) => {
            if (typeof key !== 'string') return
            if (key.startsWith('/')) navigate(key)
          }}
        />
      </Sider>

      <Layout>
        <Header className='app-header'>
          <span onClick={() => setCollapsed((v) => !v)} style={{ cursor: 'pointer', fontSize: 18 }}>
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </span>

          <div className='app-search'>
            <SearchOutlined style={{ color: '#94a3b8', marginRight: 8 }} />
            <AutoComplete
              value={searchText}
              options={searchOptions}
              onChange={setSearchText}
              onSelect={(value: string) => {
                setSearchText('')
                const hit = catalog.find((c) => c.value === value)
                if (hit) navigate(hit.path)
              }}
              variant='borderless'
              allowClear
              style={{ width: '100%' }}
              placeholder='Поиск по ИС, модулям, серверам, сегментам, потокам, схемам...'
              filterOption={(input, option) => {
                const v = (option as unknown as { value?: string } | undefined)?.value
                return String(v ?? '').toLowerCase().includes(input.toLowerCase())
              }}
            />
          </div>

          <div className='app-header-actions'>
            <Dropdown menu={{ items: notifications, onClick: () => navigate('/audit') }} placement='bottomRight' trigger={['click']}>
              <span className='app-header-icon'>
                <Badge count={audit?.length ?? 0} size='small' overflowCount={99}>
                  <BellOutlined style={{ fontSize: 17 }} />
                </Badge>
              </span>
            </Dropdown>

            <Dropdown
              menu={{
                items: userMenu,
                onClick: ({ key }) => {
                  if (key === 'settings') navigate('/audit')
                  else if (key === 'profile') message.info('Профиль пользователя недоступен в макете')
                  else message.info('Выход из системы недоступен в макете')
                },
              }}
              placement='bottomRight'
              trigger={['click']}
            >
              <span className='app-user'>
                <Avatar style={{ background: '#2f6bff' }} size={36}>{CURRENT_USER.initials}</Avatar>
                <span style={{ lineHeight: 1.15 }}>
                  <div className='app-user-name'>{CURRENT_USER.name}</div>
                  <div className='app-user-role'>{CURRENT_USER.role}</div>
                </span>
                <DownOutlined style={{ fontSize: 10, color: '#94a3b8' }} />
              </span>
            </Dropdown>
          </div>
        </Header>

        <Content className='app-content'>
          <Breadcrumb className='app-crumbs' items={crumbs} />
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}


