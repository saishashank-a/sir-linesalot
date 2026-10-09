import { EdgeLabelRenderer, getBezierPath, useInternalNode, type EdgeProps } from '@xyflow/react'
import { memo, useMemo } from 'react'
import { useStore } from '../store.ts'
import type { SketchFlowEdge } from './adapter.ts'
import { borderPoint, INTO_SIDE, nodeBox } from './geometry.ts'
import { colorVar, gen, roughOptions, seedFromId } from './rough.ts'
import { RoughPaths } from './RoughPaths.tsx'

// Floating edge: endpoints sit on the node outlines facing each other, so nodes need no visible handles.
export const SketchEdge = memo(function SketchEdge({ id, source, target, data }: EdgeProps<SketchFlowEdge>) {
  const s = useInternalNode(source)
  const t = useInternalNode(target)
  const openCard = useStore((st) => st.openCard)
  const { edge, hasCard, dim } = data!

  const geo = useMemo(() => {
    if (!s || !t) return null
    const sb = nodeBox(s)
    const tb = nodeBox(t)
    const a = borderPoint(s, { x: tb.cx, y: tb.cy })
    const b = borderPoint(t, { x: sb.cx, y: sb.cy })
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
    const opts = roughOptions({ ...edge.style, fill: undefined, fillStyle: 'none' }, seedFromId(id))
    const [l1, l2] = [barb(0.5), barb(-0.5)]
    const drawables = [gen.path(d, opts), gen.line(b.x, b.y, ...l1, opts), gen.line(b.x, b.y, ...l2, opts)]
    return { d, labelX, labelY, drawables }
  }, [s, t, id, edge.style])

  if (!geo) return null
  return (
    <g className={`sk-edge${dim ? ' dim' : ''}${hasCard ? ' has-card' : ''}`}>
      {/* Wide invisible twin of the clean path: the tap target (and, from milestone d, the Play track). */}
      <path d={geo.d} className="sk-edge-hit" />
      <RoughPaths drawables={geo.drawables} colors={{ S: colorVar(edge.style?.stroke, 'var(--c-ink)') }} dashed={edge.style?.dashed} />
      {edge.label && (
        <EdgeLabelRenderer>
          <div
            className={`sk-edge-label nodrag nopan${dim ? ' dim' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${geo.labelX}px, ${geo.labelY}px)` }}
          >
            {hasCard ? (
              <button type="button" className="has-card" onClick={() => openCard(edge.id)}>{edge.label}</button>
            ) : (
              edge.label
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  )
})
