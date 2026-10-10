import type { Drawable } from 'roughjs/bin/core'
import { pathSpecs } from './rough.ts'

export function RoughPaths({ drawables, colors, dashed }: { drawables: Drawable[]; colors: Record<string, string>; dashed?: boolean }) {
  return pathSpecs(drawables, colors, dashed).map((p, i) => (
    <path
      key={i}
      d={p.d}
      stroke={p.stroke}
      strokeWidth={p.strokeWidth}
      fill={p.fill ?? 'none'}
      fillOpacity={p.fillOpacity}
      strokeDasharray={p.dash}
    />
  ))
}
