# Sir Lines-a-Lot: Plan

> *Knighting your diagrams.*

Status: **approved 2026-10-10.**

---

## 0. Product summary

A hand-drawn diagram canvas where diagrams are documents you *use*, not just look at.

| Mode | What you can do |
|---|---|
| **View** | Pan/zoom. Tap a node, edge, shared line or plate title to open its card in a side panel (bottom sheet on narrow screens). Tap a portal node to fly the camera to its detail plate. Hover/tap a shared line to highlight everything it touches. |
| **Edit** | Drag nodes, rename inline, add/delete nodes and edges, reconnect edge ends, edit card fields, add sticky notes, edit paths and shared lines, undo/redo. Works on desktop **and phones** (touch-first controls). |
| **Play** | Pick a named path. A token travels edge by edge through it, pausing at each node; everything not on the path fades back. Play/pause/step/speed/loop. |

Other pillars:

- **Cards** attached to nodes, edges, shared lines or plates, made of labelled rich-text (Markdown) fields.
- **Plates**: frames on one infinite canvas. An overview plate's portal nodes link to detail plates; tapping one flies the camera there, with breadcrumbs back.
- **Shared lines**: named, coloured "nerves" routed under many nodes; highlighting one lights up every node it touches.
- **Files**: our own `.lal` JSON format (save/load to a local folder via the File System Access API, download/upload fallback). Import and export `.excalidraw`; export PNG and SVG.
- **Look**: rough.js strokes, a hand-drawn font, light and dark themes.

---

## 1. The `.lal` document format

### Design goals

1. **Generator-friendly.** A script or LLM should be able to emit a valid document with only ids, labels and connections. Positions, sizes, shapes, styles and plates are all optional; missing positions trigger auto-layout (dagre) on load.
2. **Flat, referenced by id.** Top-level arrays (`nodes`, `edges`, `cards`, `paths`, `plates`, `lines`), cross-referenced by string id. No nesting to get wrong.
3. **Strict shape, open metadata.** `additionalProperties: false` everywhere to catch typos, *except* `meta`, which every element (and the document) carries for free-form data.
4. **Versioned.** `"format": "lal"` + `"version": 1`. Loader runs migrations for older versions.

### TypeScript types

```ts
// src/model/schema.ts is the single source of truth (zod), these types are z.infer'd from it.

export type Id = string;                       // /^[A-Za-z0-9_.:-]{1,64}$/, unique across the WHOLE document
export type Meta = Record<string, unknown>;    // free-form; round-tripped untouched

export type PaletteColor =
  | "ink" | "paper" | "red" | "orange" | "yellow" | "green"
  | "teal" | "blue" | "violet" | "pink" | "gray";
export type Color = PaletteColor | `#${string}`; // palette names adapt to light/dark; hex is used literally

export interface Point { x: number; y: number }
export interface Size  { width: number; height: number }

export interface Style {
  stroke?: Color;
  fill?: Color;
  fillStyle?: "none" | "hachure" | "solid" | "zigzag" | "cross-hatch" | "dots";
  strokeWidth?: number;   // default 1.5
  roughness?: number;     // 0 = clean, default 1.2, max 3
  dashed?: boolean;
}

export interface Layout {
  direction?: "RIGHT" | "DOWN" | "LEFT" | "UP"; // default "RIGHT"
  spacing?: number;                              // px between layers, default 80
}

export interface LalDocument {
  $schema?: string;
  format: "lal";
  version: 1;
  id: Id;
  title: string;
  theme?: "light" | "dark" | "auto";   // default "auto"
  layout?: Layout;                     // default for plates that don't set their own
  nodes: LalNode[];
  edges: LalEdge[];
  cards?: LalCard[];
  paths?: LalPath[];
  plates?: LalPlate[];                 // omitted => one implicit plate holds everything
  lines?: LalLine[];
  meta?: Meta;
}

