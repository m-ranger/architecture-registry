import pool from './db.js';

/**
 * Доступ к объектам реестра (только чтение).
 * Модуль является потребителем нормализованной модели реестра (ТЗ §1, §19)
 * и не дублирует атрибуты объектов — только ссылается на них.
 */

/** Типы реестровых объектов, поддерживаемые модулем (ТЗ §19). */
export const REGISTRY_TYPES = [
  'information_system',
  'application_module',
  'module_instance',
  'module_deployment',
  'server',
  'cluster',
  'environment',
  'network_zone',
  'network_segment',
  'information_flow',
  'protocol',
  // Проект — объект реестра, используемый как область (scope) схемы.
  'project',
  'annotation',
];

/**
 * Проверка формата UUID.
 * Все объекты реестра идентифицируются uuid, поэтому строка другого формата не
 * может быть найдена. Без проверки PostgreSQL возвращает ошибку
 * «invalid input syntax for type uuid»: клиент получает HTTP 500 с текстом
 * ошибки СУБД вместо ожидаемого 404.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

/** Набор идентификаторов без значений не-uuid (защита массовых выборок). */
const uuidList = (ids = []) => (Array.isArray(ids) ? ids.filter(isUuid) : []);

/** SQL-выборка «лёгкой карточки» по каждому типу для поиска и палитры. */
const SEARCH_SQL = {
  information_system: `
    SELECT id, 'information_system' AS object_type, code, name, status,
           name AS subtitle, 'IS' AS badge
    FROM information_system WHERE code ILIKE $1 OR name ILIKE $1`,
  application_module: `
    SELECT am.id, 'application_module' AS object_type, am.code, am.name, am.status,
           isys.name AS subtitle, COALESCE(am.module_type, 'MODULE') AS badge
    FROM application_module am
    JOIN information_system isys ON isys.id = am.information_system_id
    WHERE am.code ILIKE $1 OR am.name ILIKE $1 OR isys.code ILIKE $1`,
  module_instance: `
    SELECT mi.id, 'module_instance' AS object_type, am.code AS code, mi.name, mi.status,
           isys.name || ' / ' || env.name AS subtitle, 'INSTANCE' AS badge
    FROM module_instance mi
    JOIN application_module am ON am.id = mi.module_id
    JOIN information_system isys ON isys.id = am.information_system_id
    JOIN environment env ON env.id = mi.environment_id
    WHERE mi.name ILIKE $1 OR am.code ILIKE $1`,
  server: `
    SELECT id, 'server' AS object_type, name AS code, name, status,
           COALESCE(server_type, 'server') AS subtitle, 'SERVER' AS badge
    FROM server WHERE name ILIKE $1`,
  cluster: `
    SELECT id, 'cluster' AS object_type, name AS code, name, status,
           COALESCE(cluster_type, 'cluster') AS subtitle, 'CLUSTER' AS badge
    FROM cluster WHERE name ILIKE $1`,
  environment: `
    SELECT id, 'environment' AS object_type, code, name, status,
           COALESCE(criticality, 'environment') AS subtitle, 'ENV' AS badge
    FROM environment WHERE code ILIKE $1 OR name ILIKE $1`,
  network_segment: `
    SELECT id, 'network_segment' AS object_type, code, name, status,
           COALESCE(cidr::text, 'segment') AS subtitle, 'SEGMENT' AS badge
    FROM network_segment WHERE code ILIKE $1 OR name ILIKE $1`,
  information_flow: `
    SELECT fl.id, 'information_flow' AS object_type, fl.code, fl.name, fl.status,
           sm.code || ' -> ' || tm.code AS subtitle, 'FLOW' AS badge
    FROM information_flow fl
    JOIN application_module sm ON sm.id = fl.source_module_id
    JOIN application_module tm ON tm.id = fl.target_module_id
    WHERE fl.code ILIKE $1 OR fl.name ILIKE $1`,
  project: `
    SELECT id, 'project' AS object_type, code, name, status,
           COALESCE(description, 'project') AS subtitle, 'PROJECT' AS badge
    FROM project WHERE code ILIKE $1 OR name ILIKE $1`,
};

