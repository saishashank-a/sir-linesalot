// Open / Save / Save As via the File System Access API. Browsers without it
// (Firefox, Safari) get <input type=file> to open and <a download> to save.
// Open also takes .excalidraw files, converted on the way in; exports always download.
import { focusedPlate } from '../canvas/camera.ts'
import { useStore } from '../store.ts'
import { docToExcalidraw, excalidrawToDoc } from './excalidraw.ts'
import { docToSvg, excalifontDataUrl, svgToPng, themeColors } from './export.ts'
import { lalFromHash, lalFromShare, serializeLal } from './lal.ts'

// Only the picker functions are missing from TS's DOM lib; handles and writables are typed.
type PickerType = { description: string; accept: Record<string, string[]> }
interface FsaWindow {
  showOpenFilePicker?: (o: { types: PickerType[] }) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker?: (o: { types: PickerType[]; suggestedName: string }) => Promise<FileSystemFileHandle>
}
// Chromium only, on drop items.
type DropHandleItem = { getAsFileSystemHandle?: () => Promise<FileSystemHandle | null> }
const fsa = () => window as unknown as FsaWindow
const LAL_TYPES: PickerType[] = [{ description: 'Sir Linesalot document', accept: { 'application/json': ['.lal'] } }]
const OPEN_TYPES: PickerType[] = [{ description: 'Sir Linesalot or Excalidraw', accept: { 'application/json': ['.lal', '.excalidraw'] } }]

export function slug(title: string): string {
  const s = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return s.slice(0, 60) || 'untitled'
}

export const suggestedName = (fileName: string | null, title: string) => fileName ?? `${slug(title)}.lal`

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError' // user closed the picker

function report(title: string, e: unknown) {
  useStore.setState({ issues: [{ path: '', message: e instanceof Error ? e.message : String(e) }], issuesTitle: title })
}

// True when nothing is unsaved, or the user agrees to throw it away.
export function confirmDiscard(): boolean {
  return !useStore.getState().dirty || window.confirm('You have unsaved changes. Discard them?')
}

export async function openFile(fallbackInput: HTMLInputElement | null) {
  if (!confirmDiscard()) return
  const pick = fsa().showOpenFilePicker
  if (!pick) return fallbackInput?.click() // its change handler calls openFromFile
  try {
    const [fileHandle] = await pick({ types: OPEN_TYPES })
    const file = await fileHandle.getFile()
    await load(await file.text(), file.name, fileHandle)
  } catch (e) {
    if (!isAbort(e)) report("Couldn't open that file", e)
  }
}

// A plain File (the <input> fallback): no handle, so Save becomes Save as.
export async function openFromFile(file: File) {
  await load(await file.text(), file.name)
}

