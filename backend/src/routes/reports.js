import express from 'express';
import pool from '../db.js';

/**
 * Отчёты реестра — раздел «Отчеты» приложения.
 *
 * Отчёт «Сетевые взаимодействия» показывает информационные потоки в разрезе
 * «с какого адреса на какой»: поток описан на уровне модулей (information_flow),
 * адрес стороны берётся из размещения экземпляра модуля (module_deployment ->
 * server/cluster -> network_interface) с тем же приоритетом роли адреса, что и в
 * представлении v15a_instance_primary_address (SERVICE -> INGRESS -> VIRTUAL ->
 * NODE -> MANAGEMENT), поэтому отчёт согласован с v16_flow_addresses.
 *
 * Отличие от v16: стороны соединены LEFT JOIN, поэтому поток остаётся в отчёте,
 * даже если экземпляр модуля, размещение или адрес не заведены. Такие строки
 * несут NULL в адресных полях и помечаются на клиенте («адрес не
 * зарегистрирован», «размещение не задано»): без этого отчёт был бы пуст на
 * данных, где адреса ещё не описаны (У9/Б4 протокола замечаний к ТЗ
 * по схемам развертывания).
 */

const router = express.Router();

/** Состояния потока по умолчанию — как в v16_flow_addresses. */
const DEFAULT_STATUSES = ['ACTIVE', 'PLANNED'];

/** Допустимые состояния потока (CHECK information_flow_status_check). */
const FLOW_STATUSES = ['PLANNED', 'ACTIVE', 'RETIRED'];

/**
 * Базовый запрос отчёта: поток, протокол, порты, проекты и адреса сторон.
 * $1 — состояния потока, $2 — необязательный проект (фильтр по проекту).
 * Условия по источнику/получателю и среде добавляет buildFilters.
 */
const BASE_SQL = `
WITH flow_base AS (
  SELECT fl.id,
         fl.code                AS flow_code,
         fl.name                AS flow_name,
         fl.status              AS flow_status,
         fl.description         AS flow_description,
         fl.valid_from,
         fl.valid_to,
         p.code                 AS protocol_code,
         p.name                 AS protocol_name,
         p.transport            AS protocol_transport,
         COALESCE(fl.source_port, p.default_port) AS source_port,
         COALESCE(fl.target_port, p.default_port) AS target_port,
         sm.id                  AS source_module_id,
         sm.code                AS source_module_code,
         sm.name                AS source_module_name,
         sis.id                 AS source_is_id,
         sis.code               AS source_is_code,
         sis.name               AS source_is_name,
         tm.id                  AS target_module_id,
         tm.code                AS target_module_code,
         tm.name                AS target_module_name,
         tis.id                 AS target_is_id,
         tis.code               AS target_is_code,
         tis.name               AS target_is_name,
         prj.projects           AS project_codes
    FROM information_flow fl
    JOIN application_module sm  ON sm.id = fl.source_module_id
    JOIN application_module tm  ON tm.id = fl.target_module_id
    JOIN information_system sis ON sis.id = sm.information_system_id
    JOIN information_system tis ON tis.id = tm.information_system_id
    JOIN protocol p             ON p.id = fl.protocol_id
    LEFT JOIN LATERAL (
      SELECT string_agg(pj.code, ', ' ORDER BY pj.code) AS projects
        FROM information_flow_project ifp
        JOIN project pj ON pj.id = ifp.project_id
       WHERE ifp.information_flow_id = fl.id
    ) prj ON true
   WHERE fl.status = ANY($1::text[])
     AND ($2::uuid IS NULL OR EXISTS (
           SELECT 1 FROM information_flow_project ifp
            WHERE ifp.information_flow_id = fl.id AND ifp.project_id = $2::uuid))
),
placement AS (
  -- Размещения модулей: строка на экземпляр модуля в среде, адрес — предпочтительный
  -- по роли. Экземпляр без размещения или без адреса остаётся в выборке с NULL
  -- в узле и адресе.
  SELECT DISTINCT ON (mi.id, env.code)
         mi.module_id,
         mi.id    AS instance_id,
         mi.name  AS instance_name,
         env.code AS env_code,
         env.name AS env_name,
         CASE WHEN md.server_id IS NOT NULL THEN 'server'
              WHEN md.cluster_id IS NOT NULL THEN 'cluster' END AS owner_type,
         COALESCE(s.name, c.name) AS owner_name,
         ni.ip_address            AS address,
         ni.interface_role        AS address_role,
         ni.name                  AS address_name,
         sn.code                  AS segment_code,
         sz.code                  AS zone_code
    FROM module_instance mi
    JOIN environment env ON env.id = mi.environment_id
    LEFT JOIN module_deployment md
           ON md.module_instance_id = mi.id AND md.deployment_state = 'ACTIVE'
    LEFT JOIN server s  ON s.id = md.server_id
    LEFT JOIN cluster c ON c.id = md.cluster_id
    LEFT JOIN network_interface ni
           ON (ni.server_id = md.server_id OR ni.cluster_id = md.cluster_id)
          AND (ni.environment_id IS NULL OR ni.environment_id = mi.environment_id)
          AND COALESCE(ni.status, 'ACTIVE') = 'ACTIVE'
    LEFT JOIN network_segment sn ON sn.id = ni.network_segment_id
    LEFT JOIN network_zone sz ON sz.id = sn.network_zone_id
    ORDER BY mi.id, env.code,
             CASE ni.interface_role
               WHEN 'SERVICE'    THEN 0
               WHEN 'INGRESS'    THEN 1
               WHEN 'VIRTUAL'    THEN 2
               WHEN 'NODE'       THEN 3
               WHEN 'MANAGEMENT' THEN 4
               ELSE 5
             END,
             ni.ip_address
)
`;

