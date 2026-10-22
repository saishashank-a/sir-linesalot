---
name: ingest
description: Local gitingest/uithub. Dump a repo (summary, directory tree, file contents) as one text digest for LLM context. Works on private repos, nothing is uploaded. Use when asked for a repo digest, "gitingest", "uithub", or context to paste into another AI tool.
---

# /ingest

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
