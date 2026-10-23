// Local gitdiagram, compiled to .lal instead of Mermaid. Two steps:
//   node scripts/repo-diagram.ts index                     -> SOURCE INDEX (largest files, import fan-in/out)
//   node scripts/repo-diagram.ts build graph.json out.lal  -> checks the graph, writes a validated .lal
// The model only writes graph.json (shape below); this script owns ids, colours, links and validity,
// so a model mistake comes back as an issue list instead of a broken diagram.
//
// graph.json: { title, groups: [{ id, label }], nodes: [{ id, label, group, kind?, path?, summary? }],
//               edges: [{ source, target, label?, evidence? }] }
//   kind: "code" (default) | "store" | "actor" | "external"; path and evidence must be tracked files/dirs.
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
import { compileGraph, GraphSchema, repoIndex } from '../src/repo/core.ts'

const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8' }).trim()
const files = git('ls-files').split('\n').filter(Boolean)
const read = async (f: string) => readFileSync(f, 'utf8')
const [cmd, input, output] = process.argv.slice(2)

if (cmd === 'index') {
  console.log((await repoIndex(files.map((path) => ({ path, size: statSync(path).size })), read)).text)
  process.exit(0)
}

const viewer = process.env.LINESALOT_URL ?? 'https://sir-linesalot.vercel.app/'

// Uploads a built .lal (api/share.ts) and prints a short link. Unlike the #lal= link,
// this sends the diagram to the server, so the skill asks before running it.
if (cmd === 'share' && input) {
  const res = await fetch(new URL('api/share', viewer), { method: 'POST', body: readFileSync(input, 'utf8') })
  const body = await res.json().catch(() => ({ error: res.status === 429 ? 'rate limited (10 uploads a minute); try again shortly' : `server said ${res.status}` }))
  if (!res.ok) {
    console.error(`share failed: ${body.error}`)
    process.exit(1)
  }
  console.log(`short link: ${viewer}#s=${body.id}`)
  process.exit(0)
}

if (cmd !== 'build' || !input || !output) {
  console.error('usage: repo-diagram.ts index | build graph.json out.lal | share out.lal')
  process.exit(2)
}

const parsed = GraphSchema.safeParse(JSON.parse(readFileSync(input, 'utf8')))
if (!parsed.success) {
  console.error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'))
  process.exit(1)
}
// Links point at the remote's web UI (https form of the origin remote).
const remote = git('remote', 'get-url', 'origin').replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '')
const { doc, issues } = compileGraph(parsed.data, { paths: files, remote, commit: git('rev-parse', 'HEAD') }, 'scripts/repo-diagram.ts')
if (!doc) {
  console.error(issues.join('\n'))
  process.exit(1)
}
const text = JSON.stringify(doc, null, 2) + '\n'
writeFileSync(output, text)
console.log(`wrote ${output}: ${doc.nodes.length} nodes, ${doc.edges.length} edges (${doc.edges.filter((e) => e.style?.dashed).length} unverified)`)
// For sharing: the whole diagram rides in the hash (src/io/lal.ts lalFromHash), so even this hosted link uploads nothing.
// Opening it locally is serve.ts's job.
console.log(`share link: ${viewer}#lal=${deflateRawSync(text, { level: 9 }).toString('base64url')}`)
