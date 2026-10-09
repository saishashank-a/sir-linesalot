// Canvas-only UI state for Edit mode. The document itself lives in the main store.
import { create } from 'zustand'
import { addEdge, deleteElements } from '../edit/canvasActions.ts'
import { useStore } from '../store.ts'

type Selection = { kind: 'node' | 'edge'; id: string } | null

interface EditState {
  selected: Selection
  connectFrom: string | null // set by the toolbar's Connect: the next node tap becomes the target
  renaming: string | null // node or edge id whose label is being edited inline
  select: (s: Selection) => void
  setConnectFrom: (id: string | null) => void
  setRenaming: (id: string | null) => void
  reset: () => void
}

export const useEditState = create<EditState>()((set) => ({
  selected: null,
  connectFrom: null,
  renaming: null,
  select: (selected) => set({ selected, renaming: null }),
  setConnectFrom: (connectFrom) => set({ connectFrom }),
  setRenaming: (renaming) => set({ renaming }),
  reset: () => set({ selected: null, connectFrom: null, renaming: null }),
}))

// A node tap in Edit mode: finish a pending Connect, otherwise select the node.
// (The store's picker, when set, is checked by the caller before this.)
export function tapNode(id: string) {
  const { connectFrom, select, setConnectFrom } = useEditState.getState()
  if (connectFrom && connectFrom !== id) {
    setConnectFrom(null)
    let edgeId = ''
    if (useStore.getState().edit((d) => { edgeId = addEdge(d, connectFrom, id) })) select({ kind: 'edge', id: edgeId })
    return
  }
  setConnectFrom(null)
  select({ kind: 'node', id })
}

export function deleteSelected() {
  const { selected, reset } = useEditState.getState()
  if (!selected) return
  if (useStore.getState().edit((d) => deleteElements(d, [selected.id]))) reset()
}

// Inline label edit for a node or edge. Empty text keeps the old label for nodes and clears it for edges.
export function commitLabel(id: string, text: string) {
  useEditState.getState().setRenaming(null)
  const label = text.trim()
  const { doc, edit } = useStore.getState()
  const current = doc?.nodes.find((x) => x.id === id)?.label ?? doc?.edges.find((x) => x.id === id)?.label ?? ''
  if (label === current || (!label && doc?.nodes.some((x) => x.id === id))) return // no-op: don't add an undo step
  edit((d) => {
    const n = d.nodes.find((x) => x.id === id)
    if (n) {
      if (label) n.label = label
      return
    }
    const e = d.edges.find((x) => x.id === id)
    if (e) {
      if (label) e.label = label
      else delete e.label
    }
  })
}
