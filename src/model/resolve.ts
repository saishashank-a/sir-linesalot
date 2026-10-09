import type { LalDocument, LalEdge, LalPath, LalPlate } from './schema.ts'

export interface PathResolution {
  edgeIds: string[]
  problems: { index: number; message: string }[] // index = position of the pair's first node
}

// Turns a path's ordered node list into the edges the Play token travels.
// Each consecutive pair needs exactly one source->target edge, unless the
// path lists its edges explicitly.
export function resolvePath(doc: Pick<LalDocument, 'edges'>, path: LalPath): PathResolution {
  const byId = new Map(doc.edges.map((e) => [e.id, e]))
  const between = new Map<string, LalEdge[]>()
  for (const e of doc.edges) {
    const key = `${e.source}\u0000${e.target}`
    between.set(key, [...(between.get(key) ?? []), e])
  }

  const out: PathResolution = { edgeIds: [], problems: [] }
  const pairs = path.nodes.length - 1
  if (path.edges && path.edges.length !== pairs) {
    out.problems.push({ index: -1, message: `edges[] has ${path.edges.length} entries, expected ${pairs} (one per node pair)` })
    return out
  }

  for (let i = 0; i < pairs; i++) {
    const [a, b] = [path.nodes[i], path.nodes[i + 1]]
    if (path.edges) {
      const e = byId.get(path.edges[i])
      if (!e) out.problems.push({ index: i, message: `edge "${path.edges[i]}" does not exist` })
      else if (e.source !== a || e.target !== b) out.problems.push({ index: i, message: `edge "${e.id}" does not go ${a} -> ${b}` })
      else out.edgeIds.push(e.id)
      continue
    }
    const found = between.get(`${a}\u0000${b}`) ?? []
    if (found.length === 1) out.edgeIds.push(found[0].id)
    else if (found.length === 0) out.problems.push({ index: i, message: `no edge goes ${a} -> ${b}` })
    else out.problems.push({ index: i, message: `${found.length} edges go ${a} -> ${b}; list the one to use in edges[]` })
  }
  return out
}

// Nodes where separate paths arrive by different edges, e.g. three flows that all
// end up at one shared stage. Maps node id -> ids of the paths that merge there.
export function pathMerges(doc: Pick<LalDocument, 'edges' | 'paths'>): Map<string, string[]> {
  const arrivals = new Map<string, Map<string, string[]>>() // node -> incoming edge -> paths
  for (const p of doc.paths ?? []) {
    resolvePath(doc, p).edgeIds.forEach((edgeId, i) => {
      const node = p.nodes[i + 1]
      const byEdge = arrivals.get(node) ?? new Map<string, string[]>()
      byEdge.set(edgeId, [...(byEdge.get(edgeId) ?? []), p.id])
      arrivals.set(node, byEdge)
    })
  }
  const out = new Map<string, string[]>()
  for (const [node, byEdge] of arrivals) {
    if (byEdge.size > 1) out.set(node, [...new Set([...byEdge.values()].flat())])
  }
  return out
}

export const overviewPlate = (doc: Pick<LalDocument, 'plates'>) =>
  doc.plates?.find((p) => p.kind === 'overview') ?? doc.plates?.[0]

// Breadcrumbs for a plate: its `parent` chain from the root down to the plate itself.
// A chain that doesn't start at the overview gets the overview in front, so there's
// always a way home.
export function plateTrail(doc: Pick<LalDocument, 'plates'>, plateId: string): LalPlate[] {
  const plates = doc.plates ?? []
  const trail: LalPlate[] = []
  // Validation rules out cycles; the length guard keeps a bad doc from hanging.
  for (let p = plates.find((x) => x.id === plateId); p && trail.length <= plates.length; p = plates.find((x) => x.id === p!.parent)) {
    trail.unshift(p)
  }
  const home = overviewPlate(doc)
  if (home && trail[0] && trail[0] !== home) trail.unshift(home)
  return trail
}
