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

// A whole .lal carried in a link: `#lal=<base64url of deflate-raw(json)>`. Lives in the
// hash so it never reaches a server; scripts/repo-diagram.ts writes the other half.
export async function lalFromHash(hash: string): Promise<string | null> {
  const m = hash.match(/^#lal=([\w-]+)/)
  if (!m) return null
  const bytes = Uint8Array.from(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()
}

// A short link, `#s=<id>`, for diagrams too big for the hash; api/share.ts stores them.
export async function lalFromShare(hash: string): Promise<string | null> {
  const m = hash.match(/^#s=([\w-]{12})$/)
  if (!m) return null
  const res = await fetch(`/api/share?id=${m[1]}`)
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `server said ${res.status}`)
  return res.text()
}

// Writes exactly what the document holds (including layout-produced positions).
// Keys come out in schema order (zod rebuilds objects in shape order; `meta`
// contents keep theirs), so a file reads the same however it was produced and
// re-saving an unchanged doc is byte-identical.
export function serializeLal(doc: LalDocument): string {
  return JSON.stringify(LalDocumentSchema.parse(doc), null, 2) + '\n'
}
