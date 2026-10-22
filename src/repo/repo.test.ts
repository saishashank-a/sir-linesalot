import { expect, test } from 'vitest'
import { digest, repoIndex } from './core.ts'

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