/** Секция строк отчёта: поля потока, источника и получателя. */
const SELECT_SQL = `
SELECT fb.flow_code, fb.flow_name, fb.flow_status, fb.flow_description,
       fb.protocol_code, fb.protocol_name, fb.protocol_transport,
       fb.source_port, fb.target_port, fb.project_codes,
       fb.source_is_id, fb.source_is_code, fb.source_is_name,
       fb.source_module_id, fb.source_module_code, fb.source_module_name,
       sp.instance_id   AS source_instance_id,
       sp.instance_name AS source_instance_name,
       sp.env_code      AS source_env_code,
       sp.env_name      AS source_env_name,
       sp.owner_type    AS source_owner_type,
       sp.owner_name    AS source_owner_name,
       sp.address       AS source_address,
       sp.address_role  AS source_address_role,
       sp.address_name  AS source_address_name,
       sp.segment_code  AS source_segment_code,
       sp.zone_code     AS source_zone_code,
       fb.target_is_id, fb.target_is_code, fb.target_is_name,
       fb.target_module_id, fb.target_module_code, fb.target_module_name,
       tp.instance_id   AS target_instance_id,
       tp.instance_name AS target_instance_name,
       tp.env_code      AS target_env_code,
       tp.env_name      AS target_env_name,
       tp.owner_type    AS target_owner_type,
       tp.owner_name    AS target_owner_name,
       tp.address       AS target_address,
       tp.address_role  AS target_address_role,
       tp.address_name  AS target_address_name,
       tp.segment_code  AS target_segment_code,
       tp.zone_code     AS target_zone_code
  FROM flow_base fb
  LEFT JOIN placement sp ON sp.module_id = fb.source_module_id
  LEFT JOIN placement tp ON tp.module_id = fb.target_module_id
`;

/** Порядок строк: поток, затем источник и получатель. */
const ORDER_SQL = `
 ORDER BY fb.flow_code,
          sp.env_code NULLS LAST, sp.instance_name NULLS LAST,
          tp.env_code NULLS LAST, tp.instance_name NULLS LAST
`;

/**
 * Разбор значения фильтра «источник/получатель».
 * Формат: addr:<ip> | node:<узел> | module:<ИС/КОД> | instance:<экземпляр> | none
 * (none — сторона без зарегистрированного адреса).
 */
