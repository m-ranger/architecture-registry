import express from 'express';
import pool from '../db.js';

/**
 * Отчёты реестра — раздел «Отчеты» приложения.
 *
 * 1. «Сетевые взаимодействия» (GET /reports/network-interactions) показывает
 *    информационные потоки в разрезе «с какого адреса на какой»: поток описан на
 *    уровне модулей (information_flow), адрес стороны берётся из размещения
 *    экземпляра модуля (module_deployment -> server/cluster -> network_interface)
 *    с тем же приоритетом роли адреса, что и в представлении
 *    v15a_instance_primary_address (SERVICE -> INGRESS -> VIRTUAL -> NODE ->
 *    MANAGEMENT), поэтому отчёт согласован с v16_flow_addresses.
 *
 *    Поток показывается только внутри одной среды (Test -> Test, Prod -> Prod):
 *    пара сторон из разных сред в отчёт не попадает, а её количество и разбивка
 *    по парам сред возвращаются в `excluded` — правило видно в интерфейсе.
 *    Пара, у которой среда одной из сторон неизвестна (экземпляр или размещение
 *    не заведены), правило не нарушает и остаётся в отчёте с пометкой.
 *
 *    Отличие от v16 (кроме правила сред): стороны соединены LEFT JOIN, поэтому
 *    поток остаётся в отчёте, даже если экземпляр модуля, размещение или адрес не
 *    заведены. Такие строки несут NULL в адресных полях и помечаются на клиенте
 *    («адрес не зарегистрирован», «размещение не задано»): без этого отчёт был бы
 *    пуст на данных, где адреса ещё не описаны (У9/Б4 протокола замечаний к ТЗ
 *    по схемам развертывания).
 *
 * 2. «Матрица информационных потоков» (GET /reports/flow-matrix) — логическая
 *    матрица «модуль-источник x модуль-назначение»: оси — модули реестра, ячейка —
 *    потоки между парой модулей. Представление v05_information_flow_matrix не
 *    содержит идентификаторов модулей и сред их экземпляров, поэтому матрица
 *    собирается из тех же таблиц, что и отчёт, но отдельными запросами осей и
 *    ячеек (FR-010, REQ-020: диагональ матрицы пуста, поток идёт между модулями).
 */

const router = express.Router();

/** Состояния потока по умолчанию — как в v16_flow_addresses. */
const DEFAULT_STATUSES = ['ACTIVE', 'PLANNED'];

/** Допустимые состояния потока (CHECK information_flow_status_check). */
const FLOW_STATUSES = ['PLANNED', 'ACTIVE', 'RETIRED'];

/**
 * Правило «одна среда на поток»: поток не может идти из одной среды в другую —
 * Test только на Test, Prod на Prod (так же стороны соединяются в
 * v16_flow_addresses по environment_id). Пара, у которой среда одной из сторон
 * неизвестна (нет экземпляра или размещения), правило не нарушает: строку
 * оставляем в отчёте с пометкой о неполных данных.
 */
const SAME_ENVIRONMENT_SQL =
  '(sp.env_code IS NULL OR tp.env_code IS NULL OR sp.env_code = tp.env_code)';

/** Пары сторон с известными и разными средами — такие строки отчёт не показывает. */
const CROSS_ENVIRONMENT_SQL =
  '(sp.env_code IS NOT NULL AND tp.env_code IS NOT NULL AND sp.env_code <> tp.env_code)';

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
`;

/**
 * Соединение потоков с размещениями сторон. LEFT JOIN — поток без экземпляра,
 * размещения или адреса остаётся в отчёте с NULL в адресных полях.
 */
const JOIN_SQL = `
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
 * Полный запрос отчёта: базовый SQL + соединения + условия фильтров + порядок строк.
 * $1 — состояния потока, $2 — проект, далее фильтры по источнику, получателю,
 * среде и поиску по коду/наименованию потока.
 *
 * mode:
 *   'rows'       — строки отчёта; действует правило «одна среда на поток»
 *                  (Test -> Test, Prod -> Prod), пары из разных сред скрыты;
 *   'crossCount' — сводка по скрытым парам: количество строк на каждую пару сред
 *                  «источник -> получатель» (возвращается в `excluded`).
 */
