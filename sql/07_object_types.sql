-- ============================================================================
-- Миграция 07. Тип объекта: INTERNAL / EXTERNAL
-- Дата: 11.10.2026
-- Назначение: разделить объекты реестра на внутренние (INTERNAL — собственный
-- контур организации) и внешние (EXTERNAL — внешняя сторона: подрядчик, партнёр,
-- внешний сервис, внешняя площадка).
--
-- Тип задаётся пользователем у трёх объектов:
--   information_system — информационная система;
--   server             — сервер;
--   cluster            — кластер.
-- Остальные объекты наследуют признак от родителя (триггеры ниже):
--   application_module <- information_system   (модуль живёт внутри ИС);
--   module_deployment  <- server XOR cluster   (цель размещения);
--   network_interface  <- server / cluster владельца адреса; у адреса
--                         маршрутизатора или МЭ владельца с типом нет — такие
--                         устройства считаются внутренними (INTERNAL).
--
-- Наследуемый тип хранится в колонке (денормализация), а не вычисляется на
-- чтении: списки реестра фильтруются по типу без JOIN, а выборки модуля схем
-- остаются прежними.
--
-- Скрипт идемпотентен: применяется и на пустом volume (колонки создаёт базовая
-- модель 01_ddl.sql, здесь добавляются правила наследования), и на существующей
-- базе.
--
-- Порядок применения на существующей базе:
--   psql -U registry_admin -d architecture_registry -v ON_ERROR_STOP=1 \
--        -f 07_object_types.sql
--   psql ... -f verify_object_types.sql   — самопроверка (по желанию)
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Колонки типа объекта
--    DEFAULT 'INTERNAL' — действующий реестр по умолчанию состоит из
--    внутренних объектов; внешние помечаются явно.
-- --------------------------------------------------------------------------
ALTER TABLE information_system
    ADD COLUMN IF NOT EXISTS object_type varchar(20) NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE server
    ADD COLUMN IF NOT EXISTS object_type varchar(20) NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE cluster
    ADD COLUMN IF NOT EXISTS object_type varchar(20) NOT NULL DEFAULT 'INTERNAL';

-- Наследуемые объекты: значение проставляет триггер, DEFAULT нужен только для
-- строк, попавших в таблицу до применения миграции.
ALTER TABLE application_module
    ADD COLUMN IF NOT EXISTS object_type varchar(20) NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE module_deployment
    ADD COLUMN IF NOT EXISTS object_type varchar(20) NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE network_interface
    ADD COLUMN IF NOT EXISTS object_type varchar(20) NOT NULL DEFAULT 'INTERNAL';

-- Словарь типа: только INTERNAL и EXTERNAL.
ALTER TABLE information_system DROP CONSTRAINT IF EXISTS chk_information_system_object_type;
ALTER TABLE information_system ADD CONSTRAINT chk_information_system_object_type
    CHECK (object_type IN ('INTERNAL','EXTERNAL'));

ALTER TABLE server DROP CONSTRAINT IF EXISTS chk_server_object_type;
ALTER TABLE server ADD CONSTRAINT chk_server_object_type
    CHECK (object_type IN ('INTERNAL','EXTERNAL'));

ALTER TABLE cluster DROP CONSTRAINT IF EXISTS chk_cluster_object_type;
ALTER TABLE cluster ADD CONSTRAINT chk_cluster_object_type
    CHECK (object_type IN ('INTERNAL','EXTERNAL'));

ALTER TABLE application_module DROP CONSTRAINT IF EXISTS chk_application_module_object_type;
ALTER TABLE application_module ADD CONSTRAINT chk_application_module_object_type
    CHECK (object_type IN ('INTERNAL','EXTERNAL'));

ALTER TABLE module_deployment DROP CONSTRAINT IF EXISTS chk_module_deployment_object_type;
ALTER TABLE module_deployment ADD CONSTRAINT chk_module_deployment_object_type
    CHECK (object_type IN ('INTERNAL','EXTERNAL'));

ALTER TABLE network_interface DROP CONSTRAINT IF EXISTS chk_network_interface_object_type;
ALTER TABLE network_interface ADD CONSTRAINT chk_network_interface_object_type
    CHECK (object_type IN ('INTERNAL','EXTERNAL'));


