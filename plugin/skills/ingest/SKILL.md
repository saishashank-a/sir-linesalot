---
name: ingest
description: Local gitingest/uithub. Dump a repo (this one, or any GitHub repo by URL) as one text digest of summary, directory tree and file contents, for LLM context. Works on private repos, nothing is uploaded. Use when asked for a repo digest, "gitingest", "uithub", or context to paste into another AI tool.
---

# /ingest

## 0. Which repo

The current repo by default. If the user gives a GitHub repo (`owner/repo` or a URL), clone it and run every command from the clone:

```bash
git clone --depth 1 https://github.com/<owner>/<repo>.git "<scratchpad>/<repo>"
```

Clone into the scratchpad, never inside the user's project. Private repos work if the user's own git can already read them. Reuse an existing clone of the same repo in this session instead of cloning again.

Run from the root of the repo you want digested (any git repo; the script path can be absolute):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ingest.mjs" [flags] > digest.txt
```

| Flag | Effect |
|---|---|
| `--ext ts,tsx` | only these extensions |
| `--dir src,docs` | only these directories |
| `--max-tokens N` | budget, default 50000; smallest files kept first, omitted ones listed in the summary |
| `--tree-only` | summary and tree, no contents |
| `--lines` | prefix line numbers (uithub style) |

Reads `git ls-files`, so `.gitignore` is respected; lockfiles, binaries and tool state (`.omc/`, `graphify-out/`) are skipped.

Output format matches gitingest: `Repository / Branch / Files analyzed / Estimated tokens`, then `Directory structure:`, then each file as

```
================================================
FILE: path
================================================
<content>
```

Write to a file (default `digest.txt` in the scratchpad, not the repo) and tell the user the token estimate and any omitted files. Never paste the digest into chat.
