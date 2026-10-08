-- ============================================================================
-- Seed-данные "Единый реестр архитектуры ИС" v2.0
-- Источник данных: фактическое состояние БД architecture_registry контейнера arch-registry-db
-- (PostgreSQL 16.15, снимок от 08.10.2026). Разделы 01-17 повторяют реальные данные реестра.
-- Скрипт идемпотентен: таблицы очищаются перед загрузкой.
-- При повторном применении на базе, где уже подключены триггеры аудита (04_audit_triggers.sql),
-- в audit_log дополнительно попадают записи о самой загрузке — штатная работа аудита,
-- состав бизнес-данных от этого не меняется (при первом старте триггеры подключаются после сида).
--
-- Разделы 01-17 — реестровые таблицы, их создаёт 01_ddl.sql.
-- Сетевые адреса развертывания (адреса серверов и кластеров) вынесены в
-- 06_seed_addresses.sql: тот же файл применяется и к уже загруженной базе,
-- поэтому демонстрационные адреса описаны в одном месте.
-- Раздел 18 — данные модуля «Архитектурные схемы»: таблицы этого слоя создаёт сам
-- модуль (architecture-diagrams/server/schema.sql при старте сервиса), поэтому при
-- первом старте БД на пустом volume их ещё нет и раздел пропускается.
-- ============================================================================

TRUNCATE TABLE
    audit_log, information_flow_project, information_flow, network_interface,
    firewall, router, network_segment, network_zone,
    module_deployment, module_instance, cluster, server, protocol, project,
    application_module, environment, information_system
RESTART IDENTITY CASCADE;

-- --------------------------------------------------------------------------
-- 01. Information Systems (8 rows)
-- --------------------------------------------------------------------------
INSERT INTO information_system (id, code, name, description, status, owner, created_at, created_by, updated_at, updated_by) VALUES
    ('3b13ee35-d5aa-439f-88a3-0974e09c9812', 'ADS', 'Adinsure ', NULL, 'ACTIVE', 'Маликова Светлана', '2026-10-07T15:51:33Z', 'api-user', '2026-10-07T15:52:02Z', 'api-user'),
    ('510785dd-3bf2-4cb8-87dd-89b070dc8219', 'CRYPT', 'CryptoРro', NULL, 'PLANNED', 'Пономаренко Вадим', '2026-10-07T15:55:06Z', 'api-user', '2026-10-07T15:55:06Z', 'api-user'),
    ('7998b032-cc4f-472e-8b2f-5f02251aa7b7', 'LKK2', 'Личный кабинет 2.0', 'Личный кабинет клиента версия 1', 'ACTIVE', 'Палладий Мария/Вирту', '2026-10-05T14:29:48Z', 'api-user', '2026-10-07T15:55:20Z', 'api-user'),
    ('9ec66dab-8ec9-4bd0-90e3-26d809cf0022', 'NFS', 'NFS Adinsure', NULL, 'ACTIVE', 'Земляков Андрей', '2026-10-07T15:53:40Z', 'api-user', '2026-10-07T15:53:40Z', 'api-user'),
    ('9fb58746-f15d-46de-8858-2f7baa0723aa', 'ipkom3', 'Интеграционная платформа', 'Интеграционная платформа К3', 'ACTIVE', 'ООО "Ком3"', '2026-10-05T12:54:10Z', 'm.ovchinnikov', '2026-10-05T12:54:10Z', 'm.ovchinnikov'),
    ('c608b018-fdc1-4bc3-85c9-cb86caacccee', 'MAIL', 'mail.life.rgs.local', NULL, 'ACTIVE', NULL, '2026-10-07T15:59:42Z', 'api-user', '2026-10-07T15:59:42Z', 'api-user'),
    ('cea11c33-a82c-4f9e-9385-a53ab1549137', 'LKK1', 'Личный кабинет 1.0', NULL, 'ACTIVE', 'Жидков Дмитрий', '2026-10-07T15:55:46Z', 'api-user', '2026-10-07T15:55:46Z', 'api-user'),
    ('f68437f5-1463-455b-b10f-9f0b2d6cf909', 'AUTH', 'KeyCloak', NULL, 'ACTIVE', 'ООО "Ком3"', '2026-10-07T19:21:12Z', 'api-user', '2026-10-07T19:21:12Z', 'api-user');
-- --------------------------------------------------------------------------
-- 02. Environments (4 rows)
-- --------------------------------------------------------------------------
INSERT INTO environment (id, code, name, description, criticality, status, created_at, updated_at) VALUES
    ('22222222-2222-2222-2222-000000000001', 'DEV', 'Development', 'Среда разработки', 'LOW', 'ACTIVE', '2026-10-05T10:56:53Z', '2026-10-08T11:05:02Z'),
    ('22222222-2222-2222-2222-000000000002', 'TEST', 'Test', 'Среда тестирования', 'MEDIUM', 'ACTIVE', '2026-10-05T10:56:53Z', '2026-10-08T11:05:02Z'),
    ('22222222-2222-2222-2222-000000000003', 'QUA', 'Quality Assurance', 'Среда приемочного тестирования', 'HIGH', 'ACTIVE', '2026-10-05T10:56:53Z', '2026-10-08T11:05:02Z'),
    ('22222222-2222-2222-2222-000000000004', 'PROD', 'Production', 'Промышленная среда', 'CRITICAL', 'ACTIVE', '2026-10-05T10:56:53Z', '2026-10-08T11:05:02Z');
