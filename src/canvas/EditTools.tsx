// Edit-mode controls attached to a selected node or edge, plus the inline label input.
import { useEffect, useRef } from 'react'
import { PALETTE, type LalEdge, type LalNode } from '../model/schema.ts'
import { useStore } from '../store.ts'
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
      {!note && (
        <button type="button" aria-pressed={connecting} onClick={() => setConnectFrom(connecting ? null : node.id)}>
          Connect
        </button>
      )}
      <button type="button" className="danger" onClick={deleteSelected}>Delete</button>
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
