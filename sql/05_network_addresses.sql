-- ============================================================================
-- Миграция 05. Сетевые адреса развертывания
-- Дата: 08.10.2026
-- Назначение: привести базу к модели адресов, при которой
--   1) адрес узла размещения хранится в network_interface, а владелец задаётся
--      ровно одним полем: server_id / router_id / firewall_id / cluster_id;
--   2) у кластера адресов несколько (точка входа, узлы, управление), роль
--      адреса в кластере — interface_role: INGRESS, NODE, MANAGEMENT;
--   3) адрес может быть привязан к среде (environment_id), сегмент
--      (network_segment_id) не обязателен;
--   4) схемы развертывания (v11/v15/v15a/v16) показывают для каждого
--      информационного потока, с какого адреса на какой он выполняется.
--
-- Отдельная таблица cluster_network_address (первая редакция миграции) удалена
-- как дубль адресной модели: адреса кластеров переносятся в network_interface.
--
-- Скрипт идемпотентен: применяется и на существующей базе (контейнер, где
-- скрипты docker-entrypoint-initdb.d уже отработали), и на пустом volume
-- (Dockerfile копирует его последним — тогда это no-op, так как те же объекты
-- создаёт 01_ddl.sql, а устаревшей таблицы ещё нет).
--
-- Порядок применения на существующей базе:
--   1) psql -f 05_network_addresses.sql   — модель адресов: перенос адресов
--      кластеров в network_interface и удаление устаревшей таблицы;
--   2) psql -f 02_views.sql               — представления v11/v15/v15a/v16
--      (CREATE OR REPLACE; если устаревшая таблица существовала, миграция
--      удаляет читавшие её представления — их пересоздаёт этот шаг);
--   3) psql -f 04_audit_triggers.sql      — аудит (network_interface);
--   4) psql -f 06_seed_addresses.sql      — демонстрационные адреса (опционально).
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. network_interface — адрес узла размещения (server/router/firewall/cluster)
-- --------------------------------------------------------------------------
-- Адрес кластера: роль адреса в кластере задаёт interface_role.
ALTER TABLE network_interface
    ADD COLUMN IF NOT EXISTS cluster_id uuid REFERENCES cluster(id) ON DELETE RESTRICT;

-- Среда адреса: NULL — адрес действует во всех средах узла размещения.
ALTER TABLE network_interface
    ADD COLUMN IF NOT EXISTS environment_id uuid REFERENCES environment(id) ON DELETE RESTRICT;

-- Сегмент не обязателен: адрес сервиса можно завести до описания контура.
ALTER TABLE network_interface
    ALTER COLUMN network_segment_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS ix_network_interface_cluster ON network_interface(cluster_id);
CREATE INDEX IF NOT EXISTS ix_network_interface_env     ON network_interface(environment_id);

-- Ровно один владелец: server XOR router XOR firewall XOR cluster.
ALTER TABLE network_interface DROP CONSTRAINT IF EXISTS chk_network_interface_owner;
ALTER TABLE network_interface ADD CONSTRAINT chk_network_interface_owner CHECK (
    (CASE WHEN server_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN router_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN firewall_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN cluster_id IS NOT NULL THEN 1 ELSE 0 END) = 1
);

-- Роль адреса в кластере — управляемый словарь: INGRESS, NODE, MANAGEMENT.
ALTER TABLE network_interface DROP CONSTRAINT IF EXISTS chk_network_interface_cluster_role;
ALTER TABLE network_interface ADD CONSTRAINT chk_network_interface_cluster_role CHECK (
    cluster_id IS NULL
    OR interface_role IS NULL
    OR interface_role IN ('INGRESS','NODE','MANAGEMENT')
);

COMMENT ON COLUMN network_interface.cluster_id IS
    'Адрес кластера: у кластера адресов несколько (точка входа, узлы, управление)';
COMMENT ON COLUMN network_interface.environment_id IS
    'Среда адреса; NULL — адрес действует во всех средах узла размещения';
COMMENT ON COLUMN network_interface.interface_role IS
    'Роль адреса: устройства — SERVICE/MANAGEMENT/VIRTUAL/BACKUP/OTHER, кластера — INGRESS/NODE/MANAGEMENT';

-- --------------------------------------------------------------------------
-- 2. Перенос адресов кластеров из первой редакции модели
--    Дубль адресной модели удаляется: адрес кластера — тот же network_interface.
--    Роль SERVICE (VIP сервиса) переносится в INGRESS — точку входа кластера.
-- --------------------------------------------------------------------------
DO $$
DECLARE
    v_moved integer;
BEGIN
    IF to_regclass('public.cluster_network_address') IS NULL THEN
        RAISE NOTICE 'cluster_network_address отсутствует — перенос не требуется';
        RETURN;
    END IF;

    INSERT INTO network_interface
        (cluster_id, environment_id, network_segment_id, name, ip_address,
         interface_role, status)
    SELECT cna.cluster_id, cna.environment_id, cna.network_segment_id, cna.name,
           cna.ip_address,
           CASE cna.address_role
               WHEN 'SERVICE'    THEN 'INGRESS'
               WHEN 'INGRESS'    THEN 'INGRESS'
               WHEN 'NODE'       THEN 'NODE'
               WHEN 'MANAGEMENT' THEN 'MANAGEMENT'
               ELSE 'NODE'
           END,
           cna.status
    FROM cluster_network_address cna
    WHERE NOT EXISTS (
        SELECT 1 FROM network_interface ni
         WHERE ni.cluster_id = cna.cluster_id
           AND ni.ip_address = cna.ip_address
    );

    GET DIAGNOSTICS v_moved = ROW_COUNT;
    RAISE NOTICE 'перенесено адресов кластеров: %', v_moved;
END $$;

-- --------------------------------------------------------------------------
-- 3. Удаление устаревшей таблицы адресов кластера
--    Представления v15/v15a/v16 читали её — они пересоздаются в 02_views.sql.
--    На пустом volume (скрипты initdb) таблицы нет, поэтому ничего не удаляется.
-- --------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.cluster_network_address') IS NULL THEN
        RETURN;
    END IF;

    EXECUTE 'DROP VIEW IF EXISTS v16_flow_addresses';
    EXECUTE 'DROP VIEW IF EXISTS v15a_instance_primary_address';
    EXECUTE 'DROP VIEW IF EXISTS v15_deployment_addresses';
    EXECUTE 'DROP TABLE IF EXISTS cluster_network_address';
    RAISE NOTICE 'таблица cluster_network_address удалена — применить 02_views.sql';
END $$;
