---
name: explain-repo
description: Local explaingithub. Beginner-friendly explanation of an unfamiliar repo (this one, or any GitHub repo by URL), then file-by-file Q&A. Use when asked to explain a repo, onboard onto a codebase, or for "explaingithub".
---

# /explain-repo

## 0. Which repo

The current repo by default. If the user gives a GitHub repo (`owner/repo` or a URL), clone it and run every command from the clone:

```bash
git clone --depth 1 https://github.com/<owner>/<repo>.git "<scratchpad>/<repo>"
```

Clone into the scratchpad, never inside the user's project. Private repos work if the user's own git can already read them. Reuse an existing clone of the same repo in this session instead of cloning again.

1. Context: `node "${CLAUDE_PLUGIN_ROOT}/scripts/ingest.mjs" --tree-only`, README, manifest, `node "${CLAUDE_PLUGIN_ROOT}/scripts/repo-diagram.mjs" index` for the core modules, and read the entry point plus the top 3-5 core modules. If `graphify-out/GRAPH_REPORT.md` exists, use its god nodes and communities too.
2. Answer in this shape, plain language, no jargon without a one-line gloss:
   - **What it is**: two sentences.
   - **How it works**: the main flow from entry point to output, 4-7 steps, each naming its file as `path:line`.
   - **Map**: a table of top-level folders, one line each.
   - **Start here**: the 3 files to read first, and why.
   - **Run it**: commands from the manifest/README, only ones that exist.
3. End by offering file Q&A: "Name any file and I'll explain it." Then explain a file by purpose, its key functions, and who calls it (grep the callers, don't guess).
