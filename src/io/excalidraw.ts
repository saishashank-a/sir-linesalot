// .excalidraw import and export, hand-written (no Excalidraw package).
// Export: nodes -> shapes with bound text, edges -> bound arrows, lines -> line elements,
// plates -> frames. Each element carries its .lal object in customData (cards ride on
// their target, doc-level fields on the first element), so re-importing restores the
// document exactly, keeping any moves and renames made in Excalidraw.
// Import of a drawing made in Excalidraw is best effort and reports what it skipped.
// The file is untrusted: the result goes through the same parseLal as any .lal.
import { absFrame } from '../edit/canvasActions.ts'
import { resolvePath } from '../model/resolve.ts'
import { PALETTE, type LalCard, type LalDocument, type LalEdge, type LalLine, type LalNode, type LalPlate, type Style } from '../model/schema.ts'
import { parseLal, type Issue } from '../model/validate.ts'
import { autoColor } from '../canvas/adapter.ts'
import { borderPoint } from '../canvas/geometry.ts'
import { nodeShape, nodeStyle, seedFromId } from '../canvas/rough.ts'
import { nodeSize, textWidthAt, wrapText } from './layout.ts'

// Excalidraw has no CSS variables and does dark mode by inverting, so export uses the light theme
// values from theme.css (which are Excalidraw's own palette).
const HEX: Record<string, string> = {
  ink: '#1e1e1e', paper: '#fdfcf8', red: '#e03131', orange: '#e8590c', yellow: '#f2b705', green: '#2f9e44',
  teal: '#0c8599', blue: '#1971c2', violet: '#6741d9', pink: '#c2255c', gray: '#868e96',
}
const EXCALIFONT = 5 // Excalidraw's fontFamily id for Excalifont
const MAX_ELEMENTS = 10_000

const hex = (c: string | undefined, fallback: string) => (!c ? fallback : c.startsWith('#') ? c : (HEX[c] ?? fallback))
const varHex = (v: string) => hex(v.match(/^var\(--c-([\w-]+)\)$/)?.[1] ?? v, HEX.ink)

type El = Record<string, unknown> & { id: string; type: string }

function base(id: string, type: string, x: number, y: number, width: number, height: number, style?: Style): El {
  const seed = seedFromId(id)
  const fill = style?.fillStyle === 'none' ? undefined : style?.fill
  return {
    id, type, x, y, width, height, angle: 0,
    strokeColor: hex(style?.stroke, HEX.ink),
    backgroundColor: fill ? hex(fill, 'transparent') : 'transparent',
    fillStyle: style?.fillStyle === 'dots' || !style?.fillStyle || style.fillStyle === 'none' ? 'hachure' : style.fillStyle,
    strokeWidth: style?.strokeWidth ?? 1.5,
    strokeStyle: style?.dashed ? 'dashed' : 'solid',
    roughness: Math.min(2, Math.round(style?.roughness ?? 1.2)),
    opacity: 100, groupIds: [], frameId: null, roundness: null, seed, version: 1, versionNonce: seed,
    isDeleted: false, boundElements: null, updated: 1, link: null, locked: false,
  }
}

function textEl(id: string, containerId: string | null, cx: number, cy: number, text: string, px: number, maxWidth: number, color = HEX.ink): El {
  const lines = wrapText(text, maxWidth, px)
  const width = Math.max(...lines.map((l) => textWidthAt(l, px)), 1)
  const height = lines.length * px * 1.25
  return {
    ...base(id, 'text', cx - width / 2, cy - height / 2, width, height),
    strokeColor: color, text: lines.join('\n'), originalText: text, fontSize: px, fontFamily: EXCALIFONT,
    textAlign: 'center', verticalAlign: 'middle', containerId, autoResize: true, lineHeight: 1.25,
  }
}

