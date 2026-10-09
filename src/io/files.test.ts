import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { slug, suggestedName } from './files.ts'
import { readLal, serializeLal } from './lal.ts'
import { layoutDoc } from './layout.ts'

it('round-trips the fixture through layout and serialize', () => {
  const laidOut = layoutDoc(readLal(readFileSync('samples/request-flows.lal', 'utf8')).doc!)
  const text = serializeLal(laidOut)
  expect(text.endsWith('}\n')).toBe(true)
  expect(text).toContain('"$schema": "../schema/lal.schema.json"')
  const back = readLal(text)
  expect(back.issues).toEqual([])
  expect(back.doc).toEqual(laidOut)
  expect(serializeLal(back.doc!)).toBe(text) // byte-identical on re-save
})

it('suggests a file name from the title when there is none', () => {
  expect(slug('Purchase request flows!')).toBe('purchase-request-flows')
  expect(slug('Café / Ops ')).toBe('cafe-ops')
  expect(slug('***')).toBe('untitled')
  expect(suggestedName(null, 'My Flow')).toBe('my-flow.lal')
  expect(suggestedName('mine.lal', 'My Flow')).toBe('mine.lal')
})