function parseSide(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw === 'none') return { kind: 'none', value: null };
  const index = raw.indexOf(':');
  if (index <= 0) return null;
  const kind = raw.slice(0, index);
  const text = raw.slice(index + 1);
  if (!['addr', 'node', 'module', 'instance'].includes(kind) || !text) return null;
  return { kind, value: text };
}

/** Условие фильтра по стороне потока (адрес, узел, экземпляр или модуль). */
function sideCondition(alias, prefix, side, params) {
  if (!side) return null;
  if (side.kind === 'none') return `(${alias}.address IS NULL)`;
  params.push(side.value);
  const placeholder = `$${params.length}`;
  switch (side.kind) {
    case 'addr':
      // ip_address — тип inet: адрес сравнивается без маски подсети (host()).
      return `(host(${alias}.address) = ${placeholder}::text)`;
    case 'node':
      return `(${alias}.owner_name = ${placeholder}::text)`;
    case 'instance':
      return `(${alias}.instance_name = ${placeholder}::text)`;
    case 'module':
    default:
      // Модуль однозначно адресуется парой «код ИС / код модуля» (FR-002).
      return `((fb.${prefix}_is_code || '/' || fb.${prefix}_module_code) = ${placeholder}::text)`;
  }
}

/**
 * Полный запрос отчёта: базовый SQL + условия фильтров + порядок строк.
 * $1 — состояния потока, $2 — проект, далее фильтры по источнику, получателю,
 * среде и поиску по коду/наименованию потока.
 */
function buildQuery(filters = {}) {
  const statuses = Array.isArray(filters.statuses) && filters.statuses.length > 0
    ? filters.statuses
    : DEFAULT_STATUSES;

  const params = [statuses, filters.projectId || null];
  const conditions = [];

  const source = sideCondition('sp', 'source', parseSide(filters.source), params);
  if (source) conditions.push(source);
  const target = sideCondition('tp', 'target', parseSide(filters.target), params);
  if (target) conditions.push(target);

  if (filters.environmentCode) {
    params.push(String(filters.environmentCode));
    const placeholder = `$${params.length}`;
    conditions.push(`(sp.env_code = ${placeholder}::text OR tp.env_code = ${placeholder}::text)`);
  }
  if (filters.q) {
    params.push(`%${String(filters.q).trim()}%`);
    const placeholder = `$${params.length}`;
    conditions.push(`(fb.flow_code ILIKE ${placeholder} OR fb.flow_name ILIKE ${placeholder})`);
  }

  const whereSql = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  return { text: `${BASE_SQL}${SELECT_SQL}${whereSql}${ORDER_SQL}`, params };
}

/**
 * Варианты фильтра «Источник»/«Получатель»: адрес, узел, экземпляр и модуль
 * стороны. Отдельный вариант «none» — сторона без зарегистрированного адреса.
 */
function buildSideOptions(rows, prefix) {
  const options = new Map();
  const push = (value, label) => {
    if (value && !options.has(value)) options.set(value, label);
  };

  for (const row of rows) {
    const address = row[`${prefix}_address`];
    const node = row[`${prefix}_owner_name`];
    const instance = row[`${prefix}_instance_name`];
    const environment = row[`${prefix}_env_code`];
    const isCode = row[`${prefix}_is_code`];
    const moduleCode = row[`${prefix}_module_code`];

    if (address) push(`addr:${address}`, `${address} · адрес`);
    if (node) {
      const kind = row[`${prefix}_owner_type`] === 'cluster' ? 'кластер' : 'сервер';
      push(`node:${node}`, `${node} · ${kind}`);
    }
    if (instance) push(`instance:${instance}`, `${instance} · экземпляр${environment ? ` (${environment})` : ''}`);
    if (isCode && moduleCode) push(`module:${isCode}/${moduleCode}`, `${isCode}/${moduleCode} · модуль`);
  }

  if (rows.some((row) => !row[`${prefix}_address`])) {
    push('none', 'Адрес не зарегистрирован');
  }
  return Array.from(options, ([value, label]) => ({ value, label }));
}

