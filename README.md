# Sir Linesalot

> *Knighting your diagrams.*

An interactive, hand-drawn style diagram canvas: sketchy nodes you can tap to open cards, edit in place, and bring to life by playing animations along paths.

Open it at **https://sir-linesalot.vercel.app/**.

## Claude Code plugin

```
/plugin install sir-linesalot --marketplace saishashank-a/sir-linesalot
```

Or from a terminal:

```
claude plugin marketplace add saishashank-a/sir-linesalot
claude plugin install sir-linesalot@sir-linesalot
```

Restart Claude Code after installing. To update later: `claude plugin marketplace update sir-linesalot && claude plugin update sir-linesalot@sir-linesalot`.

Every skill works on the repo you're in, or on any GitHub repo you name (`owner/repo` or a URL). A GitHub repo is shallow-cloned into a temporary folder; private repos work if your git can already read them.

| Skill | What you get |
|---|---|
| `/sir-linesalot:repo-diagram` | A hand-drawn architecture diagram, opened in your browser |
| `/sir-linesalot:ingest` | One text digest of the repo (tree + file contents) to paste into any AI tool |
| `/sir-linesalot:explain-repo` | A plain-language tour of the repo, then file-by-file Q&A |
| `/sir-linesalot:reverse-prompt` | The one prompt someone could have used to build the repo |

```
/sir-linesalot:repo-diagram
/sir-linesalot:repo-diagram https://github.com/sindresorhus/ky
/sir-linesalot:ingest vercel/next.js
```

**Diagrams open on your machine.** The plugin ships the app and serves it on `127.0.0.1`, so a diagram of a private repo never leaves your computer. The server stops by itself once the page is idle; reopen the `.lal` file later with File → Open. Your own repo's diagram is saved to `diagrams/architecture.lal`.

**Sharing is opt-in.** The build also prints a `share link:` to the hosted app, which carries the whole diagram inside the link (nothing uploaded). For diagrams too big for a link, the skill can make a short link, but that uploads the diagram, so it asks first. In the hosted app, File → Copy share link does the same.

### Developing the plugin

The plugin's scripts and viewer are built from this repo: run `npm run plugin` after changing `scripts/`, `src/`, or the app, and bump `version` in `plugin/.claude-plugin/plugin.json` so installed copies update.

## Status

All planned milestones, (a) to (f), are done:

- **(a)** `.lal` schema, validator and path resolver
- **(b)** read-only viewer with tappable cards
- **(c)** editor, on desktop and phone
- **(d)** Play mode
- **(e)** plates and camera fly-to
- **(f)** SVG, PNG and `.excalidraw` export, and `.excalidraw` import (File → Open)

See [PLAN.md](PLAN.md) for the full plan.

## License

MIT © Sai Shashank Anchuri. Third-party notices live in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
