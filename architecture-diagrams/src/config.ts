import { REGISTRY_ROUTE } from './model/diagramTypes'
import type { RegistryRef } from './model/diagramTypes'

/**
 * Адрес основного приложения реестра.
 * Модуль «Архитектурные схемы» — отдельный контейнер, поэтому переход
 * из схемы в карточку объекта реестра выполняется по внешнему URL (FR-014).
 */
export const REGISTRY_APP_URL: string =
  (import.meta.env.VITE_REGISTRY_URL as string | undefined) || 'http://localhost:8080'

/** Ссылка на карточку объекта реестра. */
export function registryLink(ref: RegistryRef): string | null {
  const route = REGISTRY_ROUTE[ref.type]
  return route ? `${REGISTRY_APP_URL.replace(/\/$/, '')}${route}` : null
}
