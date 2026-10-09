import { expect, it } from 'vitest'
import { addField, moveField, removeField, safeUrl, updateField } from './cards.ts'

const f = (label: string) => ({ label, value: '' })
const labels = (xs: { label: string }[]) => xs.map((x) => x.label)

it('adds, removes and moves fields without mutating', () => {
  const start = [f('a'), f('b'), f('c')]
  expect(labels(addField(start))).toEqual(['a', 'b', 'c', 'New field'])
  expect(labels(removeField(start, 1))).toEqual(['a', 'c'])
  expect(labels(moveField(start, 2, -1))).toEqual(['a', 'c', 'b'])
  expect(labels(moveField(start, 0, 1))).toEqual(['b', 'a', 'c'])
  expect(moveField(start, 0, -1)).toBe(start) // already first
  expect(moveField(start, 2, 1)).toBe(start) // already last
  expect(labels(start)).toEqual(['a', 'b', 'c'])
})

it('updates one field and drops the default markdown format', () => {
  const start = [f('a'), { label: 'b', value: 'x', format: 'plain' as const }]
  expect(updateField(start, 0, { value: 'hi' })[0]).toEqual({ label: 'a', value: 'hi' })
  expect(updateField(start, 1, { format: 'markdown' })[1]).toEqual({ label: 'b', value: 'x' })
  expect(updateField(start, 1, { format: 'url' })[1].format).toBe('url')
})

it('only allows http(s) and mailto links', () => {
  expect(safeUrl(' https://example.com ')).toBe('https://example.com')
  expect(safeUrl('mailto:a@b.c')).toBe('mailto:a@b.c')
  expect(safeUrl('javascript:alert(1)')).toBe('')
  expect(safeUrl('data:text/html,x')).toBe('')
  expect(safeUrl('/relative')).toBe('')
})
