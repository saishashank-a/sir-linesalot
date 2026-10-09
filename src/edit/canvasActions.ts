// Pure document edits behind the canvas editor. Each mutates a draft, for use
// inside useStore.getState().edit(...), which validates the result.
import { nodeSize, plateFrame } from '../io/layout.ts'
import { overviewPlate as overview, resolvePath } from '../model/resolve.ts'
import type { LalDocument, LalPlate } from '../model/schema.ts'
import { allIds, newId } from './ids.ts'

interface Point { x: number; y: number }

const PLATE_GAP = 160

// A plate's frame in absolute canvas coordinates.
export function absFrame(doc: LalDocument, p: LalPlate) {
  const f = plateFrame(doc, p.id)
  const o = p.position ?? { x: 0, y: 0 }
  return { x: o.x + f.x, y: o.y + f.y, width: f.width, height: f.height }
}

const inside = (r: { x: number; y: number; width: number; height: number }, p: Point) =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height

export function plateAt(doc: LalDocument, p: Point): LalPlate | undefined {
  return doc.plates?.find((pl) => inside(absFrame(doc, pl), p))
}


// Removes nodes/edges and everything that would dangle: edges on removed nodes,
// line stops (lines left with <2 nodes go), paths that no longer resolve, and
// cards whose target is gone. Plates go through deletePlate.
export function deleteElements(doc: LalDocument, ids: Iterable<string>) {
  const gone = new Set(ids)
  doc.nodes = doc.nodes.filter((n) => !gone.has(n.id))
  const nodeIds = new Set(doc.nodes.map((n) => n.id))
  doc.edges = doc.edges.filter((e) => !gone.has(e.id) && nodeIds.has(e.source) && nodeIds.has(e.target))

  if (doc.lines) {
    for (const l of doc.lines) l.nodes = l.nodes.filter((id) => nodeIds.has(id))
    doc.lines = doc.lines.filter((l) => l.nodes.length >= 2)
  }
  if (doc.paths) {
    doc.paths = doc.paths.filter((p) => p.nodes.every((id) => nodeIds.has(id)) && !resolvePath(doc, p).problems.length)
  }
  const left = allIds(doc)
  if (doc.cards) doc.cards = doc.cards.filter((c) => left.has(c.target))
}

// Why a plate can't be deleted, or null if it can. The overview anchors the
// breadcrumbs, so it only goes when it's the last plate.
export function plateDeleteBlocker(doc: LalDocument, id: string): string | null {
  const p = doc.plates?.find((x) => x.id === id)
  if (!p) return 'No such plate'
  if (p === overview(doc) && doc.plates!.length > 1) return "The overview can't be deleted while other plates exist"
  return null
}

// Deletes a plate with everything on it. Portals into it stop being portals and
// its child plates move up to its parent. Deleting the last plate leaves a
// plate-less document, which is allowed.
export function deletePlate(doc: LalDocument, id: string) {
  const p = doc.plates?.find((x) => x.id === id)
  if (!p) return
  const last = doc.plates!.length === 1
  doc.plates = doc.plates!.filter((x) => x !== p)
  for (const child of doc.plates) {
    if (child.parent !== id) continue
    if (p.parent) child.parent = p.parent
    else delete child.parent
  }
  for (const n of doc.nodes) if (n.link?.plate === id) delete n.link
  if (last) {
    // No plates left: the nodes stay where they are, just without a plate.
    const o = p.position ?? { x: 0, y: 0 }
    delete doc.plates
    for (const n of doc.nodes) {
      delete n.plate
      if (n.position) n.position = { x: n.position.x + o.x, y: n.position.y + o.y }
    }
    deleteElements(doc, [id])
  } else {
    deleteElements(doc, [id, ...doc.nodes.filter((n) => n.plate === id).map((n) => n.id)])
  }
}

export function addEdge(doc: LalDocument, source: string, target: string): string {
  const id = newId(doc, 'e')
  doc.edges.push({ id, source, target })
  return id
}

// New step or note centred on `at` (absolute), on the plate under it (overview if none).
export function addNode(doc: LalDocument, kind: 'step' | 'note', at: Point): string {
  const id = newId(doc, kind === 'note' ? 'note' : 'n')
  const label = kind === 'note' ? 'Note' : 'New step'
  const plate = plateAt(doc, at) ?? overview(doc)
  const size = nodeSize({ id, label })
  const o = plate?.position ?? { x: 0, y: 0 }
  doc.nodes.push({
    id,
    label,
    ...(kind === 'note' && { kind: 'note' as const }),
    ...(plate && { plate: plate.id }),
    position: { x: Math.round(at.x - size.width / 2 - o.x), y: Math.round(at.y - size.height / 2 - o.y) },
  })
  return id
}

// New detail plate (with one starter step so it has a frame) to the right of
// everything else. A doc without plates first gets an overview holding all nodes.
export function addPlate(doc: LalDocument): { plateId: string; nodeId: string } {
  if (!doc.plates?.length) {
    const id = newId(doc, 'plate')
    doc.plates = [{ id, title: doc.title, kind: 'overview', position: { x: 0, y: 0 } }]
    for (const n of doc.nodes) n.plate = id
  }
  const right = Math.max(...doc.plates.map((p) => {
    const f = absFrame(doc, p)
    return f.x + f.width
  }))
  const top = Math.min(...doc.plates.map((p) => absFrame(doc, p).y))
  const plateId = newId(doc, 'plate')
  const nodeId = newId(doc, 'n')
  doc.plates.push({ id: plateId, title: 'New plate', kind: 'detail', parent: overview(doc)!.id, position: { x: 0, y: 0 } })
  doc.nodes.push({ id: nodeId, label: 'New step', plate: plateId, position: { x: 0, y: 0 } })
  // Line the new frame's top-left up with `right + gap`, `top`.
  const f = plateFrame(doc, plateId)
  doc.plates.at(-1)!.position = { x: right + PLATE_GAP - f.x, y: top - f.y }
  return { plateId, nodeId }
}

// Moves a node to an absolute top-left. Dropped outside its own frame and inside
// another plate's, it moves to that plate. Frames are measured before the move,
// i.e. as they were when the drag started.
export function moveNode(doc: LalDocument, id: string, abs: Point) {
  const n = doc.nodes.find((x) => x.id === id)
  if (!n) return
  const own = doc.plates?.find((p) => p.id === n.plate)
  const s = nodeSize(n)
  const centre = { x: abs.x + s.width / 2, y: abs.y + s.height / 2 }
  const target = own && !inside(absFrame(doc, own), centre) ? (plateAt(doc, centre) ?? own) : own
  const o = target?.position ?? { x: 0, y: 0 }
  if (target) n.plate = target.id
  n.position = { x: Math.round(abs.x - o.x), y: Math.round(abs.y - o.y) }
}

// Moves a plate so its frame's top-left lands on `abs`.
export function movePlate(doc: LalDocument, id: string, abs: Point) {
  const p = doc.plates?.find((x) => x.id === id)
  if (!p) return
  const f = plateFrame(doc, id)
  p.position = { x: Math.round(abs.x - f.x), y: Math.round(abs.y - f.y) }
}
