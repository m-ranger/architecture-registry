-- ============================================================================
-- Seed 06. Сетевые адреса развертывания (демонстрационные данные)
-- Дата: 08.10.2026
--
-- Модель:
--   * адрес узла размещения — network_interface; владелец — ровно одно поле:
--     server_id (адрес сервера) или cluster_id (адрес кластера);
--   * роль адреса кластера — interface_role: INGRESS (точка входа),
--     NODE (узел кластера), MANAGEMENT (управление);
--   * environment_id = NULL — адрес действует во всех средах узла, иначе адрес
--     принадлежит конкретной среде (тест/прод и т. п.).
--
-- Значения адресов взяты из подсетей реестра (10.10.10.0/24 — LAN-APP,
-- 10.20.10.0/24 — DMZ-APP, 10.99.1.0/24 — MGMT-01) и относятся к серверам и
-- кластерам, на которых фактически размещены экземпляры модулей.
--
-- Скрипт идемпотентен: адреса добавляются только если их ещё нет, поэтому его
-- можно применять повторно — и на пустом volume (после 03_seed_example.sql),
-- и на уже загруженной базе.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Адреса серверов (владелец server_id): адрес сервиса (среда PROD) и адрес
--    управления (среда NULL — управление не зависит от среды).
-- --------------------------------------------------------------------------
INSERT INTO network_interface
    (server_id, environment_id, network_segment_id, name, ip_address, interface_role, status)
SELECT s.id, v.env_id::uuid, ns.id, v.name, v.ip::inet, v.role, 'ACTIVE'
FROM (VALUES
    ('fefbe519-5e1d-405b-a697-bd3738e3f333', '22222222-2222-2222-2222-000000000004', 'LAN-APP',  'ipkom3-p-app-04-svc',  '10.10.10.14/32', 'SERVICE'),
    ('fefbe519-5e1d-405b-a697-bd3738e3f333', NULL,                                   'MGMT-01',  'ipkom3-p-app-04-mgmt', '10.99.1.14/32',  'MANAGEMENT'),
    ('fdc6c4fc-64b9-4b14-96ae-835131592fb3', '22222222-2222-2222-2222-000000000004', 'LAN-APP',  'ipkom3-p-app-05-svc',  '10.10.10.15/32', 'SERVICE'),
    ('fdc6c4fc-64b9-4b14-96ae-835131592fb3', NULL,                                   'MGMT-01',  'ipkom3-p-app-05-mgmt', '10.99.1.15/32',  'MANAGEMENT'),
    ('b7232f9b-cb8f-494b-b3d7-2f75a13e90c3', '22222222-2222-2222-2222-000000000004', 'LAN-APP',  'ipkom3-p-app-06-svc',  '10.10.10.16/32', 'SERVICE'),
    ('b7232f9b-cb8f-494b-b3d7-2f75a13e90c3', NULL,                                   'MGMT-01',  'ipkom3-p-app-06-mgmt', '10.99.1.16/32',  'MANAGEMENT'),
    ('16fee6cb-f031-4e77-8b8e-dccdc87e468d', '22222222-2222-2222-2222-000000000004', 'DMZ-APP',  'ipkom3-p-app-18-svc',  '10.20.10.18/32', 'SERVICE'),
    ('16fee6cb-f031-4e77-8b8e-dccdc87e468d', NULL,                                   'DMZ-MGMT', 'ipkom3-p-app-18-mgmt', '10.20.20.18/32', 'MANAGEMENT'),
    ('9da21806-9eb5-46a8-ba83-6f3e3041d9bc', '22222222-2222-2222-2222-000000000004', 'LAN-APP',  'vpl-kom3auth01-svc',   '10.10.10.31/32', 'SERVICE'),
    ('9da21806-9eb5-46a8-ba83-6f3e3041d9bc', NULL,                                   'MGMT-01',  'vpl-kom3auth01-mgmt',  '10.99.1.31/32',  'MANAGEMENT')
) AS v(server_id, env_id, segment_code, name, ip, role)
JOIN server s ON s.id = v.server_id::uuid
LEFT JOIN network_segment ns ON ns.code = v.segment_code
WHERE NOT EXISTS (
    SELECT 1 FROM network_interface ni
     WHERE ni.server_id = s.id AND ni.ip_address = v.ip::inet
);