function buildQuery(filters = {}, mode = 'rows') {
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

  if (mode === 'crossCount') {
    // Скрытые пары из разных сред: группируем по паре «среда источника -> среда
    // получателя», чтобы в интерфейсе было видно, почему строк меньше.
    conditions.push(CROSS_ENVIRONMENT_SQL);
    const whereSql = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    return {
      text: `${BASE_SQL}
SELECT sp.env_code::text AS source_env_code,
       tp.env_code::text AS target_env_code,
       count(*)::int     AS total
${JOIN_SQL}${whereSql}
 GROUP BY sp.env_code, tp.env_code
 ORDER BY sp.env_code, tp.env_code`,
      params,
    };
  }

  conditions.push(SAME_ENVIRONMENT_SQL);
  const whereSql = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  return { text: `${BASE_SQL}${SELECT_SQL}${JOIN_SQL}${whereSql}${ORDER_SQL}`, params };
}

/**
 * Идентификатор проекта по коду: фильтры отчётов задаются кодом проекта
 * (A24-8394), а не uuid — так удобнее и в query-строке, и в интерфейсе.
 */
async function resolveProjectId(code) {
  const trimmed = String(code || '').trim();
  if (!trimmed) return null;
  const { rows } = await pool.query('SELECT id FROM project WHERE code = $1', [trimmed]);
  return rows[0]?.id || null;
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
 * Ответ: { total, rows, excluded, options, applied }: rows — строки отчёта,
 * excluded — скрытые правилом «одна среда на поток» пары (количество и разбивка
 * по парам сред), options — варианты фильтров. Списки вариантов считаются без
 * фильтров источника, получателя, среды и поиска, чтобы выбор не «схлопывался»
 * после фильтрации.
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
      filters.projectId = await resolveProjectId(filters.projectCode);
      if (!filters.projectId) {
        return res.json({
          total: 0,
          rows: [],
          excluded: { crossEnvironment: 0, pairs: [] },
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

    // Скрытые пары сторон из разных сред: правило «Test только на Test, Prod на
    // Prod» (см. SAME_ENVIRONMENT_SQL) — возвращаем, чтобы в интерфейсе было
    // видно, сколько строк не показано и почему.
    const crossed = buildQuery(filters, 'crossCount');
    const { rows: crossRows } = await pool.query(crossed.text, crossed.params);
    const pairs = crossRows.map((row) => ({
      sourceEnvCode: row.source_env_code,
      targetEnvCode: row.target_env_code,
      total: row.total,
    }));

    res.json({
      total: rows.length,
      rows,
      excluded: {
        crossEnvironment: pairs.reduce((sum, pair) => sum + pair.total, 0),
        pairs,
      },
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

// ---------------------------------------------------------------------------
// «Матрица информационных потоков» (GET /api/reports/flow-matrix)
// ---------------------------------------------------------------------------

/**
 * Условия отбора потоков матрицы: состояния потока, проект, поиск по коду или
 * наименованию и фокус на одной ИС. Возвращает SQL-фрагменты и значения
 * параметров; фрагменты подставляются и в запрос ячеек матрицы, и в запрос её
 * осей (модулей), поэтому нумерация $n у обоих запросов общая:
 *   $1 — состояния потока, $2 — uuid проекта, $3 — поиск, $4 — код ИС.
 * Псевдоним потока в подставляемых запросах — fl.
 */
function matrixFlowFilters(filters = {}) {
  const statuses = Array.isArray(filters.statuses) && filters.statuses.length > 0
    ? filters.statuses
    : DEFAULT_STATUSES;

  const params = [
    statuses,
    filters.projectId || null,
    filters.q ? `%${String(filters.q).trim()}%` : null,
    filters.isCode || null,
  ];

  const conditions = [
    'fl.status = ANY($1::text[])',
    `($2::uuid IS NULL OR EXISTS (
        SELECT 1 FROM information_flow_project ifp
         WHERE ifp.information_flow_id = fl.id AND ifp.project_id = $2::uuid))`,
    '($3::text IS NULL OR fl.code ILIKE $3::text OR fl.name ILIKE $3::text)',
    // Фокус на одной ИС: рассматриваются только потоки внутри неё, поэтому оси и
    // ячейки матрицы согласованы (матрица остаётся квадратной).
    `($4::text IS NULL OR (
        EXISTS (SELECT 1 FROM application_module m
                  JOIN information_system i ON i.id = m.information_system_id
                 WHERE m.id = fl.source_module_id AND i.code = $4::text)
     AND EXISTS (SELECT 1 FROM application_module m
                  JOIN information_system i ON i.id = m.information_system_id
                 WHERE m.id = fl.target_module_id AND i.code = $4::text)))`,
  ];

  return { conditions, params };
}

/**
 * Ячейки матрицы — отобранные потоки с протоколом, портами и проектами.
 * Поток описан парой модулей (source_module_id / target_module_id), поэтому
 * диагональ матрицы пуста: поток модуля «сам в себя» запрещён (REQ-020).
 */
const matrixFlowsSql = (whereSql) => `
SELECT fl.id,
       fl.code,
       fl.name,
       fl.status,
       fl.source_module_id,
       fl.target_module_id,
       p.code      AS protocol_code,
       p.name      AS protocol_name,
       p.transport AS protocol_transport,
       COALESCE(fl.source_port, p.default_port) AS source_port,
       COALESCE(fl.target_port, p.default_port) AS target_port,
       prj.project_codes
  FROM information_flow fl
  JOIN protocol p ON p.id = fl.protocol_id
  LEFT JOIN LATERAL (
        SELECT string_agg(pj.code, ', ' ORDER BY pj.code) AS project_codes
          FROM information_flow_project ifp
          JOIN project pj ON pj.id = ifp.project_id
         WHERE ifp.information_flow_id = fl.id
       ) prj ON true
 WHERE ${whereSql}
 ORDER BY fl.code
`;

/**
 * Оси матрицы — модули реестра (строки и столбцы) со средой их экземпляров.
 * $5 — показывать выведенные из эксплуатации модули, $6 — только модули,
 * участвующие в отобранных потоках. Модуль, участвующий в отобранном потоке,
 * всегда попадает в оси, даже если он выведен из эксплуатации: иначе поток
 * «потерялся» бы в матрице.
 */
const matrixModulesSql = (whereSql) => `
SELECT am.id,
       am.code,
       am.name,
       am.status,
       isys.id   AS information_system_id,
       isys.code AS is_code,
       isys.name AS is_name,
       COALESCE(envs.env_codes, '') AS env_codes
  FROM application_module am
  JOIN information_system isys ON isys.id = am.information_system_id
  LEFT JOIN LATERAL (
        SELECT string_agg(DISTINCT env.code, ',' ORDER BY env.code) AS env_codes
          FROM module_instance mi
          JOIN environment env ON env.id = mi.environment_id
         WHERE mi.module_id = am.id
       ) envs ON true
 WHERE (
         (NOT $6::bool)
         AND ($5::bool OR am.status <> 'RETIRED')
         AND ($4::text IS NULL OR isys.code = $4::text)
       )
    OR EXISTS (
         SELECT 1 FROM information_flow fl
          WHERE (fl.source_module_id = am.id OR fl.target_module_id = am.id)
            AND ${whereSql})
 ORDER BY isys.code, am.code
`;

/**
 * GET /api/reports/flow-matrix — «Матрица информационных потоков» на данных
 * реестра (аналог представления v05_information_flow_matrix и раздела 14 ТЗ):
 * строка — модуль-источник, столбец — модуль-назначение, ячейка — потоки между
 * парой модулей.
 *
 * Параметры запроса:
 *   statuses         — состояния потока через запятую (по умолчанию ACTIVE,PLANNED);
 *   project          — код проекта (потоки, задействованные в проекте);
 *   is               — код ИС: матрица внутри одной информационной системы;
 *   q                — поиск по коду/наименованию потока;
 *   onlyInvolved=1   — только модули, между которыми есть отобранные потоки;
 *   includeRetired=1 — показывать выведенные из эксплуатации модули.
 *
 * Ответ: { modules, flows, summary, options, applied }: оси (modules) и ячейки
 * (flows) отдаются раздельно — клиент группирует потоки по паре модулей, а
 * summary даёт количество модулей, потоков и заполненных ячеек.
 *
 * Правило «одна среда на поток» отчёта «Сетевые взаимодействия» здесь не
 * применяется: матрица логическая и связывает модули, а не адреса в средах
 * (среды экземпляров модуля отдаются в module.env_codes как справка).
 */
router.get('/flow-matrix', async (req, res, next) => {
  try {
    const statuses = String(req.query.statuses || req.query.status || '')
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter((value) => FLOW_STATUSES.includes(value));

    const projectCode = String(req.query.project || req.query.project_id || '').trim();
    const isCode = String(
      req.query.is || req.query.informationSystem || req.query.information_system || '',
    ).trim();

    const filters = {
      statuses,
      projectCode: projectCode || null,
      isCode: isCode || null,
      q: req.query.q,
      onlyInvolved: String(req.query.onlyInvolved || '') === '1',
      includeRetired: String(req.query.includeRetired || '') === '1',
    };

    // Проект задаётся кодом (в фильтре удобнее код, чем uuid).
    if (filters.projectCode) {
      filters.projectId = await resolveProjectId(filters.projectCode);
      if (!filters.projectId) {
        return res.json({
          modules: [],
          flows: [],
          summary: emptyMatrixSummary(),
          options: await matrixOptions(),
          applied: matrixApplied(filters),
        });
      }
    }

    const { conditions, params } = matrixFlowFilters(filters);
    const whereSql = conditions.join(' AND ');

    // Оси матрицы: к общим параметрам фильтров добавляются $5 (выведенные модули)
    // и $6 (только участвующие в потоках) — их использует matrixModulesSql.
    const { rows: modules } = await pool.query(matrixModulesSql(whereSql), [
      ...params,
      filters.includeRetired,
      filters.onlyInvolved,
    ]);
    const { rows: flows } = await pool.query(matrixFlowsSql(whereSql), params);

    res.json({
      modules,
      flows,
      summary: {
        modules: modules.length,
        flows: flows.length,
        // Заполненные ячейки — пары «источник -> назначение» с хотя бы одним потоком.
        cells: new Set(flows.map((flow) => `${flow.source_module_id}|${flow.target_module_id}`)).size,
        informationSystems: new Set(modules.map((module) => module.is_code)).size,
        statuses: countByStatus(flows),
      },
      options: await matrixOptions(),
      applied: matrixApplied(filters),
    });
  } catch (err) {
    next(err);
  }
});

/** Пустая сводка матрицы — для случая «проект не найден». */
function emptyMatrixSummary() {
  return { modules: 0, flows: 0, cells: 0, informationSystems: 0, statuses: countByStatus([]) };
}

/** Количество потоков по состояниям: { ACTIVE: 2, PLANNED: 3, RETIRED: 0 }. */
function countByStatus(flows) {
  const counts = Object.fromEntries(FLOW_STATUSES.map((status) => [status, 0]));
  for (const flow of flows) {
    counts[flow.status] = (counts[flow.status] || 0) + 1;
  }
  return counts;
}

/**
 * Варианты фильтров матрицы: информационные системы (оси), проекты потоков и
 * состояния (легенда). Справочники отдаются целиком, чтобы выбор не
 * «схлопывался» после применения фильтров.
 */
async function matrixOptions() {
  const [{ rows: informationSystems }, { rows: projects }] = await Promise.all([
    pool.query(`
      SELECT isys.code AS value, isys.code || ' — ' || isys.name AS label
        FROM information_system isys
       ORDER BY isys.code
    `),
    pool.query(`
      SELECT DISTINCT pj.code AS value, pj.code || ' — ' || pj.name AS label
        FROM information_flow_project ifp
        JOIN project pj ON pj.id = ifp.project_id
       ORDER BY 1
    `),
  ]);

  return {
    informationSystems,
    projects,
    statuses: FLOW_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] || value })),
  };
}

/** Применённые фильтры матрицы — эхо для интерфейса. */
function matrixApplied(filters) {
  return {
    statuses: filters.statuses.length > 0 ? filters.statuses : DEFAULT_STATUSES,
    project: filters.projectCode,
    informationSystem: filters.isCode,
    q: filters.q || null,
    onlyInvolved: filters.onlyInvolved,
    includeRetired: filters.includeRetired,
  };
}

export default router;
