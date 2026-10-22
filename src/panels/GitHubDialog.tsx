import { useEffect, useRef, useState } from 'react'
import { confirmDiscard } from '../io/files.ts'
import { serializeLal } from '../io/lal.ts'
import { digest } from '../repo/core.ts'
import { loadRepo, type GitHubRepo } from '../repo/github.ts'
import { useStore } from '../store.ts'
import './GitHubDialog.css'

// Paste a public GitHub repo: Ingest shows a text digest, Diagram has Claude draw it.
// The API key lives only in this component's state: never stored, sent only to Anthropic.
export default function GitHubDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const repoCache = useRef<{ input: string; repo: Promise<GitHubRepo> } | null>(null)
  const [input, setInput] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')

  useEffect(() => dialog.current?.showModal(), [])

  // Both buttons on the same repo share one GitHub fetch (the tree costs 3 of the 60 calls an hour).
  const repo = () => {
    if (repoCache.current?.input !== input) repoCache.current = { input, repo: loadRepo(input) }
    const p = repoCache.current.repo
    p.catch(() => repoCache.current?.repo === p && (repoCache.current = null)) // a failed load can be retried
    return p
  }

  const run = async (job: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await job()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  const ingest = () =>
    run(async () => {
      setStatus('Fetching files…')
      const gh = await repo()
      setText((gh.truncated ? 'Note: GitHub returned a partial file list for this very large repo.\n\n' : '') + (await digest(gh, gh.files, gh.read, { maxTokens: 100_000 })))
    })

  const diagram = () =>
    run(async () => {
      if (!confirmDiscard()) return
      const { diagramRepo } = await import('../repo/claude.ts') // the SDK loads only for people who use this
      const doc = await diagramRepo(await repo(), apiKey.trim(), setStatus)
      await useStore.getState().loadText(serializeLal(doc))
      useStore.setState({ dirty: true }) // unsaved until they save or share it
      onClose()
    })

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    Object.assign(document.createElement('a'), { href: url, download: `${input.trim().replace(/\/$/, '').split('/').pop()}-digest.txt` }).click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <dialog ref={dialog} className="gh-dialog" aria-labelledby="gh-title" onClose={onClose}>
      <form method="dialog" className="gh-head">
        <h2 id="gh-title">From GitHub</h2>
        <button aria-label="Close">✕</button>
      </form>
      <label>
        Public repo
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="owner/repo or https://github.com/owner/repo" disabled={busy} autoFocus />
      </label>
      <label>
        Anthropic API key <span className="gh-hint">(only for Diagram)</span>
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" disabled={busy} />
      </label>
      <p className="gh-hint">Your key stays in this tab and goes only to Anthropic, who bill it. A diagram usually costs a few cents to about a dollar.</p>
      <div className="gh-actions">
        <button type="button" onClick={ingest} disabled={busy || !input.trim()}>
          Ingest
        </button>
        <button type="button" className="gh-primary" onClick={diagram} disabled={busy || !input.trim() || !apiKey.trim()}>
          Diagram
        </button>
      </div>
      <p role="status" className="gh-status">
        {status}
      </p>
      {error && (
        <p role="alert" className="gh-error">
          {error}
        </p>
      )}
      {text && (
        <div className="gh-digest">
          <textarea readOnly value={text} aria-label="Repo digest" />
          <div className="gh-actions">
            <span className="gh-hint">~{Math.round(text.length / 4000)}k tokens</span>
            <button type="button" onClick={() => navigator.clipboard.writeText(text)}>
              Copy
            </button>
            <button type="button" onClick={download}>
              Download .txt
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
