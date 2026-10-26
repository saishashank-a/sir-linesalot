# Sir Linesalot plugin

Sir Linesalot turns a codebase into a hand-drawn, clickable architecture diagram. Every card links to the source files behind it, and every edge carries the evidence for why it exists. It works on the repo you're in or on any GitHub repo you name (`owner/repo` or a URL). A GitHub repo is shallow-cloned into a temporary folder; private repos work if your git can already read them.

## Install

```
claude plugin marketplace add saishashank-a/sir-linesalot
claude plugin install sir-linesalot@sir-linesalot
```

Restart Claude Code after installing.

## Skills

| Skill | What you get |
|---|---|
| `/sir-linesalot:repo-diagram` | A hand-drawn architecture diagram (`.lal`), opened in your browser |
| `/sir-linesalot:ingest` | One text digest of the repo (tree + file contents) to paste into any AI tool |
| `/sir-linesalot:explain-repo` | A plain-language tour of the repo, then file-by-file Q&A |
| `/sir-linesalot:reverse-prompt` | The one prompt someone could have used to build the repo |

## Privacy

Diagrams open in a viewer this plugin serves on `127.0.0.1`, and the diagram travels in the link's `#` part, so it never leaves your machine. The server stops by itself once the page is idle. A short share link uploads the diagram to the Sir Linesalot server, so the skill asks before making one. Uploaded diagrams are stored privately (Vercel Blob) under an unguessable ID, can be opened by anyone who has the link, and are kept with no expiry. To have one removed, open an issue at https://github.com/saishashank-a/sir-linesalot/issues with its link. Nothing else is uploaded, and there is no telemetry.

## Source and license

Source: https://github.com/saishashank-a/sir-linesalot. MIT, see [LICENSE](LICENSE).
