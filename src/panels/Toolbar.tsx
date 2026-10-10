import { useStore, type Mode, type Theme } from '../store.ts'
import { FileMenu } from './FileMenu.tsx'

const NEXT_THEME: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' }
const THEME_ICON: Record<Theme, string> = { auto: '◐', light: '☀', dark: '☾' }
const MODES: Mode[] = ['view', 'edit']

export function Toolbar() {
  const title = useStore((s) => s.doc?.title)
  const theme = useStore((s) => s.theme)
  const mode = useStore((s) => s.mode)
  const dirty = useStore((s) => s.dirty)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const { setTheme, setMode, undo, redo } = useStore.getState()

  return (
    <header className="toolbar">
      <span className="brand">Sir Linesalot</span>
      {title && <span className="doc-title">{title}{dirty && <span aria-label="unsaved changes"> •</span>}</span>}
      <span className="spacer" />
      <div className="segmented" role="group" aria-label="Mode">
        {MODES.map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m === 'view' ? 'View' : 'Edit'}
          </button>
        ))}
      </div>
      {mode === 'edit' && (
        <>
          <button type="button" className="icon" onClick={undo} disabled={!canUndo} aria-label="Undo">↶</button>
          <button type="button" className="icon" onClick={redo} disabled={!canRedo} aria-label="Redo">↷</button>
        </>
      )}
      <FileMenu />
      <button type="button" className="icon" onClick={() => setTheme(NEXT_THEME[theme])} aria-label={`Theme: ${theme}. Switch to ${NEXT_THEME[theme]}`}>
        {THEME_ICON[theme]}
      </button>
    </header>
  )
}
