// Derives React Flow nodes/edges from the document. The document stays the only
// source of truth; this runs again whenever it (or the highlight) changes.
import type { Edge, Node } from '@xyflow/react'
import { nodeSize, plateFrame, type Rect, type Size } from '../io/layout.ts'
import { pathMerges, resolvePath } from '../model/resolve.ts'
import type { LalDocument, LalEdge, LalLine, LalNode, LalPath, LalPlate } from '../model/schema.ts'
import { colorVar } from './rough.ts'

// Play mode: `onPath` is the playing path's colour on its nodes, `merge` the colours of every
// path that joins at this node (only on the playing path's merge points).
export type StepData = { node: LalNode; size: Size; hasCard: boolean; dim: boolean; halo?: string; onPath?: string; merge?: string[] }
export type PlateData = { plate: LalPlate; size: Size; hasCard: boolean }
export type SketchEdgeData = { edge: LalEdge; hasCard: boolean; dim: boolean; ink?: string }
export type LineEdgeData = { line: LalLine; color: string; hasCard: boolean; dim: boolean; active: boolean }

export type StepFlowNode = Node<StepData, 'step'>
export type PlateFlowNode = Node<PlateData, 'plate'>
export type SketchFlowEdge = Edge<SketchEdgeData, 'sketch'>
export type LineFlowEdge = Edge<LineEdgeData, 'line'>

// Paths and lines without a colour cycle through these by their position in the document.
const AUTO_COLORS = ['red', 'blue', 'green', 'orange', 'violet', 'teal', 'pink']
export const autoColor = (color: string | undefined, index: number) =>
  colorVar(color || AUTO_COLORS[Math.max(index, 0) % AUTO_COLORS.length], 'var(--c-ink)')
export const lineColor = (doc: LalDocument, line: LalLine) => autoColor(line.color, (doc.lines ?? []).indexOf(line))
export const pathColor = (doc: LalDocument, path: LalPath) => autoColor(path.color, (doc.paths ?? []).indexOf(path))

export function docToFlow(doc: LalDocument, highlightLineId: string | null, playPathId: string | null = null) {
  const carded = new Set((doc.cards ?? []).map((c) => c.target))
  const pp = doc.paths?.find((p) => p.id === playPathId)
  // Playing a path replaces the line highlight: everything off the path fades back.
  const hl = pp ? undefined : doc.lines?.find((l) => l.id === highlightLineId)
  const touched = new Set(hl?.nodes)
  const halo = hl && lineColor(doc, hl)
  const ppNodes = new Set(pp?.nodes)
  const ppEdges = new Set(pp ? resolvePath(doc, pp).edgeIds : [])
  const ink = pp && pathColor(doc, pp)
  const merges = pp ? pathMerges(doc) : new Map<string, string[]>()
  const mergeColors = (id: string) =>
    merges.get(id)?.map((pid) => pathColor(doc, doc.paths!.find((p) => p.id === pid)!))

  const nodes: (StepFlowNode | PlateFlowNode)[] = []
  const frames = new Map<string, Rect>()
  // Plates first: React Flow needs parents before their children.
  for (const p of doc.plates ?? []) {
    const f = plateFrame(doc, p.id)
    const pos = p.position ?? { x: 0, y: 0 }
    frames.set(p.id, f)
    nodes.push({
      id: p.id,
      type: 'plate',
      position: { x: pos.x + f.x, y: pos.y + f.y },
      width: f.width,
      height: f.height,
      data: { plate: p, size: f, hasCard: carded.has(p.id) },
    })
  }
  for (const n of doc.nodes) {
    const size = nodeSize(n)
    const f = n.plate ? frames.get(n.plate) : undefined
    const pos = n.position ?? { x: 0, y: 0 }
    nodes.push({
      id: n.id,
      type: 'step',
      position: { x: pos.x - (f?.x ?? 0), y: pos.y - (f?.y ?? 0) }, // children are relative to the frame
      ...(f && { parentId: n.plate }),
      width: size.width,
      height: size.height,
      data: {
        node: n, size, hasCard: carded.has(n.id),
        dim: (!!hl && !touched.has(n.id)) || (!!pp && !ppNodes.has(n.id)),
        halo: touched.has(n.id) ? halo : undefined,
        ...(ppNodes.has(n.id) && { onPath: ink, merge: mergeColors(n.id) }),
      },
    })
  }

  // Lines first so they draw underneath ordinary edges.
  const edges: (SketchFlowEdge | LineFlowEdge)[] = []
  for (const line of doc.lines ?? []) {
    const data = { line, color: lineColor(doc, line), hasCard: carded.has(line.id), dim: !!pp || (!!hl && hl !== line), active: hl === line }
    line.nodes.slice(1).forEach((target, i) => {
      edges.push({ id: `${line.id}#${i}`, type: 'line', source: line.nodes[i], target, data })
    })
  }
  for (const e of doc.edges) {
    edges.push({
      id: e.id,
      type: 'sketch',
      source: e.source,
      target: e.target,
      data: {
        edge: e, hasCard: carded.has(e.id),
        dim: (!!hl && !(touched.has(e.source) && touched.has(e.target))) || (!!pp && !ppEdges.has(e.id)),
        ...(ppEdges.has(e.id) && { ink }),
      },
    })
  }
  return { nodes, edges }
}