export function docToExcalidraw(doc: LalDocument): string {
  const els: El[] = []
  const cards = new Map((doc.cards ?? []).map((c) => [c.target, c]))
  const lal = (key: string, value: unknown, id: string) => ({ lal: { [key]: value }, ...(cards.has(id) && { lalCard: cards.get(id) }) })
  const plates = new Map((doc.plates ?? []).map((p) => [p.id, p]))
  const rect = new Map<string, { x: number; y: number; width: number; height: number }>()
  const bound = new Map<string, { type: string; id: string }[]>()
  const bind = (on: string, type: string, id: string) => bound.set(on, [...(bound.get(on) ?? []), { type, id }])

  for (const n of doc.nodes) {
    const o = (n.plate && plates.get(n.plate)?.position) || { x: 0, y: 0 }
    const p = n.position ?? { x: 0, y: 0 }
    rect.set(n.id, { x: o.x + p.x, y: o.y + p.y, ...nodeSize(n) })
  }
  const box = (id: string) => {
    const r = rect.get(id)!
    return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, hw: r.width / 2, hh: r.height / 2 }
  }

  for (const line of doc.lines ?? []) {
    const pts = line.nodes.map((id) => [box(id).cx, box(id).cy])
    const [x0, y0] = pts[0]
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const color = varHex(autoColor(line.color, doc.lines!.indexOf(line)))
    els.push({
      ...base(line.id, 'line', x0, y0, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
      strokeColor: color, strokeWidth: 4, opacity: 40, roughness: 1,
      points: pts.map(([x, y]) => [x - x0, y - y0]), lastCommittedPoint: null,
      startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: null,
      customData: lal('line', line, line.id),
    })
  }
  for (const e of doc.edges) {
    const [s, t] = [box(e.source), box(e.target)]
    const a = borderPoint(s, { x: t.cx, y: t.cy })
    const b = borderPoint(t, { x: s.cx, y: s.cy })
    const el: El = {
      ...base(e.id, 'arrow', a.x, a.y, Math.abs(b.x - a.x), Math.abs(b.y - a.y), { ...e.style, fill: undefined }),
      points: [[0, 0], [b.x - a.x, b.y - a.y]], lastCommittedPoint: null, elbowed: false,
      startBinding: { elementId: e.source, focus: 0, gap: 4 }, endBinding: { elementId: e.target, focus: 0, gap: 4 },
      startArrowhead: null, endArrowhead: 'arrow', customData: lal('edge', e, e.id),
    }
    bind(e.source, 'arrow', e.id)
    bind(e.target, 'arrow', e.id)
    els.push(el)
    if (e.label) {
      els.push(textEl(`${e.id}:label`, e.id, (a.x + b.x) / 2, (a.y + b.y) / 2, e.label, 16, 200, HEX.gray))
      bind(e.id, 'text', `${e.id}:label`)
    }
  }
  for (const n of doc.nodes) {
    const r = rect.get(n.id)!
    const shape = nodeShape(n)
    els.push({
      ...base(n.id, shape === 'pill' ? 'rectangle' : shape, r.x, r.y, r.width, r.height, nodeStyle(n)),
      ...(shape === 'pill' && { roundness: { type: 3 } }),
      customData: lal('node', n, n.id),
    })
    els.push(textEl(`${n.id}:label`, n.id, r.x + r.width / 2, r.y + r.height / 2, n.label, n.kind === 'note' ? 16 : 18, r.width - 40))
    bind(n.id, 'text', `${n.id}:label`)
  }
  // Frames after their children: Excalidraw keeps a frame above what it contains.
  for (const p of doc.plates ?? []) {
    const f = absFrame(doc, p)
    for (const el of els) if (doc.nodes.some((n) => n.plate === p.id && (el.id === n.id || el.id === `${n.id}:label`))) el.frameId = p.id
    els.push({ ...base(p.id, 'frame', f.x, f.y, f.width, f.height), name: p.title, roughness: 0, customData: lal('plate', p, p.id) })
  }
  for (const el of els) if (bound.has(el.id)) el.boundElements = bound.get(el.id)!
  const header = { $schema: doc.$schema, id: doc.id, title: doc.title, theme: doc.theme, layout: doc.layout, meta: doc.meta, paths: doc.paths }
  if (els[0]) els[0].customData = { ...(els[0].customData as object), lalDoc: header }

  return JSON.stringify(
    { type: 'excalidraw', version: 2, source: 'https://github.com/saishashank-a/sir-linesalot', elements: els, appState: { viewBackgroundColor: HEX.paper, gridSize: null }, files: {} },
    null,
    2,
  )
}

// --- Import ---

