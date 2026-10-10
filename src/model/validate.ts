// Loads untrusted .lal input: structure via zod, then the semantic rules from
// PLAN.md section 1 that JSON Schema can't express. Collects every issue rather
// than stopping at the first, so generators get one complete report.
import { LalDocumentSchema, type LalDocument } from './schema.ts'
import { resolvePath } from './resolve.ts'

export interface Issue {
  path: string // e.g. "paths[2].nodes[3]"; "" = whole document
  message: string
}

const SUPPORTED_VERSION = 1

export function formatPath(segments: readonly PropertyKey[]): string {
  return segments
    .map((s, i) => (typeof s === 'number' ? `[${s}]` : `${i ? '.' : ''}${String(s)}`))
    .join('')
}

export function parseLal(input: unknown): { doc?: LalDocument; issues: Issue[] } {
  const version = (input as { version?: unknown } | null)?.version
  if (typeof version === 'number' && version !== SUPPORTED_VERSION) {
    const hint = version > SUPPORTED_VERSION ? 'it was made by a newer Sir Linesalot' : 'no migration exists for it'
    return { issues: [{ path: 'version', message: `unsupported version ${version} (${hint}); this app reads version ${SUPPORTED_VERSION}` }] }
  }

  const parsed = LalDocumentSchema.safeParse(input)
  if (!parsed.success) {
    return { issues: parsed.error.issues.map((i) => ({ path: formatPath(i.path), message: i.message })) }
  }
  const issues = validateDoc(parsed.data)
  return issues.length ? { issues } : { doc: parsed.data, issues }
}

export function validateDoc(doc: LalDocument): Issue[] {
  const issues: Issue[] = []
  const err = (path: string, message: string) => issues.push({ path, message })

  const cards = doc.cards ?? []
  const paths = doc.paths ?? []
  const plates = doc.plates ?? []
  const lines = doc.lines ?? []

  // Rule 1: one id namespace across every element type.
  const kindOf = new Map<string, string>()
  const groups = { nodes: doc.nodes, edges: doc.edges, cards, paths, plates, lines }
  for (const [group, items] of Object.entries(groups)) {
    items.forEach((item, i) => {
      const prev = kindOf.get(item.id)
      if (prev) err(`${group}[${i}].id`, `id "${item.id}" is already used by ${prev}`)
      else kindOf.set(item.id, `${group}[${i}]`)
    })
  }

  const nodes = new Map(doc.nodes.map((n) => [n.id, n]))
  const plateIds = new Set(plates.map((p) => p.id))
  // Rule 2 helper: the node must exist; rule 7: notes can't be wired up.
  const checkNodeRef = (at: string, ref: string) => {
    const n = nodes.get(ref)
    if (!n) err(at, `node "${ref}" does not exist`)
    else if (n.kind === 'note') err(at, `"${ref}" is a note; notes can't be in edges, paths or lines`)
  }
  const plateOf = (nodeId: string) => nodes.get(nodeId)?.plate

  // Rule 4: an element's nodes all sit on one plate.
  const checkSamePlate = (at: string, nodeIds: string[]) => {
    const seen = new Set(nodeIds.filter((n) => nodes.has(n)).map(plateOf))
    if (seen.size > 1) err(at, `spans plates ${[...seen].map((p) => `"${p}"`).join(', ')}; must stay within one plate`)
  }

  doc.edges.forEach((e, i) => {
    checkNodeRef(`edges[${i}].source`, e.source)
    checkNodeRef(`edges[${i}].target`, e.target)
    checkSamePlate(`edges[${i}]`, [e.source, e.target])
  })

  // Rule 6: cards attach to a node, edge, line or plate, at most one each.
  const carded = new Set<string>()
  cards.forEach((c, i) => {
    const kind = kindOf.get(c.target)?.split('[')[0]
    if (!kind) err(`cards[${i}].target`, `"${c.target}" does not exist`)
    else if (!['nodes', 'edges', 'lines', 'plates'].includes(kind)) err(`cards[${i}].target`, `cards can't attach to ${kind}`)
    if (carded.has(c.target)) err(`cards[${i}].target`, `"${c.target}" already has a card`)
    carded.add(c.target)
  })

  // Rule 5: every path resolves to a chain of edges.
  paths.forEach((p, i) => {
    p.nodes.forEach((n, j) => checkNodeRef(`paths[${i}].nodes[${j}]`, n))
    checkSamePlate(`paths[${i}]`, p.nodes)
    for (const prob of resolvePath(doc, p).problems) {
      err(prob.index < 0 ? `paths[${i}].edges` : `paths[${i}].nodes[${prob.index}]`, prob.message)
    }
  })

  lines.forEach((l, i) => {
    l.nodes.forEach((n, j) => checkNodeRef(`lines[${i}].nodes[${j}]`, n))
    checkSamePlate(`lines[${i}]`, l.nodes)
  })

  // Rule 3: plates.
  if (plates.length) {
    const overviews = plates.filter((p) => p.kind === 'overview').length
    if (overviews !== 1) err('plates', `needs exactly one plate with kind "overview", found ${overviews}`)
    doc.nodes.forEach((n, i) => {
      if (!n.plate) err(`nodes[${i}].plate`, 'required when the document declares plates')
    })
    plates.forEach((p, i) => {
      if (p.parent && !plateIds.has(p.parent)) err(`plates[${i}].parent`, `plate "${p.parent}" does not exist`)
      const seen = new Set([p.id])
      for (let cur = p.parent; cur; cur = plates.find((q) => q.id === cur)?.parent) {
        if (seen.has(cur)) {
          err(`plates[${i}].parent`, 'parent chain loops back on itself')
          break
        }
        seen.add(cur)
      }
    })
  }
  doc.nodes.forEach((n, i) => {
    if (n.plate && !plateIds.has(n.plate)) err(`nodes[${i}].plate`, `plate "${n.plate}" does not exist`)
    if (n.link) {
      if (!plateIds.has(n.link.plate)) err(`nodes[${i}].link.plate`, `plate "${n.link.plate}" does not exist`)
      else if (n.link.plate === n.plate) err(`nodes[${i}].link.plate`, 'a portal must link to a different plate')
    }
  })

  return issues
}
