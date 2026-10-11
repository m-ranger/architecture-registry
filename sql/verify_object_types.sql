-- ============================================================================
-- Самопроверка модели «тип объекта» INTERNAL / EXTERNAL (миграция 07).
-- Внутри транзакции создаётся временный внешний контур (ИС, сервер, кластер,
-- модуль, размещение и сетевые адреса), проверяется наследование типа и его
-- пересчёт при смене типа родителя; затем выполняется ROLLBACK, поэтому данные
-- реестра не меняются.
--
-- Запуск:
--   docker cp sql/verify_object_types.sql arch-registry-db:/tmp/verify_types.sql
--   docker exec arch-registry-db psql -U registry_admin -d architecture_registry \
--       -v ON_ERROR_STOP=1 -f /tmp/verify_types.sql
-- ============================================================================
BEGIN;

\echo '--- Распределение типов в действующем реестре ---'
SELECT 'information_system' AS entity, object_type, count(*) AS cnt FROM information_system GROUP BY object_type
UNION ALL
SELECT 'application_module', object_type, count(*) FROM application_module GROUP BY object_type
UNION ALL
SELECT 'module_deployment', object_type, count(*) FROM module_deployment GROUP BY object_type
UNION ALL
SELECT 'server', object_type, count(*) FROM server GROUP BY object_type
UNION ALL
SELECT 'cluster', object_type, count(*) FROM cluster GROUP BY object_type
UNION ALL
SELECT 'network_interface', object_type, count(*) FROM network_interface GROUP BY object_type
ORDER BY entity, object_type;

\echo '--- Временный внешний контур: ИС, сервер, кластер (тип EXTERNAL) ---'
INSERT INTO information_system (code, name, status, owner, created_by, updated_by, object_type)
VALUES ('TMP-VERIFY-EXT', 'Временная внешняя ИС', 'PLANNED', 'verify', 'verify', 'verify', 'EXTERNAL');

INSERT INTO server (name, status, description, object_type)
VALUES ('tmp-verify-ext-srv', 'PLANNED', 'проверка наследования типа', 'EXTERNAL');

INSERT INTO cluster (name, cluster_type, status, description, object_type)
VALUES ('tmp-verify-ext-clu', 'KUBERNETES', 'PLANNED', 'проверка наследования типа', 'EXTERNAL');

\echo '--- Модуль создаётся без указания типа: ожидается EXTERNAL от ИС ---'
INSERT INTO application_module
    (information_system_id, code, name, purpose, status, created_by, updated_by)
SELECT isys.id, 'TMP-VERIFY-EXT-MOD', 'Временный модуль внешней ИС',
       'проверка наследования типа', 'PLANNED', 'verify', 'verify'
FROM information_system isys
WHERE isys.code = 'TMP-VERIFY-EXT';

INSERT INTO module_instance (module_id, environment_id, name, status)
SELECT am.id, (SELECT e.id FROM environment e WHERE e.status = 'ACTIVE' ORDER BY e.code LIMIT 1),
       'tmp-verify-ext-inst', 'PLANNED'
FROM application_module am
WHERE am.code = 'TMP-VERIFY-EXT-MOD';

\echo '--- Размещение на внешнем сервере: ожидается EXTERNAL ---'
INSERT INTO module_deployment (module_instance_id, server_id, deployment_state)
SELECT mi.id, s.id, 'ACTIVE'
FROM module_instance mi, server s
WHERE mi.name = 'tmp-verify-ext-inst' AND s.name = 'tmp-verify-ext-srv';

\echo '--- Сетевые адреса: сервера и кластера (тип не задаётся, ожидается EXTERNAL) ---'
INSERT INTO network_interface (server_id, name, ip_address, status)
SELECT s.id, 'tmp-verify-ext-srv-eth0', '192.0.2.10'::inet, 'PLANNED'
FROM server s
WHERE s.name = 'tmp-verify-ext-srv';

INSERT INTO network_interface (cluster_id, name, ip_address, interface_role, status)
SELECT c.id, 'tmp-verify-ext-clu-ingress', '192.0.2.20'::inet, 'INGRESS', 'PLANNED'
FROM cluster c
WHERE c.name = 'tmp-verify-ext-clu';

\echo '--- Наследование: ожидается EXTERNAL во всех четырёх строках ---'
SELECT 'модуль (от ИС)' AS object, am.code AS name, am.object_type
  FROM application_module am WHERE am.code = 'TMP-VERIFY-EXT-MOD'
UNION ALL
SELECT 'размещение (от сервера)', s.name, md.object_type
  FROM module_deployment md JOIN server s ON s.id = md.server_id
 WHERE s.name = 'tmp-verify-ext-srv'
UNION ALL
SELECT 'адрес (от сервера)', ni.name, ni.object_type
  FROM network_interface ni JOIN server s ON s.id = ni.server_id
 WHERE s.name = 'tmp-verify-ext-srv'
UNION ALL
SELECT 'адрес (от кластера)', ni.name, ni.object_type
  FROM network_interface ni JOIN cluster c ON c.id = ni.cluster_id
 WHERE c.name = 'tmp-verify-ext-clu';

\echo '--- Смена типа сервера на INTERNAL: ожидается пересчёт размещения и адреса ---'
UPDATE server SET object_type = 'INTERNAL' WHERE name = 'tmp-verify-ext-srv';

SELECT 'размещение' AS object, s.name AS name, md.object_type
  FROM module_deployment md JOIN server s ON s.id = md.server_id
 WHERE s.name = 'tmp-verify-ext-srv'
UNION ALL
SELECT 'адрес', ni.name, ni.object_type
  FROM network_interface ni JOIN server s ON s.id = ni.server_id
 WHERE s.name = 'tmp-verify-ext-srv';

\echo '--- Смена типа ИС на INTERNAL: модуль следует за ИС ---'
UPDATE information_system SET object_type = 'INTERNAL' WHERE code = 'TMP-VERIFY-EXT';

SELECT code, object_type FROM application_module WHERE code = 'TMP-VERIFY-EXT-MOD';

\echo '--- Смена типа владельца размещения (размещение переводится на кластер) ---'
UPDATE module_deployment
   SET cluster_id = (SELECT c.id FROM cluster c WHERE c.name = 'tmp-verify-ext-clu'),
       server_id  = NULL
 WHERE server_id = (SELECT s.id FROM server s WHERE s.name = 'tmp-verify-ext-srv');

SELECT 'размещение (теперь на кластере EXTERNAL)' AS object, md.object_type
  FROM module_deployment md JOIN cluster c ON c.id = md.cluster_id
 WHERE c.name = 'tmp-verify-ext-clu';

\echo '--- Итог проверки (все проверочные данные откатываются) ---'
SELECT count(*) AS external_objects_left
  FROM application_module am
 WHERE am.code = 'TMP-VERIFY-EXT-MOD' AND am.object_type = 'INTERNAL';

ROLLBACK;
