# Sir Linesalot

> *Knighting your diagrams.*

An interactive, hand-drawn style diagram canvas: sketchy nodes you can tap to open cards, edit in place, and bring to life by playing animations along paths.

Open it at **https://sir-linesalot.vercel.app/**.

## Claude Code plugin

```
/plugin install sir-linesalot --marketplace saishashank-a/sir-linesalot
```

Then run `/sir-linesalot:repo-diagram` in any repo. It writes `diagrams/architecture.lal` and prints a link that opens the diagram in the app; the diagram travels inside the link, so nothing is uploaded. The plugin also adds `ingest`, `explain-repo` and `reverse-prompt`.

Plugin scripts are bundled from `scripts/` with `npm run plugin`; rerun it after changing `scripts/` or `src/model/`.

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
