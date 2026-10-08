-- ============================================================================
-- Единый реестр архитектуры ИС — физическая модель PostgreSQL v2.0
-- Дата: 03.10.2026
-- Принципы v2.0:
--   information_flow только на уровне application_module (без instance)
--   technical_flow / NetworkRoute отсутствуют
--   router и firewall — объекты инфраструктуры через network_interface
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- для gen_random_uuid()

-- --------------------------------------------------------------------------
-- 01. information_system
-- --------------------------------------------------------------------------
CREATE TABLE information_system (
    id          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    code        varchar(50)     NOT NULL,
    name        varchar(255)    NOT NULL,
    description text            NULL,
    status      varchar(30)     NOT NULL CHECK (status IN ('PLANNED','ACTIVE','RETIRED')),
    owner       varchar(255)    NULL,
    created_at  timestamptz     NOT NULL DEFAULT now(),
    created_by  varchar(255)    NOT NULL,
    updated_at  timestamptz     NOT NULL DEFAULT now(),
    updated_by  varchar(255)    NOT NULL,
    CONSTRAINT uq_information_system_code UNIQUE (code)
);

-- --------------------------------------------------------------------------
-- 02. application_module
-- --------------------------------------------------------------------------
CREATE TABLE application_module (
    id                      uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    information_system_id   uuid            NOT NULL REFERENCES information_system(id) ON DELETE RESTRICT,
    code                    varchar(100)    NOT NULL,
    name                    varchar(255)    NOT NULL,
    purpose                 text            NOT NULL,
    module_type             varchar(50)     NULL CHECK (module_type IN ('FRONTEND','BACKEND','API','INTEGRATION','DATABASE','BATCH','ADAPTER')),
    version                 varchar(100)    NULL,
    status                  varchar(30)     NOT NULL CHECK (status IN ('PLANNED','ACTIVE','RETIRED')),
    created_at              timestamptz     NOT NULL DEFAULT now(),
    created_by              varchar(255)    NOT NULL,
    updated_at              timestamptz     NOT NULL DEFAULT now(),
    updated_by              varchar(255)    NOT NULL,
    CONSTRAINT uq_application_module_is_code UNIQUE (information_system_id, code)
);

-- --------------------------------------------------------------------------
-- 03. environment — не смешивается с network_zone
-- --------------------------------------------------------------------------
CREATE TABLE environment (
    id          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    code        varchar(50)     NOT NULL,
    name        varchar(255)    NOT NULL,
    description text            NULL,
    criticality varchar(30)     NULL,
    status      varchar(30)     NOT NULL CHECK (status IN ('PLANNED','ACTIVE','RETIRED')),
    created_at  timestamptz     NOT NULL DEFAULT now(),
    updated_at  timestamptz     NOT NULL DEFAULT now(),
    CONSTRAINT uq_environment_code UNIQUE (code)
);

-- --------------------------------------------------------------------------
-- 04. module_instance — принадлежит ровно одной среде
-- --------------------------------------------------------------------------
CREATE TABLE module_instance (
    id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id       uuid            NOT NULL REFERENCES application_module(id) ON DELETE RESTRICT,
    environment_id  uuid            NOT NULL REFERENCES environment(id) ON DELETE RESTRICT,
    name            varchar(255)    NOT NULL,
    version         varchar(100)    NULL,
    runtime_type    varchar(50)     NULL,
    status          varchar(30)     NOT NULL CHECK (status IN ('PLANNED','ACTIVE','RETIRED')),
    description     text            NULL,
    created_at      timestamptz     NOT NULL DEFAULT now(),
    updated_at      timestamptz     NOT NULL DEFAULT now(),
    CONSTRAINT uq_module_instance_module_env_name UNIQUE (module_id, environment_id, name)
);
CREATE INDEX ix_module_instance_module_id      ON module_instance(module_id);
CREATE INDEX ix_module_instance_environment_id ON module_instance(environment_id);

-- --------------------------------------------------------------------------
-- 05. server — IP хранятся в network_interface (multi-homing)
-- --------------------------------------------------------------------------
CREATE TABLE server (
    id          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    name        varchar(255)    NOT NULL,
    server_type varchar(50)     NULL,
    status      varchar(30)     NOT NULL CHECK (status IN ('PLANNED','ACTIVE','RETIRED')),
    description text            NULL,
    created_at  timestamptz     NOT NULL DEFAULT now(),
    updated_at  timestamptz     NOT NULL DEFAULT now(),
    CONSTRAINT uq_server_name UNIQUE (name)
);

