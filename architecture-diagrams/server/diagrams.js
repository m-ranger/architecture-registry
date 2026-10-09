import pool from './db.js';
import { normalizeContainers } from './layout.js';

/**
 * Репозиторий диаграмм (ТЗ §7, §8, §18).
 * Реляционная БД хранит связи и поиск, JSON snapshot обеспечивает
 * воспроизводимость версии. Публикация делает snapshot неизменяемым.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER = process.env.MODULE_USER || 'diagram-module';

/**
 * Типы области (scope) схемы: информационная система или проект.
 * Значения совпадают с SCOPE_TYPES генератора графа (server/graph.js, ТЗ §10).
 */
const SCOPE_TYPES = ['information_system', 'project'];

const httpError = (status, message) => Object.assign(new Error(message), { status });

/** style_json = style узла + описание (описание не дублирует реестр, а поясняет схему). */
function packStyle(node) {
  const { variant, code, status, role, ...rest } = node.style || {};
  return {
    variant: variant || 'application',
    ...(code ? { code } : {}),
    ...(status ? { status } : {}),
    ...(role ? { role } : {}),
    ...rest,
    ...(node.description ? { description: node.description } : {}),
  };
}

function unpackStyle(styleJson) {
  const style = styleJson || {};
  const { description, ...rest } = style;
  return { style: rest, description: description || null };
}

const mapDiagramRow = (row) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: row.description,
  diagramType: row.diagram_type,
  scopeType: row.scope_type,
  scopeObjectId: row.scope_object_id,
  // Срез схемы по среде (диаграмма развертывания в разрезе среды, ТЗ §10.3).
  scopeEnvironmentId: row.scope_environment_id || null,
  status: row.status,
  revision: row.revision,
  publishedVersion: row.published_version,
  dependenciesDirty: row.dependencies_dirty,
  createdAt: row.created_at,
  createdBy: row.created_by,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
});

/** Список схем с количеством узлов и связей (FR-001, FR-011). */
export async function listDiagrams() {
  const { rows } = await pool.query(`
    SELECT d.*,
      COALESCE(n.node_count, 0) AS node_count,
      COALESCE(e.edge_count, 0) AS edge_count,
      COALESCE(isys.name, prj.name) AS scope_name,
      COALESCE(isys.code, prj.code) AS scope_code,
      env.code AS environment_code,
      env.name AS environment_name
    FROM architecture_diagram d
    LEFT JOIN (
      SELECT diagram_id, COUNT(*) AS node_count
      FROM architecture_diagram_element GROUP BY diagram_id
    ) n ON n.diagram_id = d.id
    LEFT JOIN (
      SELECT diagram_id, COUNT(*) AS edge_count
      FROM architecture_diagram_relationship GROUP BY diagram_id
    ) e ON e.diagram_id = d.id
    -- Область схемы — информационная система или проект: код и наименование
    -- берутся из таблицы, соответствующей scope_type (ТЗ §10).
    LEFT JOIN information_system isys
      ON d.scope_type = 'information_system' AND isys.id = d.scope_object_id
    LEFT JOIN project prj
      ON d.scope_type = 'project' AND prj.id = d.scope_object_id
    -- Срез схемы по среде: у схемы развертывания может быть выбрана одна среда.
    LEFT JOIN environment env ON env.id = d.scope_environment_id
    ORDER BY d.updated_at DESC
  `);
  return rows.map((row) => ({
    ...mapDiagramRow(row),
    nodeCount: Number(row.node_count),
    edgeCount: Number(row.edge_count),
    scopeName: row.scope_name,
    scopeCode: row.scope_code,
    environmentCode: row.environment_code || null,
    environmentName: row.environment_name || null,
  }));
}

/** Карточка схемы по id или code. */
export async function findDiagram(idOrCode) {
  const column = UUID_RE.test(idOrCode) ? 'id' : 'code';
  const { rows } = await pool.query(
    `SELECT * FROM architecture_diagram WHERE ${column} = $1`,
    [idOrCode],
  );
  if (!rows[0]) throw httpError(404, `Схема ${idOrCode} не найдена`);
  return rows[0];
}

