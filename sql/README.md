# Скрипты базы данных реестра

Порядок применения совпадает с `Dockerfile`: файлы копируются в
`docker-entrypoint-initdb.d` и выполняются по алфавиту при первом старте на пустом
volume (`pg_data`).

| Файл | Назначение |
|------|------------|
| `01_ddl.sql` | физическая модель реестра v2.0: таблицы, индексы, именованные CHECK-ограничения, триггеры `updated_at`; порядок колонок и имена объектов совпадают с рабочей базой |
| `02_views.sql` | представления `V01`–`V16` (`CREATE OR REPLACE` — безопасно применять повторно) |
| `03_seed_example.sql` | демонстрационные данные реестра (разделы 01–18) |
| `04_audit_triggers.sql` | триггеры аудита `audit_log` (идемпотентны) |
| `05_network_addresses.sql` | миграция модели сетевых адресов развертывания: адрес кластера в `network_interface`, удаление устаревшей таблицы (идемпотентна) |
| `06_seed_addresses.sql` | демонстрационные сетевые адреса серверов и кластеров (идемпотентен) |
| `07_object_types.sql` | тип объекта `INTERNAL`/`EXTERNAL`: авторитетные таблицы (`information_system`, `server`, `cluster`) и наследование типа потомками (идемпотентна) |

## Схема пустой базы и рабочая база

`01_ddl.sql` описывает **текущее** состояние таблиц: имена ограничений и порядок
колонок совпадают с работающим реестром. Поэтому схема, собранная скриптами `01`–`07`
на пустом volume, равна схеме рабочей базы — кроме таблиц модуля схем
(`architecture_diagram`, `architecture_diagram_element`,
`architecture_diagram_relationship`, `diagram_version`): их создаёт сам модуль из
`architecture-diagrams/server/schema.sql` (`server/migrate.js` при старте).

Проверка «чистая база против рабочей» (образ собирается из `sql/Dockerfile`, поэтому в
него попадают только `01`–`07`; рабочая база и её volume не затрагиваются):

```bash
docker build -t registry-db-check ./sql
docker run -d --name ddl-check -e POSTGRES_DB=architecture_registry \
  -e POSTGRES_USER=registry_admin -e POSTGRES_PASSWORD=registry_pass \
  -v ddl_check_pg:/var/lib/postgresql/data registry-db-check
# дождаться окончания initdb (в логах — "ready for start up"), затем сравнить дампы:
docker exec ddl-check        pg_dump -U registry_admin -d architecture_registry \
  --schema-only --no-owner --no-privileges --no-comments > fresh.sql
docker exec arch-registry-db pg_dump -U registry_admin -d architecture_registry \
  --schema-only --no-owner --no-privileges --no-comments > live.sql
diff fresh.sql live.sql     # ожидается: только объекты модуля схем
docker rm -f ddl-check; docker volume rm ddl_check_pg
```

Если различие шире, `01_ddl.sql` разошёлся с рабочей базой и файл нужно
актуализировать. Именно так был найден отставший триггер
`trg_touch_cluster_network_address`: таблица `cluster_network_address` снята миграцией
`05`, а `01_ddl.sql` продолжал обращаться к ней — на пустом volume initdb падал и
скрипты `02`–`07` не применялись. Тогда же CHECK по `object_type` объявлены явно
(`chk_<таблица>_object_type`, как в `07_object_types.sql`): при безымянном CHECK
PostgreSQL даёт автоимя `<таблица>_object_type_check`, и на свежей базе появлялся
второй, дублирующий CHECK.

## Модель сетевых адресов развертывания

Схема Deployment показывает для каждого информационного потока, с какого адреса
на какой он выполняется, поэтому адрес связан с узлом размещения и хранится в
одной таблице — `network_interface`:

* **владелец адреса** — ровно одно поле: `server_id`, `router_id`, `firewall_id`
  или `cluster_id` (CHECK `chk_network_interface_owner`);