const obj = (v: unknown): Record<string, unknown> | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
const named = new Map(Object.entries(HEX).map(([k, v]) => [v.toLowerCase(), k]))
const color = (v: unknown) => {
  const c = str(v)?.toLowerCase()
  if (!c || c === 'transparent') return undefined
  return (named.get(c) as (typeof PALETTE)[number] | undefined) ?? (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(c) ? c : undefined)
}
const SHAPES: Record<string, LalNode['shape']> = { rectangle: 'rectangle', ellipse: 'ellipse', diamond: 'diamond' }

export interface ExcalidrawImport { doc?: LalDocument; issues: Issue[]; skipped: string[] }

export function excalidrawToDoc(text: string): ExcalidrawImport {
  let file: Record<string, unknown> | undefined
  try {
    file = obj(JSON.parse(text))
  } catch (e) {
    return { issues: [{ path: '', message: `not valid JSON: ${(e as Error).message}` }], skipped: [] }
  }
  if (file?.type !== 'excalidraw' || !Array.isArray(file.elements)) return { issues: [{ path: '', message: 'not an .excalidraw file' }], skipped: [] }
  if (file.elements.length > MAX_ELEMENTS) return { issues: [{ path: 'elements', message: `more than ${MAX_ELEMENTS} elements` }], skipped: [] }

  const els = file.elements.map(obj).filter((e): e is El => !!e && typeof e.id === 'string' && typeof e.type === 'string' && !e.isDeleted)
  const skipped = new Map<string, number>()
  const skip = (why: string) => skipped.set(why, (skipped.get(why) ?? 0) + 1)
  const data = (e: El, key: string) => obj(obj(obj(e.customData)?.lal)?.[key])
  const header = obj(els.map((e) => obj(e.customData)?.lalDoc).find(Boolean))
  const labelOf = (id: string) => str(els.find((t) => t.type === 'text' && t.containerId === id)?.originalText ?? els.find((t) => t.type === 'text' && t.containerId === id)?.text)

  // Ids: ours are kept; Excalidraw's are made safe and unique.
  const used = new Set<string>()
  const idFor = (raw: string, prefix: string) => {
    let id = raw.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 56) || prefix
    if (!/^[A-Za-z]/.test(id)) id = `${prefix}_${id}`
    while (used.has(id)) id = `${id}_`
    used.add(id)
    return id
  }

  const plateOf = new Map<string, LalPlate>() // frame element id -> plate
  for (const f of els.filter((e) => e.type === 'frame')) {
    const kept = data(f, 'plate') as LalPlate | undefined
    const p: LalPlate = kept ? { ...kept } : { id: idFor(f.id, 'plate'), title: str(f.name) ?? 'Frame', kind: 'detail' }
    if (kept) used.add(p.id)
    if (str(f.name)) p.title = str(f.name)!
    plateOf.set(f.id, p)
  }
  const plates = [...plateOf.values()]

  const nodes: LalNode[] = []
  const nodeOf = new Map<string, LalNode>() // element id -> node
  for (const e of els) {
    const kept = data(e, 'node') as LalNode | undefined
    const shape = SHAPES[e.type]
    const freeText = e.type === 'text' && !e.containerId
    if (!kept && !shape && !freeText) continue
    const n: LalNode = kept
      ? { ...kept }
      : {
          id: idFor(e.id, 'n'),
          label: freeText ? (str(e.originalText) ?? str(e.text) ?? '') : (labelOf(e.id) ?? ''),
          ...(freeText ? { kind: 'note' as const } : { shape: shape! }),
        }
    if (kept) {
      used.add(n.id)
      n.label = labelOf(e.id) ?? n.label
      if (kept.size) n.size = { width: num(e.width) || kept.size.width, height: num(e.height) || kept.size.height }
    } else if (!freeText) {
      const style: Style = {
        ...(color(e.strokeColor) && { stroke: color(e.strokeColor) }),
        ...(color(e.backgroundColor) && { fill: color(e.backgroundColor), fillStyle: (['hachure', 'solid', 'zigzag', 'cross-hatch'].includes(str(e.fillStyle)!) ? e.fillStyle : 'hachure') as Style['fillStyle'] }),
        ...(e.strokeStyle === 'dashed' && { dashed: true }),
      }
      if (Object.keys(style).length) n.style = style
    }
    const plate = plateOf.get(str(e.frameId) ?? '')
    if (plate) n.plate = plate.id
    else if (!kept?.plate || !plates.some((p) => p.id === kept.plate)) delete n.plate
    n.position = { x: Math.round(num(e.x)), y: Math.round(num(e.y)) } // absolute for now
    nodes.push(n)
    nodeOf.set(e.id, n)
  }

  // Plates need exactly one overview; loose nodes join it (a new one if no frame can be it).
  if (plates.length) {
    let overview = plates.find((p) => p.kind === 'overview')
    if (nodes.some((n) => !n.plate) && !overview) plates.unshift((overview = { id: idFor('plate_drawing', 'plate'), title: 'Drawing', kind: 'overview' }))
    if (!overview) (overview = plates[0]).kind = 'overview'
    for (const p of plates) if (p !== overview && p.kind === 'overview') p.kind = 'detail'
    for (const n of nodes) n.plate ??= overview.id
    for (const p of plates) if (p.parent && !plates.some((q) => q.id === p.parent)) delete p.parent
  }
  // Node positions become plate-relative; plates without a position get one from layoutDoc on load.
  const origin = new Map(plates.map((p) => [p.id, p.position ?? { x: 0, y: 0 }]))
  for (const n of nodes) {
    const o = n.plate ? origin.get(n.plate)! : { x: 0, y: 0 }
    n.position = { x: n.position!.x - o.x, y: n.position!.y - o.y }
  }

  const edges: LalEdge[] = []
  const lines: LalLine[] = []
  for (const e of els) {
    if (e.type === 'arrow') {
      const kept = data(e, 'edge') as LalEdge | undefined
      const s = nodeOf.get(str(obj(e.startBinding)?.elementId) ?? '')
      const t = nodeOf.get(str(obj(e.endBinding)?.elementId) ?? '')
      if (!s || !t) { skip('arrows not connected to shapes at both ends'); continue }
      if (s.kind === 'note' || t.kind === 'note') { skip('arrows to or from free text'); continue }
      if (s.plate !== t.plate) { skip('arrows between different frames'); continue }
      const edge: LalEdge = kept ? { ...kept, source: s.id, target: t.id } : { id: idFor(e.id, 'e'), source: s.id, target: t.id }
      if (kept) used.add(edge.id)
      const label = labelOf(e.id)
      if (label) edge.label = label
      else delete edge.label
      if (!kept && e.strokeStyle === 'dashed') edge.style = { dashed: true }
      edges.push(edge)
    } else if (e.type === 'line' && data(e, 'line')) {
      const line = { ...(data(e, 'line') as LalLine) }
      if (line.nodes.every((id) => nodes.some((n) => n.id === id))) lines.push(line)
      else skip('shared lines whose stops were deleted')
    } else if (!['text', 'frame', 'rectangle', 'ellipse', 'diamond'].includes(e.type)) skip(`${e.type} elements`)
  }

  const ids = new Set([...nodes, ...edges, ...lines, ...plates].map((x) => x.id))
  const cards = els.map((e) => obj(obj(e.customData)?.lalCard) as LalCard | undefined).filter((c): c is LalCard => !!c && ids.has(c.target))
  const paths = (Array.isArray(header?.paths) ? (header.paths as LalDocument['paths'])! : []).filter((p) => {
    const ok = p.nodes.every((id) => nodes.some((n) => n.id === id)) && !resolvePath({ edges }, p).problems.length
    if (!ok) skip('paths broken by deleted shapes or arrows')
    return ok
  })

  const doc = {
    ...(str(header?.$schema) && { $schema: str(header!.$schema) }),
    format: 'lal', version: 1,
    id: str(header?.id) ?? 'doc_excalidraw', title: str(header?.title) ?? 'Imported drawing',
    ...(header?.theme !== undefined && { theme: header.theme }),
    ...(header?.layout !== undefined && { layout: header.layout }),
    nodes, edges,
    ...(cards.length && { cards }), ...(paths.length && { paths }), ...(plates.length && { plates }), ...(lines.length && { lines }),
    ...(header?.meta !== undefined && { meta: header.meta }),
  }
  const { doc: valid, issues } = parseLal(doc)
  return { doc: valid, issues, skipped: [...skipped].map(([why, n]) => `${n} ${why}`) }
}