-- --------------------------------------------------------------------------
-- 06. cluster — без обязательной привязки к среде
-- --------------------------------------------------------------------------
CREATE TABLE cluster (
    id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    name                varchar(255)    NOT NULL,
    cluster_type        varchar(50)     NOT NULL,
    version             varchar(100)    NULL,
    management_address  varchar(255)    NULL,
    status              varchar(30)     NOT NULL CHECK (status IN ('PLANNED','ACTIVE','RETIRED')),
    description         text            NULL,
    created_at          timestamptz     NOT NULL DEFAULT now(),
    updated_at          timestamptz     NOT NULL DEFAULT now(),
    CONSTRAINT uq_cluster_name UNIQUE (name)
);

-- --------------------------------------------------------------------------
-- 07. module_deployment — факт размещения (1:N), ровно один из server/cluster
-- --------------------------------------------------------------------------
CREATE TABLE module_deployment (
    id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    module_instance_id  uuid            NOT NULL REFERENCES module_instance(id) ON DELETE RESTRICT,
    server_id           uuid            NULL REFERENCES server(id) ON DELETE RESTRICT,
    cluster_id          uuid            NULL REFERENCES cluster(id) ON DELETE RESTRICT,
    deployment_role     varchar(50)     NULL CHECK (deployment_role IN ('PRIMARY','SECONDARY','REPLICA','ACTIVE','PASSIVE','SERVICE')),
    deployment_state    varchar(30)     NOT NULL CHECK (deployment_state IN ('ACTIVE','STANDBY','RETIRED')),
    valid_from          timestamptz     NULL,
    valid_to            timestamptz     NULL,
    created_at          timestamptz     NOT NULL DEFAULT now(),
    updated_at          timestamptz     NOT NULL DEFAULT now(),
    CONSTRAINT chk_module_deployment_xor CHECK (
        (server_id IS NOT NULL AND cluster_id IS NULL) OR
        (server_id IS NULL AND cluster_id IS NOT NULL)
    ),
    CONSTRAINT chk_module_deployment_period CHECK (
        valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from
    )
);
CREATE INDEX ix_module_deployment_instance ON module_deployment(module_instance_id);
CREATE INDEX ix_module_deployment_server   ON module_deployment(server_id);
CREATE INDEX ix_module_deployment_cluster  ON module_deployment(cluster_id);


