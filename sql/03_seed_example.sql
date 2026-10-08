-- ============================================================================
-- Seed-данные "Единый реестр архитектуры ИС" v2.0
-- Источник данных: frontend/src/mock/data*.ts (демонстрационный набор)
-- Скрипт идемпотентен: таблицы очищаются перед загрузкой.
-- ============================================================================

TRUNCATE TABLE
    audit_log, information_flow_project, information_flow, network_interface,
    firewall, router, network_segment, network_zone, module_deployment,
    module_instance, cluster, server, protocol, project, application_module,
    environment, information_system
RESTART IDENTITY CASCADE;

-- --------------------------------------------------------------------------
-- 01. Information Systems (5 rows)
-- --------------------------------------------------------------------------
INSERT INTO information_system (id, code, name, description, status, owner, created_at, created_by, updated_at, updated_by) VALUES
    ('11111111-1111-1111-1111-000000000001', 'IS-IB', 'Internet Banking', 'Канал обслуживания клиентов через интернет', 'ACTIVE', 'Digital Channels', '2025-03-11T09:00:00Z', 'admin', '2026-08-14T10:22:00Z', 's.ivanov'),
    ('11111111-1111-1111-1111-000000000002', 'IS-CUSTOMER', 'Customer Information System', 'Мастер-данные клиентов', 'ACTIVE', 'Core Banking', '2025-01-20T09:00:00Z', 'admin', '2026-09-01T08:05:00Z', 'n.petrov'),
    ('11111111-1111-1111-1111-000000000003', 'IS-CORE', 'Core Banking System', 'Расчетные счета и платежи', 'ACTIVE', 'Core Banking', '2024-11-02T09:00:00Z', 'admin', '2026-10-01T11:40:00Z', 'n.petrov'),
    ('11111111-1111-1111-1111-000000000004', 'IS-CRM', 'CRM', 'Работа с клиентами в отделениях', 'PLANNED', 'Sales', '2026-06-05T09:00:00Z', 'm.smirnova', '2026-09-28T12:00:00Z', 'm.smirnova'),
    ('11111111-1111-1111-1111-000000000005', 'IS-LEGACY-CC', 'Legacy Card Processing', 'Выведено из эксплуатации, историческая фиксация', 'RETIRED', 'Payments', '2023-04-10T09:00:00Z', 'admin', '2026-02-27T16:30:00Z', 'a.kuznetsov');
-- --------------------------------------------------------------------------
-- 02. Environments (4 rows)
-- --------------------------------------------------------------------------
INSERT INTO environment (id, code, name, description, criticality, status) VALUES
    ('22222222-2222-2222-2222-000000000001', 'DEV', 'Development', 'Среда разработки', 'LOW', 'ACTIVE'),
    ('22222222-2222-2222-2222-000000000002', 'TEST', 'Test', 'Среда тестирования', 'MEDIUM', 'ACTIVE'),
    ('22222222-2222-2222-2222-000000000003', 'QUA', 'Quality Assurance', 'Среда приемочного тестирования', 'HIGH', 'ACTIVE'),
    ('22222222-2222-2222-2222-000000000004', 'PROD', 'Production', 'Промышленная среда', 'CRITICAL', 'ACTIVE');
