import { create } from 'zustand'
import { readLal } from './io/lal.ts'
import { LABEL_FONT, layoutDoc } from './io/layout.ts'
import type { LalDocument } from './model/schema.ts'
import { validateDoc, type Issue } from './model/validate.ts'

export type Theme = 'light' | 'dark' | 'auto'
export type Mode = 'view' | 'edit'

const HISTORY_LIMIT = 100

export interface EditOptions {
  // Consecutive edits with the same key collapse into one undo step (e.g. one drag).
  coalesce?: string
}

interface State {
  doc: LalDocument | null
  loadCount: number // bumps on every load so the canvas remounts and refits
  issues: Issue[]
  issuesTitle: string
  openCardTarget: string | null
  highlightLineId: string | null
  theme: Theme
  mode: Mode

  // Editing. ponytail: whole-document snapshots; switch to patches if docs get huge.
  past: LalDocument[]
  future: LalDocument[]
  lastCoalesce: string | null
  dirty: boolean

  // Where the document came from, for Save (File System Access handle when available).
  fileName: string | null
  fileHandle: FileSystemFileHandle | null

  // While set, tapping a node calls this instead of its normal action (path/line editors pick nodes this way).
  picker: ((nodeId: string) => void) | null
  // The route being picked, so the canvas can number its stops (color is a CSS colour).
  routeMarks: { nodes: string[]; color: string } | null

  loadText: (text: string, source?: { fileName?: string; fileHandle?: FileSystemFileHandle }) => Promise<void>
  openCard: (target: string) => void
  closeCard: () => void
  toggleLine: (lineId: string) => void
  setTheme: (theme: Theme) => void
  clearIssues: () => void
  setMode: (mode: Mode) => void
  edit: (recipe: (draft: LalDocument) => void, opts?: EditOptions) => boolean
  undo: () => void
  redo: () => void
  markSaved: (source?: { fileName?: string; fileHandle?: FileSystemFileHandle | null }) => void
  setPicker: (picker: ((nodeId: string) => void) | null) => void
  setRouteMarks: (marks: State['routeMarks']) => void
}

export const useStore = create<State>()((set, get) => ({
  doc: null,
  loadCount: 0,
  issues: [],
  issuesTitle: '',
  openCardTarget: null,
  highlightLineId: null,
  theme: 'auto',
  mode: 'view',
  past: [],
  future: [],
  lastCoalesce: null,
  dirty: false,
  fileName: null,
  fileHandle: null,
  picker: null,
  routeMarks: null,

  async loadText(text, source) {
    const { doc, issues } = readLal(text)
    if (!doc) return set({ issues, issuesTitle: "Couldn't open that file" }) // keep the current document on a bad load
    try {
      await document.fonts.load(LABEL_FONT) // sizes are measured in this font
    } catch {
      // measure with the fallback font rather than refuse to open
    }
    set((s) => ({
      doc: layoutDoc(doc),
      issues: [],
      loadCount: s.loadCount + 1,
      openCardTarget: null,
      highlightLineId: null,
      theme: doc.theme ?? 'auto',
      past: [],
      future: [],
      lastCoalesce: null,
      dirty: false,
      fileName: source?.fileName ?? null,
      fileHandle: source?.fileHandle ?? null,
      picker: null,
      routeMarks: null,
    }))
  },

  openCard: (target) =>
    set((s) =>
      // Edit mode opens the card editor even when there's no card yet.
      s.mode === 'edit' || s.doc?.cards?.some((c) => c.target === target) ? { openCardTarget: target } : {},
    ),
  closeCard: () => set({ openCardTarget: null }),
  toggleLine: (lineId) => set((s) => ({ highlightLineId: s.highlightLineId === lineId ? null : lineId })),
  setTheme: (theme) => set({ theme }),
  clearIssues: () => set({ issues: [] }),
  setMode: (mode) => set({ mode, picker: null, routeMarks: null, lastCoalesce: null }),

  // The only way to change the document. Applies `recipe` to a copy, refuses the
  // change if the result breaks a rule (so the doc is always valid), and records undo.
  edit(recipe, opts) {
    const { doc, past, lastCoalesce } = get()
    if (!doc) return false
    const draft = structuredClone(doc)
    recipe(draft)
    const issues = validateDoc(draft)
    if (issues.length) {
      set({ issues, issuesTitle: "That change would break the diagram, so it wasn't made" })
      return false
    }
    const merge = !!opts?.coalesce && opts.coalesce === lastCoalesce
    set({
      doc: draft,
      past: merge ? past : [...past, doc].slice(-HISTORY_LIMIT),
      future: [],
      lastCoalesce: opts?.coalesce ?? null,
      dirty: true,
    })
    return true
  },
  undo: () =>
    set((s) => {
      const prev = s.past.at(-1)
      return prev && s.doc ? { doc: prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future], lastCoalesce: null, dirty: true } : {}
    }),
  redo: () =>
    set((s) => {
      const [next, ...rest] = s.future
      return next && s.doc ? { doc: next, past: [...s.past, s.doc], future: rest, lastCoalesce: null, dirty: true } : {}
    }),
  markSaved: (source) =>
    set((s) => ({
      dirty: false,
      fileName: source?.fileName ?? s.fileName,
      fileHandle: source?.fileHandle === undefined ? s.fileHandle : source.fileHandle,
    })),
  setPicker: (picker) => set({ picker }),
  setRouteMarks: (routeMarks) => set({ routeMarks }),
}))
