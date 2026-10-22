---
name: explain-repo
description: Local explaingithub. Beginner-friendly explanation of an unfamiliar repo, then file-by-file Q&A. Use when asked to explain a repo, onboard onto a codebase, or for "explaingithub".
---

# /explain-repo

1. Context: `node "${CLAUDE_PLUGIN_ROOT}/scripts/ingest.mjs" --tree-only`, README, manifest, `node "${CLAUDE_PLUGIN_ROOT}/scripts/repo-diagram.mjs" index` for the core modules, and read the entry point plus the top 3-5 core modules. If `graphify-out/GRAPH_REPORT.md` exists, use its god nodes and communities too.
2. Answer in this shape, plain language, no jargon without a one-line gloss:
   - **What it is**: two sentences.
   - **How it works**: the main flow from entry point to output, 4-7 steps, each naming its file as `path:line`.
   - **Map**: a table of top-level folders, one line each.
   - **Start here**: the 3 files to read first, and why.
   - **Run it**: commands from the manifest/README, only ones that exist.
3. End by offering file Q&A: "Name any file and I'll explain it." Then explain a file by purpose, its key functions, and who calls it (grep the callers, don't guess).
