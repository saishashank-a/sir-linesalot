// Play mode controller. Runs outside React: Motion drives a 0..1 value along each
// edge and we write the token's transform and the ink's dash offset straight to the
// DOM, so a frame costs no React render. The store only hears about arrivals.
import { animate, type AnimationPlaybackControls } from 'motion'
import { resolvePath } from '../model/resolve.ts'
import { useStore, type PlayState } from '../store.ts'

const PX_PER_SEC = 260 // token travel speed at 1x
const DWELL_S = 0.6 // pause at each node at 1x

const inks = new Map<string, SVGPathElement>() // edge id -> inked copy of its clean path
let token: HTMLElement | null = null
let edgeIds: string[] = []
let anim: AnimationPlaybackControls | null = null
let gen = 0 // bumps whenever the running animation is abandoned, so its onComplete is ignored
let travelling = false // the token is on edge `step`, between nodes step and step+1

const state = () => useStore.getState().play
const setPlay = (patch: Partial<PlayState>) => useStore.getState().setPlay(patch)
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

type Pt = { x: number; y: number }

// Point at fraction t along path edge i.
function pointOn(i: number, t: number): Pt | null {
  const el = inks.get(edgeIds[i])
  return el ? el.getPointAtLength(t * el.getTotalLength()) : null
}

// Where the token waits at node `step`: where it leaves on the next edge, or where it
// arrived on the last one.
const restPoint = (step: number) => (step < edgeIds.length ? pointOn(step, 0) : pointOn(step - 1, 1))

function moveToken(p: Pt | null) {
  if (!token) return
  token.style.visibility = p ? 'visible' : 'hidden'
  if (p) token.style.transform = `translate(${p.x}px, ${p.y}px)`
}

function inkEdge(i: number, progress: number) {
  const el = inks.get(edgeIds[i])
  if (!el) return
  const len = el.getTotalLength()
  el.style.strokeDasharray = `${len} ${len}`
  el.style.strokeDashoffset = String(len * (1 - progress))
}

// Redraws everything from the store's step: edges before it inked, the rest blank.
function paint() {
  const { step } = state()
  edgeIds.forEach((_, i) => inkEdge(i, i < step ? 1 : 0))
  if (!travelling) moveToken(restPoint(step))
}

function stopAnim() {
  gen++
  anim?.stop()
  anim = null
}

function run(from: number, to: number, seconds: number, onUpdate: (p: number) => void, onDone: () => void) {
  const mine = ++gen
  anim = animate(from, to, {
    duration: seconds,
    ease: 'easeInOut',
    onUpdate,
    onComplete: () => {
      if (mine !== gen) return
      anim = null
      onDone()
    },
  })
  anim.speed = state().speed
}

function openCardAt(step: number) {
  const { doc, openCard, play } = useStore.getState()
  const node = doc?.paths?.find((p) => p.id === play.pathId)?.nodes[step]
  if (play.autoCards && node && doc?.cards?.some((c) => c.target === node)) openCard(node)
}

// Travel edge `step`, then arrive.
function travel() {
  const i = state().step
  if (i >= edgeIds.length) return arrive(i)
  const el = inks.get(edgeIds[i])
  if (!el || reduced()) return arrive(i + 1) // reduced motion: jump node to node
  travelling = true
  run(0, 1, el.getTotalLength() / PX_PER_SEC, (p) => {
    inkEdge(i, p)
    moveToken(pointOn(i, p))
  }, () => {
    travelling = false
    arrive(i + 1)
  })
}

// Token reached node `step`: pulse (SketchNode reacts to the store), dwell, carry on.
function arrive(step: number) {
  setPlay({ step })
  paint()
  openCardAt(step)
  const last = step >= edgeIds.length
  // During the dwell the token slides from where it arrived to where the next edge leaves.
  const arrival = step > 0 ? pointOn(step - 1, 1) : restPoint(0)
  const departure = restPoint(step)
  const dwell = DWELL_S * (reduced() ? 2 : 1)
  run(0, 1, dwell, (p) => {
    if (arrival && departure) moveToken({ x: arrival.x + (departure.x - arrival.x) * p, y: arrival.y + (departure.y - arrival.y) * p })
  }, () => {
    if (!last) return travel()
    if (!state().loop) return setPlay({ status: 'done' })
    setPlay({ step: 0 })
    paint()
    travel()
  })
}

// Picks a path (or none). The token waits at its first node until play().
export function loadPath(pathId: string | null) {
  stopAnim()
  travelling = false
  const doc = useStore.getState().doc
  const path = doc?.paths?.find((p) => p.id === pathId)
  edgeIds = doc && path ? resolvePath(doc, path).edgeIds : []
  setPlay({ pathId: path ? path.id : null, step: 0, status: path ? 'paused' : 'idle' })
  paint()
}

export function play() {
  const { status, step, pathId } = state()
  if (!pathId || status === 'playing') return
  setPlay({ status: 'playing' })
  if (anim) return anim.play() // resume mid-edge or mid-dwell
  if (status === 'done' || step >= edgeIds.length) {
    setPlay({ step: 0 })
    paint()
  }
  travel()
}

export function pause() {
  if (state().status !== 'playing') return
  anim?.pause()
  setPlay({ status: 'paused' })
}

// Step forward/back one node. Mid-edge, back returns to the node it left.
export function stepBy(d: 1 | -1) {
  if (!state().pathId) return
  const { step } = state()
  const target = Math.min(edgeIds.length, Math.max(0, d < 0 && travelling ? step : step + d))
  stopAnim()
  travelling = false
  setPlay({ step: target, status: target === edgeIds.length ? 'done' : 'paused' })
  paint()
  openCardAt(target)
}

export function setSpeed(speed: number) {
  setPlay({ speed })
  if (anim) anim.speed = speed
}

export function stopPlay() {
  stopAnim()
  travelling = false
  edgeIds = []
}

// Ref callbacks. An ink path re-registers when its geometry changes (see SketchEdge).
export function registerInk(id: string, el: SVGPathElement | null) {
  if (!el) return void inks.delete(id)
  inks.set(id, el)
  // A fresh element draws fully inked until told otherwise. Mid-travel, the moving
  // edge gets its real offset on the next frame.
  const i = edgeIds.indexOf(id)
  if (i >= 0) inkEdge(i, i < state().step ? 1 : 0)
  if (!travelling) moveToken(restPoint(state().step))
}

export function registerToken(el: HTMLElement | null) {
  token = el
  if (el && !travelling) paint()
}
