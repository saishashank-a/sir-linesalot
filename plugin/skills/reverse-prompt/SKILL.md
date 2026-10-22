---
name: reverse-prompt
description: Local gitreverse. Reverse-engineer a repo (this one, or any GitHub repo by URL) into the one plain-language prompt someone could have pasted into an AI coding tool to build it. Use when asked to "reverse" a repo, for "gitreverse", or for a rebuild-this-project prompt.
---

# /reverse-prompt

## 0. Which repo

The current repo by default. If the user gives a GitHub repo (`owner/repo` or a URL), clone it and run every command from the clone:

```bash
git clone --depth 1 https://github.com/<owner>/<repo>.git "<scratchpad>/<repo>"
```

Clone into the scratchpad, never inside the user's project. Private repos work if the user's own git can already read them. Reuse an existing clone of the same repo in this session instead of cloning again.

1. Context: `node "${CLAUDE_PLUGIN_ROOT}/scripts/ingest.mjs" --tree-only`, the README, `package.json` (or equivalent) description and dependencies, and a skim of the entry point. More than gitreverse's depth-1 tree, still no full dump.
2. Write ONE synthetic user message, the kind a non-technical or lightly technical person pastes into Claude Code or Cursor to get this built in one go.
   - Plain language, 120-200 words, short sentences, no hyphens or dashes.
   - Describe what it does and how it should feel; no framework jargon, no folder structure.
   - Only features the repo actually has. Never invent.
   - May end with one line like "look up current docs online if you need to".
3. Reply with only the message in a code block, no title, no commentary. Then, outside the block, one line naming what you could not confirm, if anything.
