import {
  HomeOutlined, AppstoreOutlined, ClusterOutlined, DeploymentUnitOutlined,
  CloudServerOutlined, BranchesOutlined, ApartmentOutlined, SafetyCertificateOutlined,
  ShareAltOutlined, WifiOutlined, ApiOutlined, BookOutlined, FileTextOutlined,
  SettingOutlined, NodeIndexOutlined, GlobalOutlined, PartitionOutlined, ProjectOutlined,
  FolderOpenOutlined, TableOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'

/**
 * Навигация в стиле макета «Архитектурный реестр»:
 * плоские пункты реестра + сворачиваемые разделы «Инфраструктура» и «Справочники».
 * Ключами служат маршруты приложения — клики обрабатываются в AppLayout.
 */
export const menuItems: MenuProps['items'] = [
  { key: '/', icon: <HomeOutlined />, label: 'Главная' },
  { key: '/is', icon: <AppstoreOutlined />, label: 'Информационные системы' },
  { key: '/modules', icon: <ClusterOutlined />, label: 'Модули' },
  { key: '/instances', icon: <DeploymentUnitOutlined />, label: 'Экземпляры модулей' },
  { key: '/projects', icon: <FolderOpenOutlined />, label: 'Проекты' },
  {
    key: 'infra',
    icon: <NodeIndexOutlined />,
    label: 'Инфраструктура',
    children: [
      { key: '/servers', icon: <CloudServerOutlined />, label: 'Серверы' },
      { key: '/clusters', icon: <BranchesOutlined />, label: 'Кластеры' },
      { key: '/deployments', icon: <PartitionOutlined />, label: 'Размещения' },
      { key: '/segments', icon: <ApartmentOutlined />, label: 'Сетевые сегменты' },
      { key: '/routers', icon: <ShareAltOutlined />, label: 'Маршрутизаторы' },
      { key: '/firewalls', icon: <SafetyCertificateOutlined />, label: 'Сетевые устройства' },
      { key: '/interfaces', icon: <WifiOutlined />, label: 'Сетевые интерфейсы' },
    ],
  },
  { key: '/flows', icon: <ApiOutlined />, label: 'Информационные потоки' },
  // Список схем модуля C4 открывается внутри приложения (маршрут /diagrams),
  // редактор схемы — встроенный маршрут модуля внутри того же origin.
  { key: '/diagrams', icon: <ProjectOutlined />, label: 'Архитектурные схемы' },
  {
    key: 'refs',
    icon: <BookOutlined />,
    label: 'Справочники',
    children: [
      { key: '/environments', icon: <DeploymentUnitOutlined />, label: 'Среды' },
      { key: '/protocols', icon: <GlobalOutlined />, label: 'Протоколы' },
      { key: '/zones', icon: <SafetyCertificateOutlined />, label: 'Сетевые зоны' },
    ],
  },
  {
    key: 'reports',
    icon: <FileTextOutlined />,
    label: 'Отчеты',
    children: [
      { key: '/matrix', icon: <TableOutlined />, label: 'Матрица информационных потоков' },
      { key: '/network-interactions', icon: <ApiOutlined />, label: 'Сетевые взаимодействия' },
    ],
  },
  { key: '/audit', icon: <SettingOutlined />, label: 'Настройки' },
]

/** Разделы навигации для подзаголовков/хлебных крошек каждой страницы. */
export const pageMeta: Record<string, { section?: string; title: string }> = {
  '/': { title: 'Главная' },
  '/is': { section: 'Реестр', title: 'Информационные системы' },
  '/modules': { section: 'Реестр', title: 'Модули' },
  '/instances': { section: 'Реестр', title: 'Экземпляры модулей' },
  '/projects': { section: 'Реестр', title: 'Проекты' },
  '/servers': { section: 'Инфраструктура', title: 'Серверы' },
  '/clusters': { section: 'Инфраструктура', title: 'Кластеры' },
  '/deployments': { section: 'Инфраструктура', title: 'Размещения' },
  '/segments': { section: 'Инфраструктура', title: 'Сетевые сегменты' },
  '/routers': { section: 'Инфраструктура', title: 'Маршрутизаторы' },
  '/firewalls': { section: 'Инфраструктура', title: 'Сетевые устройства' },
  '/interfaces': { section: 'Инфраструктура', title: 'Сетевые интерфейсы' },
  '/flows': { section: 'Взаимодействия', title: 'Информационные потоки' },
  '/diagrams': { section: 'Визуализация', title: 'Архитектурные схемы' },
  '/environments': { section: 'Справочники', title: 'Среды' },
  '/protocols': { section: 'Справочники', title: 'Протоколы' },
  '/zones': { section: 'Справочники', title: 'Сетевые зоны' },
  '/matrix': { section: 'Отчеты', title: 'Матрица информационных потоков' },
  '/network-interactions': { section: 'Отчеты', title: 'Сетевые взаимодействия' },
  '/audit': { title: 'Настройки' },
}

/** Раздел меню, который нужно раскрыть для выбранного маршрута. */
export function parentGroups(pathname: string): string[] {
  if (['/servers', '/clusters', '/deployments', '/segments', '/routers', '/firewalls', '/interfaces'].includes(pathname)) {
    return ['infra']
  }
  if (['/environments', '/protocols', '/zones'].includes(pathname)) {
    return ['refs']
  }
  if (['/matrix', '/network-interactions'].includes(pathname)) {
    return ['reports']
  }
  return []
}

