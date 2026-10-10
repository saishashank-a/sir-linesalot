import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import type { LalDocument } from '../model/schema.ts'
import { docToExcalidraw, excalidrawToDoc } from './excalidraw.ts'
import { readLal } from './lal.ts'
import { layoutDoc } from './layout.ts'

const doc = layoutDoc(readLal(readFileSync('samples/request-flows.lal', 'utf8')).doc!)
const norm = (d: LalDocument) => ({ ...d, cards: [...(d.cards ?? [])].sort((a, b) => a.target.localeCompare(b.target)) })

test('round-trips the fixture through .excalidraw', () => {
  const file = JSON.parse(docToExcalidraw(doc))
  expect(file.type).toBe('excalidraw')
  const types = file.elements.map((e: { type: string }) => e.type)
  expect(types).toContain('frame')
  expect(types).toContain('arrow')
  const { doc: back, issues, skipped } = excalidrawToDoc(JSON.stringify(file))
  expect(issues).toEqual([])
  expect(skipped).toEqual([])
  expect(norm(back!)).toEqual(norm(doc))
})

test('keeps renames and moves made in Excalidraw', () => {
  const file = JSON.parse(docToExcalidraw(doc))
  const n = doc.nodes[0]
  const label = file.elements.find((e: { id: string }) => e.id === `${n.id}:label`)
  label.originalText = label.text = 'Renamed'
  file.elements.find((e: { id: string }) => e.id === n.id).x += 50
  const back = excalidrawToDoc(JSON.stringify(file)).doc!
  const m = back.nodes.find((x) => x.id === n.id)!
  expect(m.label).toBe('Renamed')
  expect(m.position!.x).toBe(n.position!.x + 50)
})

test('imports a hand-made drawing and reports what it skipped', () => {
  const el = (o: object) => ({ angle: 0, isDeleted: false, x: 0, y: 0, width: 100, height: 60, ...o })
  const file = {
    type: 'excalidraw',
    elements: [
      el({ id: 'a', type: 'rectangle', strokeColor: '#e03131', backgroundColor: 'transparent', boundElements: [{ type: 'text', id: 'ta' }] }),
      el({ id: 'ta', type: 'text', text: 'Start', containerId: 'a' }),
      el({ id: 'b', type: 'ellipse', x: 300, strokeStyle: 'dashed' }),
      el({ id: 'ar', type: 'arrow', startBinding: { elementId: 'a' }, endBinding: { elementId: 'b' } }),
      el({ id: 'loose', type: 'arrow', startBinding: { elementId: 'a' }, endBinding: null }),
      el({ id: 'note', type: 'text', text: 'remember this', containerId: null }),
      el({ id: 'scribble', type: 'freedraw' }),
      el({ id: 'gone', type: 'rectangle', isDeleted: true }),
    ],
  }
  const { doc: d, issues, skipped } = excalidrawToDoc(JSON.stringify(file))
  expect(issues).toEqual([])
  expect(d!.nodes.map((n) => [n.id, n.label, n.kind ?? n.shape]).sort()).toEqual([['a', 'Start', 'rectangle'], ['b', '', 'ellipse'], ['note', 'remember this', 'note']])
  expect(d!.nodes.find((n) => n.id === 'a')!.style).toEqual({ stroke: 'red' })
  expect(d!.nodes.find((n) => n.id === 'b')!.style).toEqual({ dashed: true })
  expect(d!.edges).toEqual([{ id: 'ar', source: 'a', target: 'b' }])
  expect(skipped.sort()).toEqual(['1 arrows not connected to shapes at both ends', '1 freedraw elements'])
})

test('frames become plates; loose shapes join a new overview plate', () => {
  const el = (o: object) => ({ x: 0, y: 0, width: 100, height: 60, ...o })
  const file = { type: 'excalidraw', elements: [el({ id: 'f', type: 'frame', name: 'Detail' }), el({ id: 'in', type: 'rectangle', frameId: 'f' }), el({ id: 'out', type: 'rectangle' })] }
  const d = excalidrawToDoc(JSON.stringify(file)).doc!
  expect(d.plates!.map((p) => [p.title, p.kind])).toEqual([['Drawing', 'overview'], ['Detail', 'detail']])
  expect(d.nodes.map((n) => n.plate)).toEqual(['f', 'plate_drawing'])
})

test('rejects untrusted junk without throwing', () => {
  expect(excalidrawToDoc('nope').issues[0].message).toMatch(/not valid JSON/)
  expect(excalidrawToDoc('{"type":"excalidraw"}').issues[0].message).toBe('not an .excalidraw file')
  const evil = { type: 'excalidraw', elements: [{ id: 'x', type: 'rectangle', customData: { lal: { node: { id: 'x', label: 'x', __proto__: { polluted: 1 }, extra: 1 } } } }] }
  const r = excalidrawToDoc(JSON.stringify(evil))
  expect(r.doc).toBeUndefined()
  expect(r.issues.length).toBeGreaterThan(0)
  expect(({} as Record<string, unknown>).polluted).toBeUndefined()
})
