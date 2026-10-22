import { readFileSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
import { expect, test } from 'vitest'
import { lalFromHash } from './lal.ts'

test('a #lal= link decodes to the exact file scripts/repo-diagram.ts encoded', async () => {
  const text = readFileSync('diagrams/architecture.lal', 'utf8')
  expect(await lalFromHash(`#lal=${deflateRawSync(text).toString('base64url')}`)).toBe(text)
  expect(await lalFromHash('#plate=x')).toBeNull()
  await expect(lalFromHash('#lal=not-deflate')).rejects.toThrow()
})
