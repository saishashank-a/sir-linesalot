// Owned by the file-io branch: Open / Save / Save As (File System Access API with
// download/upload fallback) and the unsaved-changes guard. Placeholder keeps today's buttons.
import { useRef } from 'react'
import sample from '../../samples/request-flows.lal?raw'
import { useStore } from '../store.ts'

export function FileMenu() {
  const { loadText } = useStore.getState()
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <button type="button" onClick={() => input.current?.click()}>Open…</button>
      <input
        ref={input}
        type="file"
        accept=".lal,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = '' // allow reopening the same file
          if (f) await loadText(await f.text(), { fileName: f.name })
        }}
      />
      <button type="button" onClick={() => loadText(sample)}>Sample</button>
    </>
  )
}
