// Мок-данные для прототипа. Соответствуют модели v2.0 и примерам из 03_seed_example.sql.
import type {
  InformationSystem, ApplicationModule, Environment, ModuleInstance, Server, Cluster,
  ModuleDeployment, NetworkZone, NetworkSegment, NetworkInterface, Router, Firewall,
  Protocol, InformationFlow, AuditEntry,
} from '../types'

export const informationSystems: InformationSystem[] = [
  { id: 'is-001', code: 'IS-IB', name: 'Internet Banking', description: 'Канал обслуживания клиентов через интернет', status: 'ACTIVE', owner: 'Дigital Channels', createdAt: '2025-03-11T09:00:00Z', createdBy: 'admin', updatedAt: '2026-08-14T10:22:00Z', updatedBy: 's.ivanov' },
  { id: 'is-002', code: 'IS-CUSTOMER', name: 'Customer Information System', description: 'Мастер-данные клиентов', status: 'ACTIVE', owner: 'Core Banking', createdAt: '2025-01-20T09:00:00Z', createdBy: 'admin', updatedAt: '2026-09-01T08:05:00Z', updatedBy: 'n.petrov' },
  { id: 'is-003', code: 'IS-CORE', name: 'Core Banking System', description: 'Расчетные счета и платежи', status: 'ACTIVE', owner: 'Core Banking', createdAt: '2024-11-02T09:00:00Z', createdBy: 'admin', updatedAt: '2026-10-01T11:40:00Z', updatedBy: 'n.petrov' },
  { id: 'is-004', code: 'IS-CRM', name: 'CRM', description: 'Работа с клиентами в отделениях', status: 'PLANNED', owner: 'Sales', createdAt: '2026-06-05T09:00:00Z', createdBy: 'm.smirnova', updatedAt: '2026-09-28T12:00:00Z', updatedBy: 'm.smirnova' },
  { id: 'is-005', code: 'IS-LEGACY-CC', name: 'Legacy Card Processing', description: 'Выведено из эксплуатации, историческая фиксация', status: 'RETIRED', owner: 'Payments', createdAt: '2023-04-10T09:00:00Z', createdBy: 'admin', updatedAt: '2026-02-27T16:30:00Z', updatedBy: 'a.kuznetsov' },
]

export const environments: Environment[] = [
  { id: 'env-dev', code: 'DEV', name: 'Development', description: 'Среда разработки', criticality: 'LOW', status: 'ACTIVE' },
  { id: 'env-test', code: 'TEST', name: 'Test', description: 'Среда тестирования', criticality: 'MEDIUM', status: 'ACTIVE' },
  { id: 'env-qua', code: 'QUA', name: 'Quality Assurance', description: 'Среда приемочного тестирования', criticality: 'HIGH', status: 'ACTIVE' },
  { id: 'env-prod', code: 'PROD', name: 'Production', description: 'Промышленная среда', criticality: 'CRITICAL', status: 'ACTIVE' },
]

export const modules: ApplicationModule[] = [
  { id: 'mod-gw', informationSystemId: 'is-001', code: 'API-GATEWAY', name: 'API Gateway', purpose: 'Единая точка входа для внешних вызовов Internet Banking', moduleType: 'API', version: '4.2.0', status: 'ACTIVE' },
  { id: 'mod-ib-ui', informationSystemId: 'is-001', code: 'IB-WEB-UI', name: 'Web Interface', purpose: 'Личный кабинет клиента', moduleType: 'FRONTEND', version: '4.2.0', status: 'ACTIVE' },
  { id: 'mod-ib-batch', informationSystemId: 'is-001', code: 'IB-BATCH', name: 'Batch Processing', purpose: 'Ночные регламентные операции', moduleType: 'BATCH', version: '3.1.4', status: 'ACTIVE' },
  { id: 'mod-cust-api', informationSystemId: 'is-002', code: 'CUSTOMER-API', name: 'Customer API', purpose: 'Предоставление клиентских данных другим системам', moduleType: 'API', version: '2.7.1', status: 'ACTIVE' },
  { id: 'mod-cust-db', informationSystemId: 'is-002', code: 'CUSTOMER-DB', name: 'Customer Data Store', purpose: 'Хранилище клиентских данных', moduleType: 'DATABASE', version: '15.4', status: 'ACTIVE' },
  { id: 'mod-core-adapter', informationSystemId: 'is-003', code: 'CORE-ADAPTER', name: 'Core Adapter', purpose: 'Адаптер обращений к процессинговому ядру', moduleType: 'ADAPTER', version: '6.0.2', status: 'ACTIVE' },
  { id: 'mod-core-db', informationSystemId: 'is-003', code: 'CORE-DB', name: 'Core Database', purpose: 'Расчетные счета, платежные документы', moduleType: 'DATABASE', version: '15.4', status: 'ACTIVE' },
  { id: 'mod-crm-api', informationSystemId: 'is-004', code: 'CRM-API', name: 'CRM API', purpose: 'Интерфейс доступа к CRM', moduleType: 'API', version: '0.9.0', status: 'PLANNED' },
  { id: 'mod-legacy', informationSystemId: 'is-005', code: 'LEGACY-CC', name: 'Legacy Card Module', purpose: 'Исторический модуль карточного процессинга', moduleType: 'BACKEND', version: '1.0.9', status: 'RETIRED' },
]

export const servers: Server[] = [
  { id: 'srv-ib-01', name: 'ib-api-01', serverType: 'VM', status: 'ACTIVE', description: 'API Gateway Internet Banking' },
  { id: 'srv-ib-02', name: 'ib-api-02', serverType: 'VM', status: 'ACTIVE', description: 'API Gateway Internet Banking (резерв)' },
  { id: 'srv-ui-01', name: 'ib-web-01', serverType: 'VM', status: 'ACTIVE' },
  { id: 'srv-cust-01', name: 'customer-api-01', serverType: 'VM', status: 'ACTIVE' },
  { id: 'srv-cust-02', name: 'customer-db-01', serverType: 'VM', status: 'ACTIVE' },
  { id: 'srv-core-01', name: 'core-adapter-01', serverType: 'VM', status: 'ACTIVE' },
  { id: 'srv-core-02', name: 'core-db-01', serverType: 'VM', status: 'ACTIVE' },
  { id: 'srv-batch-01', name: 'ib-batch-01', serverType: 'VM', status: 'ACTIVE' },
]

export const clusters: Cluster[] = [
  { id: 'cl-ib-k8s', name: 'ib-k8s-prod', clusterType: 'KUBERNETES', version: '1.29', managementAddress: 'https://k8s-ib.corp.local:6443', status: 'ACTIVE', description: 'Продуктивный кластер Internet Banking' },
  { id: 'cl-cust-k8s', name: 'cust-k8s-test', clusterType: 'KUBERNETES', version: '1.28', managementAddress: 'https://k8s-cust-test.corp.local:6443', status: 'ACTIVE', description: 'Тестовый кластер Customer Information System' },
  { id: 'cl-oracle', name: 'oracle-ha', clusterType: 'ORACLE_RAC', version: '19c', managementAddress: '10.10.30.5', status: 'ACTIVE', description: 'HA-кластер БД. Обслуживает TEST и PROD' },
]
