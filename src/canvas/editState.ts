// Canvas-only UI state for Edit mode. The document itself lives in the main store.
import { create } from 'zustand'
import { addEdge, deleteElements, deletePlate, plateDeleteBlocker } from '../edit/canvasActions.ts'
import { useStore } from '../store.ts'

export type Selection = { kind: 'node' | 'edge' | 'plate'; id: string } | null

interface EditState {
  selected: Selection
  connectFrom: string | null // set by the toolbar's Connect: the next node tap becomes the target
  renaming: string | null // node, edge or plate id whose label is being edited inline
  hint: string | null // short status shown in the palette, e.g. why a tap did nothing
  select: (s: Selection) => void
  setConnectFrom: (id: string | null) => void
  setRenaming: (id: string | null) => void
  setHint: (hint: string | null) => void
  reset: () => void
}

export const useEditState = create<EditState>()((set) => ({
  selected: null,
  connectFrom: null,
  renaming: null,
  hint: null,
  select: (selected) => set({ selected, renaming: null, hint: null }),
  setConnectFrom: (connectFrom) => set({ connectFrom, hint: null }),
  setRenaming: (renaming) => set({ renaming }),
  setHint: (hint) => set({ hint }),
  reset: () => set({ selected: null, connectFrom: null, renaming: null, hint: null }),
}))

// A node tap in Edit mode: finish a pending Connect, otherwise select the node.
// (The store's picker, when set, is checked by the caller before this.)
export function tapNode(id: string) {
  const { connectFrom, select, setConnectFrom, setHint } = useEditState.getState()
  if (connectFrom && connectFrom !== id) {
    const { doc, edit } = useStore.getState()
    if (doc?.nodes.find((n) => n.id === id)?.kind === 'note') return setHint("Sticky notes can't be connected. Tap a step.")
    setConnectFrom(null)
    let edgeId = ''
    if (edit((d) => { edgeId = addEdge(d, connectFrom, id) })) select({ kind: 'edge', id: edgeId })
    return
  }
  setConnectFrom(null)
  select({ kind: 'node', id })
}

export function deleteSelected() {
  const { selected, reset, setHint } = useEditState.getState()
  if (!selected) return
  const { doc, edit } = useStore.getState()
  if (selected.kind === 'plate') {
    const blocked = doc && plateDeleteBlocker(doc, selected.id)
    if (blocked) return setHint(blocked)
    if (edit((d) => deletePlate(d, selected.id))) reset()
    return
  }
  if (edit((d) => deleteElements(d, [selected.id]))) reset()
}

// Inline label edit for a node, edge or plate. Empty text keeps the old label for
// nodes and plates, and clears it for edges.
export function commitLabel(id: string, text: string) {
  useEditState.getState().setRenaming(null)
  const label = text.trim()
  const { doc, edit } = useStore.getState()
  const node = doc?.nodes.find((x) => x.id === id)
  const plate = doc?.plates?.find((x) => x.id === id)
  const current = node?.label ?? plate?.title ?? doc?.edges.find((x) => x.id === id)?.label ?? ''
  if (label === current || (!label && (node || plate))) return // no-op: don't add an undo step
  edit((d) => {
    const n = d.nodes.find((x) => x.id === id)
    if (n) return void (n.label = label)
    const p = d.plates?.find((x) => x.id === id)
    if (p) return void (p.title = label)
    const e = d.edges.find((x) => x.id === id)
    if (!e) return
    if (label) e.label = label
    else delete e.label
  })
}
