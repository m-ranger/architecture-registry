-- ============================================================================
-- Аудит изменений объектов реестра — триггеры audit_log (раздел 11)
-- Дата: 03.10.2026
--
-- Фиксируются события создания (INSERT), изменения (UPDATE) и удаления (DELETE)
-- по объектам реестра:
--   information_system      — информационная система
--   application_module      — модуль
--   module_instance         — экземпляр модуля
--   project                 — проект
--   information_flow        — информационный поток
--   information_flow_project — задействованность потока в проекте (связь 1:N,
--                              редактируется вместе с потоком)
--   cluster_network_address — сетевые адреса кластера (адреса развертывания)
--
-- В audit_log попадает полный снимок строки до и после изменения
-- (old_value / new_value, jsonb), поэтому журнал остаётся читаемым и после
-- удаления самого объекта.
--
-- Автор изменения (changed_by) определяется в порядке приоритета:
--   1) app.changed_by — значение транзакции, его выставляет backend из заголовка
--      X-User: SELECT set_config('app.changed_by', $1, true);
--   2) колонки updated_by / created_by изменяемой строки;
--   3) session_user (пользователь соединения с БД).
--
-- Скрипт идемпотентен: его можно применять повторно на существующей базе
-- (CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS).
-- ============================================================================

-- --------------------------------------------------------------------------
-- Универсальная функция аудита: одна на все контролируемые таблицы
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_log() RETURNS trigger AS $$
DECLARE
    v_operation  varchar(20);
    v_old_value  jsonb;
    v_new_value  jsonb;
    v_entity_id  uuid;
    v_changed_by varchar(255);
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_operation := 'INSERT';
        v_new_value := to_jsonb(NEW);
        v_entity_id := NEW.id;

    ELSIF TG_OP = 'UPDATE' THEN
        v_old_value := to_jsonb(OLD);
        v_new_value := to_jsonb(NEW);
        v_entity_id := NEW.id;

        -- updated_at/updated_by проставляет триггер trg_touch_* автоматически.
        -- Если кроме этих служебных полей ничего не изменилось, запись в журнал
        -- не нужна — иначе журнал засоряется «пустыми» изменениями.
        IF (v_new_value - 'updated_at' - 'updated_by')
           = (v_old_value - 'updated_at' - 'updated_by') THEN
            RETURN NULL;
        END IF;
        v_operation := 'UPDATE';

    ELSE -- DELETE
        v_operation := 'DELETE';
        v_old_value := to_jsonb(OLD);
        v_entity_id := OLD.id;
    END IF;

    -- Автор изменения
    v_changed_by := NULLIF(current_setting('app.changed_by', true), '');
    IF v_changed_by IS NULL THEN
        v_changed_by := COALESCE(
            v_new_value ->> 'updated_by', v_new_value ->> 'created_by',
            v_old_value ->> 'updated_by', v_old_value ->> 'created_by',
            session_user
        );
    END IF;

    INSERT INTO audit_log (entity_type, entity_id, operation, changed_by, old_value, new_value)
    VALUES (TG_TABLE_NAME, v_entity_id, v_operation, v_changed_by, v_old_value, v_new_value);

    -- AFTER-триггер: результат не важен, транзакцию не меняем
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_audit_log() IS
    'Универсальный аудит изменений (INSERT/UPDATE/DELETE) в audit_log для таблиц из списка ниже';

-- --------------------------------------------------------------------------
-- Подключение аудита к контролируемым таблицам.
-- Чтобы добавить новый объект в аудит — достаточно дописать имя таблицы
-- в массив audited_tables (у таблицы должно быть поле id uuid).
-- --------------------------------------------------------------------------
DO $$
DECLARE
    t               text;
    audited_tables  text[] := ARRAY[
        'information_system',       -- информационные системы
        'application_module',       -- модули
        'module_instance',          -- экземпляры модулей
        'project',                  -- проекты
        'information_flow',         -- информационные потоки
        'information_flow_project', -- задействованность потока в проекте
        'network_interface'         -- сетевые адреса узлов размещения (в т. ч. кластеров)
    ];
BEGIN
    FOREACH t IN ARRAY audited_tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %1$I', t);
        EXECUTE format(
            'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %1$I
             FOR EACH ROW EXECUTE FUNCTION fn_audit_log()', t);
        RAISE NOTICE 'audit trigger enabled for table %', t;
    END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- Дополнительные индексы под фильтры журнала (тип объекта, операция, автор)
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS ix_audit_log_operation  ON audit_log(operation);
CREATE INDEX IF NOT EXISTS ix_audit_log_changed_by ON audit_log(changed_by);
