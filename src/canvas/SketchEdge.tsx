import { EdgeLabelRenderer, useInternalNode, type EdgeProps } from '@xyflow/react'
import { memo, useCallback, useMemo } from 'react'
import { useNarrow } from '../useNarrow.ts'
import { useStore } from '../store.ts'
import type { SketchFlowEdge } from './adapter.ts'
import { useEditState } from './editState.ts'
import { EdgeTools, LabelInput } from './EditTools.tsx'
import { edgeGeometry, nodeBox } from './geometry.ts'
import { registerInk } from './play.ts'
import { colorVar } from './rough.ts'
import { RoughPaths } from './RoughPaths.tsx'

// Floating edge: endpoints sit on the node outlines facing each other, so nodes need no visible handles.
export const SketchEdge = memo(function SketchEdge({ id, source, target, data }: EdgeProps<SketchFlowEdge>) {
  const s = useInternalNode(source)
  const t = useInternalNode(target)
  const openCard = useStore((st) => st.openCard)
  const editing = useStore((st) => st.mode === 'edit')
  const selected = useEditState((st) => st.selected?.kind === 'edge' && st.selected.id === id)
  const renaming = useEditState((st) => st.renaming === id)
  const narrow = useNarrow()
  const { edge, hasCard, dim, ink } = data!
  const select = () => useEditState.getState().select({ kind: 'edge', id })

  const geo = useMemo(() => (s && t ? edgeGeometry(nodeBox(s), nodeBox(t), id, edge.style) : null), [s, t, id, edge.style])

  const inkRef = useCallback((el: SVGPathElement | null) => registerInk(id, el), [id])

  if (!geo) return null
  return (
    <g className={`sk-edge${dim ? ' dim' : ''}${hasCard || editing ? ' has-card' : ''}${selected ? ' selected' : ''}`}>
      {/* Wide invisible twin of the clean path: the tap target (and, from milestone d, the Play track). */}
      <path d={geo.d} className="sk-edge-hit" />
      <RoughPaths drawables={geo.drawables} colors={{ S: colorVar(edge.style?.stroke, 'var(--c-ink)') }} dashed={edge.style?.dashed} />
      {/* Play mode ink: keyed by geometry so a moved edge re-registers its new path. */}
      {ink && <path key={geo.d} ref={inkRef} d={geo.d} className="sk-ink" style={{ stroke: ink }} />}
      {edge.label && !renaming && (
        <EdgeLabelRenderer>
          <div
            className={`sk-edge-label nodrag nopan${dim ? ' dim' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${geo.labelX}px, ${geo.labelY}px)` }}
          >
            {editing ? (
              <button type="button" className="has-card" onClick={select} aria-label={`${edge.label}, select`}>{edge.label}</button>
            ) : hasCard ? (
              <button type="button" className="has-card" onClick={() => openCard(edge.id)}>{edge.label}</button>
            ) : (
              edge.label
            )}
          </div>
        </EdgeLabelRenderer>
      )}
      {editing && (selected || renaming) && (
        <EdgeLabelRenderer>
          {renaming && (
            <div className="sk-edge-label nodrag nopan" style={{ transform: `translate(-50%, -50%) translate(${geo.labelX}px, ${geo.labelY}px)` }}>
              <LabelInput id={id} initial={edge.label ?? ''} />
            </div>
          )}
          {selected && !renaming && !narrow && (
            <div className="edge-tools-anchor nodrag nopan" style={{ transform: `translate(-50%, -100%) translate(${geo.labelX}px, ${geo.labelY - 18}px)` }}>
              <EdgeTools edge={edge} />
            </div>
          )}
        </EdgeLabelRenderer>
      )}
    </g>
  )
})
