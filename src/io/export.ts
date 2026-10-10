// SVG and PNG export. docToSvg is pure: it draws with the canvas's own rough
// functions and seeds (canvas/rough.ts, canvas/geometry.ts), so the file matches
// the canvas stroke for stroke. Colours come in as resolved CSS variables, so the
// output carries literal hex values and renders the same in any viewer.
import { absFrame } from '../edit/canvasActions.ts'
import { overviewPlate } from '../model/resolve.ts'
import type { LalDocument, LalNode } from '../model/schema.ts'
import { lineColor } from '../canvas/adapter.ts'
import { edgeGeometry, type Box } from '../canvas/geometry.ts'
import { colorVar, nodeColors, nodeDrawables, nodeStyle, pathSpecs, plateDrawables, portalGlyph, lineSegment, type PathSpec } from '../canvas/rough.ts'
import { nodeSize, textWidthAt, wrapText } from './layout.ts'

export interface SvgOptions {
  colors: Record<string, string> // CSS variable name -> value, e.g. { '--c-ink': '#1e1e1e' }
  fontDataUrl?: string // embedded so the file renders anywhere, and inside a PNG canvas
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const PAD = 24

export function docToSvg(doc: LalDocument, plateId: string | null, { colors, fontDataUrl }: SvgOptions): string {
  const col = (v: string | undefined) => (v ?? 'none').replace(/var\((--[\w-]+)\)/g, (_, n: string) => colors[n] ?? '#000')
  const plate = doc.plates?.find((p) => p.id === plateId) ?? (doc.plates?.length ? overviewPlate(doc) : undefined)
  const nodes = doc.nodes.filter((n) => n.plate === plate?.id)
  const onPlate = new Set(nodes.map((n) => n.id))
  const origin = plate?.position ?? { x: 0, y: 0 }
  const box = new Map(
    nodes.map((n) => {
      const { width, height } = nodeSize(n)
      const p = n.position ?? { x: 0, y: 0 }
      return [n.id, { x: origin.x + p.x, y: origin.y + p.y, width, height }]
    }),
  )
  const center = (id: string): Box => {
    const r = box.get(id)!
    return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, hw: r.width / 2, hh: r.height / 2 }
  }

  const paths = (specs: PathSpec[], extra = '') =>
    specs
      .map((p) => `<path d="${p.d}" stroke="${col(p.stroke)}" stroke-width="${p.strokeWidth}" fill="${col(p.fill)}"` +
        `${p.fillOpacity ? ` fill-opacity="${p.fillOpacity}"` : ''}${p.dash ? ` stroke-dasharray="${p.dash}"` : ''}${extra}/>`)
      .join('')
  const text = (x: number, y: number, lines: string[], px: number, fill: string, anchor = 'middle', lh = px * 1.28) =>
    `<text x="${x}" font-size="${px}" fill="${col(fill)}" text-anchor="${anchor}" dominant-baseline="central">` +
    lines.map((l, i) => `<tspan x="${x}" y="${y + (i - (lines.length - 1) / 2) * lh}">${esc(l)}</tspan>`).join('') +
    `</text>`

