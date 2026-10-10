// rough.js without the DOM: the generator returns path data that we render as
// React <path>s. Colours are passed to rough as one-letter markers and swapped
// for CSS variables at render time, so a theme switch never regenerates shapes.
import rough from 'roughjs'
import type { Drawable, Options } from 'roughjs/bin/core'
import type { LalNode, LalPlate, Style } from '../model/schema.ts'

export const gen = rough.generator()

// Stable 32-bit FNV-1a hash, so a shape wobbles the same way on every render,
// reload and export. rough treats seed 0 as "random", hence the +1.
export function seedFromId(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return ((h >>> 0) % 0x7fffffff) + 1
}

export const colorVar = (c: string | undefined, fallback: string) =>
  !c ? fallback : c.startsWith('#') ? c : `var(--c-${c})`

// S = stroke, F = fill, P = paper backing.
export function roughOptions(style: Style | undefined, seed: number, extra: Options = {}): Options {
  const fillStyle = style?.fillStyle ?? (style?.fill ? 'hachure' : 'none')
  return {
    seed,
    stroke: 'S',
    strokeWidth: style?.strokeWidth ?? 1.5,
    roughness: style?.roughness ?? 1.2,
    ...(fillStyle !== 'none' && { fill: 'F', fillStyle, hachureGap: 6, fillWeight: 1 }),
    ...extra,
  }
}

export type Shape = 'rectangle' | 'ellipse' | 'diamond' | 'pill'

export function shapeDrawable(shape: Shape, w: number, h: number, opts: Options): Drawable {
  const p = 3 // inset so strokes aren't clipped by the svg box
  switch (shape) {
    case 'ellipse':
      return gen.ellipse(w / 2, h / 2, w - 2 * p, h - 2 * p, opts)
    case 'diamond':
      return gen.polygon([[w / 2, p], [w - p, h / 2], [w / 2, h - p], [p, h / 2]], opts)
    case 'pill': {
      const r = (h - 2 * p) / 2
      return gen.path(`M${p + r},${p} H${w - p - r} A${r},${r} 0 0 1 ${w - p - r},${h - p} H${p + r} A${r},${r} 0 0 1 ${p + r},${p} Z`, opts)
    }
    default:
      return gen.rectangle(p, p, w - 2 * p, h - 2 * p, opts)
  }
}

// Everything below is shared by the canvas components and the exporters (src/io/export.ts),
// so an exported drawing matches the canvas stroke for stroke.

export function nodeStyle(node: LalNode): Style | undefined {
  return node.kind === 'note' ? { fill: 'yellow', fillStyle: 'solid', roughness: 1.6, ...node.style } : node.style
}

export const nodeShape = (node: LalNode): Shape => (node.kind === 'note' ? 'rectangle' : (node.shape ?? 'rectangle'))

// Paper backing, outline, and a second outline for portals.
export function nodeDrawables(node: LalNode, w: number, h: number): Drawable[] {
  const seed = seedFromId(node.id)
  const shape = nodeShape(node)
  const style = nodeStyle(node)
  const backing = shapeDrawable(shape, w, h, { seed, roughness: 0, stroke: 'none', fill: 'P', fillStyle: 'solid' })
  const outline = shapeDrawable(shape, w, h, roughOptions(style, seed))
  const portal = node.link && shapeDrawable(shape, w, h, roughOptions(style, seed + 1, { fill: undefined }))
  return portal ? [backing, outline, portal] : [backing, outline]
}

export function nodeColors(node: LalNode): Record<string, string> {
  const style = nodeStyle(node)
  return { S: colorVar(style?.stroke, 'var(--c-ink)'), F: colorVar(style?.fill, 'var(--c-ink)'), P: 'var(--c-paper)' }
}

// "Enter plate" mark: a small square with an arrow into it, at (x, y) inside the node.
export function portalGlyph(x: number, y: number): Drawable[] {
  const o = { seed: 7, roughness: 0.8, stroke: 'S', strokeWidth: 1.2 }
  return [gen.rectangle(x, y, 14, 12, o), gen.line(x - 6, y - 6, x + 6, y + 5, o), gen.line(x + 6, y + 5, x + 6, y, o)]
}

export const plateDrawables = (plate: LalPlate, w: number, h: number): Drawable[] => [
  gen.rectangle(4, 4, w - 8, h - 8, { seed: seedFromId(plate.id), roughness: 1.4, stroke: 'S', strokeWidth: plate.kind === 'overview' ? 2.2 : 1.4 }),
]

// One shared-line segment, centre to centre.
export const lineSegment = (id: string, a: { x: number; y: number }, b: { x: number; y: number }): Drawable =>
  gen.line(a.x, a.y, b.x, b.y, { seed: seedFromId(id), roughness: 0.8, stroke: 'S', strokeWidth: 7, disableMultiStroke: true })

// toPaths() drops rough's dash option, so dashes are applied by the renderers, to outline strokes only.
export interface PathSpec { d: string; stroke: string; strokeWidth: number; fill?: string; fillOpacity?: number; dash?: string }
export function pathSpecs(drawables: Drawable[], colors: Record<string, string>, dashed?: boolean): PathSpec[] {
  return drawables
    .flatMap((d) => gen.toPaths(d))
    .map((p) => ({
      d: p.d,
      stroke: colors[p.stroke] ?? p.stroke,
      strokeWidth: p.strokeWidth,
      fill: p.fill ? (colors[p.fill] ?? p.fill) : undefined,
      fillOpacity: p.fill === 'F' ? 0.35 : undefined,
      dash: dashed && p.stroke === 'S' ? '8 6' : undefined,
    }))
}
