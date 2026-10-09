import { ViewportPortal } from '@xyflow/react'
import { useMemo, type CSSProperties } from 'react'
import { registerToken } from './play.ts'
import { gen } from './rough.ts'
import { RoughPaths } from './RoughPaths.tsx'

// The Play token: a small rough-drawn shield in flow coordinates, so it pans and zooms
// with the canvas. play.ts moves it by writing its transform; React never re-renders it.
export function Token({ color }: { color: string }) {
  const drawables = useMemo(
    () => [gen.path('M -11 -13 L 11 -13 L 11 0 Q 11 10 0 15 Q -11 10 -11 0 Z', { seed: 11, roughness: 1.1, stroke: 'S', strokeWidth: 2, fill: 'F', fillStyle: 'solid' })],
    [],
  )
  return (
    <ViewportPortal>
      <div ref={registerToken} className="play-token" style={{ '--token': color } as CSSProperties} aria-hidden>
        <svg width={32} height={36} viewBox="-16 -17 32 36">
          <RoughPaths drawables={drawables} colors={{ S: 'var(--c-ink)', F: color }} />
        </svg>
      </div>
    </ViewportPortal>
  )
}
