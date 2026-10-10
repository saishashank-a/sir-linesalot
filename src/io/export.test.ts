import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { readLal } from './lal.ts'
import { layoutDoc } from './layout.ts'
import { docToSvg } from './export.ts'

const doc = layoutDoc(readLal(readFileSync('samples/request-flows.lal', 'utf8')).doc!)
const colors = { '--c-ink': '#111111', '--c-paper': '#fafafa', '--c-yellow': '#f2b705', '--c-frame': '#888888', '--c-muted': '#666666' }

test('exports the overview plate with resolved colours, deterministically', () => {
  const svg = docToSvg(doc, null, { colors })
  expect(svg).toBe(docToSvg(doc, null, { colors })) // same seeds, same strokes
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="\d+"/)
  for (const n of doc.nodes.filter((n) => n.plate === 'plate_overview')) expect(svg).toContain(n.label.split(' ')[0])
  expect(svg).not.toMatch(/var\(|undefined|NaN/)
  expect(svg).toContain('#111111')
})

test('exports only the requested plate, and embeds the font when given', () => {
  const svg = docToSvg(doc, 'plate_fulfilment', { colors, fontDataUrl: 'data:font/woff2;base64,AAAA' })
  expect(svg).toContain('<title>Fulfilment detail</title>')
  expect(svg).toContain('src:url(data:font/woff2;base64,AAAA)')
  expect(svg).not.toContain('Manager review')
})

test('escapes label text', () => {
  const d = structuredClone(doc)
  d.nodes[0].label = '<b>&"x"</b>'
  expect(docToSvg(d, null, { colors })).toContain('&#60;b&#62;&#38;&#34;x&#34;&#60;/b&#62;')
})
