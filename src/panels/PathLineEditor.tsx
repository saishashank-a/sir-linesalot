// Edit-mode drawer for Play paths and shared lines: create, rename, recolour,
// delete, and edit a route by tapping nodes on the canvas in order.
import { useEffect, useState } from 'react'
import { lineColor } from '../canvas/adapter.ts'
import { colorVar } from '../canvas/rough.ts'
import { newId } from '../edit/ids.ts'
import { buildPathRoute, canAppend, routeProblems, type RouteKind } from '../edit/pathLine.ts'
import { PALETTE, type LalDocument } from '../model/schema.ts'
import { useStore } from '../store.ts'
import './PathLineEditor.css'

interface Draft {
  kind: RouteKind
  id: string | null // null = new, not in the doc until Done
  name: string
  color: string // '' = automatic
  route: string[]
  load: number // the document load it belongs to; a new document drops it
}

const listOf = (doc: LalDocument, kind: RouteKind) => (kind === 'path' ? (doc.paths ?? []) : (doc.lines ?? []))

export function PathLineEditor() {
  const doc = useStore((s) => s.doc)
  const loadCount = useStore((s) => s.loadCount)
  const [open, setOpen] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [stored, setDraft] = useState<Draft | null>(null)
  const [message, setMessage] = useState('')
  const draft = stored?.load === loadCount ? stored : null

  if (!doc) return null
  const rows = (['path', 'line'] as const).flatMap((kind) => listOf(doc, kind).map((item) => ({ kind, item })))

  const startRoute = (d: Omit<Draft, 'load'>) => {
    setMessage('')
    setExpanded(null)
    setDraft({ ...d, load: loadCount })
  }

  const remove = (kind: RouteKind, id: string) =>
    useStore.getState().edit((d) => {
      if (kind === 'path') d.paths = d.paths?.filter((p) => p.id !== id)
      else d.lines = d.lines?.filter((l) => l.id !== id)
      d.cards = d.cards?.filter((c) => c.target !== id)
    })

  const rename = (kind: RouteKind, id: string, name: string) =>
    useStore.getState().edit((d) => { listOf(d, kind).find((x) => x.id === id)!.name = name }, { coalesce: `rename:${id}` })

  const recolor = (kind: RouteKind, id: string, color: string) =>
    useStore.getState().edit((d) => {
      const item = listOf(d, kind).find((x) => x.id === id)!
      if (color) item.color = color
      else delete item.color
    })

  return (
    <section className="ple" aria-label="Paths and lines">
      <button type="button" className="ple-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        Paths &amp; lines <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && !draft && (
        <div className="ple-body">
          {!rows.length && <p className="ple-empty">No paths or lines yet.</p>}
          <ul>
            {rows.map(({ kind, item }) => {
              const swatch = kind === 'line' ? lineColor(doc, doc.lines!.find((l) => l.id === item.id)!) : colorVar(item.color, 'var(--c-gray)')
              const isOpen = expanded === item.id
              return (
                <li key={item.id}>
                  <button type="button" className="ple-row" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : item.id)}>
                    <span className={`ple-swatch ${kind}`} style={{ background: swatch }} />
                    <span className="ple-name">{item.name || '(unnamed)'}</span>
                    <span className="ple-kind">{kind}</span>
                  </button>
                  {isOpen && (
                    <div className="ple-details">
                      <label>
                        Name
                        <input value={item.name} onChange={(e) => rename(kind, item.id, e.target.value)} />
                      </label>
                      <label>
                        Colour
                        <ColorSelect value={item.color ?? ''} onChange={(c) => recolor(kind, item.id, c)} />
                      </label>
                      <div className="ple-actions">
                        <button type="button" onClick={() => startRoute({ kind, id: item.id, name: item.name, color: item.color ?? '', route: [...item.nodes] })}>
                          Edit route
                        </button>
                        <button type="button" onClick={() => remove(kind, item.id)}>Delete</button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="ple-actions">
            <button type="button" onClick={() => startRoute({ kind: 'path', id: null, name: 'New path', color: '', route: [] })}>+ Path</button>
            <button type="button" onClick={() => startRoute({ kind: 'line', id: null, name: 'New line', color: '', route: [] })}>+ Line</button>
          </div>
        </div>
      )}
      {open && draft && (
        <RouteEditor
          doc={doc}
          draft={draft}
          setDraft={setDraft}
          message={message}
          setMessage={setMessage}
          onClose={() => setDraft(null)}
        />
      )}
    </section>
  )
}

function ColorSelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">automatic</option>
      {PALETTE.filter((c) => c !== 'paper').map((c) => <option key={c} value={c}>{c}</option>)}
      {value.startsWith('#') && <option value={value}>{value}</option>}
    </select>
  )
}

