import express from 'express';
import pool from '../db.js';

const router = express.Router();

/** Допустимые операции (ограничение chk_audit_log_operation в DDL) */
const OPERATIONS = ['INSERT', 'UPDATE', 'DELETE'];

/**
 * Поля записи журнала изменений (только чтение — записи создают триггеры БД):
 *   entity_code / entity_name — расшифровка объекта из снимка строки;
 *   changed_fields            — какие поля изменились (для операции UPDATE);
 *   old_value / new_value     — полные снимки строки до и после изменения.
 */
const AUDIT_SELECT = `
  SELECT a.id, a.entity_type, a.entity_id, a.operation, a.changed_at, a.changed_by,
         a.old_value, a.new_value,
         COALESCE(a.new_value, a.old_value) ->> 'code' AS entity_code,
         COALESCE(a.new_value, a.old_value) ->> 'name' AS entity_name,
         CASE
           WHEN a.operation = 'UPDATE' THEN COALESCE((
             SELECT jsonb_agg(e.key ORDER BY e.key)
             FROM jsonb_each(a.new_value) e
             WHERE e.key NOT IN ('created_at', 'created_by', 'updated_at', 'updated_by')
               AND e.value IS DISTINCT FROM a.old_value -> e.key
           ), '[]'::jsonb)
           ELSE '[]'::jsonb
         END AS changed_fields
  FROM audit_log a`;

/** Читает параметр запроса в snake_case или camelCase (фронтенд шлёт camelCase) */
function param(req, name) {
  const camel = name.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
  return req.query[name] ?? req.query[camel];
}

/**
 * Разбирает фильтры журнала:
 *   entity_type, entity_id, operation, changed_by, from, to, q (код/наименование)
 */
function buildFilter(req) {
  const where = [];
  const params = [];
  const push = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  const entityType = param(req, 'entity_type');
  if (entityType) where.push(`a.entity_type = ${push(entityType)}`);

  const entityId = param(req, 'entity_id');
  if (entityId) where.push(`a.entity_id = ${push(entityId)}`);

  const operation = String(param(req, 'operation') || '').toUpperCase();
  if (operation) {
    if (!OPERATIONS.includes(operation)) {
      throw Object.assign(new Error(`Недопустимая операция: ${operation}`), { status: 400 });
    }
    where.push(`a.operation = ${push(operation)}`);
  }

  const changedBy = param(req, 'changed_by');
  if (changedBy) where.push(`a.changed_by ILIKE ${push(`%${changedBy}%`)}`);

  const from = param(req, 'from');
  if (from) where.push(`a.changed_at >= ${push(from)}`);

  const to = param(req, 'to');
  if (to) where.push(`a.changed_at <= ${push(to)}`);

  const q = param(req, 'q');
  if (q) {
    const like = push(`%${q}%`);
    where.push(
      `(COALESCE(a.new_value, a.old_value) ->> 'code' ILIKE ${like}
        OR COALESCE(a.new_value, a.old_value) ->> 'name' ILIKE ${like})`
    );
  }

  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

/** Постраничный вывод: limit (по умолчанию 200, максимум 1000) и offset */
function buildPagination(req) {
  const rawLimit = parseInt(param(req, 'limit') ?? '200', 10);
  const rawOffset = parseInt(param(req, 'offset') ?? '0', 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 200, 1), 1000);
  const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
  return { limit, offset };
}

// GET /api/audit — журнал изменений объектов реестра (новые сверху)
router.get('/', async (req, res, next) => {
  try {
    const { clause, params } = buildFilter(req);
    const { limit, offset } = buildPagination(req);
    const { rows } = await pool.query(
      `${AUDIT_SELECT}
       ${clause}
       ORDER BY a.changed_at DESC, a.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/audit/:id — одна запись журнала со снимками «до/после»
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`${AUDIT_SELECT} WHERE a.id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Запись журнала не найдена' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Некорректный идентификатор записи журнала' });
    }
    next(err);
  }
});

export default router;

