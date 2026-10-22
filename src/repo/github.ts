// Public GitHub repos, straight from the browser: the file list from api.github.com
// (3 calls, inside the 60/hour unauthenticated limit) and contents from
// raw.githubusercontent.com (not rate-limited the same way). Nothing goes through our server.
import type { Read, RepoFile, Source } from './core.ts'

export interface GitHubRepo extends Source {
  name: string
  branch: string
  files: RepoFile[]
  truncated: boolean // GitHub caps recursive trees (~100k entries); the list is partial
  read: Read
}

// Accepts owner/repo, a github.com URL (with or without /tree/<branch>), or a clone URL.
export function parseRepo(input: string): { owner: string; repo: string; ref?: string } | null {
  const m = input.trim().match(/^(?:https?:\/\/github\.com\/|git@github\.com:)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([^?#]+))?\/?$/)
  return m ? { owner: m[1], repo: m[2], ...(m[3] && { ref: decodeURIComponent(m[3]) }) } : null
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, { headers: { accept: 'application/vnd.github+json' } })
  if (res.status === 404) throw new Error('No public repo there. Private repos are not supported yet.')
  if (res.status === 403 || res.status === 429) throw new Error('GitHub rate limit hit (60 requests an hour without sign-in). Try again later.')
  if (!res.ok) throw new Error(`GitHub said ${res.status}`)
  return res.json()
}

// ponytail: one shared pool of 8 fetches; raise it if big repos feel slow, lower it if raw.githubusercontent.com starts refusing.
function limited(n: number) {
  let active = 0
  const queue: (() => void)[] = []
  return async <T>(job: () => Promise<T>): Promise<T> => {
    if (active >= n) await new Promise<void>((go) => queue.push(go))
    active++
    try {
      return await job()
    } finally {
      active--
      queue.shift()?.()
    }
  }
}

export async function loadRepo(input: string): Promise<GitHubRepo> {
  const ref = parseRepo(input)
  if (!ref) throw new Error('Paste a GitHub repo, like owner/repo or https://github.com/owner/repo')
  const { owner, repo } = ref
  const meta = await api<{ default_branch: string; html_url: string; private: boolean }>(`/repos/${owner}/${repo}`)
  const branch = ref.ref ?? meta.default_branch
  const head = await api<{ commit: { sha: string } }>(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`)
  const commit = head.commit.sha
  const tree = await api<{ tree: { path: string; type: string; size?: number }[]; truncated: boolean }>(
    `/repos/${owner}/${repo}/git/trees/${commit}?recursive=1`,
  )
  const files = tree.tree.filter((t) => t.type === 'blob').map((t) => ({ path: t.path, size: t.size ?? 0 }))

  const cache = new Map<string, Promise<string>>()
  const pool = limited(8)
  const read: Read = (path) => {
    let hit = cache.get(path)
    if (!hit) {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`
      hit = pool(async () => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`couldn't read ${path} (${res.status})`)
        return res.text()
      })
      cache.set(path, hit)
    }
    return hit
  }
  return { name: repo, branch, commit, remote: meta.html_url, paths: files.map((f) => f.path), files, truncated: tree.truncated, read }
}
