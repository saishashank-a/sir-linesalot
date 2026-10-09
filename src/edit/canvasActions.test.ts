import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { readLal } from '../io/lal.ts'
import { layoutDoc } from '../io/layout.ts'
import type { LalDocument } from '../model/schema.ts'
import { validateDoc } from '../model/validate.ts'
import { absFrame, addEdge, addNode, addPlate, deleteElements, moveNode, movePlate } from './canvasActions.ts'

const base = layoutDoc(readLal(readFileSync('samples/request-flows.lal', 'utf8')).doc!)
const doc = () => structuredClone(base)
const ids = (xs: { id: string }[] = []) => xs.map((x) => x.id)
const plateOf = (d: LalDocument, id: string) => d.plates!.find((p) => p.id === id)!

it('deleting the shared stage cascades to edges, cards, lines and paths', () => {
  const d = doc()
  deleteElements(d, ['n_fulfil'])
  expect(ids(d.edges)).not.toContain('e_route_fulfil')
  expect(d.edges.some((e) => e.source === 'n_fulfil' || e.target === 'n_fulfil')).toBe(false)
  expect(ids(d.cards)).not.toEqual(expect.arrayContaining(['c_fulfil']))
  expect(ids(d.cards)).not.toContain('c_route_fulfil') // card on a removed edge
  expect(ids(d.paths)).toEqual(['p_fulfil_steps'])
  expect(d.lines!.find((l) => l.id === 'l_audit')!.nodes).not.toContain('n_fulfil')
  expect(validateDoc(d)).toEqual([])
})

it('deleting an edge drops paths that used it, and lines left with <2 nodes go', () => {
  const d = doc()
  deleteElements(d, ['e_pick_pack', 'n_finance', 'n_submit'])
  // approval used n_finance; self/direct start at n_submit; fulfil steps used e_pick_pack
  expect(ids(d.paths)).toEqual([])
  expect(ids(d.lines)).toEqual(['l_audit']) // notifications is down to n_fulfil alone
  expect(validateDoc(d)).toEqual([])
})

it('deleting a lone note touches nothing else', () => {
  const d = doc()
  deleteElements(d, ['n_note'])
  expect(d.edges).toHaveLength(base.edges.length)
  expect(validateDoc(d)).toEqual([])
})

it('adds an edge and a node on the plate under the point', () => {
  const d = doc()
  addEdge(d, 'n_policy', 'n_close')
  const f = absFrame(d, plateOf(d, 'plate_fulfilment'))
  const id = addNode(d, 'step', { x: f.x + f.width / 2, y: f.y + f.height / 2 })
  expect(d.nodes.find((n) => n.id === id)!.plate).toBe('plate_fulfilment')
  const note = addNode(d, 'note', { x: -5000, y: -5000 }) // nowhere: falls back to the overview
  expect(d.nodes.find((n) => n.id === note)!.plate).toBe('plate_overview')
  expect(validateDoc(d)).toEqual([])
})

it('adds a plate to the right without overlap, even to a doc without plates', () => {
  const d = doc()
  const { plateId } = addPlate(d)
  expect(absFrame(d, plateOf(d, plateId)).x).toBeGreaterThan(absFrame(d, plateOf(d, 'plate_fulfilment')).x)
  expect(validateDoc(d)).toEqual([])

  const flat: LalDocument = { format: 'lal', version: 1, id: 'x', title: 'Flat', nodes: [{ id: 'a', label: 'A', position: { x: 0, y: 0 } }], edges: [] }
  addPlate(flat)
  expect(flat.plates!.map((p) => p.kind)).toEqual(['overview', 'detail'])
  expect(validateDoc(flat)).toEqual([])
})

it('reparents a node dropped on another plate; the store rejects it if edges would span plates', () => {
  const d = doc()
  const target = absFrame(d, plateOf(d, 'plate_fulfilment'))
  moveNode(d, 'n_note', { x: target.x + 60, y: target.y + 60 })
  const note = d.nodes.find((n) => n.id === 'n_note')!
  expect(note.plate).toBe('plate_fulfilment')
  const o = plateOf(d, 'plate_fulfilment').position!
  expect(note.position).toEqual({ x: Math.round(target.x + 60 - o.x), y: Math.round(target.y + 60 - o.y) })
  expect(validateDoc(d)).toEqual([])

  moveNode(d, 'n_close', { x: target.x + 60, y: target.y + 60 })
  expect(validateDoc(d).some((i) => /spans plates/.test(i.message))).toBe(true)
})

it('a small move stays on the same plate; moving a plate keeps its frame where dropped', () => {
  const d = doc()
  const o = plateOf(d, 'plate_overview').position!
  moveNode(d, 'n_close', { x: o.x + 1190, y: o.y + 210 })
  expect(d.nodes.find((n) => n.id === 'n_close')!.plate).toBe('plate_overview')
  movePlate(d, 'plate_fulfilment', { x: 5000, y: 100 })
  const f = absFrame(d, plateOf(d, 'plate_fulfilment'))
  expect([f.x, f.y]).toEqual([5000, 100])
})
