import pool from '../db.js';
import { withTransaction } from './requestContext.js';

/**
 * Универсальный CRUD-хелпер для таблиц реестра.
 *
 * Все операции изменения (create/update/deleteById) выполняются в транзакции,
 * в которой выставлен автор изменения (app.changed_by) — его фиксируют
 * триггеры аудита audit_log (см. sql/04_audit_triggers.sql).
 */

/**
 * GET /api/<entity> — список всех записей
 */
export async function getAll(tableName, orderBy = 'created_at DESC') {
  const { rows } = await pool.query(`SELECT * FROM ${tableName} ORDER BY ${orderBy}`);
  return rows;
}

/**
 * GET /api/<entity>/:id — одна запись по ID
 */
export async function getById(tableName, id) {
  const { rows } = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
  if (rows.length === 0) throw new Error('Not found');
  return rows[0];
}

/**
 * POST /api/<entity> — создание записи
 * columns: ['code','name','status'], values соответствуют
 */
export async function create(tableName, columns, values, returningCols = '*') {
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const cols = columns.join(', ');
  const sql = `INSERT INTO ${tableName} (${cols}) VALUES (${placeholders}) RETURNING ${returningCols}`;
  return withTransaction(async (client) => {
    const { rows } = await client.query(sql, values);
    return rows[0];
  });
}

/**
 * PUT /api/<entity>/:id — обновление записи
 */
export async function update(tableName, id, columns, values) {
  const setClauses = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const sql = `UPDATE ${tableName} SET ${setClauses} WHERE id = $${columns.length + 1} RETURNING *`;
  return withTransaction(async (client) => {
    const { rows } = await client.query(sql, [...values, id]);
    if (rows.length === 0) throw new Error('Not found');
    return rows[0];
  });
}

/**
 * DELETE /api/<entity>/:id — удаление записи
 */
export async function deleteById(tableName, id) {
  return withTransaction(async (client) => {
    const { rowCount } = await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    if (rowCount === 0) throw new Error('Not found');
    return { deleted: true };
  });
}

