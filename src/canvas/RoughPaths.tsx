import type { Drawable } from 'roughjs/bin/core'
import { gen } from './rough.ts'

// toPaths() drops rough's dash option, so dashes are applied here, to outline strokes only.
export function RoughPaths({ drawables, colors, dashed }: { drawables: Drawable[]; colors: Record<string, string>; dashed?: boolean }) {
  return drawables
    .flatMap((d) => gen.toPaths(d))
    .map((p, i) => (
      <path
        key={i}
        d={p.d}
        stroke={colors[p.stroke] ?? p.stroke}
        strokeWidth={p.strokeWidth}
        fill={p.fill ? (colors[p.fill] ?? p.fill) : 'none'}
        fillOpacity={p.fill === 'F' ? 0.35 : undefined}
        strokeDasharray={dashed && p.stroke === 'S' ? '8 6' : undefined}
      />
    ))
}
