import { expect, it } from 'vitest'
import type { LalDocument } from '../model/schema.ts'
import { autoColor, lineColor, pathColor } from './adapter.ts'

const d: LalDocument = {
  format: 'lal', version: 1, id: 'x', title: 'X',
  nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
  edges: [],
  paths: [{ id: 'p1', nodes: ['a', 'b'], color: 'violet' }, { id: 'p2', nodes: ['a', 'b'] }],
  lines: [{ id: 'l1', nodes: ['a', 'b'] }, { id: 'l2', nodes: ['a', 'b'] }],
}

it('an explicit colour wins over the cycle', () => {
  expect(autoColor('teal', 0)).toBe('var(--c-teal)')
  expect(autoColor('#123456', 3)).toBe('#123456')
  expect(pathColor(d, d.paths![0])).toBe('var(--c-violet)')
})

it('missing colours cycle by index', () => {
  expect(autoColor(undefined, 0)).toBe('var(--c-red)')
  expect(autoColor(undefined, 1)).toBe('var(--c-blue)')
  expect(autoColor('', 7)).toBe(autoColor(undefined, 0))
  expect(lineColor(d, d.lines![1])).toBe('var(--c-blue)')
  expect(pathColor(d, d.paths![1])).toBe('var(--c-blue)')
})

it('an item not in the document (index -1) still gets a colour', () => {
  expect(autoColor(undefined, -1)).toBe('var(--c-red)')
  expect(lineColor(d, { id: 'new', nodes: ['a', 'b'] })).toBe('var(--c-red)')
  expect(pathColor({ ...d, paths: undefined }, { id: 'new', nodes: ['a'] })).toBe('var(--c-red)')
})