-- --------------------------------------------------------------------------
-- 03. Application Modules (9 rows)
-- --------------------------------------------------------------------------
INSERT INTO application_module (id, information_system_id, code, name, purpose, module_type, version, status, created_by, updated_by) VALUES
    ('33333333-3333-3333-3333-000000000001', '11111111-1111-1111-1111-000000000001', 'API-GATEWAY', 'API Gateway', 'Единая точка входа для внешних вызовов Internet Banking', 'API', '4.2.0', 'ACTIVE', 'seed', 'seed'),
    ('33333333-3333-3333-3333-000000000002', '11111111-1111-1111-1111-000000000001', 'IB-WEB-UI', 'Web Interface', 'Личный кабинет клиента', 'FRONTEND', '4.2.0', 'ACTIVE', 'seed', 'seed'),
    ('33333333-3333-3333-3333-000000000003', '11111111-1111-1111-1111-000000000001', 'IB-BATCH', 'Batch Processing', 'Ночные регламентные операции', 'BATCH', '3.1.4', 'ACTIVE', 'seed', 'seed'),
    ('33333333-3333-3333-3333-000000000004', '11111111-1111-1111-1111-000000000002', 'CUSTOMER-API', 'Customer API', 'Предоставление клиентских данных другим системам', 'API', '2.7.1', 'ACTIVE', 'seed', 'seed'),
    ('33333333-3333-3333-3333-000000000005', '11111111-1111-1111-1111-000000000002', 'CUSTOMER-DB', 'Customer Data Store', 'Хранилище клиентских данных', 'DATABASE', '15.4', 'ACTIVE', 'seed', 'seed'),
    ('33333333-3333-3333-3333-000000000006', '11111111-1111-1111-1111-000000000003', 'CORE-ADAPTER', 'Core Adapter', 'Адаптер обращений к процессинговому ядру', 'ADAPTER', '6.0.2', 'ACTIVE', 'seed', 'seed'),
    ('33333333-3333-3333-3333-000000000007', '11111111-1111-1111-1111-000000000003', 'CORE-DB', 'Core Database', 'Расчетные счета, платежные документы', 'DATABASE', '15.4', 'ACTIVE', 'seed', 'seed'),
    ('33333333-3333-3333-3333-000000000008', '11111111-1111-1111-1111-000000000004', 'CRM-API', 'CRM API', 'Интерфейс доступа к CRM', 'API', '0.9.0', 'PLANNED', 'seed', 'seed'),
    ('33333333-3333-3333-3333-000000000009', '11111111-1111-1111-1111-000000000005', 'LEGACY-CC', 'Legacy Card Module', 'Исторический модуль карточного процессинга', 'BACKEND', '1.0.9', 'RETIRED', 'seed', 'seed');
-- --------------------------------------------------------------------------
-- 04. Servers (8 rows)
-- --------------------------------------------------------------------------
INSERT INTO server (id, name, server_type, status, description) VALUES
    ('44444444-4444-4444-4444-000000000001', 'ib-api-01', 'VM', 'ACTIVE', 'API Gateway Internet Banking'),
    ('44444444-4444-4444-4444-000000000002', 'ib-api-02', 'VM', 'ACTIVE', 'API Gateway Internet Banking (резерв)'),
    ('44444444-4444-4444-4444-000000000003', 'ib-web-01', 'VM', 'ACTIVE', NULL),
    ('44444444-4444-4444-4444-000000000004', 'customer-api-01', 'VM', 'ACTIVE', NULL),
    ('44444444-4444-4444-4444-000000000005', 'customer-db-01', 'VM', 'ACTIVE', NULL),
    ('44444444-4444-4444-4444-000000000006', 'core-adapter-01', 'VM', 'ACTIVE', NULL),
    ('44444444-4444-4444-4444-000000000007', 'core-db-01', 'VM', 'ACTIVE', NULL),
    ('44444444-4444-4444-4444-000000000008', 'ib-batch-01', 'VM', 'ACTIVE', NULL);
-- --------------------------------------------------------------------------
-- 05. Clusters (3 rows)
-- --------------------------------------------------------------------------
INSERT INTO cluster (id, name, cluster_type, version, management_address, status, description) VALUES
    ('55555555-5555-5555-5555-000000000001', 'ib-k8s-prod', 'KUBERNETES', '1.29', 'https://k8s-ib.corp.local:6443', 'ACTIVE', 'Продуктивный кластер Internet Banking'),
    ('55555555-5555-5555-5555-000000000002', 'cust-k8s-test', 'KUBERNETES', '1.28', 'https://k8s-cust-test.corp.local:6443', 'ACTIVE', 'Тестовый кластер Customer Information System'),
    ('55555555-5555-5555-5555-000000000003', 'oracle-ha', 'ORACLE_RAC', '19c', '10.10.30.5', 'ACTIVE', 'HA-кластер БД. Обслуживает TEST и PROD');