// .excalidraw files are converted; the result is a new, unsaved .lal (no handle, so
// Save can't overwrite the drawing) and anything that didn't map is listed.
async function load(text: string, fileName: string, fileHandle?: FileSystemFileHandle) {
  const { loadText } = useStore.getState()
  if (!/\.excalidraw$/i.test(fileName) && !/^\s*\{\s*"type"\s*:\s*"excalidraw"/.test(text)) return loadText(text, { fileName, fileHandle })
  const { doc, issues, skipped } = excalidrawToDoc(text)
  if (!doc) return useStore.setState({ issues, issuesTitle: "Couldn't import that Excalidraw file" })
  await loadText(serializeLal(doc), { fileName: fileName.replace(/\.excalidraw$/i, '') + '.lal' })
  useStore.setState({
    dirty: true,
    ...(skipped.length && { issues: skipped.map((message) => ({ path: '', message })), issuesTitle: 'Imported from Excalidraw. Skipped:' }),
  })
}

// Opens the diagram carried in a #lal= link; `fallback` loads when there's none (or it's broken).
export async function openHash(fallback?: string) {
  const { loadText } = useStore.getState()
  try {
    const text = (await lalFromHash(location.hash)) ?? (await lalFromShare(location.hash)) ?? fallback
    if (text) await loadText(text)
  } catch (e) {
    if (fallback) await loadText(fallback)
    useStore.setState({ issues: [{ path: '', message: (e as Error).message }], issuesTitle: "Couldn't open that link" })
  }
}

// Uploads the current diagram and copies a short link. Only ever on an explicit click:
// unlike #lal= links, this sends the diagram to our server.
export async function copyShareLink() {
  const { doc } = useStore.getState()
  if (!doc) return
  try {
    const res = await fetch('/api/share', { method: 'POST', body: serializeLal(doc) })
    if (res.status === 404) throw new Error('Short links only work on sir-linesalot.vercel.app; this copy runs on your machine.')
    if (res.status === 429) throw new Error('Too many short links at once; try again in a minute.')
    const body = await res.json()
    if (!res.ok) throw new Error(body.error ?? `server said ${res.status}`)
    const url = `${location.origin}/#s=${body.id}`
    await navigator.clipboard.writeText(url)
    history.replaceState(null, '', `#s=${body.id}`) // the address bar now shows what was copied
  } catch (e) {
    report("Couldn't make a share link", e)
  }
}

// Drag-drop. Chromium can hand over a writable handle, so Save writes back to the
// dropped file; elsewhere it behaves like openFromFile.
export async function openDropped(dt: DataTransfer) {
  const item = [...dt.items].find((i) => i.kind === 'file') as (DataTransferItem & DropHandleItem) | undefined
  // Must be asked for before anything awaits: the DataTransfer empties once the drop event ends.
  const handle = item?.getAsFileSystemHandle?.().catch(() => null)
  const file = dt.files[0]
  if (!file || !confirmDiscard()) return
  const h = await handle
  const fileHandle = h?.kind === 'file' ? (h as FileSystemFileHandle) : undefined
  await load(await file.text(), file.name, fileHandle)
}

export async function save() {
  const { fileHandle } = useStore.getState()
  if (!fileHandle) return saveAs()
  try {
    await write(fileHandle)
    useStore.getState().markSaved()
  } catch (e) {
    if (!isAbort(e)) report("Couldn't save", e)
  }
}

export async function saveAs() {
  const { doc, fileName } = useStore.getState()
  if (!doc) return
  const name = suggestedName(fileName, doc.title)
  const pick = fsa().showSaveFilePicker
  try {
    if (pick) {
      const fileHandle = await pick({ types: LAL_TYPES, suggestedName: name })
      await write(fileHandle)
      useStore.getState().markSaved({ fileName: fileHandle.name, fileHandle })
    } else {
      download(serializeLal(doc), name)
      useStore.getState().markSaved({ fileName: name, fileHandle: null })
    }
  } catch (e) {
    if (!isAbort(e)) report("Couldn't save", e)
  }
}

async function write(handle: FileSystemFileHandle) {
  const doc = useStore.getState().doc
  if (!doc) return
  const w = await handle.createWritable()
  await w.write(serializeLal(doc))
  await w.close()
}

// Exports cover the plate you're looking at (the whole drawing when there are no plates).
export async function exportAs(kind: 'svg' | 'png' | 'excalidraw') {
  const { doc, focusPlateId } = useStore.getState()
  if (!doc) return
  const base = slug(doc.title)
  try {
    if (kind === 'excalidraw') return download(docToExcalidraw(doc), `${base}.excalidraw`)
    const plate = doc.plates?.length ? focusedPlate(doc, focusPlateId) : undefined
    const svg = docToSvg(doc, plate?.id ?? null, { colors: themeColors(), fontDataUrl: await excalifontDataUrl() })
    const name = plate && plate.kind !== 'overview' ? `${base}-${slug(plate.title)}` : base
    if (kind === 'svg') download(new Blob([svg], { type: 'image/svg+xml' }), `${name}.svg`)
    else download(await svgToPng(svg), `${name}.png`)
  } catch (e) {
    report("Couldn't export", e)
  }
}

function download(data: string | Blob, name: string) {
  const url = URL.createObjectURL(typeof data === 'string' ? new Blob([data], { type: 'application/json' }) : data)
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