-- --------------------------------------------------------------------------
-- 08. network_zone — иерархия без циклов
-- --------------------------------------------------------------------------
CREATE TABLE network_zone (
    id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    code            varchar(50)     NOT NULL,
    name            varchar(255)    NOT NULL,
    zone_type       varchar(50)     NULL,
    security_level  varchar(50)     NULL,
    parent_id       uuid            NULL REFERENCES network_zone(id) ON DELETE RESTRICT,
    description     text            NULL,
    status          varchar(30)     NOT NULL CHECK (status IN ('PLANNED','ACTIVE','RETIRED')),
    CONSTRAINT uq_network_zone_code UNIQUE (code),
    CONSTRAINT chk_network_zone_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE OR REPLACE FUNCTION fn_network_zone_no_cycle() RETURNS trigger AS $$
DECLARE cur uuid := NEW.parent_id; depth int := 0;
BEGIN
    IF cur IS NULL THEN RETURN NEW; END IF;
    WHILE cur IS NOT NULL LOOP
        IF cur = NEW.id THEN RAISE EXCEPTION 'Cyclic hierarchy in network_zone: % is ancestor of itself', NEW.id; END IF;
        SELECT parent_id INTO cur FROM network_zone WHERE id = cur;
        depth := depth + 1;
        IF depth > 100 THEN RAISE EXCEPTION 'network_zone hierarchy too deep or cyclic at %', NEW.id; END IF;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_network_zone_no_cycle ON network_zone;
CREATE TRIGGER trg_network_zone_no_cycle BEFORE INSERT OR UPDATE OF parent_id ON network_zone
    FOR EACH ROW EXECUTE FUNCTION fn_network_zone_no_cycle();

-- --------------------------------------------------------------------------
-- 09. network_segment — принадлежит одной зоне
-- --------------------------------------------------------------------------
CREATE TABLE network_segment (
    id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    network_zone_id uuid            NOT NULL REFERENCES network_zone(id) ON DELETE RESTRICT,
    code            varchar(50)     NOT NULL,
    name            varchar(255)    NOT NULL,
    cidr            cidr            NULL,
    vlan            integer         NULL CHECK (vlan BETWEEN 1 AND 4094),
    purpose         varchar(255)    NULL,
    status          varchar(30)     NOT NULL CHECK (status IN ('PLANNED','ACTIVE','RETIRED')),
    CONSTRAINT uq_network_segment_code UNIQUE (code)
);
CREATE INDEX ix_network_segment_zone ON network_segment(network_zone_id);

-- --------------------------------------------------------------------------
-- 10. router
-- --------------------------------------------------------------------------
CREATE TABLE router (
    id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    name                varchar(255)    NOT NULL,
    device_type         varchar(50)     NULL,
    vendor              varchar(100)    NULL,
    model               varchar(100)    NULL,
    management_address  inet            NULL,
    status              varchar(30)     NOT NULL CHECK (status IN ('PLANNED','ACTIVE','RETIRED')),
    description         text            NULL,
    CONSTRAINT uq_router_name UNIQUE (name)
);

-- --------------------------------------------------------------------------
-- 11. firewall
-- --------------------------------------------------------------------------
CREATE TABLE firewall (
    id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    name                varchar(255)    NOT NULL,
    firewall_type       varchar(50)     NULL,
    vendor              varchar(100)    NULL,
    model               varchar(100)    NULL,
    management_address  inet            NULL,
    status              varchar(30)     NOT NULL CHECK (status IN ('PLANNED','ACTIVE','RETIRED')),
    description         text            NULL,
    CONSTRAINT uq_firewall_name UNIQUE (name)
);

-- --------------------------------------------------------------------------
-- 12. network_interface — владелец ровно один из server/router/firewall
-- --------------------------------------------------------------------------
CREATE TABLE network_interface (
    id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id           uuid            NULL REFERENCES server(id) ON DELETE RESTRICT,
    router_id           uuid            NULL REFERENCES router(id) ON DELETE RESTRICT,
    firewall_id         uuid            NULL REFERENCES firewall(id) ON DELETE RESTRICT,
    network_segment_id  uuid            NOT NULL REFERENCES network_segment(id) ON DELETE RESTRICT,
    name                varchar(255)    NOT NULL,
    ip_address          inet            NULL,
    mac_address         varchar(32)     NULL,
    interface_role      varchar(50)     NULL,
    status              varchar(30)     NOT NULL CHECK (status IN ('PLANNED','ACTIVE','RETIRED')),
    CONSTRAINT chk_network_interface_owner CHECK (
        (CASE WHEN server_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN router_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN firewall_id IS NOT NULL THEN 1 ELSE 0 END) = 1
    )
);
CREATE INDEX ix_network_interface_server   ON network_interface(server_id);
CREATE INDEX ix_network_interface_router   ON network_interface(router_id);
CREATE INDEX ix_network_interface_firewall ON network_interface(firewall_id);
CREATE INDEX ix_network_interface_segment  ON network_interface(network_segment_id);
CREATE INDEX ix_network_interface_ip       ON network_interface USING gist (ip_address inet_ops);

-- --------------------------------------------------------------------------
-- 13. protocol — справочник
-- --------------------------------------------------------------------------
CREATE TABLE protocol (
    id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    code            varchar(50)     NOT NULL,
    name            varchar(100)    NOT NULL,
    transport       varchar(20)     NULL,
    layer           varchar(20)     NULL,
    default_port    integer         NULL CHECK (default_port BETWEEN 1 AND 65535),
    description     text            NULL,
    status          varchar(30)     NOT NULL CHECK (status IN ('ACTIVE','RETIRED')),
    CONSTRAINT uq_protocol_code UNIQUE (code)
);

-- --------------------------------------------------------------------------
-- 14. information_flow — логический поток между модулями (без instance)
-- --------------------------------------------------------------------------
CREATE TABLE information_flow (
    id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    code                varchar(100)    NOT NULL,
    name                varchar(255)    NOT NULL,
    source_module_id    uuid            NOT NULL REFERENCES application_module(id) ON DELETE RESTRICT,
    target_module_id    uuid            NOT NULL REFERENCES application_module(id) ON DELETE RESTRICT,
    protocol_id         uuid            NOT NULL REFERENCES protocol(id) ON DELETE RESTRICT,
    target_port         integer         NULL CHECK (target_port BETWEEN 1 AND 65535),
    source_port         integer         NULL CHECK (source_port BETWEEN 1 AND 65535),
    description         text            NULL,
    status              varchar(30)     NOT NULL CHECK (status IN ('PLANNED','ACTIVE','RETIRED')),
    valid_from          timestamptz     NULL,
    valid_to            timestamptz     NULL,
    created_at          timestamptz     NOT NULL DEFAULT now(),
    created_by          varchar(255)    NOT NULL,
    updated_at          timestamptz     NOT NULL DEFAULT now(),
    updated_by          varchar(255)    NOT NULL,
    CONSTRAINT uq_information_flow_code UNIQUE (code),
    CONSTRAINT chk_information_flow_not_self CHECK (source_module_id <> target_module_id),
    CONSTRAINT chk_information_flow_period CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from)
);
CREATE INDEX ix_information_flow_source     ON information_flow(source_module_id);
CREATE INDEX ix_information_flow_target     ON information_flow(target_module_id);
CREATE INDEX ix_information_flow_protocol   ON information_flow(protocol_id);
CREATE INDEX ix_information_flow_proto_port ON information_flow(protocol_id, target_port);

