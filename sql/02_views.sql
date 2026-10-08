-- ============================================================================
-- Представления (Views) — раздел 13 ТЗ v2.0
-- ============================================================================

-- V01. Реестр ИС и модулей
CREATE OR REPLACE VIEW v01_is_modules AS
SELECT
    isys.code  AS is_code, isys.name AS is_name, isys.status AS is_status,
    am.code    AS module_code, am.name AS module_name, am.module_type, am.version, am.status AS module_status, am.purpose
FROM application_module am JOIN information_system isys ON isys.id = am.information_system_id;

-- V02. Экземпляры модулей по средам
CREATE OR REPLACE VIEW v02_module_instances AS
SELECT
    isys.code AS is_code, am.code AS module_code, am.name AS module_name,
    mi.name AS instance_name, mi.version AS instance_version, mi.runtime_type, mi.status AS instance_status,
    env.code AS env_code, env.name AS env_name
FROM module_instance mi
JOIN application_module am ON am.id = mi.module_id
JOIN information_system isys ON isys.id = am.information_system_id
JOIN environment env ON env.id = mi.environment_id;

-- V03. Размещение экземпляров на серверах
CREATE OR REPLACE VIEW v03_deployments_on_servers AS
SELECT mi.name AS instance_name, env.code AS env_code, am.code AS module_code,
       s.name AS server_name, md.deployment_role, md.deployment_state, md.valid_from, md.valid_to
FROM module_deployment md
JOIN module_instance mi ON mi.id = md.module_instance_id
JOIN application_module am ON am.id = mi.module_id
JOIN environment env ON env.id = mi.environment_id
JOIN server s ON s.id = md.server_id
WHERE md.server_id IS NOT NULL;

-- V04. Размещение экземпляров в кластерах
CREATE OR REPLACE VIEW v04_deployments_on_clusters AS
SELECT mi.name AS instance_name, env.code AS env_code, am.code AS module_code,
       c.name AS cluster_name, c.cluster_type, md.deployment_role, md.deployment_state
FROM module_deployment md
JOIN module_instance mi ON mi.id = md.module_instance_id
JOIN application_module am ON am.id = mi.module_id
JOIN environment env ON env.id = mi.environment_id
JOIN cluster c ON c.id = md.cluster_id
WHERE md.cluster_id IS NOT NULL;


-- V05. Логическая матрица информационных потоков
CREATE OR REPLACE VIEW v05_information_flow_matrix AS
SELECT
    sis.code AS source_is_code, sis.name AS source_is_name,
    sm.code  AS source_module_code, sm.name AS source_module_name,
    fl.code  AS flow_code, fl.name AS flow_name,
    p.code   AS protocol_code, p.name AS protocol_name, fl.target_port,
    tis.code AS target_is_code, tis.name AS target_is_name,
    tm.code  AS target_module_code, tm.name AS target_module_name,
    fl.status AS flow_status, fl.valid_from, fl.valid_to
FROM information_flow fl
JOIN application_module sm ON sm.id = fl.source_module_id
JOIN information_system sis ON sis.id = sm.information_system_id
JOIN application_module tm ON tm.id = fl.target_module_id
JOIN information_system tis ON tis.id = tm.information_system_id
JOIN protocol p ON p.id = fl.protocol_id;

-- V06. Входящие зависимости модуля
CREATE OR REPLACE VIEW v06_module_incoming AS
SELECT tm.id AS module_id, tm.code AS module_code, fl.code AS flow_code, fl.name AS flow_name,
       sm.code AS source_module_code, sm.name AS source_module_name, p.code AS protocol_code, fl.target_port
FROM information_flow fl
JOIN application_module tm ON tm.id = fl.target_module_id
JOIN application_module sm ON sm.id = fl.source_module_id
JOIN protocol p ON p.id = fl.protocol_id;

-- V07. Исходящие зависимости модуля
CREATE OR REPLACE VIEW v07_module_outgoing AS
SELECT sm.id AS module_id, sm.code AS module_code, fl.code AS flow_code, fl.name AS flow_name,
       tm.code AS target_module_code, tm.name AS target_module_name, p.code AS protocol_code, fl.target_port
FROM information_flow fl
JOIN application_module sm ON sm.id = fl.source_module_id
JOIN application_module tm ON tm.id = fl.target_module_id
JOIN protocol p ON p.id = fl.protocol_id;

-- V08. Состав сервера
CREATE OR REPLACE VIEW v08_server_composition AS
SELECT
    s.name AS server_name, ni.name AS interface_name, ni.ip_address,
    ns.code AS segment_code, nz.code AS zone_code,
    env.code AS env_code, isys.code AS is_code, am.code AS module_code,
    mi.name AS instance_name, md.deployment_role, md.deployment_state