/** Полная схема: карточка + внутренняя графовая модель (ТЗ §8). */
export async function getDiagramGraph(idOrCode) {
  const diagram = await findDiagram(idOrCode);

  const [elementRes, relationshipRes] = await Promise.all([
    pool.query(
      `SELECT * FROM architecture_diagram_element WHERE diagram_id = $1 ORDER BY node_key`,
      [diagram.id],
    ),
    pool.query(
      `SELECT r.*, s.node_key AS source_node_key, t.node_key AS target_node_key
       FROM architecture_diagram_relationship r
       JOIN architecture_diagram_element s ON s.id = r.source_element_id
       JOIN architecture_diagram_element t ON t.id = r.target_element_id
       WHERE r.diagram_id = $1
       ORDER BY r.edge_key`,
      [diagram.id],
    ),
  ]);

  const nodes = elementRes.rows.map((row) => {
    const { style, description } = unpackStyle(row.style_json);
    return {
      id: row.node_key,
      registryRef: row.registry_object_id
        ? { type: row.registry_object_type, id: row.registry_object_id }
        : null,
      c4Type: row.c4_type,
      parent: row.parent_key,
      name: row.label,
      technology: row.technology,
      description,
      position: { x: Number(row.x), y: Number(row.y) },
      size: { width: Number(row.width), height: Number(row.height) },
      style,
    };
  });

  const edges = relationshipRes.rows.map((row) => ({
    id: row.edge_key,
    source: row.source_node_key,
    target: row.target_node_key,
    registryRef: row.information_flow_id
      ? { type: 'information_flow', id: row.information_flow_id }
      : null,
    label: row.label || '',
    technology: row.technology || null,
    routing: row.routing_json || null,
  }));

  return {
    diagram: mapDiagramRow(diagram),
    graph: {
      schemaVersion: '1.0',
      diagram: {
        id: diagram.id,
        type: String(diagram.diagram_type).toLowerCase(),
        scope: {
          objectType: diagram.scope_type,
          objectId: diagram.scope_object_id,
          // Срез по среде: схема развертывания одной среды (NULL — все среды).
          environmentId: diagram.scope_environment_id || null,
        },
      },
      nodes,
      edges,
    },
  };
}

/** Срез схемы по среде: environmentId опционален и должен быть корректным UUID. */
function normalizeEnvironmentId(environmentId) {
  if (!environmentId) return null;
  if (!UUID_RE.test(String(environmentId))) {
    throw httpError(400, `Некорректный environmentId: ${environmentId}`);
  }
  return String(environmentId);
}

/** Создание схемы (FR-001, ТЗ §12 POST /api/diagrams). */
export async function createDiagram(input) {
  const { code, name, description, diagramType, scopeType, scopeObjectId, environmentId } = input;
  if (!code || !name || !diagramType) {
    throw httpError(400, 'Поля code, name и diagramType обязательны');
  }
  if (!['SYSTEM_CONTEXT', 'CONTAINER', 'DEPLOYMENT'].includes(String(diagramType).toUpperCase())) {
    throw httpError(400, `Неподдерживаемый diagramType: ${diagramType}`);
  }
  // Область схемы: информационная система (по умолчанию) или проект.
  const scope = scopeType || 'information_system';
  if (!SCOPE_TYPES.includes(scope)) {
    throw httpError(400, `Неподдерживаемый scopeType: ${scopeType}`);
  }
  const environment = normalizeEnvironmentId(environmentId);
  const { rows } = await pool.query(
    `INSERT INTO architecture_diagram
       (code, name, description, diagram_type, scope_type, scope_object_id, scope_environment_id,
        created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
     RETURNING *`,
    [
      code,
      name,
      description || null,
      String(diagramType).toUpperCase(),
      scope,
      scopeObjectId || null,
      environment,
      USER,
    ],
  );
  return mapDiagramRow(rows[0]);
}

/**
 * Смена среза схемы по среде (ТЗ §10.3).
 * environmentId = null — срез снимается, схема показывает все среды.
 * Граф после смены среза перестраивается вызывающим кодом (POST .../generate).
 */
export async function updateDiagramSlice(idOrCode, environmentId = null) {
  const diagram = await findDiagram(idOrCode);
  const environment = normalizeEnvironmentId(environmentId);
  const { rows } = await pool.query(
    `UPDATE architecture_diagram
        SET scope_environment_id = $2,
            updated_at = now(),
            updated_by = $3,
            dependencies_dirty = false
      WHERE id = $1
      RETURNING *`,
    [diagram.id, environment, USER],
  );
  return mapDiagramRow(rows[0]);
}

/** Удаление схемы вместе с элементами и версиями (ON DELETE CASCADE). */
export async function deleteDiagram(idOrCode) {
  const diagram = await findDiagram(idOrCode);
  await pool.query(`DELETE FROM architecture_diagram WHERE id = $1`, [diagram.id]);
  return { deleted: true };
}

const NODE_COLUMNS =
  'diagram_id, node_key, registry_object_type, registry_object_id, c4_type, parent_key, ' +
  'label, technology, x, y, width, height, style_json';
const EDGE_COLUMNS =
  'diagram_id, edge_key, source_element_id, target_element_id, information_flow_id, ' +
  'label, technology, routing_json';

