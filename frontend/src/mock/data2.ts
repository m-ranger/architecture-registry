// Продолжение мок-данных: экземпляры, размещения, сеть, протоколы, потоки.
import type { ModuleInstance, ModuleDeployment, NetworkZone, NetworkSegment, NetworkInterface, Router, Firewall, Protocol, InformationFlow, AuditEntry } from '../types'

export const moduleInstances: ModuleInstance[] = [
  { id: 'inst-gw-test', moduleId: 'mod-gw', environmentId: 'env-test', name: 'API-GATEWAY-TEST-01', version: '4.2.0', status: 'ACTIVE', runtimeType: 'SPRING_BOOT' },
  { id: 'inst-gw-prod-01', moduleId: 'mod-gw', environmentId: 'env-prod', name: 'API-GATEWAY-PROD-01', version: '4.2.0', status: 'ACTIVE', runtimeType: 'SPRING_BOOT' },
  { id: 'inst-gw-prod-02', moduleId: 'mod-gw', environmentId: 'env-prod', name: 'API-GATEWAY-PROD-02', version: '4.2.0', status: 'ACTIVE', runtimeType: 'SPRING_BOOT' },
  { id: 'inst-cust-api-test', moduleId: 'mod-cust-api', environmentId: 'env-test', name: 'CUSTOMER-API-TEST-01', version: '2.7.1', status: 'ACTIVE', runtimeType: 'SPRING_BOOT' },
  { id: 'inst-cust-api-prod', moduleId: 'mod-cust-api', environmentId: 'env-prod', name: 'CUSTOMER-API-PROD-01', version: '2.7.1', status: 'ACTIVE', runtimeType: 'SPRING_BOOT' },
  { id: 'inst-cust-db-prod', moduleId: 'mod-cust-db', environmentId: 'env-prod', name: 'CUSTOMER-DB-PROD-01', version: '15.4', status: 'ACTIVE', runtimeType: 'POSTGRESQL' },
  { id: 'inst-core-adapter-test', moduleId: 'mod-core-adapter', environmentId: 'env-test', name: 'CORE-ADAPTER-TEST-01', version: '6.0.2', status: 'ACTIVE', runtimeType: 'SPRING_BOOT' },
  { id: 'inst-core-adapter-prod', moduleId: 'mod-core-adapter', environmentId: 'env-prod', name: 'CORE-ADAPTER-PROD-01', version: '6.0.2', status: 'ACTIVE', runtimeType: 'SPRING_BOOT' },
  { id: 'inst-core-db-prod', moduleId: 'mod-core-db', environmentId: 'env-prod', name: 'CORE-DB-PROD-01', version: '15.4', status: 'ACTIVE', runtimeType: 'ORACLE' },
  { id: 'inst-ib-ui-prod', moduleId: 'mod-ib-ui', environmentId: 'env-prod', name: 'IB-WEB-UI-PROD-01', status: 'ACTIVE', runtimeType: 'NGINX' },
  { id: 'inst-ib-batch-prod', moduleId: 'mod-ib-batch', environmentId: 'env-prod', name: 'IB-BATCH-PROD-01', version: '3.1.4', status: 'ACTIVE', runtimeType: 'CRON' },
  { id: 'inst-ib-batch-test', moduleId: 'mod-ib-batch', environmentId: 'env-test', name: 'IB-BATCH-TEST-01', version: '3.1.4', status: 'RETIRED', runtimeType: 'CRON' },
]

export const deployments: ModuleDeployment[] = [
  { id: 'dep-001', moduleInstanceId: 'inst-gw-prod-01', serverId: 'srv-ib-01', deploymentRole: 'PRIMARY', deploymentState: 'ACTIVE', validFrom: '2026-04-01T00:00:00Z' },
  { id: 'dep-002', moduleInstanceId: 'inst-gw-prod-02', serverId: 'srv-ib-02', deploymentRole: 'PRIMARY', deploymentState: 'ACTIVE', validFrom: '2026-04-01T00:00:00Z' },
  { id: 'dep-003', moduleInstanceId: 'inst-cust-api-prod', serverId: 'srv-cust-01', deploymentRole: 'PRIMARY', deploymentState: 'ACTIVE' },
  { id: 'dep-004', moduleInstanceId: 'inst-cust-db-prod', serverId: 'srv-cust-02', deploymentRole: 'PRIMARY', deploymentState: 'ACTIVE' },
  { id: 'dep-005', moduleInstanceId: 'inst-core-adapter-prod', serverId: 'srv-core-01', deploymentRole: 'ACTIVE', deploymentState: 'ACTIVE' },
  { id: 'dep-006', moduleInstanceId: 'inst-core-db-prod', clusterId: 'cl-oracle', deploymentRole: 'PRIMARY', deploymentState: 'ACTIVE' },
  { id: 'dep-007', moduleInstanceId: 'inst-ib-ui-prod', serverId: 'srv-ui-01', deploymentRole: 'PRIMARY', deploymentState: 'ACTIVE' },
  { id: 'dep-008', moduleInstanceId: 'inst-gw-test', clusterId: 'cl-cust-k8s', deploymentRole: 'SERVICE', deploymentState: 'ACTIVE' },
  { id: 'dep-009', moduleInstanceId: 'inst-cust-api-test', clusterId: 'cl-cust-k8s', deploymentRole: 'SERVICE', deploymentState: 'ACTIVE' },
  { id: 'dep-010', moduleInstanceId: 'inst-ib-batch-prod', clusterId: 'cl-ib-k8s', deploymentRole: 'SERVICE', deploymentState: 'STANDBY' },
]
