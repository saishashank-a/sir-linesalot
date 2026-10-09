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

// Wide screens show cards in a side panel over the canvas's right edge (380px + margin).
// While one is open, widen the box to fit so the plate lands in the space left of it.
const SIDE_CARD = 392
function besideCard(r: Rect): Rect {
  const { doc, openCardTarget, mode } = useStore.getState()
  const cardOpen = !!openCardTarget && (mode === 'edit' || !!doc?.cards?.some((c) => c.target === openCardTarget))
  const w = document.querySelector('.react-flow')?.clientWidth ?? 0
  if (!cardOpen || matchMedia('(max-width: 640px)').matches || w <= SIDE_CARD * 2) return r
  return { ...r, width: (r.width * w) / (w - SIDE_CARD) }
}

// Two-stage move so you see where you're going: out to fit both plates, then in to the target.
export async function flyToPlate(plateId: string) {
  const { doc, focusPlateId, setFocusPlate } = useStore.getState()
  const to = doc?.plates?.find((p) => p.id === plateId)
  if (!doc || !to) return
  const from = focusedPlate(doc, focusPlateId)
  setFocusPlate(to.id)
  if (!fitBounds) return
  const target = besideCard(absFrame(doc, to))
  if (reduced()) {
    await fitBounds(target, { padding: 0.1 })
    return
  }
  if (from && from !== to) await fitBounds(union(absFrame(doc, from), target), { padding: 0.1, duration: 300 })
  await fitBounds(target, { padding: 0.1, duration: 500 })
}
