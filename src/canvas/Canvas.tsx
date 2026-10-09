import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Panel,
  ReactFlow,
  useReactFlow,
  useStoreApi,
  type EdgeMouseHandler,
  type OnNodeDrag,
  type OnNodesChange,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { addEdge, addNode, addPlate, moveNode, movePlate } from '../edit/canvasActions.ts'
import { useStore } from '../store.ts'
import { docToFlow, type LineFlowEdge, type PlateFlowNode, type SketchFlowEdge, type StepFlowNode } from './adapter.ts'
import { typingIn } from '../typing.ts'
import { useNarrow } from '../useNarrow.ts'
import { deleteSelected, useEditState } from './editState.ts'
import { SelectionTools } from './EditTools.tsx'
import { LineEdge } from './LineEdge.tsx'
import { PlateFrame } from './PlateFrame.tsx'
import { SketchEdge } from './SketchEdge.tsx'
import { SketchNode } from './SketchNode.tsx'
import './edit.css'

const nodeTypes = { step: SketchNode, plate: PlateFrame }
const edgeTypes = { sketch: SketchEdge, line: LineEdge }
type FlowNode = StepFlowNode | PlateFlowNode


// View mode: nothing drags, connects or selects; taps open cards and highlight lines.
// Edit mode: drag nodes and plates, connect/reconnect, select to get a toolbar.
export function Canvas() {
  const doc = useStore((s) => s.doc)!
  const highlightLineId = useStore((s) => s.highlightLineId)
  const theme = useStore((s) => s.theme)
  const editing = useStore((s) => s.mode === 'edit')
  const { openCard, toggleLine, edit } = useStore.getState()
  const { getInternalNode } = useReactFlow()
  const touches = useTouchCount()

  const flow = useMemo(() => {
    const { nodes, edges } = docToFlow(doc, highlightLineId)
    return {
      nodes: nodes.map((n): FlowNode => (n.type === 'plate' ? { ...n, dragHandle: '.sk-plate-title' } : n)),
      edges: edges.map((e) => (e.type === 'line' ? { ...e, reconnectable: false } : e)),
    }
  }, [doc, highlightLineId])

  // Drags move a local copy; the document only changes on drop, so one drag = one undo step
  // and plate frames stay as they were at drag start while the node moves.
  const [nodes, setNodes] = useState<FlowNode[]>(flow.nodes)
  const [syncedFlow, setSyncedFlow] = useState(flow)
  if (syncedFlow !== flow) {
    setSyncedFlow(flow)
    setNodes(flow.nodes)
  }
  const onNodesChange: OnNodesChange<FlowNode> = useCallback((ch) => setNodes((ns) => applyNodeChanges(ch, ns)), [])

  const onNodeDragStart: OnNodeDrag<FlowNode> = (_, n) => {
    if (n.type === 'step') useEditState.getState().select({ kind: 'node', id: n.id })
  }
  const onNodeDragStop: OnNodeDrag<FlowNode> = (_, __, dragged) => {
    const ok = edit((d) => {
      for (const n of dragged) {
        // Dragged nodes report positions relative to their (unmoved) parent plate.
        const parent = n.parentId ? getInternalNode(n.parentId)?.internals.positionAbsolute : undefined
        const abs = { x: n.position.x + (parent?.x ?? 0), y: n.position.y + (parent?.y ?? 0) }
        if (n.type === 'plate') movePlate(d, n.id, abs)
        else moveNode(d, n.id, abs)
      }
    })
    if (!ok) setNodes(flow.nodes) // rejected (e.g. edges would span plates): snap back
  }

  const onEdgeClick: EdgeMouseHandler<SketchFlowEdge | LineFlowEdge> = (_, e) => {
    if (e.type === 'line') {
      toggleLine(e.data!.line.id)
      openCard(e.data!.line.id)
    } else if (editing) useEditState.getState().select({ kind: 'edge', id: e.id })
    else openCard(e.id)
  }

  useEffect(() => {
    useEditState.getState().reset()
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      if (typingIn(e.target)) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelected()
      } else if (e.key === 'Escape') useEditState.getState().reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  return (
    <ReactFlow
      className={editing ? 'is-editing' : undefined}
      nodes={nodes}
      edges={flow.edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgeClick={onEdgeClick}
      onPaneClick={() => editing && useEditState.getState().reset()}
      onNodeDragStart={onNodeDragStart}
      onNodeDragStop={onNodeDragStop}
      onConnect={(c) => c.source !== c.target && edit((d) => { addEdge(d, c.source, c.target) })}
      onReconnect={(old, c) =>
        edit((d) => {
          const e = d.edges.find((x) => x.id === old.id)
          if (e) Object.assign(e, { source: c.source, target: c.target })
        })
      }
      // ponytail: two-finger gestures disable dragging once the second finger lands; a drag
      // already under way with one finger keeps going. Track gesture start if that bites.
      nodesDraggable={editing && touches < 2}
      nodesConnectable={editing}
      edgesReconnectable={editing}
      connectionMode={ConnectionMode.Loose}
      elementsSelectable={false}
      deleteKeyCode={null}
      colorMode={theme === 'auto' ? 'system' : theme}
      fitView
      fitViewOptions={{ padding: 0.1 }}
      minZoom={0.1}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.4} color="var(--c-grid)" />
      <Controls showInteractive={false} />
      {editing && <EditPalette />}
    </ReactFlow>
  )
}

function EditPalette() {
  const rfStore = useStoreApi()
  const { fitView } = useReactFlow()
  const connectFrom = useEditState((s) => s.connectFrom)
  const hasSelection = useEditState((s) => !!s.selected)
  const hint = useEditState((s) => s.hint)
  const narrow = useNarrow()
  const fromLabel = useStore((s) => s.doc?.nodes.find((n) => n.id === connectFrom)?.label)
  const { edit } = useStore.getState()

  const viewportCentre = () => {
    const { width, height, transform: [tx, ty, zoom] } = rfStore.getState()
    return { x: (width / 2 - tx) / zoom, y: (height / 2 - ty) / zoom }
  }
  const add = (kind: 'step' | 'note') => {
    let id = ''
    if (edit((d) => { id = addNode(d, kind, viewportCentre()) })) {
      useEditState.getState().select({ kind: 'node', id })
      useEditState.getState().setRenaming(id)
    }
  }
  const plate = () => {
    let ids = { plateId: '', nodeId: '' }
    if (!edit((d) => { ids = addPlate(d) })) return
    useEditState.getState().select({ kind: 'node', id: ids.nodeId })
    // ponytail: wait a tick for React Flow to receive the new plate before framing it.
    setTimeout(() => fitView({ nodes: [{ id: ids.plateId }], duration: 400, padding: 0.3 }), 50)
  }

  // Phones dock the palette at the bottom and swap in the selection's tools, which
  // don't fit floating over the canvas there.
  return (
    <Panel position="bottom-center" className="edit-palette" aria-label={narrow && hasSelection && !connectFrom ? 'Selection' : 'Add'}>
      {hint && <span className="hint" role="status">{hint}</span>}
      {connectFrom ? (
        <>
          {!hint && <span className="hint" role="status">Tap the node to connect “{fromLabel}” to</span>}
          <button type="button" onClick={() => useEditState.getState().setConnectFrom(null)}>Cancel</button>
        </>
      ) : narrow && hasSelection ? (
        <>
          <SelectionTools />
          <button type="button" onClick={() => useEditState.getState().reset()}>Done</button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => add('step')}>+ Step</button>
          <button type="button" onClick={() => add('note')}>+ Note</button>
          <button type="button" onClick={plate}>+ Plate</button>
          <button type="button" className="danger" disabled={!hasSelection} onClick={deleteSelected}>Delete</button>
        </>
      )}
    </Panel>
  )
}

// Number of fingers currently on the screen.
function useTouchCount() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const active = new Set<number>()
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      active.add(e.pointerId)
      setCount(active.size)
    }
    const up = (e: PointerEvent) => {
      if (!active.delete(e.pointerId)) return
      setCount(active.size)
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
    }
  }, [])
  return count
}
