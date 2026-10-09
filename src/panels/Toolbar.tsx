import { useRef } from 'react'
import sample from '../../samples/request-flows.lal?raw'
import { useStore, type Theme } from '../store.ts'

const NEXT_THEME: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' }
const THEME_ICON: Record<Theme, string> = { auto: '◐', light: '☀', dark: '☾' }

export function Toolbar() {
  const title = useStore((s) => s.doc?.title)
  const theme = useStore((s) => s.theme)
  const { loadText, setTheme } = useStore.getState()
  const input = useRef<HTMLInputElement>(null)

  return (
    <header className="toolbar">
      <span className="brand">Sir Lines-a-Lot</span>
      {title && <span className="doc-title">{title}</span>}
      <span className="spacer" />
      <button type="button" onClick={() => input.current?.click()}>Open…</button>
      <input
        ref={input}
        type="file"
        accept=".lal,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = '' // allow reopening the same file
          if (f) await loadText(await f.text())
        }}
      />
      <button type="button" onClick={() => loadText(sample)}>Sample</button>
      <button type="button" className="icon" onClick={() => setTheme(NEXT_THEME[theme])} aria-label={`Theme: ${theme}. Switch to ${NEXT_THEME[theme]}`}>
        {THEME_ICON[theme]}
      </button>
    </header>
  )
}