export interface LalNode {
  id: Id;
  label: string;
  kind?: "step" | "note";              // default "step"; notes are sticky notes, not connectable
  shape?: "rectangle" | "ellipse" | "diamond" | "pill"; // default "rectangle"; ignored for notes
  plate?: Id;                          // required iff the document declares plates
  position?: Point;                    // top-left, relative to its plate's top-left; missing => auto-layout
  size?: Size;                         // missing => measured from label
  style?: Style;
  link?: { plate: Id };                // makes this a portal into another plate
  meta?: Meta;
}

export interface LalEdge {
  id: Id;
  source: Id;                          // node id
  target: Id;                          // node id
  label?: string;
  style?: Style;
  meta?: Meta;
}

export interface LalCardField {
  label: string;
  value: string;
  format?: "markdown" | "plain" | "url"; // default "markdown"
}

export interface LalCard {
  id: Id;
  target: Id;                          // id of a node, edge, line or plate; at most one card per target
  title?: string;                      // default: node label
  fields: LalCardField[];              // ordered
  meta?: Meta;
}

export interface LalPath {
  id: Id;
  name: string;
  nodes: Id[];                         // ordered, >= 2; each consecutive pair must be joined by a source->target edge
  edges?: Id[];                        // optional explicit edges (length nodes-1), only needed if a pair has >1 edge
  color?: Color;
  meta?: Meta;
}

export interface LalPlate {
  id: Id;
  title: string;
  kind?: "overview" | "detail";        // default "detail"; exactly one overview if plates exist
  parent?: Id;                         // breadcrumb parent
  position?: Point;                    // frame top-left on the shared canvas; missing => auto-arranged
  layout?: Layout;
  meta?: Meta;
}

