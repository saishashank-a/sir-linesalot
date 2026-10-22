// Repo -> digest / index / diagram, with no git or fs: callers hand in the file list
// and a reader. scripts/ingest.ts and scripts/repo-diagram.ts feed it `git ls-files`;
// the web app (src/repo/github.ts) feeds it a GitHub tree.
import { z } from 'zod'
import type { LalCard, LalDocument, LalEdge, LalNode } from '../model/schema.ts'
import { parseLal } from '../model/validate.ts'

export interface RepoFile {
  path: string
  size: number
}
export type Read = (path: string) => Promise<string>

// ---- ingest (gitingest-style digest) ----

const IGNORE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|.*\.min\.(js|css)|.*\.map|\.omc\/.*|graphify-out\/.*)$/
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|zip|gz|mp4|mp3)$/i
const MAX_FILE = 1_000_000
const SEP = '='.repeat(48)
// ponytail: chars/4 token estimate; swap in a real tokenizer if budgets need to be exact.
const tokens = (s: string) => Math.ceil(s.length / 4)

export interface DigestOptions {
  ext?: string[]
  dir?: string[]
  maxTokens?: number
  treeOnly?: boolean
  lines?: boolean
}

export function digestFiles(files: RepoFile[], o: DigestOptions = {}): RepoFile[] {
  const exts = o.ext?.map((e) => '.' + e.replace(/^\./, ''))
  const dirs = o.dir?.map((d) => d.replace(/\/?$/, '/'))
  return files
    .filter((f) => f.path && !IGNORE.test(f.path))
    .filter((f) => !exts || exts.some((e) => f.path.endsWith(e)))
    .filter((f) => !dirs || dirs.some((d) => f.path.startsWith(d)))
}

function tree(paths: string[], root: string): string {
  const t: Record<string, any> = {}
  for (const p of paths) p.split('/').reduce((n, part) => (n[part] ??= {}), t)
  const walk = (n: Record<string, any>, pre: string): string[] =>
    Object.keys(n)
      .sort((a, b) => +!Object.keys(n[b]).length - +!Object.keys(n[a]).length || a.localeCompare(b))
      .flatMap((k, i, all) => {
        const last = i === all.length - 1
        const dir = Object.keys(n[k]).length > 0
        return [`${pre}${last ? '└── ' : '├── '}${k}${dir ? '/' : ''}`, ...walk(n[k], pre + (last ? '    ' : '│   '))]
      })
  return ['Directory structure:', `└── ${root}/`, ...walk(t, '    ')].join('\n')
}

export async function digest(repo: { name: string; branch: string }, all: RepoFile[], read: Read, o: DigestOptions = {}): Promise<string> {
  const files = digestFiles(all, o)
  const paths = files.map((f) => f.path)
  // Small files first so a tight budget keeps breadth; skipped files are listed, never silently dropped.
  const budget = o.maxTokens ?? 50_000
  const treeText = tree(paths, repo.name)
  let used = tokens(treeText)
  const blocks: { path: string; text: string }[] = []
  const skipped: string[] = []
  if (!o.treeOnly) {
    for (const f of [...files].sort((a, b) => a.size - b.size)) {
      // Bytes >= chars, so this only skips files that can't fit; it saves a fetch per file on the web.
      if (used + Math.ceil(Math.min(f.size, MAX_FILE) / 4) > budget) {
        skipped.push(f.path)
        continue
      }
      const body = BINARY.test(f.path) ? '[binary file]' : f.size > MAX_FILE ? `[skipped: ${f.size} bytes]` : await read(f.path)
      const text = o.lines ? body.split('\n').map((l, i) => `${String(i + 1).padStart(4)} | ${l}`).join('\n') : body
      const block = `${SEP}\nFILE: ${f.path}\n${SEP}\n${text}\n`
      if (used + tokens(block) > budget) {
        skipped.push(f.path)
        continue
      }
      used += tokens(block)
      blocks.push({ path: f.path, text: block })
    }
    blocks.sort((a, b) => paths.indexOf(a.path) - paths.indexOf(b.path))
  }
  return [
    `Repository: ${repo.name}`,
    `Branch: ${repo.branch}`,
    `Files analyzed: ${o.treeOnly ? 0 : blocks.length}`,
    `Estimated tokens: ${(used / 1000).toFixed(1)}k`,
    ...(skipped.length ? [`Over budget, omitted (${skipped.length}): ${skipped.join(', ')}`] : []),
    '',
    treeText,
    '',
    ...blocks.map((b) => b.text),
  ].join('\n')
}