-- --------------------------------------------------------------------------
-- 2. Наследование типа от родителя
--    BEFORE INSERT OR UPDATE на дочерних таблицах: тип всегда равен типу
--    родителя, поэтому «ручное» значение object_type в запросе перекрывается —
--    источник истины один (объект-родитель).
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_object_type_inherit() RETURNS trigger AS $$
DECLARE
    v_type varchar(20);
BEGIN
    IF TG_TABLE_NAME = 'application_module' THEN
        -- Модуль наследует тип своей информационной системы.
        SELECT isys.object_type INTO v_type
          FROM information_system isys
         WHERE isys.id = NEW.information_system_id;

    ELSIF TG_TABLE_NAME = 'module_deployment' THEN
        -- Размещение наследует тип цели размещения: сервера или кластера
        -- (ровно один из них — CHECK chk_module_deployment_xor).
        SELECT s.object_type INTO v_type FROM server  s WHERE s.id = NEW.server_id;
        IF v_type IS NULL THEN
            SELECT c.object_type INTO v_type FROM cluster c WHERE c.id = NEW.cluster_id;
        END IF;

    ELSIF TG_TABLE_NAME = 'network_interface' THEN
        -- Сетевой адрес наследует тип владельца: сервера или кластера.
        -- У адреса маршрутизатора/МЭ владельца с типом нет — устройство
        -- внутреннего контура, поэтому остаётся значение по умолчанию.
        SELECT s.object_type INTO v_type FROM server  s WHERE s.id = NEW.server_id;
        IF v_type IS NULL THEN
            SELECT c.object_type INTO v_type FROM cluster c WHERE c.id = NEW.cluster_id;
        END IF;
    END IF;

    NEW.object_type := COALESCE(v_type, 'INTERNAL');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_object_type_inherit() IS
    'Проставляет object_type дочернего объекта по типу родителя (модуль — ИС, размещение — сервер/кластер, адрес — владелец)';

DROP TRIGGER IF EXISTS trg_object_type_inherit_application_module ON application_module;
CREATE TRIGGER trg_object_type_inherit_application_module
    BEFORE INSERT OR UPDATE ON application_module
    FOR EACH ROW EXECUTE FUNCTION fn_object_type_inherit();

DROP TRIGGER IF EXISTS trg_object_type_inherit_module_deployment ON module_deployment;
CREATE TRIGGER trg_object_type_inherit_module_deployment
    BEFORE INSERT OR UPDATE ON module_deployment
    FOR EACH ROW EXECUTE FUNCTION fn_object_type_inherit();

DROP TRIGGER IF EXISTS trg_object_type_inherit_network_interface ON network_interface;
CREATE TRIGGER trg_object_type_inherit_network_interface
    BEFORE INSERT OR UPDATE ON network_interface
    FOR EACH ROW EXECUTE FUNCTION fn_object_type_inherit();

-- --------------------------------------------------------------------------
-- 3. Пересчёт типа у потомков при смене типа родителя
--    AFTER UPDATE OF object_type: изменение типа ИС, сервера или кластера
--    немедленно отражается на наследниках (модули, размещения, сетевые адреса),
--    поэтому списки, схемы и отчёты читают согласованные данные.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_object_type_propagate() RETURNS trigger AS $$
BEGIN
    IF TG_TABLE_NAME = 'information_system' THEN
        UPDATE application_module
           SET object_type = NEW.object_type
         WHERE information_system_id = NEW.id
           AND object_type IS DISTINCT FROM NEW.object_type;

    ELSIF TG_TABLE_NAME = 'server' THEN
        UPDATE module_deployment
           SET object_type = NEW.object_type
         WHERE server_id = NEW.id
           AND object_type IS DISTINCT FROM NEW.object_type;
        UPDATE network_interface
           SET object_type = NEW.object_type
         WHERE server_id = NEW.id
           AND object_type IS DISTINCT FROM NEW.object_type;

    ELSIF TG_TABLE_NAME = 'cluster' THEN
        UPDATE module_deployment
           SET object_type = NEW.object_type
         WHERE cluster_id = NEW.id
           AND object_type IS DISTINCT FROM NEW.object_type;
        UPDATE network_interface
           SET object_type = NEW.object_type
         WHERE cluster_id = NEW.id
           AND object_type IS DISTINCT FROM NEW.object_type;
    END IF;

    -- AFTER-триггер: транзакцию не меняем, результат не используется
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_object_type_propagate() IS
    'Пересчитывает object_type наследников при смене типа ИС, сервера или кластера';

