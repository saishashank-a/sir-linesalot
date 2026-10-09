import { parseLal, type Issue } from '../model/validate.ts'
import type { LalDocument } from '../model/schema.ts'

export function readLal(text: string): { doc?: LalDocument; issues: Issue[] } {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (e) {
    return { issues: [{ path: '', message: `not valid JSON: ${(e as Error).message}` }] }
  }
  return parseLal(json)
}