* **адрес сервера** — `ip_address`, `interface_role` (`SERVICE`, `MANAGEMENT`,
  `VIRTUAL`, `BACKUP`, `OTHER`), `environment_id` — среда адреса (`NULL` — адрес
  действует во всех средах узла), `network_segment_id` — контур адреса
  (необязателен);
* **адрес кластера** — тот же `network_interface` с владельцем `cluster_id`:
  у кластера адресов несколько (точка входа, узлы, управление), а роль адреса в
  кластере ограничена словарём `interface_role` (CHECK
  `chk_network_interface_cluster_role`): `INGRESS` — точка входа, `NODE` — узел
  кластера, `MANAGEMENT` — управление;
* `cluster.management_address` сохранён как источник адреса управления, если у
  кластера ещё не заведено ни одного сетевого адреса.

Отдельной сущности «адреса кластера» нет: адрес кластера — это сетевой интерфейс
с владельцем `cluster_id` (страница «Сетевые интерфейсы», раздел меню
«Инфраструктура»).

Представления адресов (раздел `V15`–`V16` в `02_views.sql`):

* `v15_deployment_addresses` — адреса размещений экземпляров модулей по средам;
* `v15a_instance_primary_address` — предпочтительный адрес размещения
  (приоритет роли: `SERVICE` → `INGRESS` → `VIRTUAL` → `NODE` → `MANAGEMENT` →
  прочие, внутри роли — по возрастанию IP);
* `v16_flow_addresses` — информационные потоки с адресами: «с какого адреса на
  какой адрес» выполняется поток в каждой среде.

## Тип объекта: INTERNAL / EXTERNAL

Реестр разделяет объекты на внутренние (`INTERNAL` — собственный контур
организации) и внешние (`EXTERNAL` — подрядчик, партнёр, внешний сервис, внешняя
площадка). Тип задаётся пользователем у трёх объектов:

| Объект | Колонка | Как задаётся |
|--------|---------|--------------|
| `information_system` | `object_type` | выбирается в форме ИС (по умолчанию `INTERNAL`) |
| `server` | `object_type` | выбирается в форме сервера (по умолчанию `INTERNAL`) |
| `cluster` | `object_type` | выбирается в форме кластера (по умолчанию `INTERNAL`) |

Остальные объекты **наследуют** признак от родителя — значение хранится в колонке
`object_type` и пересчитывается триггерами (`07_object_types.sql`), поэтому
«ручное» значение в запросе перекрывается типом родителя:

| Объект | Родитель |
|--------|----------|
| `application_module` | информационная система модуля |
| `module_deployment` | цель размещения: сервер **или** кластер (`server_id XOR cluster_id`) |
| `network_interface` | владелец адреса: сервер или кластер; у адреса маршрутизатора и МЭ владельца с типом нет — устройство считается внутренним (`INTERNAL`) |

Правила:

* триггер `trg_object_type_inherit_*` (`BEFORE INSERT OR UPDATE`) — при создании и
  изменении дочерней строки ставит тип родителя;
* триггер `trg_object_type_propagate_*` (`AFTER UPDATE OF object_type`) — при смене
  типа ИС, сервера или кластера немедленно пересчитывает тип модулей, размещений и
  сетевых адресов;
* словарь значения ограничен CHECK-ограничением `chk_<таблица>_object_type`;
* списки реестра (ИС, модули, размещения, серверы, кластеры, сетевые адреса)
  фильтруются по типу («Все», «Только внутренние», «Только внешние»; по умолчанию —
  «Только внутренние»).

## Миграция существующей базы

`01_ddl.sql` — только для пустого volume: `CREATE TABLE` идут без `IF NOT EXISTS`,
поэтому на существующей базе этот файл **не применяется**; изменения оформляются
отдельным идемпотентным скриптом (`05`–`07`), который можно запускать повторно.

