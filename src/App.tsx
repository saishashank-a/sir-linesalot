import { ReactFlowProvider } from '@xyflow/react'
import { MotionConfig } from 'motion/react'
import { useEffect } from 'react'
import sample from '../samples/request-flows.lal?raw'
import { Canvas } from './canvas/Canvas.tsx'
import { openDropped } from './io/files.ts'
import { CardPanel } from './panels/CardPanel.tsx'
import { Legend } from './panels/Legend.tsx'
import { PathLineEditor } from './panels/PathLineEditor.tsx'
import { Toolbar } from './panels/Toolbar.tsx'
import { useStore } from './store.ts'
import { typingIn } from './typing.ts'

export default function App() {
  const doc = useStore((s) => s.doc)
  const loadCount = useStore((s) => s.loadCount)
  const theme = useStore((s) => s.theme)
  const issues = useStore((s) => s.issues)
  const issuesTitle = useStore((s) => s.issuesTitle)
  const mode = useStore((s) => s.mode)
  const { loadText, clearIssues } = useStore.getState()

  useEffect(() => {
    if (!useStore.getState().doc) loadText(sample)
  }, [loadText])

  // Undo/redo shortcuts in Edit mode. Text fields keep their own native undo.
  useEffect(() => {
    if (mode !== 'edit') return
    const onKey = (e: KeyboardEvent) => {
      if (typingIn(e.target) || !(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) useStore.getState().undo()
      else if ((key === 'z' && e.shiftKey) || key === 'y') useStore.getState().redo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  useEffect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="app"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          openDropped(e.dataTransfer)
        }}
      >
        <Toolbar />
        <main className="stage">
          {doc && (
            <ReactFlowProvider key={loadCount}>
              <Canvas />
            </ReactFlowProvider>
          )}
          {/* One column, so a legend that wraps pushes the drawer down instead of under it. */}
          <div className="side-stack">
            <Legend />
            {mode === 'edit' && <PathLineEditor />}
          </div>
          <CardPanel />
        </main>
        {!!issues.length && (
          <div className="issues" role="alert">
            <strong>{issuesTitle}</strong>
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
