// Edit-mode controls attached to a selected node or edge, plus the inline label input.
import { useEffect, useRef } from 'react'
import { PALETTE, type LalEdge, type LalNode, type LalPlate } from '../model/schema.ts'
import { useStore } from '../store.ts'
import { plateDeleteBlocker, tidyPlate } from '../edit/canvasActions.ts'
import { flyToPlate } from './camera.ts'
import { commitLabel, deleteSelected, useEditState } from './editState.ts'

const SHAPES = ['rectangle', 'ellipse', 'diamond', 'pill'] as const
const FILLS = PALETTE.filter((c) => c !== 'ink' && c !== 'paper')

const editNode = (id: string, recipe: (n: LalNode) => void) =>
  useStore.getState().edit((d) => {
    const n = d.nodes.find((x) => x.id === id)
    if (n) recipe(n)
  })
const editEdge = (id: string, recipe: (e: LalEdge) => void) =>
  useStore.getState().edit((d) => {
    const e = d.edges.find((x) => x.id === id)
    if (e) recipe(e)
  })

export function LabelInput({ id, initial, className }: { id: string; initial: string; className?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false) // Enter and Esc also blur; commit only once
  useEffect(() => ref.current?.select(), [])
  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    if (save) commitLabel(id, ref.current?.value ?? '')
    else useEditState.getState().setRenaming(null)
  }
  return (
    <input
      ref={ref}
      autoFocus
      defaultValue={initial}
      aria-label="Label"
      className={`sk-rename nodrag nopan${className ? ` ${className}` : ''}`}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(true)
        if (e.key === 'Escape') finish(false)
      }}
      onBlur={() => finish(true)}
    />
  )
}

export function NodeTools({ node }: { node: LalNode }) {
  const connecting = useEditState((s) => s.connectFrom === node.id)
  const { setRenaming, setConnectFrom } = useEditState.getState()
  const openCard = useStore((s) => s.openCard)
  const plates = useStore((s) => s.doc?.plates)
  const otherPlates = plates?.filter((p) => p.id !== node.plate)
  const note = node.kind === 'note'

  return (
    <div className="edit-tools nodrag nopan" role="toolbar" aria-label={`Edit ${node.label}`}>
      <button type="button" onClick={() => setRenaming(node.id)}>Rename</button>
      <button type="button" onClick={() => openCard(node.id)}>Card</button>
      {!note && (
        <select
          aria-label="Shape"
          value={node.shape ?? 'rectangle'}
          onChange={(e) => editNode(node.id, (n) => { n.shape = e.target.value as LalNode['shape'] })}
        >
          {SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      <select
        aria-label="Fill colour"
        value={node.style?.fill ?? ''}
        onChange={(e) =>
          editNode(node.id, (n) => {
            const fill = e.target.value as (typeof FILLS)[number] | ''
            const { fill: _old, ...rest } = n.style ?? {}
            n.style = fill ? { ...rest, fill } : rest
            if (!Object.keys(n.style).length) delete n.style
          })
        }
      >
        <option value="">{note ? 'Default fill' : 'No fill'}</option>
        {FILLS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      {!note && !!otherPlates?.length && (
        <select
          aria-label="Portal to"
          value={node.link?.plate ?? ''}
          onChange={(e) =>
            editNode(node.id, (n) => {
              if (e.target.value) n.link = { plate: e.target.value }
              else delete n.link
            })
          }
        >
          <option value="">Not a portal</option>
          {otherPlates.map((p) => <option key={p.id} value={p.id}>Portal to {p.title}</option>)}
        </select>
      )}
      {node.link && <button type="button" onClick={() => flyToPlate(node.link!.plate)}>Open plate</button>}
      {!note && (
        <button type="button" aria-pressed={connecting} onClick={() => setConnectFrom(connecting ? null : node.id)}>
          Connect
        </button>
      )}
      <button type="button" className="danger" onClick={deleteSelected}>Delete</button>
    </div>
  )
}

export function PlateTools({ plate }: { plate: LalPlate }) {
  const { setRenaming } = useEditState.getState()
  const openCard = useStore((s) => s.openCard)
  const only = useStore((s) => s.doc?.plates?.length === 1)
  const blocked = useStore((s) => (s.doc ? plateDeleteBlocker(s.doc, plate.id) : null))
  return (
    <div className="edit-tools nodrag nopan" role="toolbar" aria-label={`Edit plate ${plate.title}`}>
      <button type="button" onClick={() => setRenaming(plate.id)}>Rename</button>
      <button type="button" onClick={() => openCard(plate.id)}>Card</button>
      <button type="button" onClick={() => useStore.getState().edit((d) => tidyPlate(d, plate.id))} title="Auto-layout this plate's nodes">Tidy</button>
      {/* Deleting the only plate keeps its contents and just removes the frame. */}
      <button type="button" className="danger" disabled={!!blocked} title={blocked ?? undefined} onClick={deleteSelected}>
        {only ? 'Remove frame' : 'Delete plate'}
      </button>
    </div>
  )
}

export function EdgeTools({ edge }: { edge: LalEdge }) {
  const { setRenaming } = useEditState.getState()
  const openCard = useStore((s) => s.openCard)
  return (
    <div className="edit-tools nodrag nopan" role="toolbar" aria-label="Edit connection">
      <button type="button" onClick={() => setRenaming(edge.id)}>Label</button>
      <button type="button" onClick={() => openCard(edge.id)}>Card</button>
      <button
        type="button"
        aria-pressed={!!edge.style?.dashed}
        onClick={() =>
          editEdge(edge.id, (e) => {
            const { dashed, ...rest } = e.style ?? {}
            e.style = dashed ? rest : { ...rest, dashed: true }
            if (!Object.keys(e.style).length) delete e.style
          })
        }
      >
        Dashed
      </button>
      <button type="button" className="danger" onClick={deleteSelected}>Delete</button>
    </div>
  )
}


// Whatever is selected, as one toolbar. Phones show this in the bottom dock instead of
// floating it over the canvas, where it wouldn't fit.
export function SelectionTools() {
  const selected = useEditState((s) => s.selected)
  const doc = useStore((s) => s.doc)
  if (!selected || !doc) return null
  if (selected.kind === 'node') {
    const node = doc.nodes.find((n) => n.id === selected.id)
    return node ? <NodeTools node={node} /> : null
  }
  if (selected.kind === 'edge') {
    const edge = doc.edges.find((e) => e.id === selected.id)
    return edge ? <EdgeTools edge={edge} /> : null
  }
  const plate = doc.plates?.find((p) => p.id === selected.id)
  return plate ? <PlateTools plate={plate} /> : null
}
