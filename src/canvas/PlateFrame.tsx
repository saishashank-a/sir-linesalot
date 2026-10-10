import { NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { memo, useMemo } from 'react'
import { useNarrow } from '../useNarrow.ts'
import { useStore } from '../store.ts'
import type { PlateFlowNode } from './adapter.ts'
import { useEditState } from './editState.ts'
import { LabelInput, PlateTools } from './EditTools.tsx'
import { plateDrawables } from './rough.ts'
import { RoughPaths } from './RoughPaths.tsx'

export const PlateFrame = memo(function PlateFrame({ data }: NodeProps<PlateFlowNode>) {
  const { plate, size, hasCard } = data
  const openCard = useStore((s) => s.openCard)
  const editing = useStore((s) => s.mode === 'edit')
  const selected = useEditState((s) => s.selected?.kind === 'plate' && s.selected.id === plate.id)
  const renaming = useEditState((s) => s.renaming === plate.id)
  const narrow = useNarrow()
  const { width: w, height: h } = size

  const frame = useMemo(() => plateDrawables(plate, w, h), [plate, w, h])

  return (
    <div className={`sk-plate${selected ? ' selected' : ''}`} style={{ width: w, height: h }}>
      <svg width={w} height={h} aria-hidden>
        <RoughPaths drawables={frame} colors={{ S: 'var(--c-frame)' }} />
      </svg>
      {/* In Edit mode the title selects the plate and is also its drag handle. */}
      {renaming ? (
        <div className="sk-plate-title">
          <LabelInput id={plate.id} initial={plate.title} className="plate" />
        </div>
      ) : hasCard || editing ? (
        <button
          type="button"
          className="sk-plate-title has-card"
          onClick={() => (editing ? useEditState.getState().select({ kind: 'plate', id: plate.id }) : openCard(plate.id))}
          onDoubleClick={() => editing && useEditState.getState().setRenaming(plate.id)}
          aria-label={`${plate.title}, ${editing ? 'select, or drag to move the plate' : 'open card'}`}
        >
          {plate.title}
        </button>
      ) : (
        <div className="sk-plate-title">{plate.title}</div>
      )}
      <NodeToolbar isVisible={editing && selected && !renaming && !narrow} position={Position.Top} align="start" offset={8}>
        <PlateTools plate={plate} />
      </NodeToolbar>
    </div>
  )
})