-- --------------------------------------------------------------------------
-- 06. Module Instances (12 rows)
-- --------------------------------------------------------------------------
INSERT INTO module_instance (id, module_id, environment_id, name, version, status, runtime_type) VALUES
    ('66666666-6666-6666-6666-000000000001', '33333333-3333-3333-3333-000000000001', '22222222-2222-2222-2222-000000000002', 'API-GATEWAY-TEST-01', '4.2.0', 'ACTIVE', 'SPRING_BOOT'),
    ('66666666-6666-6666-6666-000000000002', '33333333-3333-3333-3333-000000000001', '22222222-2222-2222-2222-000000000004', 'API-GATEWAY-PROD-01', '4.2.0', 'ACTIVE', 'SPRING_BOOT'),
    ('66666666-6666-6666-6666-000000000003', '33333333-3333-3333-3333-000000000001', '22222222-2222-2222-2222-000000000004', 'API-GATEWAY-PROD-02', '4.2.0', 'ACTIVE', 'SPRING_BOOT'),
    ('66666666-6666-6666-6666-000000000004', '33333333-3333-3333-3333-000000000004', '22222222-2222-2222-2222-000000000002', 'CUSTOMER-API-TEST-01', '2.7.1', 'ACTIVE', 'SPRING_BOOT'),
    ('66666666-6666-6666-6666-000000000005', '33333333-3333-3333-3333-000000000004', '22222222-2222-2222-2222-000000000004', 'CUSTOMER-API-PROD-01', '2.7.1', 'ACTIVE', 'SPRING_BOOT'),
    ('66666666-6666-6666-6666-000000000006', '33333333-3333-3333-3333-000000000005', '22222222-2222-2222-2222-000000000004', 'CUSTOMER-DB-PROD-01', '15.4', 'ACTIVE', 'POSTGRESQL'),
    ('66666666-6666-6666-6666-000000000007', '33333333-3333-3333-3333-000000000006', '22222222-2222-2222-2222-000000000002', 'CORE-ADAPTER-TEST-01', '6.0.2', 'ACTIVE', 'SPRING_BOOT'),
    ('66666666-6666-6666-6666-000000000008', '33333333-3333-3333-3333-000000000006', '22222222-2222-2222-2222-000000000004', 'CORE-ADAPTER-PROD-01', '6.0.2', 'ACTIVE', 'SPRING_BOOT'),
    ('66666666-6666-6666-6666-000000000009', '33333333-3333-3333-3333-000000000007', '22222222-2222-2222-2222-000000000004', 'CORE-DB-PROD-01', '15.4', 'ACTIVE', 'ORACLE'),
    ('66666666-6666-6666-6666-000000000010', '33333333-3333-3333-3333-000000000002', '22222222-2222-2222-2222-000000000004', 'IB-WEB-UI-PROD-01', NULL, 'ACTIVE', 'NGINX'),
    ('66666666-6666-6666-6666-000000000011', '33333333-3333-3333-3333-000000000003', '22222222-2222-2222-2222-000000000004', 'IB-BATCH-PROD-01', '3.1.4', 'ACTIVE', 'CRON'),
    ('66666666-6666-6666-6666-000000000012', '33333333-3333-3333-3333-000000000003', '22222222-2222-2222-2222-000000000002', 'IB-BATCH-TEST-01', '3.1.4', 'RETIRED', 'CRON');