-- --------------------------------------------------------------------------
-- 2. Адреса кластеров (владелец cluster_id): точка входа (VIP сервисов и
--    ingress внешнего контура), узел кластера и управление. Кластеры
--    развернуты в разных средах, поэтому адреса привязаны к средам;
--    адрес управления у кластера не зависит от среды.
-- --------------------------------------------------------------------------
INSERT INTO network_interface
    (cluster_id, environment_id, network_segment_id, name, ip_address, interface_role, status)
SELECT c.id, v.env_id::uuid, ns.id, v.name, v.ip::inet, v.role, 'ACTIVE'
FROM (VALUES
    ('b2fa3784-14cc-4020-b83d-c9566ad70e0e', '22222222-2222-2222-2222-000000000004', 'LAN-APP', 'ipkom3k8-prod-vip',      '10.10.10.100/32', 'INGRESS'),
    ('b2fa3784-14cc-4020-b83d-c9566ad70e0e', '22222222-2222-2222-2222-000000000004', 'DMZ-APP', 'ipkom3k8-prod-ingress',  '10.20.10.100/32', 'INGRESS'),
    ('b2fa3784-14cc-4020-b83d-c9566ad70e0e', '22222222-2222-2222-2222-000000000004', 'LAN-APP', 'ipkom3k8-prod-node-1',   '10.10.10.101/32', 'NODE'),
    ('b2fa3784-14cc-4020-b83d-c9566ad70e0e', NULL,                                   'MGMT-01', 'ipkom3k8-prod-mgmt',     '10.99.1.100/32',  'MANAGEMENT'),
    ('e0797690-78ca-4dcc-857a-c6c19b9d053e', '22222222-2222-2222-2222-000000000002', 'LAN-APP', 'ipkom3k8s-test-vip',     '10.10.10.150/32', 'INGRESS'),
    ('e0797690-78ca-4dcc-857a-c6c19b9d053e', '22222222-2222-2222-2222-000000000002', 'DMZ-APP', 'ipkom3k8s-test-ingress', '10.20.10.150/32', 'INGRESS'),
    ('e0797690-78ca-4dcc-857a-c6c19b9d053e', '22222222-2222-2222-2222-000000000002', 'LAN-APP', 'ipkom3k8s-test-node-1',  '10.10.10.151/32', 'NODE'),
    ('e0797690-78ca-4dcc-857a-c6c19b9d053e', NULL,                                   'MGMT-01', 'ipkom3k8s-test-mgmt',    '10.99.1.150/32',  'MANAGEMENT')
) AS v(cluster_id, env_id, segment_code, name, ip, role)
JOIN cluster c ON c.id = v.cluster_id::uuid
LEFT JOIN network_segment ns ON ns.code = v.segment_code
WHERE NOT EXISTS (
    SELECT 1 FROM network_interface ni
     WHERE ni.cluster_id = c.id AND ni.ip_address = v.ip::inet
);

-- --------------------------------------------------------------------------
-- 3. Контроль: сколько адресов заведено по узлам размещения
-- --------------------------------------------------------------------------
DO $$
DECLARE
    v_servers  integer;
    v_clusters integer;
BEGIN
    SELECT count(*) INTO v_servers  FROM network_interface
     WHERE server_id IS NOT NULL AND ip_address IS NOT NULL;
    SELECT count(*) INTO v_clusters FROM network_interface
     WHERE cluster_id IS NOT NULL AND ip_address IS NOT NULL;
    RAISE NOTICE 'адреса серверов: %, адреса кластеров: %', v_servers, v_clusters;
END $$;