export interface LalLine {
  id: Id;
  name: string;
  nodes: Id[];                         // ordered route, >= 2, need NOT be connected by edges
  color?: Color;
  style?: Style;
  meta?: Meta;
}
```

### JSON Schema (draft 2020-12)

Generated from the zod schema by `npm run schema` and committed at `schema/lal.schema.json` so external tools can validate without our code. Shown here for review:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:sir-lines-a-lot:lal:1",
  "title": "Sir Lines-a-Lot document (.lal), version 1",
  "type": "object",
  "required": ["format", "version", "id", "title", "nodes", "edges"],
  "additionalProperties": false,
  "properties": {
    "$schema": { "type": "string" },
    "format":  { "const": "lal" },
    "version": { "const": 1 },
    "id":      { "$ref": "#/$defs/id" },
    "title":   { "type": "string" },
    "theme":   { "enum": ["light", "dark", "auto"] },
    "layout":  { "$ref": "#/$defs/layout" },
    "nodes":   { "type": "array", "items": { "$ref": "#/$defs/node" } },
    "edges":   { "type": "array", "items": { "$ref": "#/$defs/edge" } },
    "cards":   { "type": "array", "items": { "$ref": "#/$defs/card" } },
    "paths":   { "type": "array", "items": { "$ref": "#/$defs/path" } },
    "plates":  { "type": "array", "items": { "$ref": "#/$defs/plate" } },
    "lines":   { "type": "array", "items": { "$ref": "#/$defs/line" } },
    "meta":    { "$ref": "#/$defs/meta" }
  },
  "$defs": {
    "id":   { "type": "string", "pattern": "^[A-Za-z0-9_.:-]{1,64}$" },
    "meta": { "type": "object" },
    "color": {
      "anyOf": [
        { "enum": ["ink", "paper", "red", "orange", "yellow", "green", "teal", "blue", "violet", "pink", "gray"] },
        { "type": "string", "pattern": "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" }
      ]
    },
    "point": {
      "type": "object", "required": ["x", "y"], "additionalProperties": false,
      "properties": { "x": { "type": "number" }, "y": { "type": "number" } }
    },
    "size": {
      "type": "object", "required": ["width", "height"], "additionalProperties": false,
      "properties": { "width": { "type": "number", "exclusiveMinimum": 0 }, "height": { "type": "number", "exclusiveMinimum": 0 } }
    },
    "style": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "stroke":      { "$ref": "#/$defs/color" },
        "fill":        { "$ref": "#/$defs/color" },
        "fillStyle":   { "enum": ["none", "hachure", "solid", "zigzag", "cross-hatch", "dots"] },
        "strokeWidth": { "type": "number", "minimum": 0 },
        "roughness":   { "type": "number", "minimum": 0, "maximum": 3 },
        "dashed":      { "type": "boolean" }
      }
    },
    "layout": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "direction": { "enum": ["RIGHT", "DOWN", "LEFT", "UP"] },
        "spacing":   { "type": "number", "minimum": 0 }
      }
    },
    "node": {
      "type": "object", "required": ["id", "label"], "additionalProperties": false,
      "properties": {
        "id":       { "$ref": "#/$defs/id" },
        "label":    { "type": "string" },
        "kind":     { "enum": ["step", "note"] },
        "shape":    { "enum": ["rectangle", "ellipse", "diamond", "pill"] },
        "plate":    { "$ref": "#/$defs/id" },
        "position": { "$ref": "#/$defs/point" },
        "size":     { "$ref": "#/$defs/size" },
        "style":    { "$ref": "#/$defs/style" },
        "link": {
          "type": "object", "required": ["plate"], "additionalProperties": false,
          "properties": { "plate": { "$ref": "#/$defs/id" } }
        },
        "meta": { "$ref": "#/$defs/meta" }
      }
    },
    "edge": {
      "type": "object", "required": ["id", "source", "target"], "additionalProperties": false,
      "properties": {
        "id":     { "$ref": "#/$defs/id" },
        "source": { "$ref": "#/$defs/id" },
        "target": { "$ref": "#/$defs/id" },
        "label":  { "type": "string" },
        "style":  { "$ref": "#/$defs/style" },
        "meta":   { "$ref": "#/$defs/meta" }
      }
    },
    "cardField": {
      "type": "object", "required": ["label", "value"], "additionalProperties": false,
      "properties": {
        "label":  { "type": "string" },
        "value":  { "type": "string" },
        "format": { "enum": ["markdown", "plain", "url"] }
      }
    },
    "card": {
      "type": "object", "required": ["id", "target", "fields"], "additionalProperties": false,
      "properties": {
        "id":     { "$ref": "#/$defs/id" },
        "target": { "$ref": "#/$defs/id" },
        "title":  { "type": "string" },
        "fields": { "type": "array", "items": { "$ref": "#/$defs/cardField" } },
        "meta":   { "$ref": "#/$defs/meta" }
      }
    },
    "path": {
      "type": "object", "required": ["id", "name", "nodes"], "additionalProperties": false,
      "properties": {
        "id":    { "$ref": "#/$defs/id" },
        "name":  { "type": "string" },
        "nodes": { "type": "array", "items": { "$ref": "#/$defs/id" }, "minItems": 2 },
        "edges": { "type": "array", "items": { "$ref": "#/$defs/id" }, "minItems": 1 },
        "color": { "$ref": "#/$defs/color" },
        "meta":  { "$ref": "#/$defs/meta" }
      }
    },
    "plate": {
      "type": "object", "required": ["id", "title"], "additionalProperties": false,
      "properties": {
        "id":     { "$ref": "#/$defs/id" },
        "title":  { "type": "string" },
        "kind":   { "enum": ["overview", "detail"] },
        "parent":   { "$ref": "#/$defs/id" },
        "position": { "$ref": "#/$defs/point" },
        "layout":   { "$ref": "#/$defs/layout" },
        "meta":   { "$ref": "#/$defs/meta" }
      }
    },
    "line": {
      "type": "object", "required": ["id", "name", "nodes"], "additionalProperties": false,
      "properties": {
        "id":    { "$ref": "#/$defs/id" },
        "name":  { "type": "string" },
        "nodes": { "type": "array", "items": { "$ref": "#/$defs/id" }, "minItems": 2 },
        "color": { "$ref": "#/$defs/color" },
        "style": { "$ref": "#/$defs/style" },
        "meta":  { "$ref": "#/$defs/meta" }
      }
    }
  }
}
```

