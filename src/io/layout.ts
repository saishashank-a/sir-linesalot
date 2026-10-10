// Default node sizes, dagre auto-layout for nodes without positions, and
// left-to-right arrangement of plates without positions (PLAN.md section 1, Defaults).
import { Graph, layout } from '@dagrejs/dagre'
import type { LalDocument, LalNode, Layout } from '../model/schema.ts'

export interface Size { width: number; height: number }
export interface Rect extends Size { x: number; y: number }

export const LABEL_FONT = '18px Excalifont'
const MAX_TEXT = 200
const PAD_X = 20
const LINE_H = 23
const PLATE_PAD = 40
const PLATE_TITLE = 36
const PLATE_GAP = 160
const RANKDIR = { RIGHT: 'LR', DOWN: 'TB', LEFT: 'RL', UP: 'BT' } as const

let ctx: CanvasRenderingContext2D | null | undefined
function textWidth(text: string): number {
  if (ctx === undefined) ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  if (!ctx) return text.length * 9 // no DOM (tests): rough per-character estimate
  ctx.font = LABEL_FONT
  return ctx.measureText(text).width
}

// Greedy word wrap at `max` px, for renderers without CSS layout (SVG export).
// Overlong words are kept whole, like the canvas's overflow-wrap would break them visually.
export function wrapText(text: string, max = MAX_TEXT, px = 18): string[] {
  const width = (t: string) => (textWidth(t) * px) / 18
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && width(next) > max) {
      lines.push(line)
      line = word
    } else line = next
  }
  return line ? [...lines, line] : lines.length ? lines : ['']
}

export const textWidthAt = (text: string, px: number) => (textWidth(text) * px) / 18

const sizeCache = new Map<string, Size>()
// Callers must await document.fonts.load(LABEL_FONT) first, or the cache keeps fallback-font widths.
export function nodeSize(n: LalNode): Size {
  if (n.size) return n.size
  const key = `${n.shape}|${n.label}`
  let s = sizeCache.get(key)
  if (!s) {
    const w = textWidth(n.label)
    // ponytail: line count ignores word breaks; measure wrapped lines if labels clip.
    const lines = Math.max(1, Math.ceil(w / MAX_TEXT))
    const grow = n.shape === 'diamond' || n.shape === 'ellipse' ? 1.4 : 1
    // ceil + 4px slack: a box exactly as wide as its text still wraps the last glyph.
    s = {
      width: Math.ceil(Math.max(120, Math.min(w, MAX_TEXT) + 2 * PAD_X + 4) * grow),
      height: Math.ceil(Math.max(56, lines * LINE_H + 24) * grow),
    }
    sizeCache.set(key, s)
  }
  return s
}

// The frame around a plate's nodes, in that plate's own coordinates.
export function plateFrame(doc: LalDocument, plateId: string): Rect {
  const kids = doc.nodes.filter((n) => n.plate === plateId && n.position)
  if (!kids.length) return { x: 0, y: 0, width: 320, height: 200 }
  const xs = kids.flatMap((n) => [n.position!.x, n.position!.x + nodeSize(n).width])
  const ys = kids.flatMap((n) => [n.position!.y, n.position!.y + nodeSize(n).height])
  const x = Math.min(...xs) - PLATE_PAD
  const y = Math.min(...ys) - PLATE_PAD - PLATE_TITLE
  return { x, y, width: Math.max(...xs) + PLATE_PAD - x, height: Math.max(...ys) + PLATE_PAD - y }
}

// Returns a copy with every node and plate positioned. Positions already set are kept.
export function layoutDoc(input: LalDocument): LalDocument {
  const doc = structuredClone(input)
  const plates = doc.plates ?? []
  if (!plates.length) layoutPlate(doc, undefined, doc.layout)
  for (const p of plates) layoutPlate(doc, p.id, { ...doc.layout, ...p.layout })
  arrangePlates(doc)
  return doc
}

function layoutPlate(doc: LalDocument, plateId: string | undefined, cfg: Layout = {}) {
  const onPlate = doc.nodes.filter((n) => n.plate === plateId)
  const missing = onPlate.filter((n) => !n.position)
  if (!missing.length) return

  const spacing = cfg.spacing ?? 80
  const g = new Graph()
  g.setGraph({ rankdir: RANKDIR[cfg.direction ?? 'RIGHT'], ranksep: spacing, nodesep: 40 })
  g.setDefaultEdgeLabel(() => ({}))
  const ids = new Set(missing.map((n) => n.id))
  for (const n of missing) g.setNode(n.id, { ...nodeSize(n) })
  for (const e of doc.edges) if (ids.has(e.source) && ids.has(e.target)) g.setEdge(e.source, e.target)
  layout(g)

  // ponytail: new nodes go below the already-placed ones. Pinning placed nodes
  // inside dagre would interleave them better, if mixed docs turn out common.
  const placed = onPlate.filter((n) => n.position)
  const offsetY = placed.length ? Math.max(...placed.map((n) => n.position!.y + nodeSize(n).height)) + spacing : 0
  for (const n of missing) {
    const p = g.node(n.id)
    n.position = { x: Math.round(p.x - p.width / 2), y: Math.round(p.y - p.height / 2 + offsetY) }
  }
}

function arrangePlates(doc: LalDocument) {
  const plates = [...(doc.plates ?? [])].sort((a, b) => Number(b.kind === 'overview') - Number(a.kind === 'overview'))
  let cursor = 0
  for (const p of plates.filter((p) => p.position)) {
    const f = plateFrame(doc, p.id)
    cursor = Math.max(cursor, p.position!.x + f.x + f.width + PLATE_GAP)
  }
  for (const p of plates.filter((p) => !p.position)) {
    const f = plateFrame(doc, p.id)
    p.position = { x: cursor - f.x, y: -f.y }
    cursor += f.width + PLATE_GAP
  }
}
