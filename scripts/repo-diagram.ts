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
import { dirname, join, normalize } from 'node:path'
import { deflateRawSync } from 'node:zlib'
import { parseLal } from '../src/model/validate.ts'
import type { LalCard, LalDocument, LalEdge, LalNode } from '../src/model/schema.ts'

const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8' }).trim()
const files = git('ls-files').split('\n')
const isTracked = (p: string) => files.includes(p) || files.some((f) => f.startsWith(p.replace(/\/?$/, '/')))
const [cmd, input, output] = process.argv.slice(2)

if (cmd === 'index') {
  // ponytail: regex over relative JS/TS imports only; add per-language patterns when a non-TS repo needs this.
  const code = files.filter((f) => /\.(m?[jt]sx?)$/.test(f))
  const fanIn = new Map<string, number>()
  const out = code.map((f) => {
    const deps = [...readFileSync(f, 'utf8').matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)]
      .map((m) => normalize(join(dirname(f), m[1].replace(/\?.*$/, ''))))
      .map((p) => [p, `${p}.ts`, `${p}.tsx`, `${p}/index.ts`].find((c) => files.includes(c)) ?? p)
    deps.forEach((d) => fanIn.set(d, (fanIn.get(d) ?? 0) + 1))
    return { f, deps }
  })
  const rank = (f: string) => Math.log2(statSync(f).size + 1) + 2 * (fanIn.get(f) ?? 0) - (/\.test\./.test(f) ? 99 : 0)
  const core = [...code].sort((a, b) => rank(b) - rank(a)).slice(0, 16)
  console.log(`CORE MODULES: ${core.join(', ')}\n`)
  for (const { f, deps } of out) if (deps.length || fanIn.get(f)) console.log(`${f} (in ${fanIn.get(f) ?? 0}) -> ${deps.join(', ') || '-'}`)
  process.exit(0)
}

if (cmd !== 'build' || !input || !output) {
  console.error('usage: repo-diagram.ts index | build graph.json out.lal')
  process.exit(2)
}

interface G {
  title: string
  groups: { id: string; label: string }[]
  nodes: { id: string; label: string; group: string; kind?: string; path?: string; summary?: string }[]
  edges: { source: string; target: string; label?: string; evidence?: string | null }[]
}
const g: G = JSON.parse(readFileSync(input, 'utf8'))
const issues: string[] = []
const groupIds = new Set(g.groups.map((x) => x.id))
const nodeIds = new Set(g.nodes.map((n) => n.id))
for (const n of g.nodes) {
  if (!groupIds.has(n.group)) issues.push(`node ${n.id}: group "${n.group}" not declared`)
  if (n.path && !isTracked(n.path)) issues.push(`node ${n.id}: path "${n.path}" is not a tracked file or directory`)
  if (!n.path && (n.kind ?? 'code') === 'code') issues.push(`node ${n.id}: code nodes need a path (use kind "external" otherwise)`)
}
for (const e of g.edges) {
  for (const end of [e.source, e.target]) if (!nodeIds.has(end)) issues.push(`edge ${e.source}->${e.target}: node "${end}" not declared`)
  if (e.evidence && !isTracked(e.evidence)) issues.push(`edge ${e.source}->${e.target}: evidence "${e.evidence}" is not tracked`)
}
if (issues.length) {
  console.error(issues.join('\n'))
  process.exit(1)
}

// Links point at the remote's web UI; only http(s) survives the card renderer's safeUrl.
const remote = git('remote', 'get-url', 'origin').replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '')
const ref = git('rev-parse', 'HEAD')
const linkOf = (p: string) => `${remote}/${files.includes(p) ? 'blob' : 'tree'}/${ref}/${p}`

const TONES = ['blue', 'yellow', 'green', 'pink', 'violet', 'teal', 'orange'] as const
const tone = new Map(g.groups.map((x, i) => [x.id, TONES[i % TONES.length]]))
const groupLabel = new Map(g.groups.map((x) => [x.id, x.label]))
const SHAPE = { code: 'rectangle', store: 'ellipse', actor: 'pill', external: 'diamond' } as const
const sid = (s: string) => s.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 60)

const nodes: LalNode[] = g.nodes.map((n) => ({
  id: `n_${sid(n.id)}`,
  label: n.label,
  shape: SHAPE[(n.kind ?? 'code') as keyof typeof SHAPE] ?? 'rectangle',
  style: { fill: tone.get(n.group) },
}))
// No evidence = the model believes the edge but couldn't point at code; draw it dashed, gitdiagram-style.
const edges: LalEdge[] = g.edges.map((e, i) => ({
  id: `e_${i}`,
  source: `n_${sid(e.source)}`,
  target: `n_${sid(e.target)}`,
  ...(e.label && { label: e.label }),
  ...(!e.evidence && { style: { dashed: true } }),
}))
const cards: LalCard[] = [
  ...g.nodes.map((n) => ({
    id: `c_n_${sid(n.id)}`,
    target: `n_${sid(n.id)}`,
    title: n.label,
    fields: [
      { label: 'Group', value: groupLabel.get(n.group)!, format: 'plain' as const },
      ...(n.summary ? [{ label: 'What', value: n.summary, format: 'markdown' as const }] : []),
      ...(n.path ? [{ label: 'Source', value: linkOf(n.path), format: 'url' as const }] : []),
    ],
  })),
  ...g.edges.flatMap((e, i) =>
    e.evidence ? [{ id: `c_e_${i}`, target: `e_${i}`, fields: [{ label: 'Evidence', value: linkOf(e.evidence), format: 'url' as const }] }] : [],
  ),
]

const doc: LalDocument = {
  format: 'lal',
  version: 1,
  id: `doc_${sid(g.title.toLowerCase())}`,
  title: g.title,
  theme: 'auto',
  layout: { direction: 'DOWN' },
  nodes,
  edges,
  cards,
  meta: { generator: 'scripts/repo-diagram.ts', commit: ref },
}
const { issues: lalIssues } = parseLal(doc)
if (lalIssues.length) {
  console.error(lalIssues.map((x) => `${x.path}: ${x.message}`).join('\n'))
  process.exit(1)
}
const text = JSON.stringify(doc, null, 2) + '\n'
writeFileSync(output, text)
console.log(`wrote ${output}: ${nodes.length} nodes, ${edges.length} edges (${edges.filter((e) => e.style?.dashed).length} unverified)`)
// The whole diagram rides in the hash (src/io/lal.ts lalFromHash), so the link opens it with no upload.
const viewer = process.env.LINESALOT_URL ?? 'https://sir-linesalot.vercel.app/'
console.log(`open: ${viewer}#lal=${deflateRawSync(text, { level: 9 }).toString('base64url')}`)
