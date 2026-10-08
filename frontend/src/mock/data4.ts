import type { Router, Firewall, Protocol, InformationFlow, AuditEntry } from '../types'

export const routers: Router[] = [
  { id: 'rtr-01', name: 'RTR-DMZ-01', deviceType: 'CORE', vendor: 'Cisco', model: 'ASR1002-X', managementAddress: '10.99.1.10', status: 'ACTIVE', description: 'Ядровой маршрутизатор DMZ/LAN' },
  { id: 'rtr-02', name: 'RTR-PCI-01', deviceType: 'EDGE', vendor: 'Juniper', model: 'MX204', managementAddress: '10.99.1.12', status: 'PLANNED', description: 'Маршрутизатор PCI периметра (план)' },
]

export const firewalls: Firewall[] = [
  { id: 'fw-01', name: 'FW-01', firewallType: 'PERIMETER', vendor: 'Palo Alto', model: 'PA-5250', managementAddress: '10.99.1.20', status: 'ACTIVE', description: 'Межсетевой экран между DMZ и LAN' },
  { id: 'fw-02', name: 'FW-PCI-01', firewallType: 'ZONAL', vendor: 'Checkpoint', model: '15600', status: 'PLANNED', description: 'Firewalls для PCI зоны' },
]

export const protocols: Protocol[] = [
  { id: 'proto-https', code: 'HTTPS', name: 'HTTP Secure', transport: 'TCP', layer: 'L7', defaultPort: 443, description: 'HTTPS REST/gRPC-over-TLS', status: 'ACTIVE' },
  { id: 'proto-http', code: 'HTTP', name: 'HTTP', transport: 'TCP', layer: 'L7', defaultPort: 80, status: 'ACTIVE' },
  { id: 'proto-jdbc', code: 'JDBC', name: 'JDBC', transport: 'TCP', layer: 'L7', defaultPort: 5432, description: 'Подключение к реляционной БД', status: 'ACTIVE' },
  { id: 'proto-kafka', code: 'Kafka', name: 'Apache Kafka', transport: 'TCP', layer: 'L7', defaultPort: 9092, status: 'ACTIVE' },
  { id: 'proto-grpc', code: 'gRPC', name: 'gRPC', transport: 'TCP', layer: 'L7', defaultPort: 9090, status: 'ACTIVE' },
  { id: 'proto-amqp', code: 'AMQP', name: 'AMQP', transport: 'TCP', layer: 'L7', defaultPort: 5672, status: 'ACTIVE' },
  { id: 'proto-sftp', code: 'SFTP', name: 'SFTP', transport: 'TCP', layer: 'L7', defaultPort: 22, status: 'ACTIVE' },
]

export const informationFlows: InformationFlow[] = [
  { id: 'flow-001', code: 'FLOW-001', name: 'IB API Gateway → Customer API', sourceModuleId: 'mod-gw', targetModuleId: 'mod-cust-api', protocolId: 'proto-https', targetPort: 8443, description: 'REST: получение клиентских данных', status: 'ACTIVE' },
  { id: 'flow-002', code: 'FLOW-002', name: 'Customer API → Customer Data Store', sourceModuleId: 'mod-cust-api', targetModuleId: 'mod-cust-db', protocolId: 'proto-jdbc', targetPort: 5432, status: 'ACTIVE' },
  { id: 'flow-003', code: 'FLOW-003', name: 'Customer API → Core Adapter', sourceModuleId: 'mod-cust-api', targetModuleId: 'mod-core-adapter', protocolId: 'proto-https', targetPort: 443, status: 'ACTIVE' },
  { id: 'flow-004', code: 'FLOW-004', name: 'Web Interface → API Gateway', sourceModuleId: 'mod-ib-ui', targetModuleId: 'mod-gw', protocolId: 'proto-https', targetPort: 443, status: 'ACTIVE' },
  { id: 'flow-005', code: 'FLOW-005', name: 'Core Adapter → Core Database', sourceModuleId: 'mod-core-adapter', targetModuleId: 'mod-core-db', protocolId: 'proto-jdbc', targetPort: 1521, description: 'JDBC/Oracle', status: 'ACTIVE' },
  { id: 'flow-006', code: 'FLOW-006', name: 'Batch → Core Adapter', sourceModuleId: 'mod-ib-batch', targetModuleId: 'mod-core-adapter', protocolId: 'proto-grpc', targetPort: 9090, status: 'PLANNED' },
  { id: 'flow-007', code: 'FLOW-007', name: 'CRM → Customer API (план)', sourceModuleId: 'mod-crm-api', targetModuleId: 'mod-cust-api', protocolId: 'proto-https', targetPort: 8443, status: 'PLANNED' },
]

export const auditEntries: AuditEntry[] = [
  { id: 'aud-01', entityType: 'information_system', entityId: 'is-001', operation: 'UPDATE', changedAt: '2026-08-14T10:22:00Z', changedBy: 's.ivanov' },
  { id: 'aud-02', entityType: 'application_module', entityId: 'mod-gw', operation: 'UPDATE', changedAt: '2026-09-18T14:05:00Z', changedBy: 'n.petrov' },
  { id: 'aud-03', entityType: 'information_flow', entityId: 'flow-001', operation: 'INSERT', changedAt: '2026-07-02T11:12:00Z', changedBy: 'm.smirnova' },
  { id: 'aud-04', entityType: 'module_deployment', entityId: 'dep-001', operation: 'UPDATE', changedAt: '2026-09-29T09:44:00Z', changedBy: 'ops-deploy' },
  { id: 'aud-05', entityType: 'network_interface', entityId: 'nic-fw01-dmz', operation: 'INSERT', changedAt: '2026-05-11T16:00:00Z', changedBy: 'netops' },
]