const CHUNK = 100;

/**
 * Атомарная запись графа: элементы и связи заменяются целиком внутри транзакции.
 * Выполняется на одном клиенте, поэтому схема никогда не остаётся частично записанной.
 */
async function writeGraph(client, diagramId, graph) {
  // Инвариант схемы развертывания соблюдается и на записи: экземпляры модулей
  // находятся внутри рамки своего узла размещения (ТЗ §10.3). Нормализованный
  // граф возвращается в ответе API, поэтому canvas и хранилище согласованы.
  const nodes = normalizeContainers(Array.isArray(graph?.nodes) ? graph.nodes : []);
  if (graph) graph.nodes = nodes;
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];

  await client.query(`DELETE FROM architecture_diagram_relationship WHERE diagram_id = $1`, [diagramId]);
  await client.query(`DELETE FROM architecture_diagram_element WHERE diagram_id = $1`, [diagramId]);
  if (nodes.length === 0) return;

  const keyToId = new Map();
  for (let start = 0; start < nodes.length; start += CHUNK) {
    const slice = nodes.slice(start, start + CHUNK);
    const params = [];
    const tuples = slice.map((node, index) => {
      const base = index * 13;
      const refId =
        node.registryRef?.id && UUID_RE.test(node.registryRef.id) ? node.registryRef.id : null;
      params.push(
        diagramId,
        String(node.id),
        node.registryRef?.type || 'annotation',
        refId,
        String(node.c4Type || 'Container'),
        node.parent || null,
        node.name || '',
        node.technology || null,
        Number(node.position?.x) || 0,
        Number(node.position?.y) || 0,
        Number(node.size?.width) || 240,
        Number(node.size?.height) || 100,
        JSON.stringify(packStyle(node)),
      );
      const placeholders = Array.from({ length: 13 }, (_, k) => `$${base + k + 1}`);
      return `(${placeholders.join(', ')})`;
    });

    const { rows } = await client.query(
      `INSERT INTO architecture_diagram_element (${NODE_COLUMNS}) VALUES ${tuples.join(', ')}
       RETURNING id, node_key`,
      params,
    );
    for (const row of rows) keyToId.set(row.node_key, row.id);
  }

  const validEdges = edges.filter((edge) => {
    const source = keyToId.get(String(edge.source));
    const target = keyToId.get(String(edge.target));
    return Boolean(source && target && source !== target);
  });

  for (let start = 0; start < validEdges.length; start += CHUNK) {
    const slice = validEdges.slice(start, start + CHUNK);
    const params = [];
    const tuples = slice.map((edge, index) => {
      const base = index * 8;
      const flowId =
        edge.registryRef?.type === 'information_flow' &&
        edge.registryRef.id &&
        UUID_RE.test(edge.registryRef.id)
          ? edge.registryRef.id
          : null;
      params.push(
        diagramId,
        String(edge.id),
        keyToId.get(String(edge.source)),
        keyToId.get(String(edge.target)),
        flowId,
        edge.label || null,
        edge.technology || null,
        edge.routing ? JSON.stringify(edge.routing) : null,
      );
      const placeholders = Array.from({ length: 8 }, (_, k) => `$${base + k + 1}`);
      return `(${placeholders.join(', ')})`;
    });

    await client.query(
      `INSERT INTO architecture_diagram_relationship (${EDGE_COLUMNS}) VALUES ${tuples.join(', ')}`,
      params,
    );
  }
}

/**
 * Сохранение схемы с optimistic locking (FR-010, ТЗ §12).
 * Конфликт ревизий — HTTP 409. При сохранении публикация переводится в Draft,
 * так как вносимые изменения должны быть опубликованы новой версией (ТЗ §18).
 */
