// Single source of truth for the .lal format. TS types are inferred from these
// schemas, and scripts/gen-schema.ts turns them into schema/lal.schema.json.
// Only structure lives here; cross-references are checked in validate.ts.
import { z } from 'zod'

const id = z.string().regex(/^[A-Za-z0-9_.:-]{1,64}$/).meta({ id: 'id' })
const meta = z.record(z.string(), z.unknown()).meta({ id: 'meta' })

export const PALETTE = [
  'ink', 'paper', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'pink', 'gray',
] as const

const color = z
  .union([z.enum(PALETTE), z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)])
  .meta({ id: 'color' })

const point = z.strictObject({ x: z.number(), y: z.number() }).meta({ id: 'point' })
const size = z.strictObject({ width: z.number().positive(), height: z.number().positive() }).meta({ id: 'size' })

const style = z
  .strictObject({
    stroke: color.optional(),
    fill: color.optional(),
    fillStyle: z.enum(['none', 'hachure', 'solid', 'zigzag', 'cross-hatch', 'dots']).optional(),
    strokeWidth: z.number().min(0).optional(),
    roughness: z.number().min(0).max(3).optional(),
    dashed: z.boolean().optional(),
  })
  .meta({ id: 'style' })

const layout = z
  .strictObject({
    direction: z.enum(['RIGHT', 'DOWN', 'LEFT', 'UP']).optional(),
    spacing: z.number().min(0).optional(),
  })
  .meta({ id: 'layout' })

const node = z
  .strictObject({
    id,
    label: z.string(),
    kind: z.enum(['step', 'note']).optional(),
    shape: z.enum(['rectangle', 'ellipse', 'diamond', 'pill']).optional(),
    plate: id.optional(),
    position: point.optional(),
    size: size.optional(),
    style: style.optional(),
    link: z.strictObject({ plate: id }).optional(),
    meta: meta.optional(),
  })
  .meta({ id: 'node' })

const edge = z
  .strictObject({
    id,
    source: id,
    target: id,
    label: z.string().optional(),
    style: style.optional(),
    meta: meta.optional(),
  })
  .meta({ id: 'edge' })

const cardField = z
  .strictObject({
    label: z.string(),
    value: z.string(),
    format: z.enum(['markdown', 'plain', 'url']).optional(),
  })
  .meta({ id: 'cardField' })

const card = z
  .strictObject({
    id,
    target: id,
    title: z.string().optional(),
    fields: z.array(cardField),
    meta: meta.optional(),
  })
  .meta({ id: 'card' })

const path = z
  .strictObject({
    id,
    name: z.string(),
    nodes: z.array(id).min(2),
    edges: z.array(id).min(1).optional(),
    color: color.optional(),
    meta: meta.optional(),
  })
  .meta({ id: 'path' })

const plate = z
  .strictObject({
    id,
    title: z.string(),
    kind: z.enum(['overview', 'detail']).optional(),
    parent: id.optional(),
    position: point.optional(),
    layout: layout.optional(),
    meta: meta.optional(),
  })
  .meta({ id: 'plate' })

const line = z
  .strictObject({
    id,
    name: z.string(),
    nodes: z.array(id).min(2),
    color: color.optional(),
    style: style.optional(),
    meta: meta.optional(),
  })
  .meta({ id: 'line' })

export const LalDocumentSchema = z
  .strictObject({
    $schema: z.string().optional(),
    format: z.literal('lal'),
    version: z.literal(1),
    id,
    title: z.string(),
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    layout: layout.optional(),
    nodes: z.array(node),
    edges: z.array(edge),
    cards: z.array(card).optional(),
    paths: z.array(path).optional(),
    plates: z.array(plate).optional(),
    lines: z.array(line).optional(),
    meta: meta.optional(),
  })
  .meta({ title: 'Sir Linesalot document (.lal), version 1' })

export type LalDocument = z.infer<typeof LalDocumentSchema>
export type LalNode = z.infer<typeof node>
export type LalEdge = z.infer<typeof edge>
export type LalCard = z.infer<typeof card>
export type LalCardField = z.infer<typeof cardField>
export type LalPath = z.infer<typeof path>
export type LalPlate = z.infer<typeof plate>
export type LalLine = z.infer<typeof line>
export type Style = z.infer<typeof style>
export type Layout = z.infer<typeof layout>
