/**
 * Тип объекта реестра: INTERNAL — внутренний (собственный контур организации),
 * EXTERNAL — внешний (подрядчик, партнёр, внешний сервис, внешняя площадка).
 *
 * Тип задаётся пользователем у информационной системы, сервера и кластера
 * (sql/07_object_types.sql); модуль, размещение и сетевой адрес наследуют его от
 * родителя — триггеры БД пересчитывают значение автоматически, поэтому в API
 * изменений этих объектов поле не передаётся.
 */

/** Допустимые значения типа объекта (словарь ограничен и в БД: chk_*_object_type) */
export const OBJECT_TYPES = ['INTERNAL', 'EXTERNAL'];

/** Значение по умолчанию: реестр ведётся по внутренним объектам, внешние помечаются явно */
export const DEFAULT_OBJECT_TYPE = 'INTERNAL';

/** Русские наименования типов — для сообщений об ошибках */
export const OBJECT_TYPE_LABEL = {
  INTERNAL: 'внутренний',
  EXTERNAL: 'внешний',
};

/**
 * Приводит тип объекта из тела запроса к значению словаря.
 *
 * @param {unknown} value значение поля object_type (может отсутствовать)
 * @param {string} fallback значение при пустом поле (по умолчанию INTERNAL)
 * @returns {string} 'INTERNAL' или 'EXTERNAL'
 * @throws {Error} ошибка со статусом 400, если значение вне словаря —
 *   её отдаёт общий обработчик ошибок backend (err.status === 400)
 */
export function normalizeObjectType(value, fallback = DEFAULT_OBJECT_TYPE) {
  if (value === undefined || value === null || value === '') return fallback;

  const type = String(value).trim().toUpperCase();
  if (!OBJECT_TYPES.includes(type)) {
    const err = new Error(
      `Недопустимый тип объекта «${value}»: допустимые значения — ${OBJECT_TYPES.join(', ')}`
    );
    err.status = 400;
    throw err;
  }
  return type;
}
