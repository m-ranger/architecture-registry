-- Проверка модели адресов развертывания (временный поток откатывается ROLLBACK).
BEGIN;

INSERT INTO information_flow
    (code, name, source_module_id, target_module_id, protocol_id, target_port, status, created_by, updated_by)
SELECT 'TMP-VERIFY-ADDR', 'Временный поток проверки адресов',
       '53da05aa-9ad6-4831-b5c6-f3a1ec45f9bf'::uuid,  -- ipkom3 / runner
       '808f068c-f755-4a88-bef1-a3218851c0fd'::uuid,  -- AUTH / AUTH-LAN
       p.id, 8443, 'PLANNED', 'verify', 'verify'
FROM protocol p
WHERE p.code = 'HTTPS';

\echo '--- V16: адреса потока по средам ---'
SELECT flow_code, env_code, source_module_code, source_address, source_port,
       target_module_code, target_address, target_port
FROM v16_flow_addresses
ORDER BY env_code;

\echo '--- V15a: предпочтительные адреса размещений (PROD) ---'
SELECT module_code, instance_name, owner_type, owner_name, ip_address, address_role
FROM v15a_instance_primary_address
WHERE env_code = 'PROD'
ORDER BY module_code, owner_name;

\echo '--- Адреса узлов размещения (запрос модуля схем, PROD) ---'
SELECT ni.server_id, ni.name, ni.ip_address::text AS ip, ni.interface_role,
       ni.status, ns.code AS segment_code, nz.code AS zone_code
FROM network_interface ni
LEFT JOIN network_segment ns ON ns.id = ni.network_segment_id
LEFT JOIN network_zone nz ON nz.id = ns.network_zone_id
WHERE ni.server_id = ANY(ARRAY[
        'fefbe519-5e1d-405b-a697-bd3738e3f333'::uuid,
        'fdc6c4fc-64b9-4b14-96ae-835131592fb3'::uuid,
        '16fee6cb-f031-4e77-8b8e-dccdc87e468d'::uuid,
        '9da21806-9eb5-46a8-ba83-6f3e3041d9bc'::uuid]::uuid[])
  AND ni.ip_address IS NOT NULL
  AND ni.status <> 'RETIRED'
  AND (ni.environment_id IS NULL OR ni.environment_id = '22222222-2222-2222-2222-000000000004'::uuid)
ORDER BY ni.ip_address;

\echo '--- Адреса кластеров (запрос модуля схем, все среды) ---'
SELECT ni.cluster_id, ni.name, ni.ip_address::text AS ip, ni.interface_role,
       ni.status, ns.code AS segment_code
FROM network_interface ni
LEFT JOIN network_segment ns ON ns.id = ni.network_segment_id
WHERE ni.cluster_id = ANY(ARRAY[
        'b2fa3784-14cc-4020-b83d-c9566ad70e0e'::uuid,
        'e0797690-78ca-4dcc-857a-c6c19b9d053e'::uuid]::uuid[])
  AND ni.ip_address IS NOT NULL
  AND ni.status <> 'RETIRED'
ORDER BY ni.ip_address;

\echo '--- Устаревшая таблица адресов кластера (ожидается пусто) ---'
SELECT to_regclass('public.cluster_network_address') AS legacy_table;

ROLLBACK;
