// Short links for diagrams too big to ride in a #lal= hash. POST a .lal, get back
// an id; GET ?id= returns it. The id is a hash of the content, so sharing the same
// diagram twice gives the same link. The store is private: the id is the only key.
import { get, put } from '@vercel/blob'
// Bundled from src/model/validate.ts by `npm run plugin`: Vercel functions can't import the app's .ts sources.
import { parseLal } from './_lib/validate.mjs'

const MAX_BYTES = 2_000_000
// Uploads are rate limited by the Vercel firewall rule "Short link uploads" (10 POSTs a minute
// per IP, 429 past that), not in code. ponytail: no auth; tie uploads to accounts once short
// links are a paid feature.

const pathOf = (id: string) => `s/${id}.lal`
const json = (body: object, status: number) => Response.json(body, { status })

export async function POST(req: Request): Promise<Response> {
  const text = await req.text()
  if (text.length > MAX_BYTES) return json({ error: `diagram over ${MAX_BYTES / 1e6} MB` }, 413)
  let input: unknown
  try {
    input = JSON.parse(text)
  } catch {
    return json({ error: 'not valid JSON' }, 400)
  }
  const { doc, issues } = parseLal(input)
  if (!doc) return json({ error: 'not a valid .lal', issues: issues.slice(0, 5) }, 400)

  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  const id = Buffer.from(digest).toString('base64url').slice(0, 12) // 72 bits: unguessable enough for link-sharing
  await put(pathOf(id), text, { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true })
  return json({ id }, 201)
}

export async function GET(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!/^[\w-]{12}$/.test(id)) return json({ error: 'bad id' }, 400)
  const found = await get(pathOf(id), { access: 'private' })
  if (!found) return json({ error: 'no diagram with that link' }, 404)
  // Content never changes for an id, so browsers and the CDN can keep it.
  return new Response(found.stream, {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=31536000, immutable' },
  })
}