/** Поиск объектов реестра для палитры и диалога добавления (ТЗ FR-006). */
export async function searchRegistry(query, types = REGISTRY_TYPES, limit = 20) {
  const pattern = `%${(query || '').trim()}%`;
  const requested = types.filter((t) => SEARCH_SQL[t]);
  const chunks = [];
  for (const type of requested) {
    chunks.push(`(${SEARCH_SQL[type]})`);
  }
  if (chunks.length === 0) return [];
  const sql = `SELECT * FROM (${chunks.join(' UNION ALL ')}) q ORDER BY q.name LIMIT ${Number(limit) || 20}`;
  const { rows } = await pool.query(sql, [pattern]);
  return rows;
}

/** Карточка реестрового объекта (для перехода из схемы в реестр, ТЗ FR-014). */
export async function getRegistryObject(type, id) {
  const table = {
    information_system: 'information_system',
    application_module: 'application_module',
    module_instance: 'module_instance',
    module_deployment: 'module_deployment',
    server: 'server',
    cluster: 'cluster',
    environment: 'environment',
    network_zone: 'network_zone',
    network_segment: 'network_segment',
    information_flow: 'information_flow',
    protocol: 'protocol',
    project: 'project',
  }[type];
  if (!table || !isUuid(id)) return null;
  const { rows } = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return rows[0] || null;
}

/** Существование реестрового объекта — базовая проверка валидации (ТЗ §17). */
export async function registryObjectExists(type, id) {
  const object = await getRegistryObject(type, id);
  return Boolean(object);
}

/** Список информационных систем для выбора scope схемы. */
export async function listSystems(query = '', limit = 100) {
  const { rows } = await pool.query(
    `SELECT id, code, name, status, description
       FROM information_system
      WHERE code ILIKE $1 OR name ILIKE $1
      ORDER BY name
      LIMIT $2`,
    [`%${query}%`, Number(limit) || 100],
  );
  return rows;
}

/**
 * Список сред эксплуатации для выбора среды схемы развертывания (ADR-026).
 * Среды, выведенные из эксплуатации, не предлагаются: размещения RETIRED-среды в
 * состав схемы не попадают, поэтому схема по такой среде была бы пустой.
 */
export async function listEnvironments(query = '', limit = 100) {
  const { rows } = await pool.query(
    `SELECT id, code, name, status, criticality
       FROM environment
      WHERE (code ILIKE $1 OR name ILIKE $1)
        AND status <> 'RETIRED'
      ORDER BY code
      LIMIT $2`,
    [`%${query}%`, Number(limit) || 100],
  );
  return rows;
}

/** Паспорт информационной системы — корень scope для всех типов схем. */
export async function getInformationSystem(id) {
  if (!isUuid(id)) return null;
  const { rows } = await pool.query(
    `SELECT * FROM information_system WHERE id = $1`,
    [id],
  );
  return rows[0] || null;
}

/** Модули ИС (Container-уровень, ТЗ §10.2). */
export async function getModulesOfSystem(systemId) {
  if (!isUuid(systemId)) return [];
  const { rows } = await pool.query(
    `SELECT * FROM application_module WHERE information_system_id = $1 ORDER BY code`,
    [systemId],
  );
  return rows;
}

/**
 * Потоки, в которых участвуют модули указанной ИС (ТЗ §3, §10.1, §10.2).
 * В модели реестра v2.0 information_flow связывает application_module.
 */
export async function getSystemFlows(systemId, statuses = ['ACTIVE', 'PLANNED']) {
  if (!isUuid(systemId)) return [];
  const { rows } = await pool.query(
    `SELECT fl.id, fl.code, fl.name, fl.description, fl.status, fl.target_port, fl.source_port,
            sm.id AS source_id, sm.code AS source_code, sm.name AS source_name,
            sm.information_system_id AS source_system_id,
            tm.id AS target_id, tm.code AS target_code, tm.name AS target_name,
            tm.information_system_id AS target_system_id,
            p.id AS protocol_id, p.code AS protocol_code, p.name AS protocol_name,
            p.transport AS protocol_transport, p.default_port
     FROM information_flow fl
     JOIN application_module sm ON sm.id = fl.source_module_id
     JOIN application_module tm ON tm.id = fl.target_module_id
     JOIN protocol p ON p.id = fl.protocol_id
     WHERE (sm.information_system_id = $1 OR tm.information_system_id = $1)
       AND fl.status = ANY($2::text[])
     ORDER BY fl.code`,
    [systemId, statuses],
  );
  return rows;
}

