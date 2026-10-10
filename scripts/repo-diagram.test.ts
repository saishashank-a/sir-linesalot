import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const dir = mkdtempSync(join(tmpdir(), 'repo-diagram-'))
const build = (graph: object) => {
  writeFileSync(join(dir, 'g.json'), JSON.stringify(graph))
  try {
    execFileSync('node', ['scripts/repo-diagram.ts', 'build', join(dir, 'g.json'), join(dir, 'out.lal')], { stdio: 'pipe' })
    return ''
  } catch (e) {
    return String((e as { stderr: Buffer }).stderr)
  }
}

test('rejects invented paths, undeclared nodes and fake evidence', () => {
  const err = build({
    title: 't',
    groups: [{ id: 'a', label: 'A' }],
    nodes: [{ id: 'x', label: 'X', group: 'a', path: 'src/nope.ts' }],
    edges: [{ source: 'x', target: 'q', evidence: 'fake.ts' }],
  })
  expect(err).toContain('path "src/nope.ts"')
  expect(err).toContain('node "q" not declared')
  expect(err).toContain('evidence "fake.ts"')
})

test('compiles a valid graph; unevidenced edges are dashed', () => {
  expect(
    build({
      title: 'Store flow',
      groups: [{ id: 'm', label: 'Model' }],
      nodes: [
        { id: 'store', label: 'Store', group: 'm', path: 'src/store.ts' },
        { id: 'schema', label: 'Schema', group: 'm', path: 'src/model/schema.ts' },
        { id: 'user', label: 'User', group: 'm', kind: 'actor' },
      ],
      edges: [
        { source: 'store', target: 'schema', label: 'uses', evidence: 'src/store.ts' },
        { source: 'user', target: 'store' },
      ],
    }),
  ).toBe('')
  const doc = JSON.parse(readFileSync(join(dir, 'out.lal'), 'utf8'))
  expect(doc.edges.map((e: { style?: { dashed?: boolean } }) => !!e.style?.dashed)).toEqual([false, true])
  expect(doc.cards.find((c: { target: string }) => c.target === 'e_0').fields[0].value).toMatch(/\/blob\/[0-9a-f]{40}\/src\/store\.ts$/)
})
