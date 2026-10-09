import { lineColor } from '../canvas/adapter.ts'
import { useStore } from '../store.ts'

// Shared-lines legend: tap a line to highlight everything it touches.
export function Legend() {
  const doc = useStore((s) => s.doc)
  const highlightLineId = useStore((s) => s.highlightLineId)
  const toggleLine = useStore((s) => s.toggleLine)
  const lines = doc?.lines
  if (!doc || !lines?.length) return null
  return (
    <div className="legend" role="group" aria-label="Shared lines">
      {lines.map((l) => (
        <button key={l.id} type="button" aria-pressed={highlightLineId === l.id} onClick={() => toggleLine(l.id)}>
          <span className="swatch" style={{ background: lineColor(doc, l) }} />
          {l.name}
        </button>
      ))}
    </div>
  )
}
