import { apiFetchText } from './client'

export type ExportFormat = 'svg' | 'png' | 'pdf' | 'plantuml' | 'mermaid' | 'json'

export const EXPORT_LABEL: Record<ExportFormat, string> = {
  svg: 'SVG',
  png: 'PNG',
  pdf: 'PDF',
  plantuml: 'PlantUML',
  mermaid: 'Mermaid',
  json: 'JSON',
}

/** Приоритеты из ТЗ §15: P0 — SVG/PNG/PDF, P1 — PlantUML, P2 — Mermaid/JSON. */
export const EXPORT_PRIORITY: Record<ExportFormat, 'P0' | 'P1' | 'P2'> = {
  svg: 'P0',
  png: 'P0',
  pdf: 'P0',
  plantuml: 'P1',
  mermaid: 'P2',
  json: 'P2',
}

const id = (value: string) => encodeURIComponent(value)

export const exportApi = {
  /** Ссылка на серверный экспорт (svg/plantuml/mermaid/json). */
  url: (diagramId: string, format: string, inline = false) =>
    `/api/diagrams/${id(diagramId)}/export?format=${format}${inline ? '&inline=1' : ''}`,

  /** Текстовая модель схемы — источник для client-side PNG/PDF (ТЗ §15). */
  svgText: (diagramId: string) => apiFetchText(`/diagrams/${id(diagramId)}/export?format=svg&inline=1`),

  plantUmlText: (diagramId: string) =>
    apiFetchText(`/diagrams/${id(diagramId)}/export?format=plantuml&inline=1`),

  mermaidText: (diagramId: string) =>
    apiFetchText(`/diagrams/${id(diagramId)}/export?format=mermaid&inline=1`),

  jsonText: (diagramId: string) => apiFetchText(`/diagrams/${id(diagramId)}/export?format=json&inline=1`),

  /** Скачивание файла, отдаваемого сервером. */
  download: async (diagramId: string, format: string, filename: string) => {
    const response = await fetch(`/api/diagrams/${id(diagramId)}/export?format=${format}`)
    if (!response.ok) {
      throw new Error(`Не удалось экспортировать схему: HTTP ${response.status}`)
    }
    saveBlob(await response.blob(), filename)
  },
}

/** Сохранение blob в браузере. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function saveText(text: string, filename: string, mime = 'text/plain;charset=utf-8') {
  saveBlob(new Blob([text], { type: mime }), filename)
}
