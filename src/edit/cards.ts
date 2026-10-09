// Pure helpers for the card editor. They return new arrays so they work both on
// edit() drafts and in tests.
import type { LalCardField, LalDocument } from '../model/schema.ts'

// Links in cards may only be http(s) or mailto; anything else becomes '' (rendered as plain text).
export const safeUrl = (u: string) => (/^(https?:|mailto:)/i.test(u.trim()) ? u.trim() : '')

export const addField = (fields: LalCardField[]): LalCardField[] => [...fields, { label: 'New field', value: '' }]

export const removeField = (fields: LalCardField[], i: number): LalCardField[] => fields.filter((_, k) => k !== i)

// Swaps field i with its neighbour; out-of-range moves leave the list unchanged.
export function moveField(fields: LalCardField[], i: number, delta: -1 | 1): LalCardField[] {
  const j = i + delta
  if (i < 0 || i >= fields.length || j < 0 || j >= fields.length) return fields
  const out = [...fields]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

export function updateField(fields: LalCardField[], i: number, patch: Partial<LalCardField>): LalCardField[] {
  return fields.map((f, k) => {
    if (k !== i) return f
    const next = { ...f, ...patch }
    if (next.format === 'markdown') delete next.format // markdown is the default; keep files minimal
    return next
  })
}

// What a card is titled when it has no title of its own.
export function labelOf(doc: LalDocument, id: string): string {
  const n = doc.nodes.find((x) => x.id === id)
  if (n) return n.label
  const e = doc.edges.find((x) => x.id === id)
  if (e) return e.label ?? `${e.source} → ${e.target}`
  return doc.lines?.find((x) => x.id === id)?.name ?? doc.plates?.find((x) => x.id === id)?.title ?? id
}
