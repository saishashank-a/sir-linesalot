import { Position, type InternalNode } from '@xyflow/react'

export function nodeBox(n: InternalNode) {
  const { x, y } = n.internals.positionAbsolute
  const w = n.measured.width ?? n.width ?? 0
  const h = n.measured.height ?? n.height ?? 0
  return { cx: x + w / 2, cy: y + h / 2, hw: w / 2, hh: h / 2 }
}

// Where the line from `n`'s centre toward `to` leaves n's bounding box, and which side that is.
// ponytail: uses the box for every shape, so arrows to diamonds/ellipses stop a little short.
// Intersect the real outline if that shows.
export function borderPoint(n: InternalNode, to: { x: number; y: number }) {
  const { cx, cy, hw, hh } = nodeBox(n)
  const dx = to.x - cx
  const dy = to.y - cy
  const sx = Math.abs(dx) / hw
  const sy = Math.abs(dy) / hh
  const k = 1 / Math.max(sx, sy, 1e-6)
  const side = sx > sy ? (dx > 0 ? Position.Right : Position.Left) : dy > 0 ? Position.Bottom : Position.Top
  return { x: cx + dx * k, y: cy + dy * k, side }
}

// Direction a bezier arrives in when it ends on `side` (React Flow bends edges outward from the side).
export const INTO_SIDE: Record<Position, [number, number]> = {
  [Position.Left]: [1, 0],
  [Position.Right]: [-1, 0],
  [Position.Top]: [0, 1],
  [Position.Bottom]: [0, -1],
}
