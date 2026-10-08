# Скрипты базы данных реестра

Порядок применения совпадает с `Dockerfile`: файлы копируются в
`docker-entrypoint-initdb.d` и выполняются по алфавиту при первом старте на пустом
volume (`pg_data`).

| Файл | Назначение |
|------|------------|
| `01_ddl.sql` | физическая модель реестра v2.0: таблицы, индексы, CHECK-ограничения, триггеры `updated_at` |
| `02_views.sql` | представления `V01`–`V16` (`CREATE OR REPLACE` — безопасно применять повторно) |
| `03_seed_example.sql` | демонстрационные данные реестра (разделы 01–18) |
| `04_audit_triggers.sql` | триггеры аудита `audit_log` (идемпотентны) |
| `05_network_addresses.sql` | миграция модели сетевых адресов развертывания: адрес кластера в `network_interface`, удаление устаревшей таблицы (идемпотентна) |
| `06_seed_addresses.sql` | демонстрационные сетевые адреса серверов и кластеров (идемпотентен) |

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

## Миграция существующей базы

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