### Semantic rules (checked by `validateDoc()`, not expressible in JSON Schema)

1. Ids are unique across the whole document (all element types share one namespace).
2. Every reference resolves: `edge.source/target`, `card.target` (must be a node, edge, line or plate), `path.nodes/edges`, `line.nodes`, `node.plate`, `node.link.plate`, `plate.parent`.
3. If `plates` is present: every node has a `plate`, exactly one plate is `kind: "overview"`, `parent` chains are acyclic, and `node.link.plate` differs from the node's own plate.
4. Edges, paths and lines stay within a single plate.
5. Path: each consecutive node pair is joined by exactly one `source -> target` edge, or `edges[]` is given (length `nodes.length - 1`) and each listed edge joins its pair.
6. At most one card per target.
7. `kind: "note"` nodes cannot appear in edges, paths or lines.

Errors are reported as `{ path: "paths[2].nodes[3]", message }` so generators get actionable output. Unknown `version` => refuse with a clear message; older version => migrate.

### Defaults (applied on load, never written back unless the user changes them)

| Field | Default |
|---|---|
| `node.kind` / `node.shape` | `"step"` / `"rectangle"` |
| `node.size` | label measured with the app font (canvas `measureText` after `document.fonts.ready`), min 120×56, diamonds +40% |
| `node.position` | dagre layered layout for that plate, using `plate.layout ?? doc.layout` |
| `plate.position` | plates without one are placed left to right after laying out their contents: overview first, then detail plates in document order, 160px gap |
| `style.roughness` / `strokeWidth` | `1.2` / `1.5` |
| colours | `stroke: "ink"`, `fill: "none"`; path/line colours cycle through the palette |
| `card.title` | node label |

Saving writes back exactly what the user/document set, plus any positions the layout produced (so a generated doc becomes stable after the first save).

### Fixture

[`samples/request-flows.lal`](samples/request-flows.lal) is a purchase request workflow with three paths that merge into one shared stage:

- **Approval flow**: submit -> route -> manager review -> finance sign-off -> **fulfilment** -> closed
- **Self-approval flow**: submit -> route -> policy check -> self-approve -> **fulfilment** -> closed
- **Direct flow**: submit -> route -> **fulfilment** -> closed (with explicit `edges[]`)

It also covers: cards with markdown/plain/url fields on nodes, an edge, a shared line and a plate; a sticky note; a dashed edge; two shared lines (Audit trail, Notifications); and an overview plate whose Fulfilment portal links into a detail plate that has **no positions** (exercises dagre auto-layout and plate auto-arrangement) and its own path.

---

## 2. Architecture

### Data flow

```
 .lal file ──parse+validate+migrate──▶ LalDocument (zustand, source of truth)
                                          │
              ┌───────────────────────────┼─────────────────────────────┐
              ▼                           ▼                             ▼
   adapter: docToFlow(doc)          export fns (pure)           serialize ──▶ .lal
   ─▶ React Flow nodes/edges        docToSvg / docToExcalidraw
      (plates = group nodes)        (.excalidraw import ──▶ excalidrawToDoc ──▶ validate)
              │                           │
              ▼                           ▼
   <ReactFlow> with custom           SVG ─▶ PNG (canvas)
   nodes/edges (rough.js)
              │
   user events (drag, connect, edit) ──▶ store actions mutate LalDocument
```

One source of truth: the `LalDocument` in the store. React Flow nodes/edges are *derived* (memoised selector), and React Flow change events are translated back into document mutations. No second copy of the graph to keep in sync.

### Store (zustand, one file, three slices)

