// Local gitingest/uithub: prints a repo digest (summary, tree, file contents) for LLM context.
// Works on private repos because it only reads `git ls-files`; nothing leaves the machine.
// Run: node scripts/ingest.ts [--ext ts,tsx] [--dir src] [--max-tokens 50000] [--tree-only] [--lines] > digest.txt
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { parseArgs } from 'node:util'
import { digest } from '../src/repo/core.ts'

const { values: o } = parseArgs({
  options: {
    ext: { type: 'string' },
    dir: { type: 'string' },
    'max-tokens': { type: 'string', default: '50000' },
    'tree-only': { type: 'boolean', default: false },
    lines: { type: 'boolean', default: false },
  },
})

const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8' }).trim()
const files = git('ls-files').split('\n').filter(Boolean).map((path) => ({ path, size: statSync(path).size }))
console.log(
  await digest({ name: basename(process.cwd()), branch: git('rev-parse', '--abbrev-ref', 'HEAD') }, files, async (f) => readFileSync(f, 'utf8'), {
    ext: o.ext?.split(','),
    dir: o.dir?.split(','),
    maxTokens: Number(o['max-tokens']),
    treeOnly: o['tree-only'],
    lines: o.lines,
  }),
)
