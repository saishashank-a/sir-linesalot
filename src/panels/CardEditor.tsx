// Edit-mode card editor for nodes, edges, lines and plates. Every change goes
// through store.edit(); typing in one input coalesces into one undo step.
import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'
import { addField, labelOf, moveField, removeField, safeUrl, updateField } from '../edit/cards.ts'
import { newId } from '../edit/ids.ts'
import type { LalCard, LalCardField } from '../model/schema.ts'
import { useStore } from '../store.ts'
import './CardEditor.css'
import { FieldValue } from './FieldValue.tsx'

type Format = NonNullable<LalCardField['format']>
const FORMATS: { value: Format; label: string }[] = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'plain', label: 'Plain text' },
  { value: 'url', label: 'Link' },
]

export function CardEditor({ target }: { target: string }) {
  const doc = useStore((s) => s.doc)!
  const card = doc.cards?.find((c) => c.target === target)
  const root = useRef<HTMLDivElement>(null)

  // Applies `change` to this card inside an edit() draft.
  const editCard = (change: (c: LalCard) => void, coalesce?: string) =>
    useStore.getState().edit((d) => {
      const c = d.cards?.find((x) => x.target === target)
      if (c) change(c)
    }, coalesce ? { coalesce } : undefined)

  if (!card) {
    return (
      <div className="card-editor">
        <p className="ce-empty">No card yet.</p>
        <button
          type="button"
          className="ce-primary"
          onClick={() =>
            useStore.getState().edit((d) => {
              d.cards = [...(d.cards ?? []), { id: newId(d, 'c'), target, fields: [addField([])[0]] }]
            })
          }
        >
          Add card
        </button>
      </div>
    )
  }

  const fields = card.fields
  // After a move the buttons re-render under a new index; keep keyboard focus on the moved field.
  const move = (i: number, delta: -1 | 1) => {
    editCard((c) => { c.fields = moveField(c.fields, i, delta) })
    requestAnimationFrame(() => {
      const to = i + delta
      const btn = root.current?.querySelector<HTMLButtonElement>(`[data-move="${delta}"][data-index="${to}"]`)
      ;(btn && !btn.disabled ? btn : root.current?.querySelector<HTMLButtonElement>(`[data-move="${-delta}"][data-index="${to}"]`))?.focus()
    })
  }

  return (
    <div className="card-editor" ref={root}>
      <label className="ce-row">
        <span>Title</span>
        <input
          value={card.title ?? ''}
          placeholder={labelOf(doc, target)}
          onChange={(e) =>
            editCard((c) => {
              if (e.target.value) c.title = e.target.value
              else delete c.title // empty falls back to the element's label
            }, `card:${card.id}:title`)
          }
        />
      </label>

      <ol className="ce-fields">
        {fields.map((f, i) => {
          const format = f.format ?? 'markdown'
          const badUrl = format === 'url' && !!f.value.trim() && !safeUrl(f.value)
          const hintId = `ce-hint-${card.id}-${i}`
          const set = (patch: Partial<LalCardField>, part?: string) =>
            editCard((c) => { c.fields = updateField(c.fields, i, patch) }, part && `card:${card.id}:${i}:${part}`)
          return (
            <li key={i} className="ce-field">
              <div className="ce-field-head">
                <input className="ce-label" aria-label={`Field ${i + 1} label`} value={f.label} onChange={(e) => set({ label: e.target.value }, 'label')} />
                <select aria-label={`Field ${i + 1} format`} value={format} onChange={(e) => set({ format: e.target.value as Format })}>
                  {FORMATS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {format === 'url' ? (
                <input
                  type="url"
                  aria-label={`Field ${i + 1} link`}
                  value={f.value}
                  placeholder="https://"
                  aria-invalid={badUrl}
                  aria-describedby={badUrl ? hintId : undefined}
                  onChange={(e) => set({ value: e.target.value }, 'value')}
                />
              ) : (
                <GrowingTextarea aria-label={`Field ${i + 1} value`} value={f.value} rows={3} onChange={(e) => set({ value: e.target.value }, 'value')} />
              )}
              {badUrl && <p id={hintId} className="ce-hint">Only http(s) and mailto links open. This one will show as plain text.</p>}
              {format === 'markdown' && f.value.trim() && (
                <div className="ce-preview" aria-label={`Field ${i + 1} preview`}>
                  <FieldValue field={f} />
                </div>
              )}
              <div className="ce-field-actions">
                <button type="button" data-move={-1} data-index={i} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${f.label || `field ${i + 1}`} up`}>↑</button>
                <button type="button" data-move={1} data-index={i} disabled={i === fields.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${f.label || `field ${i + 1}`} down`}>↓</button>
                <button type="button" onClick={() => editCard((c) => { c.fields = removeField(c.fields, i) })} aria-label={`Remove ${f.label || `field ${i + 1}`}`}>Remove</button>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="ce-footer">
        <button type="button" className="ce-primary" onClick={() => editCard((c) => { c.fields = addField(c.fields) })}>Add field</button>
        <button
          type="button"
          className="ce-danger"
          onClick={() => useStore.getState().edit((d) => { d.cards = d.cards?.filter((c) => c.target !== target) })}
        >
          Delete card
        </button>
      </div>
    </div>
  )
}

// CSS `field-sizing: content` grows textareas in Chromium; elsewhere, size to the content by hand.
const growsNatively = typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content')

function GrowingTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (growsNatively || !el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 3}px` // + borders
  }, [props.value])
  return <textarea ref={ref} {...props} />
}
