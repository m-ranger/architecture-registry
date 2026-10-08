import { exportApi, saveBlob, saveText, type ExportFormat } from '../api/exportApi'

/**
 * Экспорт схемы (ТЗ §15).
 * SVG / PlantUML / Mermaid / JSON формируются на backend из внутренней
 * графовой модели. PNG и PDF строятся на клиенте из того же серверного SVG,
 * чтобы canvas и экспорт не расходились (ТЗ §3).
 */

const filename = (code: string, version: number | null, extension: string) =>
  `${code}-v${version ?? 'draft'}.${extension}`

export interface ExportContext {
  id: string
  code: string
  version: number | null
}

/** SVG, PlantUML, Mermaid, JSON — прямое скачивание серверного экспорта. */
export async function exportVectorOrText(
  context: ExportContext,
  format: Exclude<ExportFormat, 'png' | 'pdf'>,
): Promise<void> {
  const extensions: Record<string, string> = {
    svg: 'svg',
    plantuml: 'puml',
    mermaid: 'mmd',
    json: 'json',
  }
  await exportApi.download(context.id, format, filename(context.code, context.version, extensions[format]))
}

let svgImageSize: { width: number; height: number } | null = null

async function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Не удалось отрисовать SVG'))
      element.src = url
    })
    const match = svg.match(/width="(\d+)"\s+height="(\d+)"/)
    svgImageSize = {
      width: image.width || (match ? Number(match[1]) : 1600),
      height: image.height || (match ? Number(match[2]) : 1000),
    }
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** PNG (P0, ТЗ §15) — растеризация серверного SVG. */
export async function exportPng(context: ExportContext, scale = 2): Promise<void> {
  const svg = await exportApi.svgText(context.id)
  const image = await loadSvgImage(svg)
  const size = svgImageSize || { width: 1600, height: 1000 }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(size.width * scale)
  canvas.height = Math.round(size.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas недоступен в этом браузере')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('Не удалось сформировать PNG'))), 'image/png'),
  )
  saveBlob(blob, filename(context.code, context.version, 'png'))
}

/** PDF (P0, ТЗ §15) — печать серверного SVG через диалог печати браузера. */
export async function exportPdf(context: ExportContext): Promise<void> {
  const svg = await exportApi.svgText(context.id)
  const printWindow = window.open('', '_blank', 'width=1200,height=800')
  if (!printWindow) throw new Error('Браузер заблокировал окно печати')
  printWindow.document.write(
    `<!doctype html><html lang="ru"><head><meta charset="utf-8" />` +
      `<title>${context.code}</title>` +
      '<style>@page{size:A4 landscape;margin:10mm}body{margin:0;display:flex;justify-content:center}</style>' +
      `</head><body>${svg}</body></html>`,
  )
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

/** Копирование текстовой модели в буфер обмена (диаграммы как код, ТЗ §15). */
export async function copyTextModel(context: ExportContext, format: 'plantuml' | 'mermaid'): Promise<void> {
  const text = format === 'plantuml' ? await exportApi.plantUmlText(context.id) : await exportApi.mermaidText(context.id)
  await navigator.clipboard.writeText(text)
}

/** Сохранение текстовой модели файлом. */
export async function downloadTextModel(context: ExportContext, format: 'plantuml' | 'mermaid' | 'json'): Promise<void> {
  const map = { plantuml: 'puml', mermaid: 'mmd', json: 'json' } as const
  const loaders = {
    plantuml: exportApi.plantUmlText,
    mermaid: exportApi.mermaidText,
    json: exportApi.jsonText,
  } as const
  const text = await loaders[format](context.id)
  saveText(text, filename(context.code, context.version, map[format]))
}

export async function runExport(context: ExportContext, format: ExportFormat): Promise<void> {
  switch (format) {
    case 'svg':
    case 'plantuml':
    case 'mermaid':
    case 'json':
      await exportVectorOrText(context, format)
      return
    case 'png':
      await exportPng(context)
      return
    case 'pdf':
      await exportPdf(context)
      return
    default:
      throw new Error(`Формат ${format} не поддерживается`)
  }
}
