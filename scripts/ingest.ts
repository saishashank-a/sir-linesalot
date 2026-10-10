// Local gitingest/uithub: prints a repo digest (summary, tree, file contents) for LLM context.
// Works on private repos because it only reads `git ls-files`; nothing leaves the machine.
// Run: node scripts/ingest.ts [--ext ts,tsx] [--dir src] [--max-tokens 50000] [--tree-only] [--lines] > digest.txt
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { parseArgs } from 'node:util'

const { values: o } = parseArgs({
  options: {
    ext: { type: 'string' },
    dir: { type: 'string' },
    'max-tokens': { type: 'string', default: '50000' },
    'tree-only': { type: 'boolean', default: false },
    lines: { type: 'boolean', default: false },
  },
})

const IGNORE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|.*\.min\.(js|css)|.*\.map|\.omc\/.*|graphify-out\/.*)$/
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|zip|gz|mp4|mp3)$/i
const MAX_FILE = 1_000_000
const SEP = '='.repeat(48)
// ponytail: chars/4 token estimate; swap in a real tokenizer if budgets need to be exact.
const tokens = (s: string) => Math.ceil(s.length / 4)

const exts = o.ext?.split(',').map((e) => '.' + e.replace(/^\./, ''))
const dirs = o.dir?.split(',').map((d) => d.replace(/\/?$/, '/'))
const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !IGNORE.test(f))
  .filter((f) => !exts || exts.some((e) => f.endsWith(e)))
  .filter((f) => !dirs || dirs.some((d) => f.startsWith(d)))

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

// Small files first so a tight budget keeps breadth; skipped files are listed, never silently dropped.
const budget = Number(o['max-tokens'])
const treeText = tree(files, basename(process.cwd()))
let used = tokens(treeText)
const blocks: string[] = []
const skipped: string[] = []
if (!o['tree-only']) {
  for (const f of [...files].sort((a, b) => statSync(a).size - statSync(b).size)) {
    const size = statSync(f).size
    const body = BINARY.test(f) ? '[binary file]' : size > MAX_FILE ? `[skipped: ${size} bytes]` : readFileSync(f, 'utf8')
    const text = o.lines ? body.split('\n').map((l, i) => `${String(i + 1).padStart(4)} | ${l}`).join('\n') : body
    const block = `${SEP}\nFILE: ${f}\n${SEP}\n${text}\n`
    if (used + tokens(block) > budget) { skipped.push(f); continue }
    used += tokens(block)
    blocks.push(block)
  }
  blocks.sort((a, b) => files.indexOf(a.split('\n')[1].slice(6)) - files.indexOf(b.split('\n')[1].slice(6)))
}

const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim()
console.log(
  [
    `Repository: ${basename(process.cwd())}`,
    `Branch: ${branch}`,
    `Files analyzed: ${o['tree-only'] ? 0 : blocks.length}`,
    `Estimated tokens: ${(used / 1000).toFixed(1)}k`,
    ...(skipped.length ? [`Over budget, omitted (${skipped.length}): ${skipped.join(', ')}`] : []),
    '',
    treeText,
    '',
    ...blocks,
  ].join('\n'),
)
