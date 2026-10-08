/**
 * Ссылки на встроенный модуль «Архитектурные схемы» (C4).
 *
 * Модуль остаётся отдельным сервисом (`diagrams`, порт 8082), но nginx общего
 * приложения реестра проксирует его на том же origin:
 *   `DIAGRAMS_API_BASE` (`/diagrams-api`)   → API модуля,
 *   `DIAGRAMS_APP_PATH` (`/diagrams-module`) → SPA модуля (canvas-редактор).
 * Поэтому список схем открывается внутри приложения, а редактор — по внутреннему
 * пути, без второй вкладки и без CORS.
 */

/** Порт модуля схем по умолчанию (docker-compose: DIAGRAMS_PORT). */
const DIAGRAMS_PORT = '8082'

/** Встроенный путь API модуля схем (location /diagrams-api/ в nginx). */
export const DIAGRAMS_API_BASE = '/diagrams-api'

/** Встроенный путь SPA модуля схем (location /diagrams-module/ в nginx). */
export const DIAGRAMS_APP_PATH = '/diagrams-module'

/**
 * Внутренний маршрут редактора схемы: открывается в том же приложении
 * (внутри общего origin), например `/diagrams-module/diagrams/<id>`.
 */
export function diagramEditorPath(diagramId: string): string {
  return `${DIAGRAMS_APP_PATH}/diagrams/${encodeURIComponent(diagramId)}`
}

/**
 * Внешний адрес модуля «Архитектурные схемы» (отдельный порт) — для ссылки
 * «открыть в отдельном окне»:
 * 1) build-arg `VITE_DIAGRAMS_URL` (docker-compose передаёт DIAGRAMS_PUBLIC_URL);
 * 2) иначе — тот же хост, что и у реестра, и стандартный порт модуля.
 */
export function diagramsUrl(): string {
  const configured = import.meta.env.VITE_DIAGRAMS_URL as string | undefined
  if (configured) return configured.replace(/\/$/, '')
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:${DIAGRAMS_PORT}`
}

/** Внешний адрес страницы схем на отдельном порту модуля. */
export function diagramExternalPath(diagramId: string): string {
  return `${diagramsUrl()}${diagramEditorPath(diagramId)}`
}