-- --------------------------------------------------------------------------
-- 03. Application Modules (8 rows)
-- --------------------------------------------------------------------------
INSERT INTO application_module (id, information_system_id, code, name, purpose, module_type, version, status, created_at, created_by, updated_at, updated_by) VALUES
    ('051df149-00bb-4af9-9688-abcfcbbecbc9', '3b13ee35-d5aa-439f-88a3-0974e09c9812', 'ADS-APP', 'Сервер приложения Adinsure', 'Сервер приложения Adinsure', NULL, NULL, 'ACTIVE', '2026-10-07T18:29:28Z', 'api-user', '2026-10-07T18:29:28Z', 'api-user'),
    ('1fa0616d-12a0-48dd-a94b-220a2e4403c9', 'f68437f5-1463-455b-b10f-9f0b2d6cf909', 'AUTH-DMZ', 'Сервер Аутентификации DMZ', 'Сервер Аутентификации DMZ', NULL, NULL, 'ACTIVE', '2026-10-07T19:22:53Z', 'api-user', '2026-10-07T19:22:53Z', 'api-user'),
    ('497a85a9-0d65-4d40-b1f5-61fde440ecaf', '510785dd-3bf2-4cb8-87dd-89b070dc8219', 'CRYPT1', 'Сервер CryptoPro', 'Получение файлов реестров', NULL, NULL, 'PLANNED', '2026-10-07T18:35:37Z', 'api-user', '2026-10-07T18:35:54Z', 'api-user'),
    ('53da05aa-9ad6-4831-b5c6-f3a1ec45f9bf', '9fb58746-f15d-46de-8858-2f7baa0723aa', 'runner', 'runner', 'Модуль исполнения интеграционных процессов', NULL, NULL, 'ACTIVE', '2026-10-05T13:42:27Z', 'm.ovchinnikov', '2026-10-05T13:42:27Z', 'm.ovchinnikov'),
    ('808f068c-f755-4a88-bef1-a3218851c0fd', 'f68437f5-1463-455b-b10f-9f0b2d6cf909', 'AUTH-LAN', 'Сервер Аутентификации', 'Сервер Аутентификации', NULL, NULL, 'PLANNED', '2026-10-07T19:22:18Z', 'api-user', '2026-10-07T19:22:18Z', 'api-user'),
    ('b921355f-40aa-4f99-aa7e-22db620b405d', 'c608b018-fdc1-4bc3-85c9-cb86caacccee', 'MAIL', 'Почтовый сервер', 'Почтовый сервер', NULL, NULL, 'ACTIVE', '2026-10-07T18:27:30Z', 'api-user', '2026-10-07T18:27:30Z', 'api-user'),
    ('bb20da52-4a0c-4ab2-baf9-e4ebc79c66e0', '7998b032-cc4f-472e-8b2f-5f02251aa7b7', 'test lkk', 'ЛКК-Фронтенд', 'ЛКК-Фронтенд', NULL, NULL, 'RETIRED', '2026-10-05T19:13:31Z', 'api-user', '2026-10-05T19:13:31Z', 'api-user'),
    ('d3277b4f-98ae-4cae-9717-ce7859da900b', '9ec66dab-8ec9-4bd0-90e3-26d809cf0022', 'NFS', 'Хранение файлов', 'Хранение файлов для ФНС', NULL, NULL, 'PLANNED', '2026-10-07T18:26:36Z', 'api-user', '2026-10-07T18:26:36Z', 'api-user');
