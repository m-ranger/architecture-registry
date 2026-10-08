/**
 * Тонкая обёртка над fetch для API модуля.
 * Сервер модуля возвращает camelCase для диаграмм, но выборки реестра приходят
 * из PostgreSQL в snake_case, поэтому ответы приводятся к camelCase.
 * Тела запросов передаются как есть — контракт API модуля уже camelCase.
 */

/**
 * База API модуля. По умолчанию `/api` (прямая работа модуля и dev-сервер
 * с проксированием). При встраивании в общее приложение задаётся
 * `VITE_API_BASE=/diagrams-api` — nginx реестра проксирует префикс на API модуля.
 */
const API_BASE = ((import.meta.env.VITE_API_BASE as string | undefined) || '/api').replace(/\/+$/, '')


export interface ApiError {
  message: string
  status: number
  payload?: unknown
}

const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

function camelizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelizeValue)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [toCamel(k), camelizeValue(v)]),
    )
  }
  return value
}

export const camelize = <T>(value: unknown): T => camelizeValue(value) as T

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    })
  } catch (err) {
    throw { message: err instanceof Error ? err.message : 'Сеть недоступна', status: 0 } as ApiError
  }

  const text = await response.text()

  if (!response.ok) {
    let message = `HTTP ${response.status}: ${response.statusText}`
    let payload: unknown
    try {
      const body = text ? JSON.parse(text) : null
      payload = camelizeValue(body)
      if (body?.error) message = body.error
      else if (body?.message) message = body.message
    } catch {
      // тело ответа не JSON — оставляем текст статуса
    }
    throw { message, status: response.status, payload } as ApiError
  }

  if (response.status === 204 || !text) return undefined as T
  return camelize<T>(JSON.parse(text))
}

export const api = {
  get: <T>(endpoint: string) => apiFetch<T>(endpoint),
  post: <T>(endpoint: string, data?: unknown) =>
    apiFetch<T>(endpoint, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  put: <T>(endpoint: string, data?: unknown) =>
    apiFetch<T>(endpoint, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  delete: <T>(endpoint: string) => apiFetch<T>(endpoint, { method: 'DELETE' }),
  base: API_BASE,
}

/** Текстовый ответ (экспорт в SVG/PlantUML/Mermaid). */
export async function apiFetchText(endpoint: string): Promise<string> {
  const response = await fetch(`${API_BASE}${endpoint}`)
  if (!response.ok) {
    throw { message: `HTTP ${response.status}: ${response.statusText}`, status: response.status } as ApiError
  }
  return response.text()
}
