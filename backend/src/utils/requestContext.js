import { AsyncLocalStorage } from 'node:async_hooks';
import pool from '../db.js';

/**
 * Контекст выполнения запроса: кто выполняет изменение.
 *
 * Аудит в audit_log пишут триггеры БД (sql/04_audit_triggers.sql), поэтому
 * backend передаёт автора изменения в саму транзакцию:
 *   SELECT set_config('app.changed_by', <пользователь>, true)
 * Дальше триггер подставляет это значение в audit_log.changed_by.
 */

/** Пользователь по умолчанию — вызовы без заголовка X-User (скрипты, интеграции) */
export const DEFAULT_USER = process.env.API_USER || 'api-user';

const storage = new AsyncLocalStorage();

/** Текущий пользователь запроса (для created_by/updated_by и аудита) */
export function currentUser() {
  return storage.getStore()?.user || DEFAULT_USER;
}

/**
 * Разбирает значение заголовка с пользователем.
 *
 * Значения HTTP-заголовков — ByteString (Latin-1), поэтому кириллицу в заголовке
 * передавать нельзя: браузерный fetch отклоняет такое значение
 * («Cannot convert value ... to ByteString ...»), и запрос не уходит вовсе.
 * Фронтенд кодирует имя пользователя percent-encoding'ом (frontend/src/utils/
 * currentUser.ts) — здесь оно декодируется обратно, чтобы в created_by/updated_by
 * и audit_log.changed_by попадало читаемое ФИО.
 *
 * Заголовок, пришедший без кодирования (curl, интеграции, скрипты), используется
 * как есть: некорректная percent-последовательность просто оставляет текст
 * неизменным.
 */
function userFromHeader(value) {
  const header = (value || '').trim();
  if (!header) return '';
  try {
    return decodeURIComponent(header);
  } catch {
    return header;
  }
}

/**
 * Читает пользователя из заголовка X-User (альтернатива — X-User-Name)
 * и ведёт контекст запроса. Заголовок прокидывается фронтендом и nginx.
 */
export function requestContext(req, res, next) {
  const user = userFromHeader(req.get('x-user') || req.get('x-user-name')) || DEFAULT_USER;
  req.user = user;
  storage.run({ user }, () => next());
}

/**
 * Выполняет функцию в транзакции на одном соединении и сообщает триггерам
 * аудита автора изменения. Возвращает результат функции.
 *
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 * @param {string} [user] автор изменения (по умолчанию — текущий пользователь)
 */
export async function withTransaction(fn, user = currentUser()) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // set_config(..., true) — значение живёт только до конца транзакции
    await client.query('SELECT set_config($1, $2, true)', ['app.changed_by', user]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
