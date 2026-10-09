import type { NodeProps } from '@xyflow/react'
import { memo, useMemo } from 'react'
import { useStore } from '../store.ts'
import type { PlateFlowNode } from './adapter.ts'
import { gen, seedFromId } from './rough.ts'
import { RoughPaths } from './RoughPaths.tsx'

export const PlateFrame = memo(function PlateFrame({ data }: NodeProps<PlateFlowNode>) {
  const { plate, size, hasCard } = data
  const openCard = useStore((s) => s.openCard)
  const overview = plate.kind === 'overview'
  const { width: w, height: h } = size

  const frame = useMemo(
    () => [gen.rectangle(4, 4, w - 8, h - 8, { seed: seedFromId(plate.id), roughness: 1.4, stroke: 'S', strokeWidth: overview ? 2.2 : 1.4 })],
    [plate.id, w, h, overview],
  )

  return (
    <div className="sk-plate" style={{ width: w, height: h }}>
      <svg width={w} height={h} aria-hidden>
        <RoughPaths drawables={frame} colors={{ S: 'var(--c-frame)' }} />
      </svg>
      {hasCard ? (
        <button type="button" className="sk-plate-title has-card" onClick={() => openCard(plate.id)} aria-label={`${plate.title}, open card`}>
          {plate.title}
        </button>
      ) : (
        <div className="sk-plate-title">{plate.title}</div>
      )}
    </div>
  )
})
