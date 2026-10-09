import { readFileSync } from 'node:fs'
import { beforeEach, expect, it } from 'vitest'
import { readLal } from '../io/lal.ts'
import { layoutDoc } from '../io/layout.ts'
import { validateDoc } from '../model/validate.ts'
import { useStore } from '../store.ts'
import { commitLabel, deleteSelected, tapNode, useEditState } from './editState.ts'

const base = layoutDoc(readLal(readFileSync('samples/request-flows.lal', 'utf8')).doc!)
const doc = () => useStore.getState().doc!

beforeEach(() => {
  useStore.setState({ doc: structuredClone(base), mode: 'edit', past: [], future: [], issues: [] })
  useEditState.getState().reset()
})

it('connecting a step to a sticky note adds nothing and explains why', () => {
  useEditState.getState().setConnectFrom('n_policy')
  tapNode('n_note')
  expect(doc().edges).toHaveLength(base.edges.length)
  expect(useEditState.getState().hint).toMatch(/note/i)
  expect(useStore.getState().issues).toEqual([])
  expect(useStore.getState().past).toEqual([])
})

it('connecting a step to a step adds an edge and selects it', () => {
  useEditState.getState().setConnectFrom('n_policy')
  tapNode('n_close')
  const added = doc().edges.find((e) => e.source === 'n_policy' && e.target === 'n_close')!
  expect(added).toBeDefined()
  expect(useEditState.getState().selected).toEqual({ kind: 'edge', id: added.id })
  expect(useEditState.getState().connectFrom).toBeNull()
  expect(validateDoc(doc())).toEqual([])
})

it('deleting the selected overview plate is refused with a hint', () => {
  const before = doc()
  useEditState.getState().select({ kind: 'plate', id: 'plate_overview' })
  deleteSelected()
  expect(useEditState.getState().hint).toMatch(/overview/i)
  expect(doc()).toBe(before)
  expect(useStore.getState().past).toEqual([])
})

it('commitLabel renames a plate; empty text is a no-op', () => {
  commitLabel('plate_fulfilment', '  Warehouse  ')
  expect(doc().plates!.find((p) => p.id === 'plate_fulfilment')!.title).toBe('Warehouse')
  expect(useStore.getState().past).toHaveLength(1)
  const before = doc()
  commitLabel('plate_fulfilment', '   ')
  expect(doc()).toBe(before)
  expect(useStore.getState().past).toHaveLength(1)
})
