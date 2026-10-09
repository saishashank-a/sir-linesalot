import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { LalDocument } from '../model/schema.ts'
import { validateDoc } from '../model/validate.ts'
import { buildPathRoute, canAppend, routeProblems } from './pathLine.ts'

const doc: LalDocument = JSON.parse(readFileSync('samples/request-flows.lal', 'utf8'))

it('accepts a path step only along an arrow', () => {
  expect(canAppend(doc, 'path', [], 'n_submit')).toEqual({ ok: true })
  expect(canAppend(doc, 'path', ['n_submit'], 'n_route')).toEqual({ ok: true, edgeId: 'e_submit_route', ambiguous: false })
  expect(canAppend(doc, 'path', ['n_submit'], 'n_close')).toMatchObject({ ok: false, reason: expect.stringMatching(/No arrow/) })
})

it('lets lines jump between unconnected nodes', () => {
  expect(canAppend(doc, 'line', ['n_submit'], 'n_close').ok).toBe(true)
})

it('rejects notes, other plates and repeating the last stop', () => {
  expect(canAppend(doc, 'line', [], 'n_note')).toMatchObject({ ok: false, reason: expect.stringMatching(/notes/) })
  expect(canAppend(doc, 'line', ['n_submit'], 'n_pick')).toMatchObject({ ok: false, reason: expect.stringMatching(/different plate/) })
  expect(canAppend(doc, 'line', ['n_submit'], 'n_submit').ok).toBe(false)
})

it('flags the stops broken by removing a middle chip', () => {
  expect(routeProblems(doc, 'path', ['n_submit', 'n_manager', 'n_finance'])).toEqual([
    { index: 1, reason: expect.stringMatching(/No arrow/) },
  ])
  expect(routeProblems(doc, 'line', ['n_submit', 'n_finance'])).toEqual([])
})

it('writes edges[] only when a pair has several arrows, and the result validates', () => {
  expect(buildPathRoute(doc, ['n_submit', 'n_route', 'n_fulfil'])).toEqual({ nodes: ['n_submit', 'n_route', 'n_fulfil'] })

  const twin = structuredClone(doc)
  twin.edges.push({ id: 'e_route_fulfil_2', source: 'n_route', target: 'n_fulfil' })
  twin.paths!.splice(2, 1) // p_direct would still resolve, but drop it to keep this about the new path
  const built = buildPathRoute(twin, ['n_submit', 'n_route', 'n_fulfil'])
  expect(built.edges).toEqual(['e_submit_route', 'e_route_fulfil'])
  twin.paths!.push({ id: 'p_new', name: 'New', ...built })
  expect(validateDoc(twin)).toEqual([])
})
