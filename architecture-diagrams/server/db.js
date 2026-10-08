import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

/**
 * Пул подключений к БД реестра.
 * Модуль использует существующую СУБД реестра (ТЗ §21: «существующая СУБД + JSON snapshot»),
 * но хранит собственный слой диаграмм в отдельных таблицах architecture_diagram*.
 * Нормализованная модель реестра модулем не изменяется (ТЗ §19).
 */
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'architecture_registry',
  user: process.env.POSTGRES_USER || 'registry_admin',
  password: process.env.POSTGRES_PASSWORD || 'registry_pass',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[diagrams] Unexpected error on idle PostgreSQL client', err);
});

export default pool;
