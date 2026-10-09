// Derives React Flow nodes/edges from the document. The document stays the only
// source of truth; this runs again whenever it (or the highlight) changes.
import type { Edge, Node } from '@xyflow/react'
import { nodeSize, plateFrame, type Rect, type Size } from '../io/layout.ts'
import type { LalDocument, LalEdge, LalLine, LalNode, LalPlate } from '../model/schema.ts'
import { colorVar } from './rough.ts'

export type StepData = { node: LalNode; size: Size; hasCard: boolean; dim: boolean; halo?: string }
export type PlateData = { plate: LalPlate; size: Size; hasCard: boolean }
export type SketchEdgeData = { edge: LalEdge; hasCard: boolean; dim: boolean }
export type LineEdgeData = { line: LalLine; color: string; hasCard: boolean; dim: boolean; active: boolean }

export type StepFlowNode = Node<StepData, 'step'>
export type PlateFlowNode = Node<PlateData, 'plate'>
export type SketchFlowEdge = Edge<SketchEdgeData, 'sketch'>
export type LineFlowEdge = Edge<LineEdgeData, 'line'>

const LINE_COLORS = ['red', 'blue', 'green', 'orange', 'violet', 'teal', 'pink']
export const lineColor = (doc: LalDocument, line: LalLine) =>
  colorVar(line.color ?? LINE_COLORS[(doc.lines ?? []).indexOf(line) % LINE_COLORS.length], 'var(--c-ink)')

export function docToFlow(doc: LalDocument, highlightLineId: string | null) {
  const carded = new Set((doc.cards ?? []).map((c) => c.target))
  const hl = doc.lines?.find((l) => l.id === highlightLineId)
  const touched = new Set(hl?.nodes)
  const halo = hl && lineColor(doc, hl)

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
      data: { node: n, size, hasCard: carded.has(n.id), dim: !!hl && !touched.has(n.id), halo: touched.has(n.id) ? halo : undefined },
    })
  }

  // Lines first so they draw underneath ordinary edges.
  const edges: (SketchFlowEdge | LineFlowEdge)[] = []
  for (const line of doc.lines ?? []) {
    const data = { line, color: lineColor(doc, line), hasCard: carded.has(line.id), dim: !!hl && hl !== line, active: hl === line }
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
      data: { edge: e, hasCard: carded.has(e.id), dim: !!hl && !(touched.has(e.source) && touched.has(e.target)) },
    })
  }
  return { nodes, edges }
}
