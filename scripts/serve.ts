// Opens a .lal in the Sir Linesalot viewer served from this machine (127.0.0.1 only):
// the diagram rides in the URL hash, so nothing is uploaded anywhere.
// Run: node scripts/serve.ts diagrams/architecture.lal   (plugin: serve.mjs, viewer in ../viewer)
import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateRawSync } from 'node:zlib'

const file = process.argv[2]
if (!file) {
  console.error('usage: serve.ts <file>.lal')
  process.exit(2)
}
const here = fileURLToPath(new URL('.', import.meta.url))
// Plugin layout first (scripts/ next to viewer/), then this repo's own build output.
const root = [join(here, '../viewer'), join(here, '../dist')].find((d) => existsSync(join(d, 'index.html')))
if (!root) {
  console.error('viewer not found: run `npm run build` (or `npm run plugin`) first')
  process.exit(1)
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
}
// ponytail: exits 2 minutes after the last request; the page needs nothing once loaded. Make it a flag if people keep it open to reload.
const IDLE_MS = 120_000
let idle: NodeJS.Timeout
const touch = () => {
  clearTimeout(idle)
  idle = setTimeout(() => process.exit(0), IDLE_MS)
}

const server = createServer((req, res) => {
  touch()
  let target = ''
  try {
    target = resolve(root, '.' + decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname))
  } catch {
    // malformed escape: fall through to the app shell
  }
  // Stay inside the viewer folder; anything else (including ../ tricks) gets the app shell.
  const inside = target.startsWith(root + sep) && existsSync(target) && extname(target)
  const served = inside ? target : join(root, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[extname(served)] ?? 'application/octet-stream' })
  res.end(readFileSync(served))
})

server.listen(0, '127.0.0.1', () => {
  const { port } = server.address() as { port: number }
  const url = `http://127.0.0.1:${port}/#lal=${deflateRawSync(readFileSync(file), { level: 9 }).toString('base64url')}`
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] : ['xdg-open', [url]]
  execFile(cmd as string, args as string[], (err) => err && console.error(`couldn't open a browser (${err.message}); open the link yourself`))
  console.log(`serving on http://127.0.0.1:${port}/ (stops 2 minutes after the page goes quiet)`)
  console.log(`open: ${url}`)
  touch()
})
