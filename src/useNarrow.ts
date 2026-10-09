import { useSyncExternalStore } from 'react'

// Phone layout: bottom sheets and a docked edit bar. Matches the 640px breakpoint in the CSS.
const narrowQuery = typeof matchMedia === 'undefined' ? null : matchMedia('(max-width: 640px)')

export const useNarrow = () =>
  useSyncExternalStore(
    (cb) => (narrowQuery?.addEventListener('change', cb), () => narrowQuery?.removeEventListener('change', cb)),
    () => !!narrowQuery?.matches,
  )
