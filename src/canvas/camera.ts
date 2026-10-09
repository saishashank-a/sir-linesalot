// Camera moves between plates: into a portal's plate, and back via the breadcrumbs.
// The canvas registers its React Flow instance here so panels outside the
// provider (card panel, breadcrumbs) can fly the camera too.
import type { FitBounds } from '@xyflow/react'
import { absFrame } from '../edit/canvasActions.ts'
import { overviewPlate } from '../model/resolve.ts'
import type { LalDocument } from '../model/schema.ts'
import { useStore } from '../store.ts'

type Rect = { x: number; y: number; width: number; height: number }

let fitBounds: FitBounds | null = null
export const registerCamera = (fn: FitBounds | null) => { fitBounds = fn }

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y }
}

// The plate in focus: the one last flown to, else the overview.
export const focusedPlate = (doc: LalDocument, focusPlateId: string | null) =>
  doc.plates?.find((p) => p.id === focusPlateId) ?? overviewPlate(doc)

// Two-stage move so you see where you're going: out to fit both plates, then in to the target.
export async function flyToPlate(plateId: string) {
  const { doc, focusPlateId, setFocusPlate } = useStore.getState()
  const to = doc?.plates?.find((p) => p.id === plateId)
  if (!doc || !to) return
  const from = focusedPlate(doc, focusPlateId)
  setFocusPlate(to.id)
  if (!fitBounds) return
  const target = absFrame(doc, to)
  if (reduced()) {
    await fitBounds(target, { padding: 0.1 })
    return
  }
  if (from && from !== to) await fitBounds(union(absFrame(doc, from), target), { padding: 0.1, duration: 300 })
  await fitBounds(target, { padding: 0.1, duration: 500 })
}
