import { flyToPlate, focusedPlate } from '../canvas/camera.ts'
import { plateTrail } from '../model/resolve.ts'
import { useStore } from '../store.ts'

// Plate trail, e.g. "Request lifecycle / Fulfilment detail". Earlier crumbs fly back.
export function Breadcrumbs() {
  const doc = useStore((s) => s.doc)
  const focusPlateId = useStore((s) => s.focusPlateId)
  if (!doc || (doc.plates?.length ?? 0) < 2) return null
  const here = focusedPlate(doc, focusPlateId)
  const trail = here ? plateTrail(doc, here.id) : []
  return (
    <nav className="crumbs" aria-label="Plates">
      <ol>
        {trail.map((p, i) => (
          <li key={p.id}>
            {i === trail.length - 1 ? (
              <span aria-current="location">{p.title}</span>
            ) : (
              <button type="button" onClick={() => flyToPlate(p.id)}>{p.title}</button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