- `doc`: `LalDocument`, `dirty`, `fileHandle`; actions (`moveNodes`, `renameNode`, `addEdge`, `reconnectEdge`, `upsertCard`, `setPath`, ...). Undo/redo = snapshot stack of the doc, capped at 100. (ponytail: snapshots are fine at this doc size; switch to patches if docs get huge.)
- `ui`: `mode` (`view|edit|play`), `selection`, `openCardTarget`, `plateTrail` (breadcrumbs of plates flown into), `highlightLineId`, `theme`.
- `play`: `pathId`, `status` (`idle|playing|paused|done`), `speed`, `loop`, `stepIndex`.

### Folder structure

```
sir-lines-a-lot/
├─ schema/lal.schema.json        # generated from zod, committed
├─ samples/request-flows.lal     # fixture
├─ scripts/gen-schema.ts         # zod -> JSON Schema
├─ src/
│  ├─ main.tsx, App.tsx
│  ├─ model/
│  │  ├─ schema.ts               # zod schema, exported types
│  │  ├─ validate.ts             # semantic rules (section 1)
│  │  ├─ resolve.ts              # path -> edge list, defaults, plate membership
│  │  └─ model.test.ts           # validate/resolve against the fixture + broken variants
│  ├─ store.ts                   # zustand slices
│  ├─ canvas/
│  │  ├─ Canvas.tsx              # one <ReactFlow> for the whole doc, mode-dependent props
│  │  ├─ PlateFrame.tsx          # plate group node: rough frame + title
│  │  ├─ adapter.ts              # docToFlow()
│  │  ├─ rough.ts                # generator, seedFromId(), shape -> SVG path data
│  │  ├─ SketchNode.tsx          # step + note + portal variants
│  │  ├─ SketchEdge.tsx          # floating rough edge + label + arrowhead
│  │  ├─ LineEdge.tsx            # shared-line segment
│  │  └─ play.ts / Token.tsx     # playback controller + token
│  ├─ panels/
│  │  ├─ Toolbar.tsx             # mode switch, file menu, theme
│  │  ├─ CardPanel.tsx           # view + edit card
│  │  ├─ PlayBar.tsx             # path picker + transport
│  │  └─ Breadcrumbs.tsx         # plate trail
│  ├─ io/
│  │  ├─ lal.ts                  # parse / serialize / migrate
│  │  ├─ files.ts                # File System Access + fallback
│  │  ├─ layout.ts               # dagre per plate + plate arrangement
│  │  ├─ export.ts               # svg, png
│  │  └─ excalidraw.ts           # .excalidraw import + export
│  └─ theme.css                  # palette tokens, light/dark, font-face
└─ THIRD_PARTY_LICENSES.md
```

Files get split only when one grows past ~300 lines.

---

## 3. Rendering: rough.js inside React Flow

### Nodes

- Each custom node renders an absolutely positioned `<svg>` sized to the node, plus an HTML label on top (so text wraps, is selectable and accessible).
- Shapes come from `rough.generator()` (no DOM, no canvas): `rectangle`, `ellipse`, `polygon` (diamond), `path` (pill = rounded-rect path data). `generator.toPaths(drawable)` returns `{ d, stroke, fill, strokeWidth }[]`, which we render as plain React `<path>` elements. No imperative DOM, works with React reconciliation and SSR-free export.
- **Stable jitter:** `seed = seedFromId(node.id)` (32-bit string hash). Same id => same wobble across re-renders, reloads and exports. Changing size regenerates the shape but keeps its "handwriting".
- **Memoised** on `(shape, width, height, style, seed)`. Drag only changes the node's transform, so dragging a node never regenerates its rough shape.
- **Theme without regeneration:** we discard the colours rough returns and set `stroke="var(--c-ink)"` / `fill="var(--c-yellow)"` etc. Switching light/dark is a CSS variable flip, zero regeneration.
- Hit area: a transparent rect behind the strokes so taps on hachure gaps still hit the node.
- Portal nodes (with `link`) get a small "enter plate" glyph and a doubled outline.

### Edges

