// Writes schema/lal.schema.json from the zod schema. Run: npm run schema
import { mkdirSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import { LalDocumentSchema } from '../src/model/schema.ts'

const json = {
  $id: 'urn:sir-linesalot:lal:1',
  ...z.toJSONSchema(LalDocumentSchema, { target: 'draft-2020-12' }),
}

mkdirSync('schema', { recursive: true })
writeFileSync('schema/lal.schema.json', JSON.stringify(json, null, 2) + '\n')
console.log('wrote schema/lal.schema.json')
