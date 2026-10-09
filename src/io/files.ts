// Open / Save / Save As via the File System Access API. Browsers without it
// (Firefox, Safari) get <input type=file> to open and <a download> to save.
import { useStore } from '../store.ts'
import { serializeLal } from './lal.ts'

// Only the picker functions are missing from TS's DOM lib; handles and writables are typed.
type PickerType = { description: string; accept: Record<string, string[]> }
interface FsaWindow {
  showOpenFilePicker?: (o: { types: PickerType[] }) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker?: (o: { types: PickerType[]; suggestedName: string }) => Promise<FileSystemFileHandle>
}
const fsa = () => window as unknown as FsaWindow
const LAL_TYPES: PickerType[] = [{ description: 'Sir Lines-a-Lot document', accept: { 'application/json': ['.lal'] } }]

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
    const [fileHandle] = await pick({ types: LAL_TYPES })
    const file = await fileHandle.getFile()
    await useStore.getState().loadText(await file.text(), { fileName: file.name, fileHandle })
  } catch (e) {
    if (!isAbort(e)) report("Couldn't open that file", e)
  }
}

// A plain File (input fallback, drag-drop): no handle, so Save becomes Save as.
export async function openFromFile(file: File) {
  await useStore.getState().loadText(await file.text(), { fileName: file.name })
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

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