FROM server s
LEFT JOIN network_interface ni ON ni.server_id = s.id
LEFT JOIN network_segment ns ON ns.id = ni.network_segment_id
LEFT JOIN network_zone nz ON nz.id = ns.network_zone_id
LEFT JOIN module_deployment md ON md.server_id = s.id
LEFT JOIN module_instance mi ON mi.id = md.module_instance_id
LEFT JOIN application_module am ON am.id = mi.module_id
LEFT JOIN information_system isys ON isys.id = am.information_system_id
LEFT JOIN environment env ON env.id = mi.environment_id;

-- V09. Состав сетевого сегмента
CREATE OR REPLACE VIEW v09_segment_composition AS
SELECT
    ns.code AS segment_code, ns.cidr, ns.vlan, nz.code AS zone_code,
    ni.name AS interface_name, ni.ip_address,
    s.name AS server_name, r.name AS router_name, f.name AS firewall_name
FROM network_segment ns
JOIN network_zone nz ON nz.id = ns.network_zone_id
LEFT JOIN network_interface ni ON ni.network_segment_id = ns.id
LEFT JOIN server s ON s.id = ni.server_id
LEFT JOIN router r ON r.id = ni.router_id
LEFT JOIN firewall f ON f.id = ni.firewall_id;

-- V10. Состав сетевой зоны
CREATE OR REPLACE VIEW v10_zone_composition AS
SELECT
    nz.code AS zone_code, nz.name AS zone_name,
    ns.code AS segment_code, ns.cidr, ns.vlan,
    (SELECT count(*) FROM network_interface ni JOIN server s ON s.id=ni.server_id WHERE ni.network_segment_id=ns.id) AS servers_cnt,
    (SELECT count(*) FROM network_interface ni JOIN router r ON r.id=ni.router_id WHERE ni.network_segment_id=ns.id) AS routers_cnt,
    (SELECT count(*) FROM network_interface ni JOIN firewall fw ON fw.id=ni.firewall_id WHERE ni.network_segment_id=ns.id) AS firewalls_cnt
FROM network_zone nz
LEFT JOIN network_segment ns ON ns.network_zone_id = nz.id;

-- V11. Сетевые интерфейсы инфраструктуры
CREATE OR REPLACE VIEW v11_network_interfaces AS
SELECT
    ni.name AS interface_name, ni.ip_address, ni.mac_address, ni.interface_role, ni.status,
    ns.code AS segment_code, nz.code AS zone_code,
    s.name AS server_name, r.name AS router_name, f.name AS firewall_name
FROM network_interface ni
JOIN network_segment ns ON ns.id = ni.network_segment_id
JOIN network_zone nz ON nz.id = ns.network_zone_id
LEFT JOIN server s ON s.id = ni.server_id
LEFT JOIN router r ON r.id = ni.router_id
LEFT JOIN firewall f ON f.id = ni.firewall_id;

-- V12. Изменения архитектуры
CREATE OR REPLACE VIEW v12_architecture_changes AS
SELECT entity_type, entity_id, operation, changed_at, changed_by, old_value, new_value
FROM audit_log ORDER BY changed_at DESC;

-- V13. Задействованность информационных потоков в проектах (1:N)
CREATE OR REPLACE VIEW v13_flow_projects AS
SELECT
    fl.code  AS flow_code, fl.name AS flow_name, fl.status AS flow_status,
    prj.code AS project_number, prj.name AS project_name, prj.status AS project_status,
    sis.code AS source_is_code, sm.code AS source_module_code,
    tis.code AS target_is_code, tm.code AS target_module_code
FROM information_flow_project fp
JOIN information_flow fl ON fl.id = fp.information_flow_id
JOIN project prj ON prj.id = fp.project_id
JOIN application_module sm ON sm.id = fl.source_module_id
JOIN information_system sis ON sis.id = sm.information_system_id
JOIN application_module tm ON tm.id = fl.target_module_id
JOIN information_system tis ON tis.id = tm.information_system_id;

-- V14. Проекты и количество задействованных в них потоков
CREATE OR REPLACE VIEW v14_project_flows AS
SELECT
    prj.code AS project_number, prj.name AS project_name, prj.status AS project_status,
    count(fp.information_flow_id) AS flows_cnt
FROM project prj
LEFT JOIN information_flow_project fp ON fp.project_id = prj.id
GROUP BY prj.id, prj.code, prj.name, prj.status;