DROP TRIGGER IF EXISTS trg_object_type_propagate_information_system ON information_system;
CREATE TRIGGER trg_object_type_propagate_information_system
    AFTER UPDATE OF object_type ON information_system
    FOR EACH ROW EXECUTE FUNCTION fn_object_type_propagate();

DROP TRIGGER IF EXISTS trg_object_type_propagate_server ON server;
CREATE TRIGGER trg_object_type_propagate_server
    AFTER UPDATE OF object_type ON server
    FOR EACH ROW EXECUTE FUNCTION fn_object_type_propagate();

DROP TRIGGER IF EXISTS trg_object_type_propagate_cluster ON cluster;
CREATE TRIGGER trg_object_type_propagate_cluster
    AFTER UPDATE OF object_type ON cluster
    FOR EACH ROW EXECUTE FUNCTION fn_object_type_propagate();

-- --------------------------------------------------------------------------
-- 4. Заполнение существующих строк
--    Колонки созданы со значением по умолчанию 'INTERNAL', поэтому пересчёт
--    нужен только там, где тип родителя иной (EXTERNAL). Условие
--    IS DISTINCT FROM оставляет строки без изменений: повторное применение
--    миграции не трогает updated_at и не пишет лишних записей в audit_log.
-- --------------------------------------------------------------------------
WITH inherited AS (
    SELECT am.id,
           COALESCE(isys.object_type, 'INTERNAL') AS object_type
      FROM application_module am
      LEFT JOIN information_system isys ON isys.id = am.information_system_id
)
UPDATE application_module am
   SET object_type = i.object_type
  FROM inherited i
 WHERE i.id = am.id
   AND am.object_type IS DISTINCT FROM i.object_type;

WITH inherited AS (
    SELECT md.id,
           COALESCE(
               (SELECT s.object_type FROM server  s WHERE s.id = md.server_id),
               (SELECT c.object_type FROM cluster c WHERE c.id = md.cluster_id),
               'INTERNAL'
           ) AS object_type
      FROM module_deployment md
)
UPDATE module_deployment md
   SET object_type = i.object_type
  FROM inherited i
 WHERE i.id = md.id
   AND md.object_type IS DISTINCT FROM i.object_type;

WITH inherited AS (
    SELECT ni.id,
           COALESCE(
               (SELECT s.object_type FROM server  s WHERE s.id = ni.server_id),
               (SELECT c.object_type FROM cluster c WHERE c.id = ni.cluster_id),
               'INTERNAL'
           ) AS object_type
      FROM network_interface ni
)
UPDATE network_interface ni
   SET object_type = i.object_type
  FROM inherited i
 WHERE i.id = ni.id
   AND ni.object_type IS DISTINCT FROM i.object_type;

-- --------------------------------------------------------------------------
-- 5. Комментарии к колонкам
-- --------------------------------------------------------------------------
COMMENT ON COLUMN information_system.object_type IS
    'Тип объекта: INTERNAL — собственная система, EXTERNAL — внешняя система';
COMMENT ON COLUMN server.object_type IS
    'Тип объекта: INTERNAL — собственный сервер, EXTERNAL — внешний (подрядчик, партнёр, внешняя площадка)';
COMMENT ON COLUMN cluster.object_type IS
    'Тип объекта: INTERNAL — собственный кластер, EXTERNAL — внешний';
COMMENT ON COLUMN application_module.object_type IS
    'Наследуется от information_system.object_type (триггер trg_object_type_inherit_application_module)';
COMMENT ON COLUMN module_deployment.object_type IS
    'Наследуется от цели размещения: server.object_type или cluster.object_type (триггер trg_object_type_inherit_module_deployment)';
COMMENT ON COLUMN network_interface.object_type IS
    'Наследуется от владельца адреса: server.object_type / cluster.object_type; у маршрутизатора и МЭ — INTERNAL (триггер trg_object_type_inherit_network_interface)';
