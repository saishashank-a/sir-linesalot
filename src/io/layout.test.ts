import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { readLal } from './lal.ts'
import { layoutDoc, nodeSize, plateFrame } from './layout.ts'

const { doc } = readLal(readFileSync('samples/request-flows.lal', 'utf8'))

it('positions every node and plate, keeping existing positions', () => {
  const out = layoutDoc(doc!)
  expect(out.nodes.every((n) => n.position)).toBe(true)
  expect(out.plates!.every((p) => p.position)).toBe(true)
  expect(out.nodes.find((n) => n.id === 'n_route')!.position).toEqual({ x: 220, y: 188 })
  expect(doc!.nodes.find((n) => n.id === 'n_pick')!.position).toBeUndefined() // input untouched
})

it('lays the detail plate out left to right in edge order', () => {
  const out = layoutDoc(doc!)
  const x = (id: string) => out.nodes.find((n) => n.id === id)!.position!.x
  expect(x('n_pick')).toBeLessThan(x('n_pack'))
  expect(x('n_pack')).toBeLessThan(x('n_ship'))
  expect(x('n_ship')).toBeLessThan(x('n_confirm'))
})

it('places the detail plate to the right of the overview without overlap', () => {
  const out = layoutDoc(doc!)
  const abs = (id: string) => {
    const f = plateFrame(out, id)
    const p = out.plates!.find((q) => q.id === id)!.position!
    return { left: p.x + f.x, right: p.x + f.x + f.width, top: p.y + f.y }
  }
  expect(abs('plate_fulfilment').left).toBeGreaterThan(abs('plate_overview').right)
  expect(abs('plate_fulfilment').top).toBe(abs('plate_overview').top)
})

it('sizes diamonds bigger than rectangles with the same label', () => {
  const rect = nodeSize({ id: 'a', label: 'Route request' })
  const diamond = nodeSize({ id: 'b', label: 'Route request', shape: 'diamond' })
  expect(diamond.width).toBeGreaterThan(rect.width)
})
