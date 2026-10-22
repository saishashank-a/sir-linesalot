---
name: reverse-prompt
description: Local gitreverse. Reverse-engineer a repo into the one plain-language prompt someone could have pasted into an AI coding tool to build it. Use when asked to "reverse" a repo, for "gitreverse", or for a rebuild-this-project prompt.
---

# /reverse-prompt

1. Context: `node "${CLAUDE_PLUGIN_ROOT}/scripts/ingest.mjs" --tree-only`, the README, `package.json` (or equivalent) description and dependencies, and a skim of the entry point. More than gitreverse's depth-1 tree, still no full dump.
2. Write ONE synthetic user message, the kind a non-technical or lightly technical person pastes into Claude Code or Cursor to get this built in one go.
   - Plain language, 120-200 words, short sentences, no hyphens or dashes.
   - Describe what it does and how it should feel; no framework jargon, no folder structure.
   - Only features the repo actually has. Never invent.
   - May end with one line like "look up current docs online if you need to".
3. Reply with only the message in a code block, no title, no commentary. Then, outside the block, one line naming what you could not confirm, if anything.