-- --------------------------------------------------------------------------
-- 07. Module Deployments (10 rows) — ровно один из server_id / cluster_id
-- --------------------------------------------------------------------------
INSERT INTO module_deployment (id, module_instance_id, server_id, cluster_id, deployment_role, deployment_state, valid_from) VALUES
    ('dddddddd-dddd-dddd-dddd-000000000001', '66666666-6666-6666-6666-000000000002', '44444444-4444-4444-4444-000000000001', NULL, 'PRIMARY', 'ACTIVE', '2026-04-01T00:00:00Z'),
    ('dddddddd-dddd-dddd-dddd-000000000002', '66666666-6666-6666-6666-000000000003', '44444444-4444-4444-4444-000000000002', NULL, 'PRIMARY', 'ACTIVE', '2026-04-01T00:00:00Z'),
    ('dddddddd-dddd-dddd-dddd-000000000003', '66666666-6666-6666-6666-000000000005', '44444444-4444-4444-4444-000000000004', NULL, 'PRIMARY', 'ACTIVE', NULL),
    ('dddddddd-dddd-dddd-dddd-000000000004', '66666666-6666-6666-6666-000000000006', '44444444-4444-4444-4444-000000000005', NULL, 'PRIMARY', 'ACTIVE', NULL),
    ('dddddddd-dddd-dddd-dddd-000000000005', '66666666-6666-6666-6666-000000000008', '44444444-4444-4444-4444-000000000006', NULL, 'ACTIVE', 'ACTIVE', NULL),
    ('dddddddd-dddd-dddd-dddd-000000000006', '66666666-6666-6666-6666-000000000009', NULL, '55555555-5555-5555-5555-000000000003', 'PRIMARY', 'ACTIVE', NULL),
    ('dddddddd-dddd-dddd-dddd-000000000007', '66666666-6666-6666-6666-000000000010', '44444444-4444-4444-4444-000000000003', NULL, 'PRIMARY', 'ACTIVE', NULL),
    ('dddddddd-dddd-dddd-dddd-000000000008', '66666666-6666-6666-6666-000000000001', NULL, '55555555-5555-5555-5555-000000000002', 'SERVICE', 'ACTIVE', NULL),
    ('dddddddd-dddd-dddd-dddd-000000000009', '66666666-6666-6666-6666-000000000004', NULL, '55555555-5555-5555-5555-000000000002', 'SERVICE', 'ACTIVE', NULL),
    ('dddddddd-dddd-dddd-dddd-000000000010', '66666666-6666-6666-6666-000000000011', NULL, '55555555-5555-5555-5555-000000000001', 'SERVICE', 'STANDBY', NULL);
-- --------------------------------------------------------------------------
-- 08. Network Zones (5 rows, иерархия PCI -> LAN)
-- --------------------------------------------------------------------------
INSERT INTO network_zone (id, code, name, zone_type, security_level, parent_id, status) VALUES
    ('77777777-7777-7777-7777-000000000001', 'DMZ', 'Demilitarized Zone', 'DMZ', 'HIGH', NULL, 'ACTIVE'),
    ('77777777-7777-7777-7777-000000000002', 'LAN', 'Internal LAN', 'INTERNAL', 'MEDIUM', NULL, 'ACTIVE'),
    ('77777777-7777-7777-7777-000000000003', 'PCI', 'PCI DSS Zone', 'PCI_DSS', 'CRITICAL', '77777777-7777-7777-7777-000000000002', 'ACTIVE'),
    ('77777777-7777-7777-7777-000000000004', 'MANAGEMENT', 'Management Zone', 'MANAGEMENT', 'HIGH', NULL, 'ACTIVE'),
    ('77777777-7777-7777-7777-000000000005', 'EXTERNAL', 'External', 'EXTERNAL', 'LOW', NULL, 'ACTIVE');
-- --------------------------------------------------------------------------
-- 09. Network Segments (6 rows)
-- --------------------------------------------------------------------------
INSERT INTO network_segment (id, network_zone_id, code, name, cidr, vlan, purpose, status) VALUES
    ('88888888-8888-8888-8888-000000000001', '77777777-7777-7777-7777-000000000001', 'DMZ-APP', 'DMZ Application Segment', '10.20.10.0/24', 210, 'Internet Banking DMZ', 'ACTIVE'),
    ('88888888-8888-8888-8888-000000000002', '77777777-7777-7777-7777-000000000001', 'DMZ-MGMT', 'DMZ Management Segment', '10.20.20.0/24', 220, NULL, 'ACTIVE'),
    ('88888888-8888-8888-8888-000000000003', '77777777-7777-7777-7777-000000000002', 'LAN-APP', 'LAN Application Segment', '10.10.10.0/24', 110, 'Internal services', 'ACTIVE'),
    ('88888888-8888-8888-8888-000000000004', '77777777-7777-7777-7777-000000000002', 'LAN-DB', 'LAN Database Segment', '10.10.30.0/24', 130, 'Database VLAN', 'ACTIVE'),
    ('88888888-8888-8888-8888-000000000005', '77777777-7777-7777-7777-000000000004', 'MGMT-01', 'Management Segment', '10.99.1.0/24', 99, NULL, 'ACTIVE'),
    ('88888888-8888-8888-8888-000000000006', '77777777-7777-7777-7777-000000000003', 'PCI-APP', 'PCI Application Segment', '10.40.10.0/24', 410, 'Card transaction processing', 'ACTIVE');
