import { Background, BackgroundVariant, Controls, Panel, ReactFlow, type EdgeMouseHandler } from '@xyflow/react'
import { useMemo } from 'react'
import { useStore } from '../store.ts'
import { docToFlow, lineColor, type LineFlowEdge, type SketchFlowEdge } from './adapter.ts'
import { LineEdge } from './LineEdge.tsx'
import { PlateFrame } from './PlateFrame.tsx'
import { SketchEdge } from './SketchEdge.tsx'
import { SketchNode } from './SketchNode.tsx'

const nodeTypes = { step: SketchNode, plate: PlateFrame }
const edgeTypes = { sketch: SketchEdge, line: LineEdge }

// View mode: nothing drags, connects or selects; taps open cards and highlight lines.
export function Canvas() {
  const doc = useStore((s) => s.doc)!
  const highlightLineId = useStore((s) => s.highlightLineId)
  const theme = useStore((s) => s.theme)
  const { openCard, toggleLine } = useStore.getState()
  const { nodes, edges } = useMemo(() => docToFlow(doc, highlightLineId), [doc, highlightLineId])

  const onEdgeClick: EdgeMouseHandler<SketchFlowEdge | LineFlowEdge> = (_, e) => {
    if (e.type === 'line') {
      toggleLine(e.data!.line.id)
      openCard(e.data!.line.id)
    } else openCard(e.id)
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onEdgeClick={onEdgeClick}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      colorMode={theme === 'auto' ? 'system' : theme}
      fitView
      fitViewOptions={{ padding: 0.1 }}
      minZoom={0.1}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.4} color="var(--c-grid)" />
      <Controls showInteractive={false} />
      {!!doc.lines?.length && (
        <Panel position="top-left" className="legend" aria-label="Shared lines">
          {doc.lines.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={highlightLineId === l.id}
              onClick={() => toggleLine(l.id)}
            >
              <span className="swatch" style={{ background: lineColor(doc, l) }} />
              {l.name}
            </button>
          ))}
        </Panel>
      )}
    </ReactFlow>
  )
}
