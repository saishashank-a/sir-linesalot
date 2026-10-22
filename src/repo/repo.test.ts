import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { digest, repoIndex } from './core.ts'
import { parseRepo } from './github.ts'

test('parseRepo takes the forms people paste', () => {
  expect(parseRepo('sindresorhus/ky')).toEqual({ owner: 'sindresorhus', repo: 'ky' })
  expect(parseRepo('https://github.com/sindresorhus/ky/')).toEqual({ owner: 'sindresorhus', repo: 'ky' })
  expect(parseRepo('https://github.com/vercel/next.js.git')).toEqual({ owner: 'vercel', repo: 'next.js' })
  expect(parseRepo('git@github.com:a/b.git')).toEqual({ owner: 'a', repo: 'b' })
  expect(parseRepo('https://github.com/a/b/tree/feature%2Fx')).toEqual({ owner: 'a', repo: 'b', ref: 'feature/x' })
  expect(parseRepo('https://gitlab.com/a/b')).toBeNull()
  expect(parseRepo('just-words')).toBeNull()
})

test('the web prompt carries the skill rules (src/repo/claude.ts slices SKILL.md)', () => {
  const skill = readFileSync('plugin/skills/repo-diagram/SKILL.md', 'utf8')
  const rules = skill.slice(skill.indexOf('## 2.'), skill.indexOf('## 3.'))
  expect(rules).toContain('Every edge needs evidence')
  expect(rules).not.toContain('node SCRIPT')
})

test('digest keeps small files, lists the ones over budget, and never reads those', async () => {
  const read: string[] = []
  const files = [
    { path: 'a.ts', size: 40 },
    { path: 'big.ts', size: 4000 },
    { path: 'logo.png', size: 10 },
  ]
  const out = await digest({ name: 'r', branch: 'main' }, files, async (p) => (read.push(p), 'x'.repeat(files.find((f) => f.path === p)!.size)), {
    maxTokens: 200,
  })
  expect(out).toContain('FILE: a.ts')
  expect(out).toContain('[binary file]')
  expect(out).toContain('Over budget, omitted (1): big.ts')
  expect(read).toEqual(['a.ts']) // big.ts skipped on size alone, logo.png never fetched
})

test('core modules rank real code above tests, including test folders', async () => {
  const files = ['source/core.ts', 'source/util.ts', 'test/main.ts', 'src/a.test.ts'].map((path) => ({ path, size: path.startsWith('source') ? 100 : 9000 }))
  const src: Record<string, string> = {
    'source/core.ts': "import './util'",
    'source/util.ts': '',
    'test/main.ts': "import '../source/core'\nimport '../source/util'",
    'src/a.test.ts': "import '../source/core'",
  }
  const { core } = await repoIndex(files, async (p) => src[p].replace(/import '/g, "import x from '"))
  expect(core.slice(0, 2).sort()).toEqual(['source/core.ts', 'source/util.ts'])
})
