// API client configuration and base fetch wrapper

import { currentUserHeader } from '../utils/currentUser'

/** База API основного приложения реестра (nginx проксирует её на сервис backend). */
const API_BASE = '/api'


export interface ApiError {
  message: string
  status: number
}

/** snake_case -> camelCase (information_system_id -> informationSystemId) */
const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

/** camelCase -> snake_case (informationSystemId -> information_system_id) */
const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

/** snake_case-имя параметра запроса: entityType -> entity_type (query-строки API) */
export const snakeKey = (key: string) => toSnake(key)


function convertKeys(value: unknown, transform: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => convertKeys(item, transform))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [transform(k), convertKeys(v, transform)]),
    )
  }
  return value
}

/** Приводит ответ API (snake_case из PostgreSQL) к camelCase-типам фронтенда */
export const camelize = <T>(value: unknown): T => convertKeys(value, toCamel) as T

/** Приводит тело запроса (camelCase) к snake_case-колонкам PostgreSQL */
export const snakify = (value: unknown): unknown => convertKeys(value, toSnake)

/**
 * Base fetch wrapper with error handling
 */
async function apiFetch<T>(base: string, endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${base}${endpoint}`

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    })
  } catch (err) {
    throw {
      message: err instanceof Error ? err.message : 'Network error',
      status: 0,
    } as ApiError
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}: ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.error) message = body.error
      else if (body?.message) message = body.message
    } catch {
      // тело ответа не JSON — оставляем текст статуса
    }
    throw { message, status: response.status } as ApiError
  }

  // 204 No Content (DELETE) — тела нет
  if (response.status === 204) return undefined as T

  const text = await response.text()
  return text ? camelize<T>(JSON.parse(text)) : (undefined as T)
}

/** Набор методов клиента API поверх базового пути */
export interface ApiClient {
  base: string
  get: <T>(endpoint: string) => Promise<T>
  post: <T>(endpoint: string, data?: unknown) => Promise<T>
  put: <T>(endpoint: string, data?: unknown) => Promise<T>
  delete: <T>(endpoint: string) => Promise<T>
}

export interface ApiClientOptions {
  /**
   * Приводить тело запроса camelCase → snake_case.
   * Backend реестра принимает snake_case-колонки, API модуля схем — camelCase.
   */
  snakeCaseBody?: boolean
  /** Дополнительные заголовки всех запросов клиента (например, X-User) */
  headers?: Record<string, string>
}

/**
 * Создаёт клиент API по базовому пути: основной backend приложения (`/api`)
 * или API встроенного модуля схем (`/diagrams-api` — nginx проксирует его
 * на сервис `diagrams`, поэтому запросы идут с общего origin без CORS).
 */
export function createApiClient(base: string, options: ApiClientOptions = {}): ApiClient {
  const root = base.replace(/\/+$/, '')
  const prepare = (data: unknown) => (options.snakeCaseBody === false ? data : snakify(data))
  const headers = options.headers ?? {}
  return {
    base: root,
    get: <T>(endpoint: string) => apiFetch<T>(root, endpoint, { headers }),
    post: <T>(endpoint: string, data?: unknown) =>
      apiFetch<T>(root, endpoint, { method: 'POST', body: JSON.stringify(prepare(data)), headers }),
    put: <T>(endpoint: string, data?: unknown) =>
      apiFetch<T>(root, endpoint, { method: 'PUT', body: JSON.stringify(prepare(data)), headers }),
    delete: <T>(endpoint: string) => apiFetch<T>(root, endpoint, { method: 'DELETE', headers }),
  }
}

/** Клиент API основного приложения реестра (запросы идут от имени текущего пользователя) */
export const api = createApiClient(API_BASE, { headers: currentUserHeader() })