Если база уже создана (volume `pg_data` существует и скрипты `initdb` отработали
ранее), изменения применяются к работающему контейнеру. Порядок важен: миграция
`05` переносит адреса кластеров и удаляет устаревшую таблицу
`cluster_network_address` вместе с читавшими её представлениями, поэтому сразу
после неё применяется `02_views.sql`.

```bash
docker cp sql/05_network_addresses.sql arch-registry-db:/tmp/05.sql
docker exec arch-registry-db psql -U registry_admin -d architecture_registry -v ON_ERROR_STOP=1 -f /tmp/05.sql

docker cp sql/02_views.sql arch-registry-db:/tmp/02.sql
docker exec arch-registry-db psql -U registry_admin -d architecture_registry -v ON_ERROR_STOP=1 -f /tmp/02.sql

docker cp sql/04_audit_triggers.sql arch-registry-db:/tmp/04.sql
docker exec arch-registry-db psql -U registry_admin -d architecture_registry -v ON_ERROR_STOP=1 -f /tmp/04.sql

# демонстрационные адреса развертывания — по желанию
docker cp sql/06_seed_addresses.sql arch-registry-db:/tmp/06.sql
docker exec arch-registry-db psql -U registry_admin -d architecture_registry -v ON_ERROR_STOP=1 -f /tmp/06.sql

# тип объекта INTERNAL/EXTERNAL
docker cp sql/07_object_types.sql arch-registry-db:/tmp/07.sql
docker exec arch-registry-db psql -U registry_admin -d architecture_registry -v ON_ERROR_STOP=1 -f /tmp/07.sql
```

Файл `03_seed_example.sql` очищает таблицы перед загрузкой (в т. ч.
`network_interface`), поэтому после его повторного применения демонстрационные
адреса нужно загрузить снова — `06_seed_addresses.sql`.

## Проверка модели адресов на демонстрационных данных

`verify_addresses.sql` — самопроверка модели: внутри транзакции создаётся временный
информационный поток (runner → AUTH-LAN), проверяются представления `v15a`/`v16`,
запросы адресов серверов и кластеров, а также отсутствие устаревшей таблицы
`cluster_network_address`; затем выполняется `ROLLBACK`, поэтому данные реестра не
меняются.

```bash
docker cp sql/verify_addresses.sql arch-registry-db:/tmp/verify.sql
docker exec arch-registry-db psql -U registry_admin -d architecture_registry -v ON_ERROR_STOP=1 -f /tmp/verify.sql
```

Ожидаемый результат: поток получает адреса `10.10.10.14:443 → 10.10.10.31:8443`
(размещение на сервере `ipkom3-p-app-04`) и `10.10.10.100:443 → 10.10.10.31:8443`
(размещение в кластере `ipkom3k8-prod` — предпочтение отдано адресу точки входа
`INGRESS`, а не узлу `NODE`).

## Проверка типа объекта

`verify_object_types.sql` — самопроверка наследования типа: внутри транзакции
создаётся временный внешний контур (ИС `TMP-VERIFY-EXT`, сервер, кластер), затем
модуль, размещение и сетевые адреса — **без указания типа**; проверяется, что они
получили `EXTERNAL`, а после смены типа родителя на `INTERNAL` тип потомков
пересчитался. Скрипт завершается `ROLLBACK`, данные реестра не меняются.

```bash
docker cp sql/verify_object_types.sql arch-registry-db:/tmp/verify_types.sql
docker exec arch-registry-db psql -U registry_admin -d architecture_registry -v ON_ERROR_STOP=1 -f /tmp/verify_types.sql
```

Ожидаемый результат: в блоке «Наследование» все четыре строки (`модуль (от ИС)`,
`размещение (от сервера)`, `адрес (от сервера)`, `адрес (от кластера)`) имеют тип
`EXTERNAL`; после `UPDATE server SET object_type = 'INTERNAL'` размещение и адрес
показывают `INTERNAL`; модуль следует за своей ИС.