-- --------------------------------------------------------------------------
-- 04. Servers (44 rows)
-- --------------------------------------------------------------------------
INSERT INTO server (id, name, server_type, status, description, created_at, updated_at) VALUES
    ('00e2eeb4-415b-4b9b-b0e1-fdc2ecc585f5', 'ipkom3-p-app-10', NULL, 'ACTIVE', 'Интеграционная платформа К3. Сервис SMS', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('0f9bcaee-7dce-4bf4-9073-dee60adb308d', 'ipkom3-t-app-02 ', NULL, 'ACTIVE', 'Интеграционная платформа К3', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('13e4992e-2bfd-46cf-beef-3f647f9aabad', 'VRL-K3AUTHDB01', NULL, 'ACTIVE', 'Сервер БД аутентификации', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('16fee6cb-f031-4e77-8b8e-dccdc87e468d', 'ipkom3-p-app-18 ', NULL, 'ACTIVE', 'Сервер аутентификации DMZ', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('1cf4da2a-409a-4496-b326-caba8e36dceb', 'ipkom3-p-app-14 ', NULL, 'ACTIVE', 'Интеграционная платформа К3', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('1f25d951-93bf-442c-b243-3640b7c11f3c', 'ocrkom3-t-dbrain-01 ', NULL, 'ACTIVE', 'Верификация. Сервер распознавания', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('3d7cb8cf-3a84-4d64-9562-b01739753eed', 'ipkom3-pr-app-04 ', NULL, 'ACTIVE', 'Интеграционная платформа К3. Сервис SMS', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('455125b5-afd1-4f2d-84bc-43d195925f6e', 'ipkom3-pr-app-03', NULL, 'ACTIVE', 'Интеграционная платформа К3. Сервис лендинга', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('4d55d74a-b1b6-4bdb-beb5-d9ffad3e07cc', 'VТL-К3AUTHDB01', NULL, 'ACTIVE', 'Сервер БД аутентификации', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('516342da-d03e-4aaf-a767-5d2395cc0181', 'ocrkom3-p-db-01', NULL, 'ACTIVE', 'Верификация. Сервер хранения', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('529179a0-7892-47fa-a1de-ca741ce28a95', 'ipkom3-pr-rds-1', NULL, 'ACTIVE', 'Интеграционная платформа К3 Сервер кеширования', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('5608095b-26a2-4af1-9392-1871b3eef1ab', 'ipkom3-p-rds-01 ', NULL, 'ACTIVE', 'Интеграционная платформа К3 Сервер кеширования', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('5ce430d1-f63e-4ba5-aff5-6e24e005bf5a', 'ipkom3-p-app-07', NULL, 'ACTIVE', 'Интеграционная платформа К3. Сервис лендинга', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('5eb47257-8822-4b2b-a19a-8e241c305c8e', 'ipkom3-t-rds-01', NULL, 'ACTIVE', 'Интеграционная платформа К3 Сервер кеширования', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('64880094-dc2a-4752-be03-9a68acb30669', 'ocrkom3-p-dbrain-01', NULL, 'ACTIVE', 'Верификация. Сервер распознавания', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('652a7ca6-4676-49c3-9395-533e253ff2e1', 'ipkom3-p-app-17 ', NULL, 'ACTIVE', 'Интеграционная платформа К3', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('668dc7bd-5de9-419c-aefd-45fc8d85635e', 'vtl-kom3auth01 ', NULL, 'ACTIVE', 'Сервер аутентификации', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('674981a2-9c35-42bd-be9d-7bbf3b064b67', 'ipkom3-p-rds-03 ', NULL, 'ACTIVE', 'Интеграционная платформа К3 Сервер кеширования', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('676b700a-9261-4875-af66-d22d3f28149c', 'ipkom3-t-app-04', NULL, 'ACTIVE', 'Интеграционная платформа К3. Сервис SMS', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('74f7cfc7-4427-4f5b-96ea-132fd752de43', 'ocrkom3-t-app-01', NULL, 'ACTIVE', 'Верификация. Сервер приложения', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('8213124c-fa8d-44f0-b328-70b9b1db6b78', 'ipkom3-t-app', NULL, 'ACTIVE', 'Интеграционная платформа К3', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('82247a33-dbc1-44a2-8bd1-19c12e5cb78f', 'ipkom3-p-migr-1 ', NULL, 'ACTIVE', 'Интеграционная платформа К3. Среда миграции', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('85157af1-ffb8-42b2-9c89-64c812d30635', 'ipkom3-t-migr-1 ', NULL, 'ACTIVE', 'Интеграционная платформа К3. Среда миграции', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('8f94b5b6-f952-4169-b2f8-a9bd472a63c1', 'ipkom3-p-app-13 ', NULL, 'ACTIVE', 'Интеграционная платформа К3', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('9da21806-9eb5-46a8-ba83-6f3e3041d9bc', 'vpl-kom3auth01 ', NULL, 'ACTIVE', 'Сервер аутентификации', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('a53cccd8-d3c0-49d0-ac4d-3c61b9f9bd42', 'ipkom3-p-app-09', NULL, 'ACTIVE', 'Интеграционная платформа К3. Сервис SMS', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('b3c301b8-512d-4fa3-9dc7-1dd768feef1a', 'ipkom3-pr-app', NULL, 'ACTIVE', 'Интеграционная платформа К3', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('b7232f9b-cb8f-494b-b3d7-2f75a13e90c3', 'ipkom3-p-app-06', NULL, 'ACTIVE', 'Интеграционная платформа К3', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('b9e07e3e-7f14-4de0-8dc9-0c92a4821c3f', 'ipkom3-t-app-03', NULL, 'ACTIVE', 'Интеграционная платформа К3. Сервис лендинга', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('c5a715b1-cbc6-45b0-9dd1-682cb244b0b6', 'ocrkom3-p-app-01 ', NULL, 'ACTIVE', 'Верификация. Сервер приложения', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('c6c49745-6539-474e-ae16-a93bb99facbd', 'VPL-K3AUTHDB01', NULL, 'ACTIVE', 'Сервер БД аутентификации DMZ', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('cc4b8774-d744-45c9-8dae-c97e0cf90e3d', 'ipkom3-p-app', NULL, 'ACTIVE', 'Интеграционная платформа К3', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('df63ae0b-1058-4304-9703-1327f7b09f9d', 'ipkom3-d-prd-01 ', NULL, 'ACTIVE', 'Интеграционная платформа К3 Внешний сервер лендинга', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('e0802688-364f-4e30-a6fb-8f17d5e9c967', 'ipkom3-p-app-12 ', NULL, 'ACTIVE', 'Интеграционная платформа К3', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('e0c1a442-87d0-4cce-8807-af429a77d3e7', 'ipkom3-p-app-08', NULL, 'ACTIVE', 'Интеграционная платформа К3. Сервис лендинга', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('e35a9402-e7d2-4fcb-ae20-fa59c799cb65', 'ipkom3-pr-app-02 ', NULL, 'ACTIVE', 'Интеграционная платформа К3', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('e62ecb7a-2048-47f4-826f-594b6816785e', 'vrl-kom3auth01 ', NULL, 'ACTIVE', 'Сервер аутентификации', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('ed8a0d44-39a0-459a-8cac-83d56760f0dd', 'ocrkom3-t-db-01', NULL, 'ACTIVE', 'Верификация. Сервер хранения', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('ee321a0d-bcb3-4880-8a06-f78a20aef4a8', 'ipkom3-p-app-16 ', NULL, 'ACTIVE', 'Интеграционная платформа К3', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('f51092b1-9b45-4f5f-85b2-a81f4a7bf50d', 'VPL-K3DAUTHDB01', NULL, 'ACTIVE', 'Сервер БД аутентификации', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('fbbfa094-fe93-41c3-b3ad-208e3a2eb5a4', 'ipkom3-p-app-15 ', NULL, 'ACTIVE', 'Интеграционная платформа К3', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('fdc6c4fc-64b9-4b14-96ae-835131592fb3', 'ipkom3-p-app-05', NULL, 'ACTIVE', 'Интеграционная платформа К3', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('fefbe519-5e1d-405b-a697-bd3738e3f333', 'ipkom3-p-app-04', NULL, 'ACTIVE', 'Интеграционная платформа К3', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z'),
    ('feff8202-eca1-4556-a726-8088c3319184', 'ipkom3-p-rds-02 ', NULL, 'ACTIVE', 'Интеграционная платформа К3 Сервер кеширования', '2026-10-07T18:22:01Z', '2026-10-07T18:22:01Z');
-- --------------------------------------------------------------------------
-- 05. Clusters (2 rows)
-- --------------------------------------------------------------------------
INSERT INTO cluster (id, name, cluster_type, version, management_address, status, description, created_at, updated_at) VALUES
    ('b2fa3784-14cc-4020-b83d-c9566ad70e0e', 'ipkom3k8-prod', 'KUBERNETES', NULL, NULL, 'ACTIVE', NULL, '2026-10-07T15:27:21Z', '2026-10-07T15:27:21Z'),
    ('e0797690-78ca-4dcc-857a-c6c19b9d053e', 'ipkom3k8S-test', 'KUBERNETES', NULL, NULL, 'ACTIVE', NULL, '2026-10-07T15:26:49Z', '2026-10-07T15:26:49Z');
-- --------------------------------------------------------------------------
-- 06. Module Instances (8 rows)
-- --------------------------------------------------------------------------
INSERT INTO module_instance (id, module_id, environment_id, name, version, runtime_type, status, description, created_at, updated_at) VALUES
    ('14f643a2-7d75-4c1b-8e5e-92f3fa2759de', '497a85a9-0d65-4d40-b1f5-61fde440ecaf', '22222222-2222-2222-2222-000000000002', 'CryptoPro Test', NULL, NULL, 'PLANNED', NULL, '2026-10-07T19:15:19Z', '2026-10-07T19:15:19Z'),
    ('27ffd946-f8f9-406a-930d-0816ffb3e33b', '808f068c-f755-4a88-bef1-a3218851c0fd', '22222222-2222-2222-2222-000000000004', 'auth-lan-prod', NULL, NULL, 'PLANNED', NULL, '2026-10-07T19:23:36Z', '2026-10-07T19:23:54Z'),
    ('2bfa1e41-1f5a-4765-8259-90d16096dfd7', '497a85a9-0d65-4d40-b1f5-61fde440ecaf', '22222222-2222-2222-2222-000000000004', 'CryptoPro Prod', NULL, NULL, 'PLANNED', NULL, '2026-10-07T19:15:43Z', '2026-10-07T19:15:43Z'),
    ('3a8bd86a-0fd4-4f67-89c8-6eb634faa1ff', '53da05aa-9ad6-4831-b5c6-f3a1ec45f9bf', '22222222-2222-2222-2222-000000000002', 'ipkom3-runner-k8test', NULL, 'ipkom3', 'ACTIVE', NULL, '2026-10-07T15:28:17Z', '2026-10-07T18:24:37Z'),
    ('5f4a1544-d70c-468a-a12c-791e04a58039', '53da05aa-9ad6-4831-b5c6-f3a1ec45f9bf', '22222222-2222-2222-2222-000000000004', 'ipkom3-runner-k8prod', NULL, 'ipkom3', 'ACTIVE', NULL, '2026-10-07T15:29:00Z', '2026-10-07T18:24:25Z'),
    ('a78bada7-d4f7-4427-a54a-16f54ee1b26a', '1fa0616d-12a0-48dd-a94b-220a2e4403c9', '22222222-2222-2222-2222-000000000004', 'auth-dmz-prod', NULL, NULL, 'ACTIVE', NULL, '2026-10-07T19:23:21Z', '2026-10-07T19:23:47Z'),
    ('aee63eff-c4d6-4457-a2fe-7a0c0d2b3f9b', 'bb20da52-4a0c-4ab2-baf9-e4ebc79c66e0', '22222222-2222-2222-2222-000000000001', 'Лкк-frontend', '1.1', 'Node', 'PLANNED', NULL, '2026-10-06T05:34:17Z', '2026-10-06T05:34:17Z'),
    ('e925e553-71bb-4757-9694-e87301bd9cad', '53da05aa-9ad6-4831-b5c6-f3a1ec45f9bf', '22222222-2222-2222-2222-000000000004', 'ipkom3-runner-prod', NULL, NULL, 'ACTIVE', NULL, '2026-10-07T18:24:09Z', '2026-10-07T19:49:56Z');
-- --------------------------------------------------------------------------
-- 07. Module Deployments (7 rows)
--     — ровно один из server_id / cluster_id
-- --------------------------------------------------------------------------
INSERT INTO module_deployment (id, module_instance_id, server_id, cluster_id, deployment_role, deployment_state, valid_from, valid_to, created_at, updated_at) VALUES
    ('162b5c1e-4250-49cc-bc2f-a448d6941792', 'e925e553-71bb-4757-9694-e87301bd9cad', 'fdc6c4fc-64b9-4b14-96ae-835131592fb3', NULL, NULL, 'ACTIVE', NULL, NULL, '2026-10-07T18:45:04Z', '2026-10-07T18:45:04Z'),
    ('54669f72-7eb5-41ff-b05c-bc4c1a3a1a6f', 'e925e553-71bb-4757-9694-e87301bd9cad', 'fefbe519-5e1d-405b-a697-bd3738e3f333', NULL, NULL, 'ACTIVE', NULL, NULL, '2026-10-07T18:44:45Z', '2026-10-07T18:44:45Z'),
    ('8342c8fe-de05-4a72-b831-7d82d2d44f61', '5f4a1544-d70c-468a-a12c-791e04a58039', NULL, 'b2fa3784-14cc-4020-b83d-c9566ad70e0e', NULL, 'ACTIVE', NULL, NULL, '2026-10-07T18:43:54Z', '2026-10-07T18:43:54Z'),
    ('9723bd4a-503f-4520-96a9-1d4816435526', '3a8bd86a-0fd4-4f67-89c8-6eb634faa1ff', NULL, 'e0797690-78ca-4dcc-857a-c6c19b9d053e', NULL, 'ACTIVE', NULL, NULL, '2026-10-07T18:44:07Z', '2026-10-07T18:44:07Z'),
    ('97add9cf-3d26-42fa-a2f8-ec39e28c2818', 'e925e553-71bb-4757-9694-e87301bd9cad', 'b7232f9b-cb8f-494b-b3d7-2f75a13e90c3', NULL, NULL, 'ACTIVE', NULL, NULL, '2026-10-07T18:45:19Z', '2026-10-07T18:45:19Z'),
    ('c3f8b85b-12a8-40d7-99f5-2cf1c1363389', '27ffd946-f8f9-406a-930d-0816ffb3e33b', '9da21806-9eb5-46a8-ba83-6f3e3041d9bc', NULL, NULL, 'ACTIVE', NULL, NULL, '2026-10-07T19:24:50Z', '2026-10-07T19:24:50Z'),
    ('c8298b6d-a9a1-408f-b5ed-7cf880141f6e', 'a78bada7-d4f7-4427-a54a-16f54ee1b26a', '16fee6cb-f031-4e77-8b8e-dccdc87e468d', NULL, NULL, 'ACTIVE', NULL, NULL, '2026-10-07T19:25:18Z', '2026-10-07T19:25:18Z');
-- --------------------------------------------------------------------------
-- 08. Network Zones (5 rows)
--     — иерархия зон через parent_id
-- --------------------------------------------------------------------------
INSERT INTO network_zone (id, code, name, zone_type, security_level, parent_id, description, status) VALUES
    ('77777777-7777-7777-7777-000000000001', 'DMZ', 'Demilitarized Zone', 'DMZ', 'HIGH', NULL, NULL, 'ACTIVE'),
    ('77777777-7777-7777-7777-000000000002', 'LAN', 'Internal LAN', 'INTERNAL', 'MEDIUM', NULL, NULL, 'ACTIVE'),
    ('77777777-7777-7777-7777-000000000003', 'PCI', 'PCI DSS Zone', 'PCI_DSS', 'CRITICAL', '77777777-7777-7777-7777-000000000002', NULL, 'ACTIVE'),
    ('77777777-7777-7777-7777-000000000004', 'MANAGEMENT', 'Management Zone', 'MANAGEMENT', 'HIGH', NULL, NULL, 'ACTIVE'),
    ('77777777-7777-7777-7777-000000000005', 'EXTERNAL', 'External', 'EXTERNAL', 'LOW', NULL, NULL, 'ACTIVE');
-- --------------------------------------------------------------------------
-- 09. Network Segments (6 rows)
-- --------------------------------------------------------------------------
INSERT INTO network_segment (id, network_zone_id, code, name, cidr, vlan, purpose, status) VALUES
    ('88888888-8888-8888-8888-000000000001', '77777777-7777-7777-7777-000000000001', 'DMZ-APP', 'DMZ Application Segment', '10.20.10.0/24', 210, 'Internet Banking DMZ', 'ACTIVE'),
    ('88888888-8888-8888-8888-000000000002', '77777777-7777-7777-7777-000000000001', 'DMZ-MGMT', 'DMZ Management Segment', '10.20.20.0/24', 220, NULL, 'ACTIVE'),
    ('88888888-8888-8888-8888-000000000003', '77777777-7777-7777-7777-000000000002', 'LAN-APP', 'LAN Application Segment', '10.10.10.0/24', 110, 'Internal services', 'ACTIVE'),
    ('88888888-8888-8888-8888-000000000004', '77777777-7777-7777-7777-000000000002', 'LAN-DB', 'LAN Database Segment', '10.10.30.0/24', 130, 'Database VLAN', 'ACTIVE'),
    ('88888888-8888-8888-8888-000000000005', '77777777-7777-7777-7777-000000000004', 'MGMT-01', 'Management Segment', '10.99.1.0/24', 99, NULL, 'ACTIVE'),
    ('88888888-8888-8888-8888-000000000006', '77777777-7777-7777-7777-000000000003', 'PCI-APP', 'PCI Application Segment', '10.40.10.0/24', 410, 'Card transaction processing', 'ACTIVE');
-- --------------------------------------------------------------------------
-- 10. Routers (2 rows)
-- --------------------------------------------------------------------------
INSERT INTO router (id, name, device_type, vendor, model, management_address, status, description) VALUES
    ('99999999-9999-9999-9999-000000000001', 'RTR-DMZ-01', 'CORE', 'Cisco', 'ASR1002-X', '10.99.1.10/32', 'ACTIVE', 'Ядровой маршрутизатор DMZ/LAN'),
    ('99999999-9999-9999-9999-000000000002', 'RTR-PCI-01', 'EDGE', 'Juniper', 'MX204', '10.99.1.12/32', 'PLANNED', 'Маршрутизатор PCI периметра (план)');
-- --------------------------------------------------------------------------
-- 11. Firewalls (2 rows)
-- --------------------------------------------------------------------------
INSERT INTO firewall (id, name, firewall_type, vendor, model, management_address, status, description) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'FW-01', 'PERIMETER', 'Palo Alto', 'PA-5250', '10.99.1.20/32', 'ACTIVE', 'Межсетевой экран между DMZ и LAN'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', 'FW-PCI-01', 'ZONAL', 'Checkpoint', '15600', NULL, 'PLANNED', 'Firewalls для PCI зоны');
-- --------------------------------------------------------------------------
-- 12. Network Interfaces (0 rows)
--     — ровно один владелец: server XOR router XOR firewall
-- --------------------------------------------------------------------------
-- Данных нет: таблица остаётся пустой.
-- --------------------------------------------------------------------------
-- 13. Protocols (9 rows)
-- --------------------------------------------------------------------------
INSERT INTO protocol (id, code, name, transport, layer, default_port, description, status) VALUES
    ('0830a380-924e-4516-8c8a-23967d2f5534', 'NFS', 'NFS', 'TCP', 'L7', 2049, NULL, 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'HTTPS', 'HTTP Secure', 'TCP', 'L7', 443, 'HTTPS REST/gRPC-over-TLS', 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000002', 'HTTP', 'HTTP', 'TCP', 'L7', 80, NULL, 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000003', 'JDBC', 'JDBC', 'TCP', 'L7', 5432, 'Подключение к реляционной БД', 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000004', 'Kafka', 'Apache Kafka', 'TCP', 'L7', 9092, NULL, 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000005', 'gRPC', 'gRPC', 'TCP', 'L7', 9090, NULL, 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000006', 'AMQP', 'AMQP', 'TCP', 'L7', 5672, NULL, 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000007', 'SFTP', 'SFTP', 'TCP', 'L7', 22, NULL, 'ACTIVE'),
    ('cbba7d70-4405-4eea-9f13-1b71f56cfc2b', 'SMTP', 'SMTP', 'TCP', 'L7', 587, 'SMTP', 'ACTIVE');
-- --------------------------------------------------------------------------
-- 14. Information Flows (5 rows)
--     — source_module_id <> target_module_id
-- --------------------------------------------------------------------------
INSERT INTO information_flow (id, code, name, source_module_id, target_module_id, protocol_id, target_port, source_port, description, status, valid_from, valid_to, created_at, created_by, updated_at, updated_by) VALUES
    ('07ffc56e-3e7b-48cd-a6a1-de746cabf214', 'NFS-1', 'Сохранение файлов реестров', '051df149-00bb-4af9-9688-abcfcbbecbc9', 'd3277b4f-98ae-4cae-9717-ce7859da900b', '0830a380-924e-4516-8c8a-23967d2f5534', 2049, NULL, 'Сохранение файлов реестров', 'PLANNED', NULL, NULL, '2026-10-07T18:30:55Z', 'api-user', '2026-10-07T18:39:47Z', 'api-user'),
    ('080a9b2a-f37c-40bf-8a22-6bc18f475315', 'NFS-3', 'Шифрование файлов реестров', '53da05aa-9ad6-4831-b5c6-f3a1ec45f9bf', '497a85a9-0d65-4d40-b1f5-61fde440ecaf', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 8090, NULL, 'Шифрование файлов реестров', 'PLANNED', NULL, NULL, '2026-10-07T18:37:19Z', 'api-user', '2026-10-07T18:37:29Z', 'api-user'),
    ('11441575-bd3a-4b0b-9ad2-5a1cc8c01990', 'NFS-4', 'Отправка реестров по почте', '53da05aa-9ad6-4831-b5c6-f3a1ec45f9bf', 'b921355f-40aa-4f99-aa7e-22db620b405d', 'cbba7d70-4405-4eea-9f13-1b71f56cfc2b', 587, NULL, 'Отправка реестров по почте', 'PLANNED', NULL, NULL, '2026-10-07T18:41:01Z', 'api-user', '2026-10-07T18:43:04Z', 'api-user'),
    ('34a7a87c-c3dc-4f06-8933-a8202b91333c', 'NFS-2', 'Получение файлов реестров', '53da05aa-9ad6-4831-b5c6-f3a1ec45f9bf', 'd3277b4f-98ae-4cae-9717-ce7859da900b', '0830a380-924e-4516-8c8a-23967d2f5534', 2049, NULL, 'Получение файлов реестров', 'PLANNED', NULL, NULL, '2026-10-07T18:33:48Z', 'api-user', '2026-10-07T18:39:53Z', 'api-user'),
    ('46d10305-929e-4a14-b0ae-f7f04054f06d', '01-test ЛКК', 'Получение данных из Adinsure', 'bb20da52-4a0c-4ab2-baf9-e4ebc79c66e0', '53da05aa-9ad6-4831-b5c6-f3a1ec45f9bf', 'bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 8043, NULL, 'Получение данных из Adinsure по договорам', 'PLANNED', NULL, NULL, '2026-10-06T05:40:46Z', 'api-user', '2026-10-06T05:40:46Z', 'api-user');
-- --------------------------------------------------------------------------
-- 15. Audit Log (5 rows)
-- --------------------------------------------------------------------------
INSERT INTO audit_log (id, entity_type, entity_id, operation, changed_at, changed_by, old_value, new_value) VALUES
    ('ffffffff-ffff-ffff-ffff-000000000001', 'information_system', '11111111-1111-1111-1111-000000000001', 'UPDATE', '2026-08-14T10:22:00Z', 's.ivanov', NULL, NULL),
    ('ffffffff-ffff-ffff-ffff-000000000002', 'application_module', '33333333-3333-3333-3333-000000000001', 'UPDATE', '2026-09-18T14:05:00Z', 'n.petrov', NULL, NULL),
    ('ffffffff-ffff-ffff-ffff-000000000003', 'information_flow', 'cccccccc-cccc-cccc-cccc-000000000001', 'INSERT', '2026-07-02T11:12:00Z', 'm.smirnova', NULL, NULL),
    ('ffffffff-ffff-ffff-ffff-000000000004', 'module_deployment', 'dddddddd-dddd-dddd-dddd-000000000002', 'UPDATE', '2026-09-29T09:44:00Z', 'ops-deploy', NULL, NULL),
    ('ffffffff-ffff-ffff-ffff-000000000005', 'network_interface', 'eeeeeeee-eeee-eeee-eeee-000000000001', 'INSERT', '2026-05-11T16:00:00Z', 'netops', NULL, NULL);
-- --------------------------------------------------------------------------
-- 16. Projects (6 rows)
--     — реестровый объект «Проект»: Номер проекта + Наименование
-- --------------------------------------------------------------------------
INSERT INTO project (id, code, name, description, status, created_at, created_by, updated_at, updated_by) VALUES
    ('18a33a1d-11cb-4ae3-876f-82deae455942', 'ЛКК2', 'Личный кабинет 2.0', NULL, 'PLANNED', '2026-10-07T16:47:56Z', 'api-user', '2026-10-07T16:47:56Z', 'api-user'),
    ('8c311f35-6daf-41d2-a735-196790e32553', 'ATL', 'Аудиотеле', NULL, 'PLANNED', '2026-10-07T16:48:13Z', 'api-user', '2026-10-07T16:48:13Z', 'api-user'),
    ('9e29e3f8-700d-4045-ad21-4f42b81a1344', 'A24-8394', 'Инициатива НПФ ВТБ', NULL, 'ACTIVE', '2026-10-07T16:02:26Z', 'api-user', '2026-10-07T16:02:26Z', 'api-user'),
    ('a285a503-ef29-4485-9058-f99be0601cfc', 'VTBO', 'Продажи ВТБ Онлайн', NULL, 'PLANNED', '2026-10-07T16:48:59Z', 'api-user', '2026-10-07T16:49:08Z', 'api-user'),
    ('ce32444b-ea2c-428e-bbcb-00caa5b55c0f', 'SOPD_Pochta', 'Сбор СОПД ПочтаБанк', NULL, 'PLANNED', '2026-10-07T16:49:52Z', 'api-user', '2026-10-07T16:49:52Z', 'api-user'),
    ('f1bdf6b9-a872-4aac-b35f-d7057e11c106', 'FNS-KNTR', 'Передача справок ФНС', 'Передача справок ФНС из операционных систем в СКБ Контур', 'PLANNED', '2026-10-07T16:51:29Z', 'api-user', '2026-10-07T16:51:41Z', 'api-user');
-- --------------------------------------------------------------------------
-- 17. Information Flow ↔ Projects (4 rows)
--     — поток задействован в проектах (1:N)
-- --------------------------------------------------------------------------
INSERT INTO information_flow_project (id, information_flow_id, project_id, created_at, created_by) VALUES
    ('093482e3-8624-4053-989c-174a3efce97d', '34a7a87c-c3dc-4f06-8933-a8202b91333c', '9e29e3f8-700d-4045-ad21-4f42b81a1344', '2026-10-07T18:39:53Z', 'api-user'),
    ('bc99d76a-f69b-459a-ad9c-82c2bc68cebb', '07ffc56e-3e7b-48cd-a6a1-de746cabf214', '9e29e3f8-700d-4045-ad21-4f42b81a1344', '2026-10-07T18:39:47Z', 'api-user'),
    ('c68cbfda-d083-4aff-8450-276c20c3ed54', '080a9b2a-f37c-40bf-8a22-6bc18f475315', '9e29e3f8-700d-4045-ad21-4f42b81a1344', '2026-10-07T18:37:29Z', 'api-user'),
    ('f6eedba5-472f-4787-b36a-ed817f90ff0e', '11441575-bd3a-4b0b-9ad2-5a1cc8c01990', '9e29e3f8-700d-4045-ad21-4f42b81a1344', '2026-10-07T18:43:04Z', 'api-user');
-- --------------------------------------------------------------------------
-- 18. Архитектурные схемы (модуль «Архитектурные схемы», C4)
--     Фактическое состояние: 1 схема, 6 узлов, 4 связи, 1 версия.
--     Таблицы слоя диаграмм создаёт сам модуль схем, а не 01_ddl.sql, поэтому при
--     первом старте БД их может ещё не быть — раздел выполняется только если
--     таблицы существуют (иначе пропускается с NOTICE).
-- --------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.architecture_diagram') IS NULL THEN
        RAISE NOTICE 'раздел 18 (архитектурные схемы) пропущен: таблицы модуля схем ещё не созданы';
        RETURN;
    END IF;

    EXECUTE 'TRUNCATE TABLE architecture_diagram, architecture_diagram_element, '
         || 'architecture_diagram_relationship, diagram_version RESTART IDENTITY CASCADE';

    INSERT INTO architecture_diagram (id, code, name, description, diagram_type, scope_type, scope_object_id, status, revision, published_version, dependencies_dirty, created_at, created_by, updated_at, updated_by) VALUES
        ('58bc13f0-37d9-4c06-9e82-9af6c4784266', 'pr1', '11', NULL, 'CONTAINER', 'project', '9e29e3f8-700d-4045-ad21-4f42b81a1344', 'PUBLISHED', 3, 1, false, '2026-10-07T19:59:21Z', 'diagram-module', '2026-10-08T06:56:33Z', 'diagram-module');

    INSERT INTO architecture_diagram_element (id, diagram_id, node_key, registry_object_type, registry_object_id, c4_type, parent_key, label, technology, x, y, width, height, style_json) VALUES
        ('2855eb5d-c171-41ff-a956-5c442fec65df', '58bc13f0-37d9-4c06-9e82-9af6c4784266', 'application_module:497a85a9-0d65-4d40-b1f5-61fde440ecaf', 'application_module', '497a85a9-0d65-4d40-b1f5-61fde440ecaf', 'Container', 'project:9e29e3f8-700d-4045-ad21-4f42b81a1344', 'Сервер CryptoPro', 'Application', -106.03311234244663, 75.39167722091207, 250, 112, '{"code": "CRYPT1", "status": "PLANNED", "variant": "application", "description": "Получение файлов реестров"}'),
        ('2fa2e000-8aba-4815-a269-7536be10e53d', '58bc13f0-37d9-4c06-9e82-9af6c4784266', 'application_module:d3277b4f-98ae-4cae-9717-ce7859da900b', 'application_module', 'd3277b4f-98ae-4cae-9717-ce7859da900b', 'Container', 'project:9e29e3f8-700d-4045-ad21-4f42b81a1344', 'Хранение файлов', 'Application', 506.2477003341685, -27.566398618817715, 250, 112, '{"code": "NFS", "status": "PLANNED", "variant": "application", "description": "Хранение файлов для ФНС"}'),
        ('759d8625-da59-407b-9b1e-ccd420c3d20b', '58bc13f0-37d9-4c06-9e82-9af6c4784266', 'application_module:051df149-00bb-4af9-9688-abcfcbbecbc9', 'application_module', '051df149-00bb-4af9-9688-abcfcbbecbc9', 'Container', 'project:9e29e3f8-700d-4045-ad21-4f42b81a1344', 'Сервер приложения Adinsure', 'Application', -112.96500957806848, -106.48730175567577, 250, 112, '{"code": "ADS-APP", "status": "ACTIVE", "variant": "application", "description": "Сервер приложения Adinsure"}'),
        ('80d09216-43ff-4994-a97e-66d688b5492c', '58bc13f0-37d9-4c06-9e82-9af6c4784266', 'application_module:b921355f-40aa-4f99-aa7e-22db620b405d', 'application_module', 'b921355f-40aa-4f99-aa7e-22db620b405d', 'Container', 'project:9e29e3f8-700d-4045-ad21-4f42b81a1344', 'Почтовый сервер', 'Application', 508.77873153647704, 315.1891105911598, 250, 112, '{"code": "MAIL", "status": "ACTIVE", "variant": "application", "description": "Почтовый сервер"}'),
        ('c305c09e-0d7a-4892-931a-5805521b7aa1', '58bc13f0-37d9-4c06-9e82-9af6c4784266', 'project:9e29e3f8-700d-4045-ad21-4f42b81a1344', 'project', '9e29e3f8-700d-4045-ad21-4f42b81a1344', 'SystemBoundary', NULL, 'Инициатива НПФ ВТБ', NULL, -144.62728054614024, -156.4873017556758, 340, 240, '{"code": "A24-8394", "status": "ACTIVE", "variant": "boundary"}'),
        ('d3d79c36-eee3-4699-9ee9-496c70745c3d', '58bc13f0-37d9-4c06-9e82-9af6c4784266', 'application_module:53da05aa-9ad6-4831-b5c6-f3a1ec45f9bf', 'application_module', '53da05aa-9ad6-4831-b5c6-f3a1ec45f9bf', 'Container', 'project:9e29e3f8-700d-4045-ad21-4f42b81a1344', 'runner', 'Application', -118.62728054614024, 317.1613853007149, 250, 112, '{"code": "runner", "status": "ACTIVE", "variant": "application", "description": "Модуль исполнения интеграционных процессов"}');

    INSERT INTO architecture_diagram_relationship (id, diagram_id, edge_key, source_element_id, target_element_id, information_flow_id, label, technology, style_json, routing_json) VALUES
        ('1e17ae23-b023-484e-98ce-71c670376417', '58bc13f0-37d9-4c06-9e82-9af6c4784266', 'information_flow:34a7a87c-c3dc-4f06-8933-a8202b91333c', 'd3d79c36-eee3-4699-9ee9-496c70745c3d', '2fa2e000-8aba-4815-a269-7536be10e53d', '34a7a87c-c3dc-4f06-8933-a8202b91333c', 'Получение файлов реестров', 'NFS/2049', NULL, NULL),
        ('4a62ec92-8ab7-4830-a59a-9a9420e34678', '58bc13f0-37d9-4c06-9e82-9af6c4784266', 'information_flow:07ffc56e-3e7b-48cd-a6a1-de746cabf214', '759d8625-da59-407b-9b1e-ccd420c3d20b', '2fa2e000-8aba-4815-a269-7536be10e53d', '07ffc56e-3e7b-48cd-a6a1-de746cabf214', 'Сохранение файлов реестров', 'NFS/2049', NULL, NULL),
        ('4fb7c3e5-43d4-4590-8452-275e7796e4ae', '58bc13f0-37d9-4c06-9e82-9af6c4784266', 'information_flow:11441575-bd3a-4b0b-9ad2-5a1cc8c01990', 'd3d79c36-eee3-4699-9ee9-496c70745c3d', '80d09216-43ff-4994-a97e-66d688b5492c', '11441575-bd3a-4b0b-9ad2-5a1cc8c01990', 'Отправка реестров по почте', 'SMTP/587', NULL, NULL),
        ('93a3bd79-06dd-47ea-ad80-cd273a052e6e', '58bc13f0-37d9-4c06-9e82-9af6c4784266', 'information_flow:080a9b2a-f37c-40bf-8a22-6bc18f475315', 'd3d79c36-eee3-4699-9ee9-496c70745c3d', '2855eb5d-c171-41ff-a956-5c442fec65df', '080a9b2a-f37c-40bf-8a22-6bc18f475315', 'Шифрование файлов реестров', 'HTTPS/8090', NULL, NULL);

    INSERT INTO diagram_version (id, diagram_id, version_no, snapshot_json, created_by, created_at, status) VALUES
        ('7bcccd7f-8a89-44cb-ba7a-b1ee224aacdc', '58bc13f0-37d9-4c06-9e82-9af6c4784266', 1, '{"code": "pr1", "name": "11", "edges": [{"id": "information_flow:07ffc56e-3e7b-48cd-a6a1-de746cabf214", "label": "Сохранение файлов реестров", "source": "application_module:051df149-00bb-4af9-9688-abcfcbbecbc9", "target": "application_module:d3277b4f-98ae-4cae-9717-ce7859da900b", "routing": null, "technology": "NFS/2049", "registryRef": {"id": "07ffc56e-3e7b-48cd-a6a1-de746cabf214", "type": "information_flow"}}, {"id": "information_flow:080a9b2a-f37c-40bf-8a22-6bc18f475315", "label": "Шифрование файлов реестров", "source": "application_module:53da05aa-9ad6-4831-b5c6-f3a1ec45f9bf", "target": "application_module:497a85a9-0d65-4d40-b1f5-61fde440ecaf", "routing": null, "technology": "HTTPS/8090", "registryRef": {"id": "080a9b2a-f37c-40bf-8a22-6bc18f475315", "type": "information_flow"}}, {"id": "information_flow:11441575-bd3a-4b0b-9ad2-5a1cc8c01990", "label": "Отправка реестров по почте", "source": "application_module:53da05aa-9ad6-4831-b5c6-f3a1ec45f9bf", "target": "application_module:b921355f-40aa-4f99-aa7e-22db620b405d", "routing": null, "technology": "SMTP/587", "registryRef": {"id": "11441575-bd3a-4b0b-9ad2-5a1cc8c01990", "type": "information_flow"}}, {"id": "information_flow:34a7a87c-c3dc-4f06-8933-a8202b91333c", "label": "Получение файлов реестров", "source": "application_module:53da05aa-9ad6-4831-b5c6-f3a1ec45f9bf", "target": "application_module:d3277b4f-98ae-4cae-9717-ce7859da900b", "routing": null, "technology": "NFS/2049", "registryRef": {"id": "34a7a87c-c3dc-4f06-8933-a8202b91333c", "type": "information_flow"}}], "nodes": [{"id": "application_module:051df149-00bb-4af9-9688-abcfcbbecbc9", "name": "Сервер приложения Adinsure", "size": {"width": 250, "height": 112}, "style": {"code": "ADS-APP", "status": "ACTIVE", "variant": "application"}, "c4Type": "Container", "parent": "project:9e29e3f8-700d-4045-ad21-4f42b81a1344", "position": {"x": -112.96500957806848, "y": -106.48730175567577}, "technology": "Application", "description": "Сервер приложения Adinsure", "registryRef": {"id": "051df149-00bb-4af9-9688-abcfcbbecbc9", "type": "application_module"}}, {"id": "application_module:497a85a9-0d65-4d40-b1f5-61fde440ecaf", "name": "Сервер CryptoPro", "size": {"width": 250, "height": 112}, "style": {"code": "CRYPT1", "status": "PLANNED", "variant": "application"}, "c4Type": "Container", "parent": "project:9e29e3f8-700d-4045-ad21-4f42b81a1344", "position": {"x": -106.03311234244663, "y": 75.39167722091207}, "technology": "Application", "description": "Получение файлов реестров", "registryRef": {"id": "497a85a9-0d65-4d40-b1f5-61fde440ecaf", "type": "application_module"}}, {"id": "application_module:53da05aa-9ad6-4831-b5c6-f3a1ec45f9bf", "name": "runner", "size": {"width": 250, "height": 112}, "style": {"code": "runner", "status": "ACTIVE", "variant": "application"}, "c4Type": "Container", "parent": "project:9e29e3f8-700d-4045-ad21-4f42b81a1344", "position": {"x": -118.62728054614024, "y": 317.1613853007149}, "technology": "Application", "description": "Модуль исполнения интеграционных процессов", "registryRef": {"id": "53da05aa-9ad6-4831-b5c6-f3a1ec45f9bf", "type": "application_module"}}, {"id": "application_module:b921355f-40aa-4f99-aa7e-22db620b405d", "name": "Почтовый сервер", "size": {"width": 250, "height": 112}, "style": {"code": "MAIL", "status": "ACTIVE", "variant": "application"}, "c4Type": "Container", "parent": "project:9e29e3f8-700d-4045-ad21-4f42b81a1344", "position": {"x": 508.77873153647704, "y": 315.1891105911598}, "technology": "Application", "description": "Почтовый сервер", "registryRef": {"id": "b921355f-40aa-4f99-aa7e-22db620b405d", "type": "application_module"}}, {"id": "application_module:d3277b4f-98ae-4cae-9717-ce7859da900b", "name": "Хранение файлов", "size": {"width": 250, "height": 112}, "style": {"code": "NFS", "status": "PLANNED", "variant": "application"}, "c4Type": "Container", "parent": "project:9e29e3f8-700d-4045-ad21-4f42b81a1344", "position": {"x": 506.2477003341685, "y": -27.566398618817715}, "technology": "Application", "description": "Хранение файлов для ФНС", "registryRef": {"id": "d3277b4f-98ae-4cae-9717-ce7859da900b", "type": "application_module"}}, {"id": "project:9e29e3f8-700d-4045-ad21-4f42b81a1344", "name": "Инициатива НПФ ВТБ", "size": {"width": 340, "height": 240}, "style": {"code": "A24-8394", "status": "ACTIVE", "variant": "boundary"}, "c4Type": "SystemBoundary", "parent": null, "position": {"x": -144.62728054614024, "y": -156.4873017556758}, "technology": null, "description": null, "registryRef": {"id": "9e29e3f8-700d-4045-ad21-4f42b81a1344", "type": "project"}}], "scope": {"objectId": "9e29e3f8-700d-4045-ad21-4f42b81a1344", "objectType": "project"}, "revision": 3, "diagramId": "58bc13f0-37d9-4c06-9e82-9af6c4784266", "diagramType": "CONTAINER", "publishedAt": "2026-10-08T06:56:33.131Z", "schemaVersion": "1.0"}', 'diagram-module', '2026-10-08T06:56:33Z', 'PUBLISHED');
END $$;
