# Образ PostgreSQL с предзагруженной схемой "Единого реестра архитектуры ИС" v2.0.
# Скрипты из docker-entrypoint-initdb.d выполняются один раз при первом старте
# на пустом volume, строго по алфавиту:
#   01_ddl.sql -> 02_views.sql -> 03_seed_example.sql -> 04_audit_triggers.sql.
# 04_audit_triggers.sql подключается последним: триггеры аудита не должны
# фиксировать загрузку демонстрационных данных.
FROM postgres:16-alpine

LABEL maintainer="architecture-registry" \
      description="PostgreSQL backend for Bank IT Architecture Registry v2.0"

COPY 01_ddl.sql          /docker-entrypoint-initdb.d/01_ddl.sql
COPY 02_views.sql        /docker-entrypoint-initdb.d/02_views.sql
COPY 03_seed_example.sql /docker-entrypoint-initdb.d/03_seed_example.sql
COPY 04_audit_triggers.sql /docker-entrypoint-initdb.d/04_audit_triggers.sql

