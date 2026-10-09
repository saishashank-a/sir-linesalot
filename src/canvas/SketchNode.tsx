import { Handle, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { memo, useMemo, useRef, type CSSProperties } from 'react'
import { useStore } from '../store.ts'
import type { StepFlowNode } from './adapter.ts'
import { tapNode, useEditState } from './editState.ts'
import { LabelInput, NodeTools } from './EditTools.tsx'
import { colorVar, gen, roughOptions, seedFromId, shapeDrawable } from './rough.ts'
import { RoughPaths } from './RoughPaths.tsx'

export const SketchNode = memo(function SketchNode({ data }: NodeProps<StepFlowNode>) {
  const { node, size, hasCard, dim, halo } = data
  const openCard = useStore((s) => s.openCard)
  const picker = useStore((s) => s.picker)
  const editing = useStore((s) => s.mode === 'edit')
  const selected = useEditState((s) => s.selected?.kind === 'node' && s.selected.id === node.id)
  const renaming = useEditState((s) => s.renaming === node.id)
  const connectFrom = useEditState((s) => s.connectFrom === node.id)
  const press = useLongPress(() => editing && !picker && useEditState.getState().select({ kind: 'node', id: node.id }))
  const note = node.kind === 'note'
  const shape = note ? 'rectangle' : (node.shape ?? 'rectangle')
  const style = useMemo(
    () => (note ? { fill: 'yellow' as const, fillStyle: 'solid' as const, roughness: 1.6, ...node.style } : node.style),
    [note, node.style],
  )
  const { width: w, height: h } = size

  // Regenerates only when the shape itself changes; dragging moves the wrapper, not this.
  const drawables = useMemo(() => {
    const seed = seedFromId(node.id)
    const backing = shapeDrawable(shape, w, h, { seed, roughness: 0, stroke: 'none', fill: 'P', fillStyle: 'solid' })
    const outline = shapeDrawable(shape, w, h, roughOptions(style, seed))
    const portal = node.link && shapeDrawable(shape, w, h, roughOptions(style, seed + 1, { fill: undefined }))
    return portal ? [backing, outline, portal] : [backing, outline]
  }, [node.id, node.link, shape, w, h, style])

  const colors = { S: colorVar(style?.stroke, 'var(--c-ink)'), F: colorVar(style?.fill, 'var(--c-ink)'), P: 'var(--c-paper)' }
  const tappable = hasCard || editing || !!picker
  const Label = tappable ? 'button' : 'div'

  return (
    <div
      className={`sk-node${note ? ' note' : ''}${dim ? ' dim' : ''}${halo ? ' halo' : ''}${editing ? ' editing' : ''}${selected ? ' selected' : ''}${connectFrom ? ' connect-from' : ''}`}
      style={{ width: w, height: h, '--halo': halo } as CSSProperties}
    >
      <svg width={w} height={h} className="sk-shape" aria-hidden>
        <RoughPaths drawables={drawables} colors={colors} dashed={style?.dashed} />
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
            onClick: () => (picker ? picker(node.id) : editing ? tapNode(node.id) : openCard(node.id)),
            onDoubleClick: () => editing && !picker && useEditState.getState().setRenaming(node.id),
            'aria-label': picker ? `Pick ${node.label}` : `${node.label}, ${editing ? 'select' : 'open card'}`,
            ...(editing && press),
          })}
        >
          {node.label}
        </Label>
      )}
      <NodeToolbar isVisible={editing && selected && !picker && !renaming} position={Position.Top} offset={12}>
        <NodeTools node={node} />
      </NodeToolbar>
      <Handle type="target" position={Position.Left} className="sk-handle" isConnectable={editing && !note} />
      <Handle type="source" position={Position.Right} className="sk-handle" isConnectable={editing && !note} />
    </div>
  )
})

// "Enter plate" mark: a small square with an arrow into it.
function PortalGlyph({ x, y }: { x: number; y: number }) {
  const paths = useMemo(() => {
    const o = { seed: 7, roughness: 0.8, stroke: 'S', strokeWidth: 1.2 }
    return [gen.rectangle(x, y, 14, 12, o), gen.line(x - 6, y - 6, x + 6, y + 5, o), gen.line(x + 6, y + 5, x + 6, y, o)]
  }, [x, y])
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
