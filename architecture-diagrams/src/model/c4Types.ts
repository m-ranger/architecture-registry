/**
 * C4-модель и визуальная конфигурация узлов (ТЗ §5, §6).
 * Единый язык System Context / Container / Deployment.
 */

export const C4_TYPE = {
  SOFTWARE_SYSTEM: 'SoftwareSystem',
  CONTAINER: 'Container',
  DEPLOYMENT_NODE: 'DeploymentNode',
  DEPLOYMENT_INSTANCE: 'DeploymentInstance',
  SYSTEM_BOUNDARY: 'SystemBoundary',
  ENVIRONMENT_BOUNDARY: 'EnvironmentBoundary',
  ANNOTATION: 'Annotation',
} as const

export type C4Type = (typeof C4_TYPE)[keyof typeof C4_TYPE]

export interface C4Visual {
  label: string
  fill: string
  stroke: string
  text: string
  tag: string
  width: number
  height: number
  dashed?: boolean
}

/** Палитра соответствует теме основного реестра (theme.ts). */
export const C4_VISUAL: Record<C4Type, C4Visual> = {
  [C4_TYPE.SOFTWARE_SYSTEM]: {
    label: 'Software System',
    fill: '#e8efff',
    stroke: '#2f6bff',
    text: '#12234a',
    tag: '#2f6bff',
    width: 240,
    height: 116,
  },
  [C4_TYPE.CONTAINER]: {
    label: 'Container',
    fill: '#ffffff',
    stroke: '#c7d3e8',
    text: '#1f2a37',
    tag: '#64748b',
    width: 250,
    height: 112,
  },
  [C4_TYPE.DEPLOYMENT_NODE]: {
    label: 'Deployment Node',
    fill: '#fff7ed',
    stroke: '#f59e0b',
    text: '#7c3f04',
    tag: '#b45309',
    width: 270,
    height: 120,
  },
  [C4_TYPE.DEPLOYMENT_INSTANCE]: {
    label: 'Deployment Instance',
    fill: '#ffffff',
    stroke: '#c7d3e8',
    text: '#1f2a37',
    tag: '#64748b',
    width: 230,
    height: 88,
  },
  [C4_TYPE.SYSTEM_BOUNDARY]: {
    label: 'System Boundary',
    fill: 'rgba(148,163,184,0.07)',
    stroke: '#94a3b8',
    text: '#475569',
    tag: '#64748b',
    width: 340,
    height: 240,
    dashed: true,
  },
  [C4_TYPE.ENVIRONMENT_BOUNDARY]: {
    label: 'Environment Boundary',
    fill: 'rgba(148,163,184,0.07)',
    stroke: '#94a3b8',
    text: '#475569',
    tag: '#64748b',
    width: 360,
    height: 260,
    dashed: true,
  },
  [C4_TYPE.ANNOTATION]: {
    label: 'Annotation',
    fill: '#fffbeb',
    stroke: '#fcd34d',
    text: '#78350f',
    tag: '#b45309',
    width: 220,
    height: 80,
  },
}

/** Соответствие объект реестра -> C4 type (ТЗ §6, §19). */
export const REGISTRY_TO_C4: Record<string, C4Type> = {
  information_system: C4_TYPE.SOFTWARE_SYSTEM,
  application_module: C4_TYPE.CONTAINER,
  module_instance: C4_TYPE.DEPLOYMENT_INSTANCE,
  server: C4_TYPE.DEPLOYMENT_NODE,
  cluster: C4_TYPE.DEPLOYMENT_NODE,
  environment: C4_TYPE.ENVIRONMENT_BOUNDARY,
  information_flow: 'Relationship' as C4Type,
}

export const DIAGRAM_TYPES = ['SYSTEM_CONTEXT', 'CONTAINER', 'DEPLOYMENT'] as const
export type DiagramType = (typeof DIAGRAM_TYPES)[number]

export const DIAGRAM_TYPE_LABEL: Record<DiagramType, string> = {
  SYSTEM_CONTEXT: 'System Context',
  CONTAINER: 'Container',
  DEPLOYMENT: 'Deployment',
}

export const DIAGRAM_TYPE_HINT: Record<DiagramType, string> = {
  SYSTEM_CONTEXT: 'Информационная система и связанные системы (по information_flow)',
  CONTAINER: 'Модули ИС как Container, потоки между модулями',
  DEPLOYMENT:
    'Контуры, узлы размещения (server/cluster), экземпляры модулей и сетевые адреса ' +
    'развертывания; можно зафиксировать срез по среде (тест, прод и т. п.)',
}

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликована',
  ARCHIVED: 'Архив',
  ACTIVE: 'В эксплуатации',
  PLANNED: 'Планируется',
  RETIRED: 'Выведен из эксплуатации',
}
