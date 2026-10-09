// Route building for Play paths and shared lines: checks each picked node as it's
// added, and turns a finished route into the document fields. edit() still runs
// the full validator on Done; this is for instant, per-pick feedback.
import type { LalDocument } from '../model/schema.ts'

export type RouteKind = 'path' | 'line'
export type StepCheck =
  | { ok: true; edgeId?: string; ambiguous?: boolean }
  | { ok: false; reason: string }

// Can `nodeId` come next after `route`?
export function canAppend(doc: LalDocument, kind: RouteKind, route: string[], nodeId: string): StepCheck {
  const node = doc.nodes.find((n) => n.id === nodeId)
  if (!node) return { ok: false, reason: `"${nodeId}" doesn't exist` }
  if (node.kind === 'note') return { ok: false, reason: `Sticky notes can't be on a ${kind}` }
  const prev = route.at(-1)
  if (!prev) return { ok: true }
  if (prev === nodeId) return { ok: false, reason: `"${node.label}" is already the last stop` }
  const first = doc.nodes.find((n) => n.id === route[0])
  if (first && first.plate !== node.plate) return { ok: false, reason: `"${node.label}" is on a different plate` }
  if (kind === 'line') return { ok: true } // lines may jump between any nodes

  const edges = doc.edges.filter((e) => e.source === prev && e.target === nodeId)
  const from = doc.nodes.find((n) => n.id === prev)?.label ?? prev
  if (!edges.length) return { ok: false, reason: `No arrow goes from "${from}" to "${node.label}"` }
  return { ok: true, edgeId: edges[0].id, ambiguous: edges.length > 1 }
}

// Re-checks a whole route (after removing a chip from the middle). Returns a message per bad stop.
export function routeProblems(doc: LalDocument, kind: RouteKind, route: string[]): { index: number; reason: string }[] {
  return route.flatMap((id, i) => {
    const c = canAppend(doc, kind, route.slice(0, i), id)
    return c.ok ? [] : [{ index: i, reason: c.reason }]
  })
}

// Path fields for a valid route. `edges` is only written when some pair has several
// arrows; then it must list one edge per pair (rule 5), so the first one is used.
export function buildPathRoute(doc: LalDocument, route: string[]): { nodes: string[]; edges?: string[] } {
  const steps = route.slice(1).map((id, i) => canAppend(doc, 'path', route.slice(0, i + 1), id))
  const ambiguous = steps.some((s) => s.ok && s.ambiguous)
  return ambiguous ? { nodes: route, edges: steps.map((s) => (s.ok ? s.edgeId! : '')) } : { nodes: route }
}