- **Floating edges**: endpoints are computed against the nodes' outlines (React Flow's floating-edge pattern with `useInternalNode`), so we don't need visible handles in View/Play mode. Edit mode shows handles for connecting and uses `onReconnect` + `reconnectEdge` for dragging edge ends.
- Clean geometry first: `getBezierPath()` gives a smooth path `d`. Then `generator.path(d, { seed: seedFromId(edge.id), roughness })` gives the sketchy version. Arrowhead = two rough strokes along the end tangent.
- We render **both**: the rough strokes (visible) and the clean `d` as an invisible `<path>` (used for hit-testing via `interactionWidth`, and for animation in Play mode).
- During a drag, connected edges regenerate every frame. Cheap for small docs; if it shows up in profiling, drop roughness to 0 while dragging and restore on drop. (ponytail: measured ceiling first, then optimise.)
- Labels via `EdgeLabelRenderer` (HTML, hand-drawn font, paper-coloured backing).

### Shared lines

- The adapter turns each `LalLine` into synthetic edges (`type: "line"`, one per consecutive node pair, not persisted as edges) with `zIndex: -1`, so they draw *under* nodes, like nerves under muscle.
- Thick, translucent, line colour, gentle curve through node centres, low roughness.
- Hover/tap a line (or pick it from a legend) sets `highlightLineId`; a selector derives the touched-node set; touched nodes get a coloured halo, everything else dims.
- ponytail: per-pair segments, so a line isn't one continuous spline. Good enough visually; upgrade to a single layer with a Catmull-Rom spline if the joins look wrong.

### Play mode: path animation

