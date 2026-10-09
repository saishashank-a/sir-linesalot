import { readFileSync } from 'node:fs'
import { beforeEach, expect, it } from 'vitest'
import { newId } from './edit/ids.ts'
import { useStore } from './store.ts'

const fixture = readFileSync('samples/request-flows.lal', 'utf8')
const s = () => useStore.getState()
const label = (id: string) => s().doc!.nodes.find((n) => n.id === id)!.label

beforeEach(async () => {
  await s().loadText(fixture, { fileName: 'request-flows.lal' })
})

it('edits, undoes and redoes', () => {
  expect(s().edit((d) => { d.nodes[0].label = 'Raised' })).toBe(true)
  expect(label('n_submit')).toBe('Raised')
  expect(s().dirty).toBe(true)
  s().undo()
  expect(label('n_submit')).toBe('Request submitted')
  s().redo()
  expect(label('n_submit')).toBe('Raised')
})

it('collapses coalesced edits into one undo step', () => {
  for (const x of [1, 2, 3]) s().edit((d) => { d.nodes[0].position = { x, y: 0 } }, { coalesce: 'drag:n_submit' })
  expect(s().past).toHaveLength(1)
  s().undo()
  expect(s().doc!.nodes[0].position).toEqual({ x: 0, y: 200 })
})

it('refuses edits that break a rule and keeps the doc', () => {
  const before = s().doc
  expect(s().edit((d) => { d.edges[0].target = 'ghost' })).toBe(false)
  expect(s().doc).toBe(before)
  expect(s().issues[0].path).toBe('edges[0].target')
  expect(s().past).toHaveLength(0)
})

it('opens an empty card editor only in edit mode', () => {
  s().openCard('n_route') // no card in the fixture
  expect(s().openCardTarget).toBeNull()
  s().setMode('edit')
  s().openCard('n_route')
  expect(s().openCardTarget).toBe('n_route')
})

it('makes ids unique across element types', () => {
  expect(newId(s().doc!, 'n')).toBe('n_1')
  s().edit((d) => { d.nodes.push({ id: 'n_1', label: 'x', plate: 'plate_overview', position: { x: 0, y: 0 } }) })
  expect(newId(s().doc!, 'n')).toBe('n_2')
})
