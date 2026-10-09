import { Handle, Position, type NodeProps } from '@xyflow/react'
import { memo, useMemo, type CSSProperties } from 'react'
import { useStore } from '../store.ts'
import type { StepFlowNode } from './adapter.ts'
import { colorVar, gen, roughOptions, seedFromId, shapeDrawable } from './rough.ts'
import { RoughPaths } from './RoughPaths.tsx'

export const SketchNode = memo(function SketchNode({ data }: NodeProps<StepFlowNode>) {
  const { node, size, hasCard, dim, halo } = data
  const openCard = useStore((s) => s.openCard)
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
  const Label = hasCard ? 'button' : 'div'

  return (
    <div
      className={`sk-node${note ? ' note' : ''}${dim ? ' dim' : ''}${halo ? ' halo' : ''}`}
      style={{ width: w, height: h, '--halo': halo } as CSSProperties}
    >
      <svg width={w} height={h} className="sk-shape" aria-hidden>
        <RoughPaths drawables={drawables} colors={colors} dashed={style?.dashed} />
        {node.link && <PortalGlyph x={w - 22} y={h - 20} />}
      </svg>
      <Label
        className={`sk-label${hasCard ? ' has-card' : ''}`}
        {...(hasCard && { type: 'button', onClick: () => openCard(node.id), 'aria-label': `${node.label}, open card` })}
      >
        {node.label}
      </Label>
      <Handle type="target" position={Position.Left} className="sk-handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="sk-handle" isConnectable={false} />
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