  const out: string[] = []
  const frame = plate ? absFrame(doc, plate) : null
  if (plate && frame) {
    out.push(`<g transform="translate(${frame.x},${frame.y})">${paths(pathSpecs(plateDrawables(plate, frame.width, frame.height), { S: 'var(--c-frame)' }))}</g>`)
    out.push(text(frame.x + 16, frame.y + 22, [plate.title], 22, 'var(--c-muted)', 'start'))
  }
  // Lines under edges, edges under nodes: the canvas's stacking order.
  for (const line of doc.lines ?? []) {
    if (!line.nodes.every((id) => onPlate.has(id))) continue
    const segs = line.nodes.slice(1).map((t, i) => {
      const [a, b] = [center(line.nodes[i]), center(t)]
      return lineSegment(`${line.id}#${i}`, { x: a.cx, y: a.cy }, { x: b.cx, y: b.cy })
    })
    out.push(paths(pathSpecs(segs, { S: lineColor(doc, line) }), ' stroke-opacity="0.32" stroke-linecap="round"'))
  }
  const labels: string[] = []
  for (const e of doc.edges) {
    if (!onPlate.has(e.source)) continue
    const g = edgeGeometry(center(e.source), center(e.target), e.id, e.style)
    out.push(paths(pathSpecs(g.drawables, { S: colorVar(e.style?.stroke, 'var(--c-ink)') }, e.style?.dashed)))
    if (e.label) {
      const w = textWidthAt(e.label, 15) + 12
      labels.push(`<rect x="${g.labelX - w / 2}" y="${g.labelY - 10}" width="${w}" height="20" fill="${col('var(--c-paper)')}"/>`)
      labels.push(text(g.labelX, g.labelY, [e.label], 15, 'var(--c-muted)'))
    }
  }
  for (const n of nodes) out.push(nodeSvg(n))
  out.push(...labels)

  function nodeSvg(n: LalNode) {
    const r = box.get(n.id)!
    const note = n.kind === 'note'
    const px = note ? 16 : 18
    const shapes = pathSpecs(nodeDrawables(n, r.width, r.height), nodeColors(n), nodeStyle(n)?.dashed)
    const glyph = n.link ? paths(pathSpecs(portalGlyph(r.width - 22, r.height - 20), { S: 'var(--c-ink)' })) : ''
    const lines = wrapText(n.label, r.width - 2 * (note ? 14 : 20), px)
    return `<g transform="translate(${r.x},${r.y})">${paths(shapes)}${glyph}${text(r.width / 2, r.height / 2, lines, px, 'var(--c-ink)', 'middle', note ? 20 : 23)}</g>`
  }

  const rects = [...box.values(), ...(frame ? [frame] : [])]
  const x0 = Math.min(...rects.map((r) => r.x), 0) - PAD
  const y0 = Math.min(...rects.map((r) => r.y), 0) - PAD
  const width = Math.ceil(Math.max(...rects.map((r) => r.x + r.width), 0) + PAD - x0)
  const height = Math.ceil(Math.max(...rects.map((r) => r.y + r.height), 0) + PAD - y0)
  const font = fontDataUrl ? `@font-face{font-family:Excalifont;src:url(${fontDataUrl}) format("woff2")}` : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x0} ${y0} ${width} ${height}">` +
    `<title>${esc(plate?.title ?? doc.title)}</title>` +
    `<style>${font}text{font-family:Excalifont,"Comic Sans MS",cursive}</style>` +
    `<rect x="${x0}" y="${y0}" width="${width}" height="${height}" fill="${col('var(--c-paper)')}"/>` +
    out.join('') +
    `</svg>`
  )
}

// --- Browser side: colours from the live theme, font fetched once, SVG -> PNG. ---

const COLOR_VARS = ['ink', 'paper', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'pink', 'gray', 'frame', 'muted']

export function themeColors(): Record<string, string> {
  const cs = getComputedStyle(document.documentElement)
  return Object.fromEntries(COLOR_VARS.map((c) => [`--c-${c}`, cs.getPropertyValue(`--c-${c}`).trim()]))
}

let font: Promise<string> | undefined
// The Latin subset covers labels in Latin scripts; others fall back to the viewer's cursive font.
export function excalifontDataUrl(): Promise<string> {
  return (font ??= fetch('/fonts/Excalifont-Latin.woff2')
    .then((r) => r.blob())
    .then((b) => new Promise<string>((ok, fail) => Object.assign(new FileReader(), { onload: (e: ProgressEvent<FileReader>) => ok(e.target!.result as string), onerror: fail }).readAsDataURL(b))))
}

export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = Object.assign(document.createElement('canvas'), { width: img.width * scale, height: img.height * scale })
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('PNG encoding failed'))), 'image/png'))
  } finally {
    URL.revokeObjectURL(url)
  }
}
