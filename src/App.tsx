import { ReactFlowProvider } from '@xyflow/react'
import { MotionConfig } from 'motion/react'
import { useEffect } from 'react'
import sample from '../samples/request-flows.lal?raw'
import { Canvas } from './canvas/Canvas.tsx'
import { CardPanel } from './panels/CardPanel.tsx'
import { Toolbar } from './panels/Toolbar.tsx'
import { useStore } from './store.ts'

export default function App() {
  const doc = useStore((s) => s.doc)
  const loadCount = useStore((s) => s.loadCount)
  const theme = useStore((s) => s.theme)
  const issues = useStore((s) => s.issues)
  const { loadText, clearIssues } = useStore.getState()

  useEffect(() => {
    if (!useStore.getState().doc) loadText(sample)
  }, [loadText])

  useEffect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="app"
        onDragOver={(e) => e.preventDefault()}
        onDrop={async (e) => {
          e.preventDefault()
          const f = e.dataTransfer.files[0]
          if (f) await loadText(await f.text())
        }}
      >
        <Toolbar />
        <main className="stage">
          {doc && (
            <ReactFlowProvider key={loadCount}>
              <Canvas />
            </ReactFlowProvider>
          )}
          <CardPanel />
        </main>
        {!!issues.length && (
          <div className="issues" role="alert">
            <strong>Couldn't open that file</strong>
            <ul>
              {issues.slice(0, 6).map((i, k) => (
                <li key={k}>{i.path && <code>{i.path}</code>} {i.message}</li>
              ))}
              {issues.length > 6 && <li>…and {issues.length - 6} more</li>}
            </ul>
            <button type="button" onClick={clearIssues}>Dismiss</button>
          </div>
        )}
      </div>
    </MotionConfig>
  )
}