-- --------------------------------------------------------------------------
-- 10. Routers (2 rows)
-- --------------------------------------------------------------------------
INSERT INTO router (id, name, device_type, vendor, model, management_address, status, description) VALUES
    ('99999999-9999-9999-9999-000000000001', 'RTR-DMZ-01', 'CORE', 'Cisco', 'ASR1002-X', '10.99.1.10', 'ACTIVE', 'Ядровой маршрутизатор DMZ/LAN'),
    ('99999999-9999-9999-9999-000000000002', 'RTR-PCI-01', 'EDGE', 'Juniper', 'MX204', '10.99.1.12', 'PLANNED', 'Маршрутизатор PCI периметра (план)');

-- --------------------------------------------------------------------------
-- 11. Firewalls (2 rows)
-- --------------------------------------------------------------------------
INSERT INTO firewall (id, name, firewall_type, vendor, model, management_address, status, description) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'FW-01', 'PERIMETER', 'Palo Alto', 'PA-5250', '10.99.1.20', 'ACTIVE', 'Межсетевой экран между DMZ и LAN'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', 'FW-PCI-01', 'ZONAL', 'Checkpoint', '15600', NULL, 'PLANNED', 'Firewalls для PCI зоны');
-- --------------------------------------------------------------------------
-- 12. Network Interfaces (11 rows) — ровно один владелец: server XOR router XOR firewall
-- --------------------------------------------------------------------------
INSERT INTO network_interface (id, server_id, router_id, firewall_id, network_segment_id, name, ip_address, mac_address, interface_role, status) VALUES
    ('eeeeeeee-eeee-eeee-eeee-000000000001', '44444444-4444-4444-4444-000000000001', NULL, NULL, '88888888-8888-8888-8888-000000000001', 'eth0', '10.20.10.15', '52:54:00:11:22:33', 'PRIMARY', 'ACTIVE'),
    ('eeeeeeee-eeee-eeee-eeee-000000000002', '44444444-4444-4444-4444-000000000001', NULL, NULL, '88888888-8888-8888-8888-000000000002', 'mgmt0', '10.20.20.11', NULL, 'MANAGEMENT', 'ACTIVE'),
    ('eeeeeeee-eeee-eeee-eeee-000000000003', '44444444-4444-4444-4444-000000000002', NULL, NULL, '88888888-8888-8888-8888-000000000001', 'eth0', '10.20.10.16', NULL, 'PRIMARY', 'ACTIVE'),
    ('eeeeeeee-eeee-eeee-eeee-000000000004', '44444444-4444-4444-4444-000000000004', NULL, NULL, '88888888-8888-8888-8888-000000000003', 'eth0', '10.10.10.25', NULL, NULL, 'ACTIVE'),
    ('eeeeeeee-eeee-eeee-eeee-000000000005', '44444444-4444-4444-4444-000000000005', NULL, NULL, '88888888-8888-8888-8888-000000000004', 'eth0', '10.10.30.11', NULL, NULL, 'ACTIVE'),
    ('eeeeeeee-eeee-eeee-eeee-000000000006', '44444444-4444-4444-4444-000000000006', NULL, NULL, '88888888-8888-8888-8888-000000000003', 'eth0', '10.10.10.42', NULL, NULL, 'ACTIVE'),
    ('eeeeeeee-eeee-eeee-eeee-000000000007', '44444444-4444-4444-4444-000000000007', NULL, NULL, '88888888-8888-8888-8888-000000000004', 'eth0', '10.10.30.42', NULL, NULL, 'ACTIVE'),
    ('eeeeeeee-eeee-eeee-eeee-000000000008', NULL, NULL, 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', '88888888-8888-8888-8888-000000000001', 'interface-01', NULL, NULL, 'INSIDE', 'ACTIVE'),
    ('eeeeeeee-eeee-eeee-eeee-000000000009', NULL, NULL, 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', '88888888-8888-8888-8888-000000000003', 'interface-02', NULL, NULL, 'OUTSIDE', 'ACTIVE'),
    ('eeeeeeee-eeee-eeee-eeee-000000000010', NULL, '99999999-9999-9999-9999-000000000001', NULL, '88888888-8888-8888-8888-000000000001', 'ge-0/0/0', NULL, NULL, NULL, 'ACTIVE'),
    ('eeeeeeee-eeee-eeee-eeee-000000000011', NULL, '99999999-9999-9999-9999-000000000001', NULL, '88888888-8888-8888-8888-000000000003', 'ge-0/0/1', NULL, NULL, NULL, 'ACTIVE');
-- --------------------------------------------------------------------------
-- 13. Protocols (7 rows)
-- --------------------------------------------------------------------------
INSERT INTO protocol (id, code, name, transport, layer, default_port, description, status) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'HTTPS', 'HTTP Secure', 'TCP', 'L7', 443, 'HTTPS REST/gRPC-over-TLS', 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000002', 'HTTP', 'HTTP', 'TCP', 'L7', 80, NULL, 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000003', 'JDBC', 'JDBC', 'TCP', 'L7', 5432, 'Подключение к реляционной БД', 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000004', 'Kafka', 'Apache Kafka', 'TCP', 'L7', 9092, NULL, 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000005', 'gRPC', 'gRPC', 'TCP', 'L7', 9090, NULL, 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000006', 'AMQP', 'AMQP', 'TCP', 'L7', 5672, NULL, 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000007', 'SFTP', 'SFTP', 'TCP', 'L7', 22, NULL, 'ACTIVE');
-- --------------------------------------------------------------------------
-- 14. Information Flows (7 rows) — source_module_id <> target_module_id
-- --------------------------------------------------------------------------
INSERT INTO information_flow (id, code, name, source_module_id, target_module_id, protocol_id, target_port, source_port, description, status, valid_from, created_by, updated_by) VALUES
    ('cccccccc-cccc-cccc-cccc-000000000001', 'FLOW-001', 'IB API Gateway -> Customer API', '33333333-3333-3333-3333-000000000001', '33333333-3333-3333-3333-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 8443, NULL, 'REST: получение клиентских данных', 'ACTIVE', NULL, 'seed', 'seed'),
    ('cccccccc-cccc-cccc-cccc-000000000002', 'FLOW-002', 'Customer API -> Customer Data Store', '33333333-3333-3333-3333-000000000004', '33333333-3333-3333-3333-000000000005', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000003', 5432, NULL, NULL, 'ACTIVE', NULL, 'seed', 'seed'),
    ('cccccccc-cccc-cccc-cccc-000000000003', 'FLOW-003', 'Customer API -> Core Adapter', '33333333-3333-3333-3333-000000000004', '33333333-3333-3333-3333-000000000006', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 443, NULL, NULL, 'ACTIVE', NULL, 'seed', 'seed'),
    ('cccccccc-cccc-cccc-cccc-000000000004', 'FLOW-004', 'Web Interface -> API Gateway', '33333333-3333-3333-3333-000000000002', '33333333-3333-3333-3333-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 443, NULL, NULL, 'ACTIVE', NULL, 'seed', 'seed'),
    ('cccccccc-cccc-cccc-cccc-000000000005', 'FLOW-005', 'Core Adapter -> Core Database', '33333333-3333-3333-3333-000000000006', '33333333-3333-3333-3333-000000000007', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000003', 1521, NULL, 'JDBC/Oracle', 'ACTIVE', NULL, 'seed', 'seed'),
    ('cccccccc-cccc-cccc-cccc-000000000006', 'FLOW-006', 'Batch -> Core Adapter', '33333333-3333-3333-3333-000000000003', '33333333-3333-3333-3333-000000000006', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000005', 9090, NULL, NULL, 'PLANNED', NULL, 'seed', 'seed'),
    ('cccccccc-cccc-cccc-cccc-000000000007', 'FLOW-007', 'CRM -> Customer API', '33333333-3333-3333-3333-000000000008', '33333333-3333-3333-3333-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 8443, NULL, NULL, 'PLANNED', NULL, 'seed', 'seed');
-- --------------------------------------------------------------------------
-- 15. Audit Log (5 примеров)
-- --------------------------------------------------------------------------
INSERT INTO audit_log (id, entity_type, entity_id, operation, changed_at, changed_by) VALUES
    ('ffffffff-ffff-ffff-ffff-000000000001', 'information_system', '11111111-1111-1111-1111-000000000001', 'UPDATE', '2026-08-14T10:22:00Z', 's.ivanov'),
    ('ffffffff-ffff-ffff-ffff-000000000002', 'application_module', '33333333-3333-3333-3333-000000000001', 'UPDATE', '2026-09-18T14:05:00Z', 'n.petrov'),
    ('ffffffff-ffff-ffff-ffff-000000000003', 'information_flow', 'cccccccc-cccc-cccc-cccc-000000000001', 'INSERT', '2026-07-02T11:12:00Z', 'm.smirnova'),
    ('ffffffff-ffff-ffff-ffff-000000000004', 'module_deployment', 'dddddddd-dddd-dddd-dddd-000000000002', 'UPDATE', '2026-09-29T09:44:00Z', 'ops-deploy'),
    ('ffffffff-ffff-ffff-ffff-000000000005', 'network_interface', 'eeeeeeee-eeee-eeee-eeee-000000000001', 'INSERT', '2026-05-11T16:00:00Z', 'netops');

-- --------------------------------------------------------------------------
-- 16. Projects (3 rows) — реестровый объект «Проект»: Номер проекта + Наименование
-- --------------------------------------------------------------------------
INSERT INTO project (id, code, name, description, status, created_by, updated_by) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'PRJ-2026-001', 'Единая клиентская витрина', 'Консолидация клиентских данных в едином хранилище', 'ACTIVE', 'seed', 'seed'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', 'PRJ-2026-002', 'Обновление интернет-банка', 'Перевод канала самообслуживания на новую платформу', 'ACTIVE', 'seed', 'seed'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-000000000003', 'PRJ-2026-003', 'Внедрение CRM', 'Единая система работы с клиентами в отделениях', 'PLANNED', 'seed', 'seed');

-- --------------------------------------------------------------------------
-- 17. Information Flow ↔ Projects (8 links) — поток задействован в проектах (1:N)
--     FLOW-002 и FLOW-005 задействованы сразу в двух проектах
-- --------------------------------------------------------------------------
INSERT INTO information_flow_project (id, information_flow_id, project_id, created_by) VALUES
    ('99999999-9999-9999-9999-000000000001', 'cccccccc-cccc-cccc-cccc-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002', 'seed'),
    ('99999999-9999-9999-9999-000000000002', 'cccccccc-cccc-cccc-cccc-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'seed'),
    ('99999999-9999-9999-9999-000000000003', 'cccccccc-cccc-cccc-cccc-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003', 'seed'),
    ('99999999-9999-9999-9999-000000000004', 'cccccccc-cccc-cccc-cccc-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'seed'),
    ('99999999-9999-9999-9999-000000000005', 'cccccccc-cccc-cccc-cccc-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002', 'seed'),
    ('99999999-9999-9999-9999-000000000006', 'cccccccc-cccc-cccc-cccc-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'seed'),
    ('99999999-9999-9999-9999-000000000007', 'cccccccc-cccc-cccc-cccc-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003', 'seed'),
    ('99999999-9999-9999-9999-000000000008', 'cccccccc-cccc-cccc-cccc-000000000007', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003', 'seed');