/** Варианты фильтра сред: среды обеих сторон потока. */
function buildEnvironmentOptions(rows) {
  const codes = new Set();
  for (const row of rows) {
    if (row.source_env_code) codes.add(row.source_env_code);
    if (row.target_env_code) codes.add(row.target_env_code);
  }
  return Array.from(codes)
    .sort()
    .map((code) => ({ value: code, label: code }));
}

/** Варианты фильтра проектов: проекты, в рамках которых задействованы потоки. */
function buildProjectOptions(rows) {
  const codes = new Set();
  for (const row of rows) {
    if (!row.project_codes) continue;
    for (const code of String(row.project_codes).split(',')) {
      const trimmed = code.trim();
      if (trimmed) codes.add(trimmed);
    }
  }
  return Array.from(codes)
    .sort()
    .map((code) => ({ value: code, label: code }));
}

/** Состояния потока с русскими подписями (совпадают с StatusTag реестра). */
const STATUS_LABELS = {
  PLANNED: 'Планируется',
  ACTIVE: 'В эксплуатации',
  RETIRED: 'Выведен из эксплуатации',
};

/**
 * GET /api/reports/network-interactions — отчёт «Сетевые взаимодействия»:
 * информационные потоки в разрезе «с какого адреса на какой» с фильтрацией
 * по источнику и получателю.
 *
 * Параметры запроса:
 *   source, target      — сторона потока: addr:<ip> | node:<узел> |
 *                         instance:<экземпляр> | module:<ИС/КОД> | none;
 *   environment         — код среды (PROD, TEST…), учитываются обе стороны;
 *   statuses            — состояния потока через запятую (по умолчанию ACTIVE,PLANNED);
 *   project             — код проекта (потоки, задействованные в проекте);
 *   q                   — поиск по коду/наименованию потока.
 *
 * Ответ: { total, rows, options, applied }: rows — строки отчёта, options —
 * варианты фильтров. Списки вариантов считаются без фильтров источника,
 * получателя, среды и поиска, чтобы выбор не «схлопывался» после фильтрации.
 */
router.get('/network-interactions', async (req, res, next) => {
  try {
    const statuses = String(req.query.statuses || req.query.status || '')
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter((value) => FLOW_STATUSES.includes(value));

    const projectCode = String(req.query.project || req.query.project_id || '').trim();
    const filters = {
      source: req.query.source,
      target: req.query.target,
      environmentCode: req.query.environment || req.query.environment_code,
      statuses,
      q: req.query.q,
      projectCode: projectCode || null,
    };

    // Проект в отчёте задаётся кодом (в фильтре удобнее код, чем uuid).
    if (filters.projectCode) {
      const { rows: projectRows } = await pool.query('SELECT id FROM project WHERE code = $1', [
        filters.projectCode,
      ]);
      filters.projectId = projectRows[0]?.id || null;
      if (!filters.projectId) {
        return res.json({
          total: 0,
          rows: [],
          options: { sources: [], targets: [], environments: [], projects: [], statuses: [] },
          applied: { ...filters, projectCode: filters.projectCode },
        });
      }
    }

    const filtered = buildQuery(filters);
    const { rows } = await pool.query(filtered.text, filtered.params);

    // Варианты фильтров — в границах отчёта (состояния и проект), но без
    // фильтров источника/получателя/среды/поиска.
    const scope = buildQuery({ statuses, projectId: filters.projectId });
    const { rows: scopeRows } = await pool.query(scope.text, scope.params);

    res.json({
      total: rows.length,
      rows,
      options: {
        sources: buildSideOptions(scopeRows, 'source'),
        targets: buildSideOptions(scopeRows, 'target'),
        environments: buildEnvironmentOptions(scopeRows),
        projects: buildProjectOptions(scopeRows),
        statuses: FLOW_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] || value })),
      },
      applied: {
        source: filters.source || null,
        target: filters.target || null,
        environment: filters.environmentCode || null,
        statuses: statuses.length > 0 ? statuses : DEFAULT_STATUSES,
        project: filters.projectCode,
        q: filters.q || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
