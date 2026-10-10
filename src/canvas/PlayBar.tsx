import { Panel } from '@xyflow/react'
import { useStore } from '../store.ts'
import { pathColor } from './adapter.ts'
import { loadPath, pause, play, setSpeed, stepBy } from './play.ts'

const SPEEDS = [0.5, 1, 1.5, 2]

// Play mode transport: path picker, step back / play-pause / step forward, speed, loop, cards.
export function PlayBar() {
  const doc = useStore((s) => s.doc)!
  const { pathId, status, step, speed, loop, autoCards } = useStore((s) => s.play)
  const { setPlay } = useStore.getState()
  const paths = doc.paths ?? []
  const path = paths.find((p) => p.id === pathId)
  const here = path && doc.nodes.find((n) => n.id === path.nodes[step])

  if (!paths.length) {
    return (
      <Panel position="bottom-center" className="edit-palette play-bar">
        <span className="hint" role="status">This diagram has no paths to play. Add one in Edit mode.</span>
      </Panel>
    )
  }
  const last = path ? path.nodes.length - 1 : 0
  return (
    <Panel position="bottom-center" className="edit-palette play-bar" aria-label="Playback">
      <label className="play-path">
        {path && <span className="swatch" style={{ background: pathColor(doc, path) }} />}
        <select aria-label="Path" value={pathId ?? ''} onChange={(e) => loadPath(e.target.value || null)}>
          {paths.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <button type="button" onClick={() => stepBy(-1)} disabled={!path || step === 0} aria-label="Step back">⏮</button>
      {status === 'playing' ? (
        <button type="button" onClick={pause} aria-label="Pause">⏸</button>
      ) : (
        <button type="button" onClick={play} disabled={!path} aria-label={status === 'done' ? 'Replay' : 'Play'}>
          {status === 'done' ? '↻' : '▶'}
        </button>
      )}
      <button type="button" onClick={() => stepBy(1)} disabled={!path || step >= last} aria-label="Step forward">⏭</button>
      <select aria-label="Speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
        {SPEEDS.map((v) => (
          <option key={v} value={v}>{v}×</option>
        ))}
      </select>
      <button type="button" aria-pressed={loop} onClick={() => setPlay({ loop: !loop })}>Loop</button>
      <button type="button" aria-pressed={autoCards} onClick={() => setPlay({ autoCards: !autoCards })}>Cards</button>
      {here && (
        <span className="hint" role="status">
          {step + 1} / {last + 1}: {here.label}
        </span>
      )}
    </Panel>
  )
}
