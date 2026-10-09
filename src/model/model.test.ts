import { readFileSync } from 'node:fs'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { LalDocumentSchema, type LalDocument } from './schema.ts'
import { pathMerges, resolvePath } from './resolve.ts'
import { parseLal } from './validate.ts'

const fixture: LalDocument = JSON.parse(readFileSync('samples/request-flows.lal', 'utf8'))
const committedSchema = JSON.parse(readFileSync('schema/lal.schema.json', 'utf8'))

// Deep copy of the fixture, broken by `mutate`.
const broken = (mutate: (d: LalDocument) => void) => {
  const d = structuredClone(fixture)
  mutate(d)
  return parseLal(d)
}
const paths = (r: ReturnType<typeof parseLal>) => r.issues.map((i) => i.path)

describe('fixture', () => {
  it('is valid', () => {
    const r = parseLal(fixture)
    expect(r.issues).toEqual([])
    expect(r.doc).toBeDefined()
  })

  it('resolves every path to its edges', () => {
    const edgesOf = (id: string) => resolvePath(fixture, fixture.paths!.find((p) => p.id === id)!)
    expect(edgesOf('p_approval')).toEqual({
      edgeIds: ['e_submit_route', 'e_route_manager', 'e_manager_finance', 'e_finance_fulfil', 'e_fulfil_close'],
      problems: [],
    })
    expect(edgesOf('p_direct').edgeIds).toEqual(['e_submit_route', 'e_route_fulfil', 'e_fulfil_close'])
    expect(edgesOf('p_fulfil_steps').edgeIds).toHaveLength(3)
  })

  it('finds where the request flows merge: only at Fulfilment', () => {
    expect([...pathMerges(fixture)]).toEqual([['n_fulfil', ['p_approval', 'p_self', 'p_direct']]])
  })
})

describe('committed JSON Schema', () => {
  it('matches the zod schema (run `npm run schema` if this fails)', () => {
    const { $id: _, ...rest } = committedSchema
    expect(rest).toEqual(JSON.parse(JSON.stringify(z.toJSONSchema(LalDocumentSchema, { target: 'draft-2020-12' }))))
  })

  it('accepts the fixture and rejects typos, without our code', () => {
    const validate = new Ajv2020({ allErrors: true }).compile(committedSchema)
    expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true)
    expect(validate({ ...fixture, nodez: [] })).toBe(false)
  })
})

describe('structure', () => {
  it('reports zod errors with readable paths', () => {
    expect(paths(broken((d) => { d.nodes[2].shape = 'hexagon' as never }))).toEqual(['nodes[2].shape'])
    expect(paths(broken((d) => { (d.edges[0] as Record<string, unknown>).colour = 'red' }))).toEqual(['edges[0]'])
  })

  it('refuses other versions with a clear message', () => {
    const r = broken((d) => { (d as { version: number }).version = 2 })
    expect(r.issues[0].message).toMatch(/unsupported version 2.*newer/)
  })
})

describe('semantic rules', () => {
  it('1: ids are unique across element types', () => {
    // p_direct names e_submit_route explicitly, so it breaks too.
    expect(paths(broken((d) => { d.edges[0].id = 'n_submit' }))).toEqual(['edges[0].id', 'paths[2].nodes[0]'])
  })

  it('2: references resolve', () => {
    expect(paths(broken((d) => { d.edges[0].target = 'n_ghost' }))).toContain('edges[0].target')
    expect(paths(broken((d) => { d.cards![0].target = 'nope' }))).toEqual(['cards[0].target'])
    expect(paths(broken((d) => { d.cards![0].target = 'p_approval' }))).toEqual(['cards[0].target'])
    expect(paths(broken((d) => { d.nodes[0].plate = 'plate_x' }))).toContain('nodes[0].plate')
  })

  it('3: plates need one overview, full membership, no cycles, real portals', () => {
    expect(paths(broken((d) => { d.plates![1].kind = 'overview' }))).toEqual(['plates'])
    expect(paths(broken((d) => { delete d.nodes[7].plate }))).toContain('nodes[7].plate')
    expect(paths(broken((d) => { d.plates![0].parent = 'plate_fulfilment' }))).toContain('plates[0].parent')
    expect(paths(broken((d) => { d.nodes[6].link = { plate: 'plate_overview' } }))).toEqual(['nodes[6].link.plate'])
  })

  it('4: edges, paths and lines stay within one plate', () => {
    expect(paths(broken((d) => { d.edges[8].target = 'n_pick' }))).toContain('edges[8]')
    expect(paths(broken((d) => { d.lines![0].nodes.push('n_pick') }))).toEqual(['lines[0]'])
  })

  it('5: each path step has exactly one edge', () => {
    expect(paths(broken((d) => { d.paths![0].nodes.splice(2, 1) }))).toEqual(['paths[0].nodes[1]'])
    expect(broken((d) => { d.edges.push({ id: 'e_dupe', source: 'n_submit', target: 'n_route' }) }).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'paths[0].nodes[0]', message: expect.stringMatching(/2 edges.*edges\[\]/) })]),
    )
    expect(paths(broken((d) => { d.paths![2].edges!.pop() }))).toEqual(['paths[2].edges'])
    expect(paths(broken((d) => { d.paths![2].edges![1] = 'e_route_policy' }))).toEqual(['paths[2].nodes[1]'])
  })

  it('6: one card per target', () => {
    expect(paths(broken((d) => { d.cards![1].target = 'n_submit' }))).toEqual(['cards[1].target'])
  })

  it('7: notes stay out of edges, paths and lines', () => {
    expect(paths(broken((d) => { d.lines![1].nodes.push('n_note') }))).toEqual(['lines[1].nodes[3]'])
  })
})
