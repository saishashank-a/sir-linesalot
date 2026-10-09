import { useInternalNode, type EdgeProps } from '@xyflow/react'
import { memo, useMemo } from 'react'
import type { LineFlowEdge } from './adapter.ts'
import { nodeBox } from './geometry.ts'
import { gen, seedFromId } from './rough.ts'
import { RoughPaths } from './RoughPaths.tsx'

// One segment of a shared line, centre to centre. Nodes are opaque and drawn on
// top, so the line reads as running underneath them.
// ponytail: one segment per node pair, so joins can kink. A single spline
// through all the line's nodes would be smoother if that ever matters.
export const LineEdge = memo(function LineEdge({ id, source, target, data }: EdgeProps<LineFlowEdge>) {
  const s = useInternalNode(source)
  const t = useInternalNode(target)
  const { color, dim, active } = data!

  const geo = useMemo(() => {
    if (!s || !t) return null
    const a = nodeBox(s)
    const b = nodeBox(t)
    const opts = { seed: seedFromId(id), roughness: 0.8, stroke: 'S', strokeWidth: 7, disableMultiStroke: true }
    return { d: `M${a.cx},${a.cy} L${b.cx},${b.cy}`, drawables: [gen.line(a.cx, a.cy, b.cx, b.cy, opts)] }
  }, [s, t, id])

  if (!geo) return null
  return (
    <g className={`sk-line${dim ? ' dim' : ''}${active ? ' active' : ''}`}>
      <path d={geo.d} className="sk-edge-hit" />
      <RoughPaths drawables={geo.drawables} colors={{ S: color }} />
    </g>
  )
})
