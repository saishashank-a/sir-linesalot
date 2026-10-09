import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import Markdown from 'react-markdown'
import type { LalCardField, LalDocument } from '../model/schema.ts'
import { useStore } from '../store.ts'
import { CardEditor } from './CardEditor.tsx'

const narrowQuery = typeof matchMedia === 'undefined' ? null : matchMedia('(max-width: 640px)')
const useNarrow = () =>
  useSyncExternalStore(
    (cb) => (narrowQuery?.addEventListener('change', cb), () => narrowQuery?.removeEventListener('change', cb)),
    () => !!narrowQuery?.matches,
  )

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
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
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
          className={`card ${narrow ? 'sheet' : 'side'}`}
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

function labelOf(doc: LalDocument, id: string) {
  const n = doc.nodes.find((x) => x.id === id)
  if (n) return n.label
  const e = doc.edges.find((x) => x.id === id)
  if (e) return e.label ?? `${e.source} → ${e.target}`
  return doc.lines?.find((x) => x.id === id)?.name ?? doc.plates?.find((x) => x.id === id)?.title ?? id
}

// Card content comes from untrusted documents: no raw HTML, no images (no remote
// fetches), and only http(s)/mailto links.
const safeUrl = (u: string) => (/^(https?:|mailto:)/i.test(u.trim()) ? u.trim() : '')

function ExternalLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>
}

function FieldValue({ field }: { field: LalCardField }) {
  if (field.format === 'plain') return <p className="plain">{field.value}</p>
  if (field.format === 'url') {
    const href = safeUrl(field.value)
    return <ExternalLink href={href || undefined}>{field.value}</ExternalLink>
  }
  return (
    <Markdown urlTransform={safeUrl} disallowedElements={['img']} unwrapDisallowed components={{ a: ExternalLink }}>
      {field.value}
    </Markdown>
  )
}
