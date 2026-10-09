import { create } from 'zustand'
import { readLal } from './io/lal.ts'
import { LABEL_FONT, layoutDoc } from './io/layout.ts'
import type { LalDocument } from './model/schema.ts'
import type { Issue } from './model/validate.ts'

export type Theme = 'light' | 'dark' | 'auto'

interface State {
  doc: LalDocument | null
  loadCount: number // bumps on every load so the canvas remounts and refits
  issues: Issue[]
  openCardTarget: string | null
  highlightLineId: string | null
  theme: Theme
  loadText: (text: string) => Promise<void>
  openCard: (target: string) => void
  closeCard: () => void
  toggleLine: (lineId: string) => void
  setTheme: (theme: Theme) => void
  clearIssues: () => void
}

export const useStore = create<State>()((set) => ({
  doc: null,
  loadCount: 0,
  issues: [],
  openCardTarget: null,
  highlightLineId: null,
  theme: 'auto',

  async loadText(text) {
    const { doc, issues } = readLal(text)
    if (!doc) return set({ issues }) // keep the current document on a bad load
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
    }))
  },

  openCard: (target) =>
    set((s) => (s.doc?.cards?.some((c) => c.target === target) ? { openCardTarget: target } : {})),
  closeCard: () => set({ openCardTarget: null }),
  toggleLine: (lineId) => set((s) => ({ highlightLineId: s.highlightLineId === lineId ? null : lineId })),
  setTheme: (theme) => set({ theme }),
  clearIssues: () => set({ issues: [] }),
}))
