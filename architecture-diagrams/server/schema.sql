-- ============================================================================
-- Модуль «Архитектурные схемы» — слой диаграмм (ТЗ §7, §8)
-- Идемпотентный DDL: выполняется сервисом модуля при старте (server/migrate.js).
-- Существующие таблицы реестра не изменяются (ТЗ §19).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Карточка схемы --------------------------------------------------------
CREATE TABLE IF NOT EXISTS architecture_diagram (
    id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    code               varchar(100)  NOT NULL,
    name               varchar(255)  NOT NULL,
    description        text          NULL,
    diagram_type       varchar(30)   NOT NULL
        CHECK (diagram_type IN ('SYSTEM_CONTEXT','CONTAINER','DEPLOYMENT')),
    scope_type         varchar(50)   NOT NULL,
    scope_object_id    uuid          NULL,
    status             varchar(20)   NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
    revision           integer       NOT NULL DEFAULT 1,
    published_version  integer       NULL,
    dependencies_dirty boolean       NOT NULL DEFAULT false,
    created_at         timestamptz   NOT NULL DEFAULT now(),
    created_by         varchar(255)  NOT NULL DEFAULT 'diagram-module',
    updated_at         timestamptz   NOT NULL DEFAULT now(),
    updated_by         varchar(255)  NOT NULL DEFAULT 'diagram-module',
    CONSTRAINT uq_architecture_diagram_code UNIQUE (code)
);

-- 2. Узел схемы ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS architecture_diagram_element (
    id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    diagram_id           uuid          NOT NULL REFERENCES architecture_diagram(id) ON DELETE CASCADE,
    node_key             varchar(100)  NOT NULL,
    registry_object_type varchar(50)   NOT NULL,
    registry_object_id   uuid          NULL,
    c4_type              varchar(40)   NOT NULL,
    parent_key           varchar(100)  NULL,
    label                varchar(255)  NULL,
    technology           varchar(255)  NULL,
    x                    double precision NOT NULL DEFAULT 0,
    y                    double precision NOT NULL DEFAULT 0,
    width                double precision NOT NULL DEFAULT 240,
    height               double precision NOT NULL DEFAULT 100,
    style_json           jsonb         NULL,
    CONSTRAINT uq_architecture_diagram_element UNIQUE (diagram_id, node_key)
);
CREATE INDEX IF NOT EXISTS ix_diagram_element_diagram ON architecture_diagram_element(diagram_id);

-- 3. Связь схемы -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS architecture_diagram_relationship (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    diagram_id          uuid          NOT NULL REFERENCES architecture_diagram(id) ON DELETE CASCADE,
    edge_key            varchar(100)  NOT NULL,
    source_element_id   uuid          NOT NULL REFERENCES architecture_diagram_element(id) ON DELETE CASCADE,
    target_element_id   uuid          NOT NULL REFERENCES architecture_diagram_element(id) ON DELETE CASCADE,
    information_flow_id uuid          NULL,
    label               varchar(255)  NULL,
    technology          varchar(255)  NULL,
    style_json          jsonb         NULL,
    routing_json        jsonb         NULL,
    CONSTRAINT uq_architecture_diagram_relationship UNIQUE (diagram_id, edge_key)
);
CREATE INDEX IF NOT EXISTS ix_diagram_relationship_diagram ON architecture_diagram_relationship(diagram_id);

-- 4. История версий (immutable snapshot) -----------------------------------
CREATE TABLE IF NOT EXISTS diagram_version (
    id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    diagram_id    uuid          NOT NULL REFERENCES architecture_diagram(id) ON DELETE CASCADE,
    version_no    integer       NOT NULL,
    snapshot_json jsonb         NOT NULL,
    created_by    varchar(255)  NOT NULL DEFAULT 'diagram-module',
    created_at    timestamptz   NOT NULL DEFAULT now(),
    status        varchar(20)   NOT NULL DEFAULT 'PUBLISHED',
    CONSTRAINT uq_diagram_version UNIQUE (diagram_id, version_no)
);
CREATE INDEX IF NOT EXISTS ix_diagram_version_diagram
    ON diagram_version(diagram_id, version_no DESC);
