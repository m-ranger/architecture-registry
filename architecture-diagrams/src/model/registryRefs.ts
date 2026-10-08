import type { ArchEdge, ArchGraph, ArchNode, RegistryRef } from './diagramTypes'
import { C4_TYPE, C4_VISUAL, REGISTRY_TO_C4, type C4Type } from './c4Types'

/** Ссылочность: ключ узла строится из типа и идентификатора объекта реестра (ТЗ §3). */
export const makeNodeKey = (type: string, id: string) => `${type}:${id}`

export const parseNodeKey = (key: string): RegistryRef | null => {
  const index = key.indexOf(':')
  if (index <= 0) return null
  return { type: key.slice(0, index), id: key.slice(index + 1) }
}

export const REGISTRY_TYPE_LABEL: Record<string, string> = {
  information_system: 'Информационная система',
  application_module: 'Модуль',
  module_instance: 'Экземпляр модуля',
  server: 'Сервер',
  cluster: 'Кластер',
  environment: 'Среда',
  network_zone: 'Сетевая зона',
  network_segment: 'Сегмент',
  information_flow: 'Поток данных',
  protocol: 'Протокол',
  project: 'Проект',
  annotation: 'Аннотация',
}

export const registryTypeLabel = (type: string) => REGISTRY_TYPE_LABEL[type] || type

/** Свободная аннотация схемы (FR-007). */
export interface SearchItem {
  id: string
  objectType: string
  code: string
  name: string
  status?: string
  subtitle?: string
  badge?: string
}

/** Таблица соответствия реестра и C4 для панели свойств. */
export const c4TypeForRegistryType = (type: string): C4Type =>
  REGISTRY_TO_C4[type] || C4_TYPE.ANNOTATION

/** Человекочитаемое описание объекта реестра. */
export const displayRef = (ref: RegistryRef | null) =>
  ref ? `${registryTypeLabel(ref.type)} · ${ref.id.slice(0, 8)}` : 'Свободный элемент'

/** Поиск узла схемы по ссылке на объект реестра (FR-004). */
export const findByRegistryRef = (nodes: ArchNode[], ref: RegistryRef): ArchNode | undefined =>
  nodes.find((node) => node.registryRef?.type === ref.type && node.registryRef?.id === ref.id)

/** Создание узла-аннотации без ссылки на реестр. */
export const makeAnnotationNode = (id: string, text: string): ArchNode => ({
  id,
  registryRef: null,
  c4Type: C4_TYPE.ANNOTATION,
  parent: null,
  name: text,
  technology: null,
  description: null,
  position: { x: 0, y: 0 },
  size: { width: C4_VISUAL[C4_TYPE.ANNOTATION].width, height: C4_VISUAL[C4_TYPE.ANNOTATION].height },
  style: { variant: 'annotation' },
})

/** Создание узла по объекту реестра (FR-006). */
export const makeRegistryNode = (item: SearchItem, position: { x: number; y: number }): ArchNode => {
  const c4Type = c4TypeForRegistryType(item.objectType)
  const size = C4_VISUAL[c4Type]
  return {
    id: makeNodeKey(item.objectType, item.id),
    registryRef: { type: item.objectType, id: item.id },
    c4Type,
    parent: null,
    name: item.name,
    technology: item.badge || null,
    description: item.subtitle || null,
    position,
    size: { width: size.width, height: size.height },
    style: { variant: c4Type === C4_TYPE.SOFTWARE_SYSTEM ? 'external' : 'application', code: item.code, status: item.status },
  }
}

/** Создание связи между узлами (FR-005). */
export const makeEdge = (source: string, target: string, existing: ArchEdge[]): ArchEdge => {
  let index = existing.length + 1
  let id = `manual:${source}->${target}`
  while (existing.some((edge) => edge.id === id)) {
    index += 1
    id = `manual:${source}->${target}:${index}`
  }
  return {
    id,
    source,
    target,
    registryRef: null,
    label: 'Связь',
    technology: null,
  }
}

/** Пустой граф для новой схемы до автогенерации (scopeType: ИС или проект). */
export const EMPTY_GRAPH = (
  diagramType: string,
  scopeObjectId: string | null,
  scopeType = 'information_system',
): ArchGraph => ({
  schemaVersion: '1.0',
  diagram: { type: diagramType.toLowerCase(), scope: { objectType: scopeType, objectId: scopeObjectId } },
  nodes: [],
  edges: [],
})