/**
 * Размещения (module_deployment) экземпляров модулей ИС (ТЗ §10.3).
 * Объекты, выведенные из эксплуатации (`status = 'RETIRED'`), в схему
 * развертывания не попадают: ни экземпляр, ни его узел размещения, ни среда
 * (ADR-023). Правило действует и в панели «Потоки области» — она читает
 * размещения этим же запросом.
 *
 * Среда схемы развертывания (environmentId) сужает состав до размещений одной
 * среды: схема строится для одной среды эксплуатации (ADR-026). Пустое значение
 * (null) оставлено для вызовов, которым нужны все среды.
 */
export async function getSystemDeployments(systemId, state = 'ACTIVE', environmentId = null) {
  if (!isUuid(systemId)) return [];
  const { rows } = await pool.query(
    `SELECT md.id, md.deployment_role, md.deployment_state,
            mi.id AS instance_id, mi.name AS instance_name, mi.status AS instance_status,
            am.id AS module_id, am.code AS module_code, am.name AS module_name,
            env.id AS environment_id, env.code AS environment_code, env.name AS environment_name,
            s.id AS server_id, s.name AS server_name, s.status AS server_status,
            c.id AS cluster_id, c.name AS cluster_name, c.status AS cluster_status, c.cluster_type
     FROM module_deployment md
     JOIN module_instance mi ON mi.id = md.module_instance_id
     JOIN application_module am ON am.id = mi.module_id
     JOIN environment env ON env.id = mi.environment_id
     LEFT JOIN server s ON s.id = md.server_id
     LEFT JOIN cluster c ON c.id = md.cluster_id
     WHERE am.information_system_id = $1 AND md.deployment_state = $2
       AND ($3::uuid IS NULL OR env.id = $3)
       AND mi.status <> 'RETIRED'
       AND COALESCE(s.status, 'ACTIVE') <> 'RETIRED'
       AND COALESCE(c.status, 'ACTIVE') <> 'RETIRED'
       AND env.status <> 'RETIRED'
     ORDER BY env.code, am.code, mi.name`,
    [systemId, state, environmentId],
  );
  return rows;
}

