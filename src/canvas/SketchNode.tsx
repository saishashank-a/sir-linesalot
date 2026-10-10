import { Handle, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { memo, useMemo, useRef, type CSSProperties } from 'react'
import { useNarrow } from '../useNarrow.ts'
import { useStore } from '../store.ts'
import type { StepFlowNode } from './adapter.ts'
import { flyToPlate } from './camera.ts'
import { tapNode, useEditState } from './editState.ts'
import { LabelInput, NodeTools } from './EditTools.tsx'
import { nodeColors, nodeDrawables, nodeStyle, portalGlyph } from './rough.ts'
import { RoughPaths } from './RoughPaths.tsx'

export const SketchNode = memo(function SketchNode({ data }: NodeProps<StepFlowNode>) {
  const { node, size, hasCard, dim, halo, onPath, merge } = data
  const openCard = useStore((s) => s.openCard)
  const picker = useStore((s) => s.picker)
  const editing = useStore((s) => s.mode === 'edit')
  const selected = useEditState((s) => s.selected?.kind === 'node' && s.selected.id === node.id)
  const renaming = useEditState((s) => s.renaming === node.id)
  const connectFrom = useEditState((s) => s.connectFrom === node.id)
  const narrow = useNarrow()
  // Play mode: the token is at (or waiting on) this node.
  const arrived = useStore((s) => !!onPath && s.doc?.paths?.find((p) => p.id === s.play.pathId)?.nodes[s.play.step] === node.id)
  // Stop numbers while a path/line route is being picked, e.g. "2" or "1, 4" for a revisit.
  const stops = useStore((s) => s.routeMarks?.nodes.flatMap((id, i) => (id === node.id ? [i + 1] : [])).join(', '))
  const markColor = useStore((s) => s.routeMarks?.color)
  const press = useLongPress(() => editing && !picker && useEditState.getState().select({ kind: 'node', id: node.id }))
  const note = node.kind === 'note'
  const { width: w, height: h } = size

  // Regenerates only when the node itself changes; dragging moves the wrapper, not this.
  const drawables = useMemo(() => nodeDrawables(node, w, h), [node, w, h])
  const colors = nodeColors(node)
  const tappable = hasCard || editing || !!picker || !!node.link
  // A portal flies to its plate; wide screens also open its card beside it (on phones the
  // bottom sheet would cover the plate you just flew to).
  const activate = () => {
    if (!node.link) return openCard(node.id)
    if (!narrow) openCard(node.id) // first, so the camera frames the plate beside the card
    flyToPlate(node.link.plate)
  }
  const Label = tappable ? 'button' : 'div'

  return (
    <div
      className={`sk-node${note ? ' note' : ''}${dim ? ' dim' : ''}${halo ? ' halo' : ''}${editing ? ' editing' : ''}${selected ? ' selected' : ''}${connectFrom ? ' connect-from' : ''}${arrived ? ' arrived' : ''}${merge ? ' merge' : ''}`}
      style={{ width: w, height: h, '--halo': halo, '--arrive': onPath } as CSSProperties}
    >
      <svg width={w} height={h} className="sk-shape" aria-hidden>
        <RoughPaths drawables={drawables} colors={colors} dashed={nodeStyle(node)?.dashed} />
        {node.link && <PortalGlyph x={w - 22} y={h - 20} />}
      </svg>
      {renaming ? (
        <div className="sk-label">
          <LabelInput id={node.id} initial={node.label} />
        </div>
      ) : (
        <Label
          className={`sk-label${tappable ? ' has-card' : ''}`}
          {...(tappable && {
            type: 'button',
            // Picker first (path/line editors), then edit-mode select/connect, then the card.
            onClick: () => (picker ? picker(node.id) : editing ? tapNode(node.id) : activate()),
            onDoubleClick: () => editing && !picker && useEditState.getState().setRenaming(node.id),
            'aria-label': picker ? `Pick ${node.label}` : `${node.label}, ${editing ? 'select' : node.link ? 'open plate' : 'open card'}`,
            ...(editing && press),
          })}
        >
          {node.label}
        </Label>
      )}
      {stops && (
        <span className="sk-stop" style={{ '--mark': markColor } as CSSProperties} aria-label={`stop ${stops}`}>
          {stops}
        </span>
      )}
      {merge && (
        <span className="sk-merge" title="Paths merge here" aria-label={`${merge.length} paths merge here`}>
          {merge.map((c, i) => <span key={i} style={{ background: c }} />)}
          merge
        </span>
      )}
      <NodeToolbar isVisible={editing && selected && !picker && !renaming && !narrow} position={Position.Top} offset={12}>
        <NodeTools node={node} />
      </NodeToolbar>
      <Handle type="target" position={Position.Left} className="sk-handle" isConnectable={editing && !note} />
      <Handle type="source" position={Position.Right} className="sk-handle" isConnectable={editing && !note} />
    </div>
  )
})

function PortalGlyph({ x, y }: { x: number; y: number }) {
  const paths = useMemo(() => portalGlyph(x, y), [x, y])
  return <RoughPaths drawables={paths} colors={{ S: 'var(--c-ink)' }} />
}

// ~500ms press without moving: opens the node toolbar on touch screens, where there's no hover.
function useLongPress(onLongPress: () => void) {
  const timer = useRef<number | undefined>(undefined)
  const start = useRef({ x: 0, y: 0 })
  const cancel = () => window.clearTimeout(timer.current)
  return {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY }
      cancel()
      timer.current = window.setTimeout(onLongPress, 500)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(), // no long-press context menu over the canvas
  }
}
