import { parseLal, type Issue } from '../model/validate.ts'
import { LalDocumentSchema, type LalDocument } from '../model/schema.ts'

export function readLal(text: string): { doc?: LalDocument; issues: Issue[] } {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (e) {
    return { issues: [{ path: '', message: `not valid JSON: ${(e as Error).message}` }] }
  }
  return parseLal(json)
}

// Writes exactly what the document holds (including layout-produced positions).
// Keys come out in schema order (zod rebuilds objects in shape order; `meta`
// contents keep theirs), so a file reads the same however it was produced and
// re-saving an unchanged doc is byte-identical.
export function serializeLal(doc: LalDocument): string {
  return JSON.stringify(LalDocumentSchema.parse(doc), null, 2) + '\n'
}