// ---- index (core modules + local imports) ----

const normalize = (p: string) =>
  p.split('/').reduce<string[]>((out, s) => (s === '..' ? out.slice(0, -1) : s === '.' || !s ? out : [...out, s]), []).join('/')
const dirname = (p: string) => p.split('/').slice(0, -1).join('/')

export async function repoIndex(files: RepoFile[], read: Read): Promise<{ core: string[]; text: string }> {
  const paths = new Set(files.map((f) => f.path))
  const size = new Map(files.map((f) => [f.path, f.size]))
  // ponytail: regex over relative JS/TS imports only; add per-language patterns when a non-TS repo needs this.
  const code = files.map((f) => f.path).filter((f) => /\.(m?[jt]sx?)$/.test(f))
  const fanIn = new Map<string, number>()
  const out = await Promise.all(
    code.map(async (f) => {
      const deps = [...(await read(f)).matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)]
        .map((m) => normalize(`${dirname(f)}/${m[1].replace(/\?.*$/, '')}`))
        .map((p) => [p, `${p}.ts`, `${p}.tsx`, `${p}/index.ts`].find((c) => paths.has(c)) ?? p)
      return { f, deps }
    }),
  )
  for (const { deps } of out) deps.forEach((d) => fanIn.set(d, (fanIn.get(d) ?? 0) + 1))
  // Tests import everything and are big, so they'd crowd out the real modules: sink both test files and test folders.
  const isTest = (f: string) => /(^|\/)(tests?|__tests__|spec|test-d)\/|\.(test|spec)\./.test(f)
  const rank = (f: string) => Math.log2((size.get(f) ?? 0) + 1) + 2 * (fanIn.get(f) ?? 0) - (isTest(f) ? 99 : 0)
  const core = [...code].sort((a, b) => rank(b) - rank(a)).slice(0, 16)
  const lines = out.filter(({ f, deps }) => deps.length || fanIn.get(f)).map(({ f, deps }) => `${f} (in ${fanIn.get(f) ?? 0}) -> ${deps.join(', ') || '-'}`)
  return { core, text: [`CORE MODULES: ${core.join(', ')}`, '', ...lines].join('\n') }
}

// ---- graph.json -> .lal ----

// What the model writes (the skill's graph.json, the web app's structured output).
export const GraphSchema = z.object({
  title: z.string(),
  groups: z.array(z.object({ id: z.string(), label: z.string() })),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      group: z.string(),
      kind: z.enum(['code', 'store', 'actor', 'external']).optional(),
      path: z.string().optional(),
      summary: z.string().optional(),
    }),
  ),
  edges: z.array(
    z.object({ source: z.string(), target: z.string(), label: z.string().optional(), evidence: z.string().nullable().optional() }),
  ),
})
export type Graph = z.infer<typeof GraphSchema>

export interface Source {
  paths: string[]
  remote: string // https web URL of the repo
  commit: string
}

// Every model mistake comes back as an issue string, so the caller can hand them back to the model.
export function compileGraph(g: Graph, src: Source, generator: string): { doc?: LalDocument; issues: string[] } {
  const files = new Set(src.paths)
  const isTracked = (p: string) => files.has(p) || src.paths.some((f) => f.startsWith(p.replace(/\/?$/, '/')))
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
  if (issues.length) return { issues }

  // Links point at the remote's web UI; only http(s) survives the card renderer's safeUrl.
  const linkOf = (p: string) => `${src.remote}/${files.has(p) ? 'blob' : 'tree'}/${src.commit}/${p}`
  const TONES = ['blue', 'yellow', 'green', 'pink', 'violet', 'teal', 'orange'] as const
  const tone = new Map(g.groups.map((x, i) => [x.id, TONES[i % TONES.length]]))
  const groupLabel = new Map(g.groups.map((x) => [x.id, x.label]))
  const SHAPE = { code: 'rectangle', store: 'ellipse', actor: 'pill', external: 'diamond' } as const
  const sid = (s: string) => s.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 60)

  const nodes: LalNode[] = g.nodes.map((n) => ({
    id: `n_${sid(n.id)}`,
    label: n.label,
    shape: SHAPE[n.kind ?? 'code'],
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
    meta: { generator, commit: src.commit },
  }
  const { issues: lalIssues } = parseLal(doc)
  return lalIssues.length ? { issues: lalIssues.map((x) => `${x.path}: ${x.message}`) } : { doc, issues: [] }
}
