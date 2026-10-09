// rough.js without the DOM: the generator returns path data that we render as
// React <path>s. Colours are passed to rough as one-letter markers and swapped
// for CSS variables at render time, so a theme switch never regenerates shapes.
import rough from 'roughjs'
import type { Drawable, Options } from 'roughjs/bin/core'
import type { Style } from '../model/schema.ts'

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
