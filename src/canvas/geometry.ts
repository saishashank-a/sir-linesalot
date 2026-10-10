import { getBezierPath, Position, type InternalNode } from '@xyflow/react'
import type { Drawable } from 'roughjs/bin/core'
import type { Style } from '../model/schema.ts'
import { gen, roughOptions, seedFromId } from './rough.ts'

export interface Box { cx: number; cy: number; hw: number; hh: number }

export function nodeBox(n: InternalNode): Box {
  const { x, y } = n.internals.positionAbsolute
  const w = n.measured.width ?? n.width ?? 0
  const h = n.measured.height ?? n.height ?? 0
  return { cx: x + w / 2, cy: y + h / 2, hw: w / 2, hh: h / 2 }
}

// Where the line from the box's centre toward `to` leaves the box, and which side that is.
// ponytail: uses the box for every shape, so arrows to diamonds/ellipses stop a little short.
// Intersect the real outline if that shows.
export function borderPoint({ cx, cy, hw, hh }: Box, to: { x: number; y: number }) {
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

// A floating edge between two node boxes: clean bezier `d`, label point, rough strokes and arrowhead.
export function edgeGeometry(s: Box, t: Box, id: string, style: Style | undefined) {
  const a = borderPoint(s, { x: t.cx, y: t.cy })
  const b = borderPoint(t, { x: s.cx, y: s.cy })
  const [d, labelX, labelY] = getBezierPath({
    sourceX: a.x, sourceY: a.y, sourcePosition: a.side,
    targetX: b.x, targetY: b.y, targetPosition: b.side,
  })
  // Arrowhead: two strokes back from the tip, 28° either side of the arrival direction.
  const [ux, uy] = INTO_SIDE[b.side]
  const barb = (angle: number) => {
    const c = Math.cos(angle)
    const sn = Math.sin(angle)
    return [b.x - 12 * (ux * c - uy * sn), b.y - 12 * (ux * sn + uy * c)] as const
  }
  const opts = roughOptions({ ...style, fill: undefined, fillStyle: 'none' }, seedFromId(id))
  const [l1, l2] = [barb(0.5), barb(-0.5)]
  const drawables: Drawable[] = [gen.path(d, opts), gen.line(b.x, b.y, ...l1, opts), gen.line(b.x, b.y, ...l2, opts)]
  return { d, labelX, labelY, drawables, start: a, end: b }
}