/** Экземпляры модулей ИС (Deployment Instance, ТЗ §10.3). */
export async function getInstancesOfSystem(systemId) {
  if (!isUuid(systemId)) return [];
  const { rows } = await pool.query(
    `SELECT mi.*, am.code AS module_code, am.name AS module_name,
            env.code AS environment_code, env.name AS environment_name
     FROM module_instance mi
     JOIN application_module am ON am.id = mi.module_id
     JOIN information_system isys ON isys.id = am.information_system_id
     JOIN environment env ON env.id = mi.environment_id
     WHERE isys.id = $1
     ORDER BY am.code, mi.name`,
    [systemId],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Область схемы «проект» (scope = project, ТЗ §10, FR-002).
// Схема в разрезе проекта включает все информационные потоки проекта и все
// модули, которые участвуют в проекте через эти интеграционные потоки.
// ---------------------------------------------------------------------------

/** Список проектов для выбора области схемы (аналог listSystems). */
export async function listProjects(query = '', limit = 100) {
  const { rows } = await pool.query(
    `SELECT p.id, p.code, p.name, p.status, p.description,
            COALESCE(fp.flows_cnt, 0) AS flows_cnt
       FROM project p
       LEFT JOIN (
         SELECT project_id, COUNT(*) AS flows_cnt
           FROM information_flow_project
          GROUP BY project_id
       ) fp ON fp.project_id = p.id
      WHERE p.code ILIKE $1 OR p.name ILIKE $1
      ORDER BY p.name
      LIMIT $2`,
    [`%${query}%`, Number(limit) || 100],
  );
  return rows.map((row) => ({ ...row, flows_cnt: Number(row.flows_cnt) }));
}

/** Паспорт проекта — корень scope для схем «в разрезе проекта». */
export async function getProject(id) {
  if (!isUuid(id)) return null;
  const { rows } = await pool.query(`SELECT * FROM project WHERE id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Информационные потоки проекта (пересечение information_flow ×
 * information_flow_project). Форма строки совпадает с getSystemFlows, поэтому
 * генератор схемы не зависит от типа области (ИС или проект).
 */
export async function getProjectFlows(projectId, statuses = ['ACTIVE', 'PLANNED']) {
  if (!isUuid(projectId)) return [];
  const { rows } = await pool.query(
    `SELECT fl.id, fl.code, fl.name, fl.description, fl.status, fl.target_port, fl.source_port,
            sm.id AS source_id, sm.code AS source_code, sm.name AS source_name,
            sm.information_system_id AS source_system_id,
            tm.id AS target_id, tm.code AS target_code, tm.name AS target_name,
            tm.information_system_id AS target_system_id,
            p.id AS protocol_id, p.code AS protocol_code, p.name AS protocol_name,
            p.transport AS protocol_transport, p.default_port
       FROM information_flow_project fp
       JOIN information_flow fl ON fl.id = fp.information_flow_id
       JOIN application_module sm ON sm.id = fl.source_module_id
       JOIN application_module tm ON tm.id = fl.target_module_id
       JOIN protocol p ON p.id = fl.protocol_id
      WHERE fp.project_id = $1
        AND fl.status = ANY($2::text[])
      ORDER BY fl.code`,
    [projectId, statuses],
  );
  return rows;
}

/** Модули, участвующие в проекте через интеграционные потоки (Container-уровень). */
export async function getProjectModules(projectId) {
  if (!isUuid(projectId)) return [];
  const { rows } = await pool.query(
    `SELECT am.*
       FROM application_module am
      WHERE am.id IN (
        SELECT fl.source_module_id
          FROM information_flow_project fp
          JOIN information_flow fl ON fl.id = fp.information_flow_id
         WHERE fp.project_id = $1
        UNION
        SELECT fl.target_module_id
          FROM information_flow_project fp
          JOIN information_flow fl ON fl.id = fp.information_flow_id
         WHERE fp.project_id = $1
      )
      ORDER BY am.code`,
    [projectId],
  );
  return rows;
}

/** Информационные системы, которым принадлежит указанный набор модулей. */
export async function getSystemsOfModules(moduleIds = []) {
  const ids = uuidList(moduleIds);
  if (ids.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT isys.*
       FROM information_system isys
       JOIN application_module am ON am.information_system_id = isys.id
      WHERE am.id = ANY($1::uuid[])
      ORDER BY isys.code`,
    [ids],
  );
  return rows;
}

/**
 * Размещения экземпляров указанного набора модулей (scope = проект, ТЗ §10.3).
 * Объекты, выведенные из эксплуатации (`status = 'RETIRED'`), в схему
 * развертывания не попадают: ни экземпляр, ни его узел размещения, ни среда
 * (ADR-023). Правило действует и в панели «Потоки области» — она читает
 * размещения этим же запросом.
 *
 * Среда схемы развертывания (environmentId) сужает состав до размещений одной
 * среды: схема строится для одной среды эксплуатации (ADR-026). Пустое значение
 * (null) оставлено для вызовов, которым нужны все среды.
 */
export async function getModuleDeployments(moduleIds = [], state = 'ACTIVE', environmentId = null) {
  const ids = uuidList(moduleIds);
  if (ids.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT md.id, md.deployment_role, md.deployment_state,
            mi.id AS instance_id, mi.name AS instance_name, mi.status AS instance_status,
            am.id AS module_id, am.code AS module_code, am.name AS module_name,
            env.id AS environment_id, env.code AS environment_code, env.name AS environment_name,
            s.id AS server_id, s.name AS server_name, s.status AS server_status,
            c.id AS cluster_id, c.name AS cluster_name, c.status AS cluster_status, c.cluster_type
       FROM module_deployment md
       JOIN module_instance mi ON mi.id = md.module_instance_id
       JOIN application_module am ON am.id = mi.module_id
       JOIN environment env ON env.id = mi.environment_id
       LEFT JOIN server s ON s.id = md.server_id
       LEFT JOIN cluster c ON c.id = md.cluster_id
      WHERE am.id = ANY($1::uuid[]) AND md.deployment_state = $2
        AND ($3::uuid IS NULL OR env.id = $3)
        AND mi.status <> 'RETIRED'
        AND COALESCE(s.status, 'ACTIVE') <> 'RETIRED'
        AND COALESCE(c.status, 'ACTIVE') <> 'RETIRED'
        AND env.status <> 'RETIRED'
      ORDER BY env.code, am.code, mi.name`,
    [ids, state, environmentId],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Сетевые адреса развертывания (адресные схемы Deployment, ТЗ §10.3)
// Адрес узла размещения хранится в network_interface: владелец server_id —
// адрес сервера, владелец cluster_id — адрес кластера (роль в кластере:
// INGRESS, NODE, MANAGEMENT). Адрес со средой NULL действует во всех средах,
// поэтому вместе с адресом конкретной среды возвращаются и «общие» адреса узла:
// предпочтённый адрес (приоритет роли) задаёт сетевой сегмент узла, а значит
// контур схемы развертывания (ADR-025).
// ---------------------------------------------------------------------------

/** Приоритет роли адреса: точка входа важнее адреса узла, затем управление. */
export const ADDRESS_ROLE_PRIORITY = [
  'SERVICE',
  'INGRESS',
  'VIRTUAL',
  'NODE',
  'MANAGEMENT',
  'BACKUP',
  'OTHER',
];

/** Ключ узла размещения в индексе адресов: server:<id> или cluster:<id>. */
export const ownerAddressKey = (ownerType, ownerId) => `${ownerType}:${ownerId}`;

/**
 * Адреса узлов размещения (server/cluster) вместе с их сетевым сегментом.
 * Возвращает строки с owner_type/owner_id, поэтому индекс строится в graph.js.
 * Владелец адреса — server_id или cluster_id (ровно одно поле).
 * Сетевой сегмент адреса нужен схеме развертывания: контур схемы — сегмент узла
 * размещения, поэтому вместе с адресом возвращаются network_segment и его зона
 * (ADR-025).
 */
export async function getDeploymentAddresses({ serverIds = [], clusterIds = [] } = {}) {
  const servers = uuidList(serverIds);
  const clusters = uuidList(clusterIds);
  const rows = [];

  if (servers.length > 0 || clusters.length > 0) {
    const { rows: ownerRows } = await pool.query(
      `SELECT CASE WHEN ni.cluster_id IS NOT NULL THEN 'cluster' ELSE 'server' END AS owner_type,
              COALESCE(ni.cluster_id, ni.server_id) AS owner_id,
              ni.name, ni.ip_address::text AS ip_address,
              COALESCE(ni.interface_role, 'OTHER') AS address_role,
              false AS is_primary, ni.status,
              ns.id AS segment_id, ns.code AS segment_code, ns.name AS segment_name,
              ns.status AS segment_status,
              nz.code AS zone_code, nz.name AS zone_name
         FROM network_interface ni
         LEFT JOIN network_segment ns ON ns.id = ni.network_segment_id
         LEFT JOIN network_zone nz ON nz.id = ns.network_zone_id
        WHERE (ni.server_id = ANY($1::uuid[]) OR ni.cluster_id = ANY($2::uuid[]))
          AND ni.ip_address IS NOT NULL
          AND ni.status <> 'RETIRED'
        ORDER BY ni.ip_address`,
      [servers, clusters],
    );
    rows.push(...ownerRows);
  }

  if (clusters.length > 0) {
    // Совместимость с прежней моделью: если у кластера адресов в
    // network_interface нет, используется единственный адрес управления
    // cluster.management_address. Сетевого сегмента у такого адреса нет, поэтому
    // узел размещения не попадает в контур сегмента — это фиксирует валидация.
    const { rows: legacyRows } = await pool.query(
      `SELECT c.id AS owner_id, 'cluster' AS owner_type,
              'cluster.management_address' AS name, c.management_address AS ip_address,
              'MANAGEMENT' AS address_role, false AS is_primary, 'ACTIVE' AS status,
              NULL::uuid AS segment_id, NULL::text AS segment_code,
              NULL::text AS segment_name, NULL::text AS segment_status,
              NULL::text AS zone_code, NULL::text AS zone_name
         FROM cluster c
        WHERE c.id = ANY($1::uuid[])
          AND c.management_address IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM network_interface ni WHERE ni.cluster_id = c.id
          )`,
      [clusters],
    );
    rows.push(...legacyRows);
  }

  return rows;
}
