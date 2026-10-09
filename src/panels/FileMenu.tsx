import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import sample from '../../samples/request-flows.lal?raw'
import { confirmDiscard, openFile, openFromFile, save, saveAs } from '../io/files.ts'
import { useStore } from '../store.ts'
import './FileMenu.css'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl+'

export function FileMenu() {
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  // Shortcuts work in every mode; the browser's own Save/Open dialogs are suppressed.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === 's' && e.shiftKey) saveAs()
      else if (key === 's') save()
      else if (key === 'o' && !e.shiftKey) openFile(input.current)
      else return
      e.preventDefault()
    }
    const onUnload = (e: BeforeUnloadEvent) => {
      if (useStore.getState().dirty) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [])

  // Open: focus the first item, close on outside press.
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector('button')?.focus()
    const onDown = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  const run = (action: () => unknown) => {
    close()
    action()
  }

  const onMenuKey = (e: KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll('button') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') {
      e.stopPropagation() // don't also close an open card
      close()
    }
    else if (e.key === 'ArrowDown') items[(i + 1) % items.length]?.focus()
    else if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length]?.focus()
    else if (e.key === 'Home') items[0]?.focus()
    else if (e.key === 'End') items.at(-1)?.focus()
    else if (e.key === 'Tab') setOpen(false)
    else return
    if (e.key !== 'Tab') e.preventDefault()
  }

  return (
    <div className="file-menu">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === 'ArrowDown' && (e.preventDefault(), setOpen(true))}
      >
        File
      </button>
      {open && (
        <div ref={menu} role="menu" aria-label="File" className="file-menu-list" onKeyDown={onMenuKey}>
          <button type="button" role="menuitem" onClick={() => run(() => openFile(input.current))}>
            Open… <kbd>{mod}O</kbd>
          </button>
          <button type="button" role="menuitem" onClick={() => run(save)}>
            Save <kbd>{mod}S</kbd>
          </button>
          <button type="button" role="menuitem" onClick={() => run(saveAs)}>
            Save as… <kbd>{isMac ? '⇧⌘' : 'Ctrl+Shift+'}S</kbd>
          </button>
          <button type="button" role="menuitem" onClick={() => run(() => confirmDiscard() && useStore.getState().loadText(sample))}>
            Load sample
          </button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept=".lal,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = '' // allow reopening the same file
          if (f) await openFromFile(f) // discard was already confirmed before the picker opened
        }}
      />
    </div>
  )
}