1. `resolvePath(doc, pathId)` -> ordered `edgeIds` (validated on load, so it can't fail at play time).
2. Every `SketchEdge` registers its invisible clean `<path>` element in a module-level `Map<edgeId, SVGPathElement>` via a ref callback. Not in React state, so no re-renders.
3. The controller uses Motion's `animate()` on a motion value from 0 to the edge's `getTotalLength()`, per edge, with `onUpdate` -> `getPointAtLength(t)` -> sets the token's `transform` directly on a ref. Zero React renders per frame.
4. Between edges: a dwell (default 600 ms) where the arrival node pulses (scale 1 -> 1.06 -> 1) and optionally auto-opens its card.
5. The traversed part of each edge is "inked in" with the path colour using `stroke-dasharray` / `stroke-dashoffset` on a copy of the clean path.
6. **Fading:** a selector computes `activeIds` (path nodes + edges). Everything else gets `opacity: 0.15` via a class, with a CSS transition.
7. The token lives in `<ViewportPortal>` so it sits in flow coordinates and pans/zooms with the canvas. It is a small rough-drawn shield.
8. Transport: play / pause / step forward / step back / speed (0.5x to 2x) / loop. `prefers-reduced-motion`: no travel, the token jumps node to node and each step highlights.

### Plates and camera fly-to

- All plates live on **one infinite canvas**. Each plate is a React Flow group node (`PlateFrame`: rough-drawn frame + hand-lettered title); its nodes are children via `parentId`, so node positions are relative to the plate and moving a plate moves its contents.
- Frame size = bounding box of its children + padding, recomputed when children move.
- Entering a portal: two-stage camera move with `fitBounds`. First zoom out to fit both plates (`duration: 300`), then into the target plate's frame (`duration: 500`), so you see where you're going. Push onto `plateTrail`; breadcrumbs (`Request lifecycle / Fulfilment detail`) fly back.
- Plates not in focus stay visible but get dimmed slightly, so the overview isn't drowned out by detail.
- Edit mode: dropping a node onto another plate's frame reparents it (moves it to that plate) and its edges must follow, or the drop is rejected with a toast (rule 4).
- ponytail: React Flow re-renders every plate at once. Fine for tens of plates; if big docs get slow, cull nodes outside the viewport (`onlyRenderVisibleElements`).

### Theme and font

- CSS custom properties for every palette colour, with light and dark values; `theme: "auto"` follows `prefers-color-scheme`. Paper texture background via a subtle CSS noise/dot pattern.
- Font: **Excalifont** (SIL OFL 1.1), self-hosted as an unmodified `.woff2` in `public/fonts/` with its OFL text alongside. Also used as the font in `.excalidraw` exports, so the two look the same.

### Accessibility basics

Nodes are focusable (React Flow), Enter opens the card, Esc closes it, the card panel is a labelled region with focus moved into it and returned on close. Labels are real text, so screen readers read them. Colour is never the only signal for path/line membership (halo + dimming + legend).

### Security

Documents can come from external generators, so card content is untrusted: Markdown rendered with `react-markdown` and **no raw HTML**; links restricted to `http(s):` and `mailto:` and opened with `rel="noopener noreferrer"`. `url` fields go through the same check.

---

## 4. Milestones

Each milestone ends with a demo against the fixture and a passing `npm test` / `npm run build`.

### (a) Schema + sample doc
- Vite + React + TS scaffold, Vitest, ESLint/Prettier defaults.
- `model/schema.ts` (zod), `validate.ts`, `resolve.ts`, `scripts/gen-schema.ts` -> `schema/lal.schema.json`.
- Tests: fixture validates; one broken variant per semantic rule fails with the right error path; generated JSON Schema validates the fixture.
- **Done when:** an external tool can validate a `.lal` file with the committed JSON Schema alone.

### (b) Read-only viewer with tappable cards
- Canvas, rough nodes/edges, labels, theme toggle, font.
- Load `.lal` (open file / drag-drop / bundled sample). Auto-layout via dagre for nodes missing positions.
- View mode: tap a node, edge, line or plate title -> `CardPanel` slides in (Motion), Markdown fields, Esc to close. Bottom sheet below 640px.
- Shared lines rendered under nodes, with legend + highlight.
- All plates rendered as frames on the canvas (portals visible but inert until (e)).
- **Done when:** the fixture renders, every card opens, both lines highlight, works on a phone.

### (c) Editor
- Edit mode: drag, inline rename, add/delete node and edge, connect via handles, reconnect edge ends, shape/colour picker, sticky notes.
- Card editor: add/remove/reorder fields, Markdown textarea with live preview.
- Path editor (pick nodes in order by clicking; validates as you go) and shared-line editor (same interaction).
- Undo/redo (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, plus toolbar buttons).
- **Phone editing:** tool bar docked at the bottom, 44px minimum touch targets, enlarged connection handles, tap-source-then-tap-target to connect (no precise drag needed), long-press for a node/edge context menu (rename, delete, card, shape), two-finger pan/pinch never starts a drag, card editor opens as a full-height sheet.
- Save/Save As/Open: File System Access API (`showOpenFilePicker`, `showSaveFilePicker`, optional `showDirectoryPicker` for a workspace folder; last handle remembered in IndexedDB). Fallback: `<a download>` and `<input type="file" accept=".lal,application/json">`. Unsaved-changes guard.
- **Done when:** fixture can be edited (on desktop and on a phone), saved, reloaded, and diffed back to equivalent JSON.

### (d) Play mode
- Path picker, token, edge inking, dwell + pulse, fading, transport controls, reduced-motion fallback.
- **Done when:** all three fixture paths play end to end, and the shared Fulfilment stage is visibly where they merge.

### (e) Plates and camera fly-to
- Portal fly-to and back, breadcrumbs, focus dimming, per-plate auto-layout + plate auto-arrangement, plate CRUD in Edit mode (create plate, drag plate, reparent nodes by drop, make node a portal).
- **Done when:** tapping Fulfilment flies the camera to the auto-laid-out detail plate, and "Fulfilment steps" plays there.

### (f) Import and exports
- **SVG:** pure `docToSvg(doc, plateId, theme)` using the same rough generator + seeds, so output matches the canvas stroke for stroke. Font embedded as base64 `@font-face` so the file renders anywhere.
- **PNG:** that SVG -> `Image` -> `<canvas>` at 2x -> `toBlob`. (The embedded font matters here: SVGs drawn into a canvas can't fetch external fonts.)
- **`.excalidraw`:** hand-written mapper, no Excalidraw package needed. Nodes -> `rectangle`/`ellipse`/`diamond` + bound `text` elements (pill -> rectangle with `roundness`), edges -> `arrow` with `startBinding`/`endBinding`, shared lines -> `line` elements, plates -> `frame` elements laid out side by side, our seeds reused as element `seed`. Cards, paths and `meta` go into each element's `customData` so nothing is lost.
- **`.excalidraw` import:** the reverse mapper. If elements carry our `customData`, restore the `.lal` exactly (round-trip). Otherwise, best effort: `rectangle`/`ellipse`/`diamond` (+ bound text) -> nodes, arrows bound at both ends -> edges, `frame` -> plates (children by `frameId`), free-standing text -> notes. Unbound arrows, freedraw, images and embeds are dropped, and the import reports what was skipped. The result goes through the same `validateDoc()` as any `.lal`, and the file is treated as untrusted input.
- **Done when:** the exported `.excalidraw` opens cleanly in excalidraw.com, re-importing it gives back an equivalent `.lal`, a hand-made excalidraw.com drawing imports with a clear skipped-elements report, the SVG opens in a browser, and the PNG is crisp at 2x.

---

## 5. Licensing

| Dependency | License | Notes |
|---|---|---|
| react, react-dom | MIT | |
| vite, @vitejs/plugin-react | MIT | dev |
| typescript | Apache-2.0 | dev |
| @xyflow/react (React Flow) | MIT | Keep the attribution badge on by default; we don't use any React Flow Pro examples or code. |
| roughjs | MIT | |
| motion (formerly framer-motion) | MIT | Framer Motion is now published as `motion`; same library, import from `motion/react`. |
| zustand | MIT | |
| @dagrejs/dagre | MIT | auto-layout (chosen over elkjs, which is EPL-2.0, to keep the runtime all-permissive) |
| zod | MIT | schema source of truth |
| react-markdown | MIT | card rendering |
| Excalifont (font file) | **OFL-1.1** | Bundled unmodified with its OFL text and copyright notice. OFL allows bundling; the font can't be sold on its own, and a modified version must be renamed. |
| vitest | MIT | dev |

Rules:

- Every runtime dependency gets an entry in `THIRD_PARTY_LICENSES.md` (name, version, license, copyright line, full license text) in the same PR that adds it. A `licenses` script (`npx license-checker-rseidelsohn --production --summary`) is run before each release to catch drift.
- **No tldraw**, anywhere, not even transitively.
- **No `@excalidraw/*` packages** are needed: `.excalidraw` import and export are our own mappers over the public JSON format. If we ever do take one, it is MIT and gets listed like any other. The Excalifont file is taken from the excalidraw repo's font assets, not via an npm package.
- **Branding:** never use the Excalidraw name or logo in our name, logo, tagline, marketing or UI chrome. The only mentions are factual file-format labels in the file menu ("Import .excalidraw", "Export as .excalidraw") and the font credit in `THIRD_PARTY_LICENSES.md`. Using Excalifont is fine under OFL; we don't present the app as affiliated with Excalidraw.

---

## 6. Decisions (answered 2026-10-09)

| # | Question | Decision |
|---|---|---|
| 1 | Font | **Excalifont** (OFL-1.1), bundled unmodified |
| 2 | Auto-layout library | **dagre** (`@dagrejs/dagre`, MIT), replacing elk.js from the original stack |
| 3 | Card rich text | **Markdown** fields, textarea + live preview |
| 4 | Plates | **One infinite canvas**, plates as frames, camera fly-to |
| 5 | Paths across plates | **No**: paths stay within one plate |
| 6 | Cards beyond nodes | **Yes**: nodes, edges, shared lines and plates (`card.target`) |
| 7 | Play token | **Rough-drawn shield** |
| 8 | `.excalidraw` import | **Import and export** |
| 9 | Hosting | **Local only** for now; no PWA |
| 10 | Package manager | **npm** |
| 11 | Mobile editing | **Full editing on phones** |