-- --------------------------------------------------------------------------
-- 15. audit_log — журнал изменений критичных объектов
-- --------------------------------------------------------------------------
CREATE TABLE audit_log (
    id          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type varchar(100)    NOT NULL,
    entity_id   uuid            NOT NULL,
    operation   varchar(20)     NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
    changed_at  timestamptz     NOT NULL DEFAULT now(),
    changed_by  varchar(255)    NULL,
    old_value   jsonb           NULL,
    new_value   jsonb           NULL
);
CREATE INDEX ix_audit_log_entity     ON audit_log(entity_type, entity_id);
CREATE INDEX ix_audit_log_changed_at ON audit_log(changed_at);

-- --------------------------------------------------------------------------
-- 16. project — проект как объект реестра: Номер проекта (code) + Наименование (name)
-- --------------------------------------------------------------------------
CREATE TABLE project (
    id          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    code        varchar(50)     NOT NULL,   -- Номер проекта
    name        varchar(255)    NOT NULL,   -- Наименование проекта
    description text            NULL,
    status      varchar(30)     NOT NULL CHECK (status IN ('PLANNED','ACTIVE','RETIRED')),
    created_at  timestamptz     NOT NULL DEFAULT now(),
    created_by  varchar(255)    NOT NULL,
    updated_at  timestamptz     NOT NULL DEFAULT now(),
    updated_by  varchar(255)    NOT NULL,
    CONSTRAINT uq_project_code UNIQUE (code)
);

-- --------------------------------------------------------------------------
-- 17. information_flow_project — задействованность информационного потока
--     в проектах (отношение 1:N: у потока — список проектов).
--     Пересечение потоков и проектов, поэтому уникальна пара (flow, project).
-- --------------------------------------------------------------------------
CREATE TABLE information_flow_project (
    id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    information_flow_id uuid            NOT NULL REFERENCES information_flow(id) ON DELETE CASCADE,
    project_id          uuid            NOT NULL REFERENCES project(id) ON DELETE RESTRICT,
    created_at          timestamptz     NOT NULL DEFAULT now(),
    created_by          varchar(255)    NOT NULL,
    CONSTRAINT uq_information_flow_project UNIQUE (information_flow_id, project_id)
);
CREATE INDEX ix_information_flow_project_flow    ON information_flow_project(information_flow_id);
CREATE INDEX ix_information_flow_project_project ON information_flow_project(project_id);

-- --------------------------------------------------------------------------
-- Триггеры updated_at
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_information_system ON information_system;
CREATE TRIGGER trg_touch_information_system BEFORE UPDATE ON information_system FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_application_module ON application_module;
CREATE TRIGGER trg_touch_application_module BEFORE UPDATE ON application_module FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_environment ON environment;
CREATE TRIGGER trg_touch_environment BEFORE UPDATE ON environment FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_module_instance ON module_instance;
CREATE TRIGGER trg_touch_module_instance BEFORE UPDATE ON module_instance FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_module_deployment ON module_deployment;
CREATE TRIGGER trg_touch_module_deployment BEFORE UPDATE ON module_deployment FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_server ON server;
CREATE TRIGGER trg_touch_server BEFORE UPDATE ON server FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_cluster ON cluster;
CREATE TRIGGER trg_touch_cluster BEFORE UPDATE ON cluster FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_information_flow ON information_flow;
CREATE TRIGGER trg_touch_information_flow BEFORE UPDATE ON information_flow FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_project ON project;
CREATE TRIGGER trg_touch_project BEFORE UPDATE ON project FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();


