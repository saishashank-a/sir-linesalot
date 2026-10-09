import type { LalDocument } from '../model/schema.ts'

// Ids share one namespace across the whole document (rule 1), so check every element type.
export function allIds(doc: LalDocument): Set<string> {
  return new Set(
    [doc.nodes, doc.edges, doc.cards ?? [], doc.paths ?? [], doc.plates ?? [], doc.lines ?? []].flatMap((xs) => xs.map((x) => x.id)),
  )
}

// newId(doc, 'n') -> "n_1", "n_2", ... skipping ids already used anywhere in the doc.
export function newId(doc: LalDocument, prefix: string): string {
  const used = allIds(doc)
  for (let i = 1; ; i++) if (!used.has(`${prefix}_${i}`)) return `${prefix}_${i}`
}