function RouteEditor({ doc, draft, setDraft, message, setMessage, onClose }: {
  doc: LalDocument
  draft: Draft
  setDraft: (d: Draft) => void
  message: string
  setMessage: (m: string) => void
  onClose: () => void
}) {
  const { kind, route } = draft
  const label = (id: string) => doc.nodes.find((n) => n.id === id)?.label ?? id
  const problems = routeProblems(doc, kind, route)

  // Canvas taps add stops while this is open. Re-registered on every change so the
  // picker always sees the current route.
  useEffect(() => {
    useStore.getState().setPicker((nodeId) => {
      const check = canAppend(doc, kind, route, nodeId)
      if (!check.ok) return setMessage(check.reason)
      setMessage(check.ambiguous ? `Several arrows join these two; using "${check.edgeId}".` : `Added "${label(nodeId)}".`)
      setDraft({ ...draft, route: [...route, nodeId] })
    })
  })
  useEffect(() => () => useStore.getState().setPicker(null), [])

  // Highlight the line being edited, then put back whatever was highlighted before.
  useEffect(() => {
    if (kind !== 'line' || !draft.id) return
    const prev = useStore.getState().highlightLineId
    if (prev !== draft.id) useStore.getState().toggleLine(draft.id)
    return () => useStore.setState({ highlightLineId: prev })
  }, [kind, draft.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const done = () => {
    const ok = useStore.getState().edit((d) => {
      const fields = kind === 'path' ? buildPathRoute(d, route) : { nodes: route }
      const list = kind === 'path' ? (d.paths ??= []) : (d.lines ??= [])
      let item = draft.id ? list.find((x) => x.id === draft.id) : undefined
      if (!item) {
        item = { id: newId(d, kind === 'path' ? 'p' : 'l'), name: draft.name, nodes: [], ...(draft.color && { color: draft.color }) }
        list.push(item)
      }
      item.nodes = fields.nodes
      if (kind === 'path') {
        const path = item as NonNullable<LalDocument['paths']>[number]
        if ('edges' in fields && fields.edges) path.edges = fields.edges
        else delete path.edges
      }
    })
    if (ok) onClose()
  }

  const canFinish = route.length >= 2 && !problems.length
  return (
    <div className="ple-body ple-route">
      <p className="ple-hint">
        {draft.id ? `Editing ${kind} “${draft.name}”.` : `New ${kind}.`} Tap nodes on the canvas in order.
      </p>
      {!draft.id && (
        <>
          <label>
            Name
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label>
            Colour
            <ColorSelect value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
          </label>
        </>
      )}
      <ol className="ple-chips" aria-label="Route">
        {route.map((id, i) => {
          const bad = problems.find((p) => p.index === i)
          return (
            <li key={`${i}-${id}`} className={bad ? 'bad' : undefined} title={bad?.reason}>
              {label(id)}
              <button type="button" aria-label={`Remove ${label(id)} (stop ${i + 1})`} onClick={() => setDraft({ ...draft, route: route.filter((_, k) => k !== i) })}>×</button>
            </li>
          )
        })}
        {!route.length && <li className="ple-empty">No stops yet</li>}
      </ol>
      <p className="ple-msg" role="status" aria-live="polite">
        {problems.length ? `Stop ${problems[0].index + 1}: ${problems[0].reason}` : message}
      </p>
      <div className="ple-actions">
        <button type="button" disabled={!route.length} onClick={() => setDraft({ ...draft, route: route.slice(0, -1) })}>Undo last</button>
        <button type="button" disabled={!canFinish} onClick={done} title={route.length < 2 ? 'A route needs at least 2 stops' : undefined}>Done</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
