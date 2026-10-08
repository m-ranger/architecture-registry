import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pool from './db.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Идемпотентная инициализация слоя диаграмм.
 * Выполняется при старте сервиса, чтобы модуль был самодостаточным
 * отдельным контейнером и не требовал ручной миграции БД.
 */
export async function migrate() {
  const ddl = await readFile(join(here, 'schema.sql'), 'utf8');
  await pool.query(ddl);
  console.log('[diagrams] schema ready (architecture_diagram layer)');
}
