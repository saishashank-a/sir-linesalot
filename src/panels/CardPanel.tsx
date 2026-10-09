import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { labelOf } from '../edit/cards.ts'
import { useStore } from '../store.ts'
import { typingIn } from '../typing.ts'
import { useNarrow } from '../useNarrow.ts'
import { CardEditor } from './CardEditor.tsx'
import { FieldValue } from './FieldValue.tsx'

export function CardPanel() {
  const doc = useStore((s) => s.doc)
  const target = useStore((s) => s.openCardTarget)
  const close = useStore((s) => s.closeCard)
  const editing = useStore((s) => s.mode === 'edit')
  const card = doc?.cards?.find((c) => c.target === target)
  const open = !!target && (!!card || editing) // edit mode can open a card that doesn't exist yet
  const narrow = useNarrow()
  const ref = useRef<HTMLElement>(null)

  // Move focus into the card, and back to whatever opened it on close.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    ref.current?.focus()
    // Esc in a field just leaves the field (what was typed is already saved); Esc elsewhere closes the card.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (typingIn(e.target)) ref.current?.focus()
      else close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [open, target, close])

  const off = narrow ? { y: '100%' } : { x: '100%' }
  return (
    <AnimatePresence>
      {open && doc && (
        <motion.aside
          key={target}
          ref={ref}
          tabIndex={-1}
          aria-labelledby="card-title"
          className={`card ${narrow ? 'sheet' : 'side'}${editing ? ' editing' : ''}`}
          initial={{ ...off, opacity: 0 }}
          animate={{ x: 0, y: 0, opacity: 1 }}
          exit={{ ...off, opacity: 0 }}
          transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        >
          <header>
            <h2 id="card-title">{card?.title ?? labelOf(doc, target)}</h2>
            <button type="button" className="icon" onClick={close} aria-label="Close card">✕</button>
          </header>
          {editing ? (
            <CardEditor target={target} />
          ) : (
            <dl>
              {card!.fields.map((f, i) => (
                <div key={i}>
                  <dt>{f.label}</dt>
                  <dd><FieldValue field={f} /></dd>
                </div>
              ))}
            </dl>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