export async function saveGraph(idOrCode, graph, expectedRevision = null) {
  const diagram = await findDiagram(idOrCode);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query(
      `SELECT revision FROM architecture_diagram WHERE id = $1 FOR UPDATE`,
      [diagram.id],
    );
    const currentRevision = Number(locked.rows[0].revision);
    if (expectedRevision != null && Number(expectedRevision) !== currentRevision) {
      throw httpError(
        409,
        `Конфликт версий: передана revision=${expectedRevision}, актуальная revision=${currentRevision}`,
      );
    }

    await writeGraph(client, diagram.id, graph);
    const { rows } = await client.query(
      `UPDATE architecture_diagram
          SET revision = revision + 1,
              updated_at = now(),
              updated_by = $2,
              status = CASE WHEN status = 'PUBLISHED' THEN 'DRAFT' ELSE status END,
              dependencies_dirty = false
        WHERE id = $1
        RETURNING *`,
      [diagram.id, USER],
    );
    await client.query('COMMIT');
    return mapDiagramRow(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Запись результата автогенерации без проверки revision (ТЗ §13). */
export async function applyGeneratedGraph(idOrCode, graph) {
  const diagram = await findDiagram(idOrCode);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await writeGraph(client, diagram.id, graph);
    const { rows } = await client.query(
      `UPDATE architecture_diagram
          SET revision = revision + 1,
              updated_at = now(),
              updated_by = $2,
              status = CASE WHEN status = 'PUBLISHED' THEN 'DRAFT' ELSE status END,
              dependencies_dirty = false
        WHERE id = $1
        RETURNING *`,
      [diagram.id, USER],
    );
    await client.query('COMMIT');
    return mapDiagramRow(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Отметка «есть изменения зависимостей» (ТЗ §18). */
export async function markDependenciesDirty(idOrCode, dirty = true) {
  const diagram = await findDiagram(idOrCode);
  const { rows } = await pool.query(
    `UPDATE architecture_diagram SET dependencies_dirty = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [diagram.id, Boolean(dirty)],
  );
  return mapDiagramRow(rows[0]);
}

/**
 * Публикация схемы (FR-012, ТЗ §18).
 * Snapshot неизменяем и самодостаточен для восстановления canvas (ТЗ §8).
 * Проверка ERROR-ов выполняется вызывающим кодом до вызова publishDiagram.
 */
export async function publishDiagram(idOrCode) {
  const { diagram, graph } = await getDiagramGraph(idOrCode);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query(
      `SELECT revision FROM architecture_diagram WHERE id = $1 FOR UPDATE`,
      [diagram.id],
    );
    const { rows: nextRows } = await client.query(
      `SELECT COALESCE(MAX(version_no), 0) + 1 AS next FROM diagram_version WHERE diagram_id = $1`,
      [diagram.id],
    );
    const versionNo = Number(nextRows[0].next);
    const snapshot = {
      schemaVersion: '1.0',
      diagramId: diagram.id,
      code: diagram.code,
      name: diagram.name,
      diagramType: diagram.diagramType,
      scope: { objectType: diagram.scopeType, objectId: diagram.scopeObjectId },
      environmentId: diagram.scopeEnvironmentId || null,
      revision: Number(locked.rows[0].revision),
      publishedAt: new Date().toISOString(),
      nodes: graph.nodes,
      edges: graph.edges,
    };

    await client.query(
      `INSERT INTO diagram_version (diagram_id, version_no, snapshot_json, created_by)
       VALUES ($1, $2, $3, $4)`,
      [diagram.id, versionNo, JSON.stringify(snapshot), USER],
    );
    const { rows } = await client.query(
      `UPDATE architecture_diagram
          SET status = 'PUBLISHED', published_version = $2, updated_at = now(), updated_by = $3
        WHERE id = $1
        RETURNING *`,
      [diagram.id, versionNo, USER],
    );
    await client.query('COMMIT');
    return { diagram: mapDiagramRow(rows[0]), versionNo, snapshot };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** История версий (FR-011, GET /api/diagrams/{id}/versions). */
export async function listVersions(idOrCode) {
  const diagram = await findDiagram(idOrCode);
  const { rows } = await pool.query(
    `SELECT id, version_no, created_at, created_by, status,
            jsonb_array_length(COALESCE(snapshot_json -> 'nodes', '[]'::jsonb)) AS node_count,
            jsonb_array_length(COALESCE(snapshot_json -> 'edges', '[]'::jsonb)) AS edge_count
       FROM diagram_version
      WHERE diagram_id = $1
      ORDER BY version_no DESC`,
    [diagram.id],
  );
  return rows.map((row) => ({
    id: row.id,
    versionNo: row.version_no,
    createdAt: row.created_at,
    createdBy: row.created_by,
    status: row.status,
    nodeCount: Number(row.node_count),
    edgeCount: Number(row.edge_count),
  }));
}

/** Восстановление конкретной версии из snapshot (ТЗ §27). */
export async function getVersion(idOrCode, versionNo) {
  const diagram = await findDiagram(idOrCode);
  const { rows } = await pool.query(
    `SELECT * FROM diagram_version WHERE diagram_id = $1 AND version_no = $2`,
    [diagram.id, Number(versionNo)],
  );
  if (!rows[0]) throw httpError(404, `Версия ${versionNo} схемы ${diagram.code} не найдена`);
  return {
    diagramId: diagram.id,
    versionNo: rows[0].version_no,
    createdBy: rows[0].created_by,
    createdAt: rows[0].created_at,
    status: rows[0].status,
    snapshot: rows[0].snapshot_json,
  };
}



