/**
 * Текущий пользователь приложения-реестра.
 *
 * Аутентификация в приложении не реализована (демонстрационный макет), поэтому
 * пользователь задан константой: он отображается в шапке и передаётся на backend
 * в заголовке X-User. Backend подставляет это значение в created_by/updated_by и
 * в автора изменения audit_log.changed_by (см. backend/src/utils/requestContext.js).
 */
export const CURRENT_USER = {
  name: 'Иванов И.И.',
  role: 'Администратор',
  initials: 'ИИ',
}

/**
 * Заголовок запроса с текущим пользователем.
 *
 * Значения HTTP-заголовков — ByteString (Latin-1), поэтому кириллицу в заголовок
 * класть нельзя: браузерный fetch падает с ошибкой вида
 * «Cannot convert value ... to ByteString because the character at index 0 has
 * value 1048 ...» (1048 = код символа «И») и запрос вообще не уходит — то есть
 * ломались бы все обращения к API.
 *
 * Поэтому имя пользователя кодируется percent-encoding'ом (только ASCII),
 * а backend декодирует его обратно (backend/src/utils/requestContext.js).
 * В журнале и в created_by/updated_by значение сохраняется уже читаемым.
 */
export const currentUserHeader = (): Record<string, string> => ({
  'X-User': encodeURIComponent(CURRENT_USER.name),
})
