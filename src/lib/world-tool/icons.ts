/**
 * Everything the Icons page knows: which SVG files exist, what sprite symbol
 * each becomes, who in the game draws that symbol, which files are waiting in
 * `public/icons-proposed/` as replacements, and which sit in
 * `public/icons-backup/` as alternates that were passed over.
 *
 * The symbol-id rule mirrors scripts/generate-sprite-sheet.js exactly, so a
 * proposal's id is the id the sprite would carry once the file is approved.
 * A slot subfolder under `equipment/` (`equipment/head/…`) is transparent to
 * the id, as it is to the generator. Usage is read from the same registries
 * the game reads — item templates and rooms from the database, enemies,
 * givers, travelers, spells and skills from their data modules — so a glyph
 * shows every consumer, not just items.
 *
 * Server-only: it reads the filesystem and the database.
 */

import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { cachedWorldToolData } from './cached'
import { resolveItemIcon } from '@/lib/item-actions'
import { itemHref, enemyHref, questGiverHref, roomHref, spellHref, skillHref, travelerHref } from '@/components/world-tool/hrefs'

const { ENEMIES } = require('@/lib/game-data/enemies') as { ENEMIES: { slug: string; name: string; icon?: string }[] }
const { GIVERS } = require('@/lib/game-data/quest-registry') as { GIVERS: Record<string, { name: string; icon?: string; roomId?: string }> }
const { TRAVELERS } = require('@/lib/game-data/travelers') as { TRAVELERS: { id: string; name: string; icon?: string }[] }
const { SPELLS } = require('@/lib/game-data/spells') as { SPELLS: { id: string; name: string; icon?: string }[] }
const { SKILLS } = require('@/lib/game-data/skills') as { SKILLS: { id: string; name: string; icon?: string }[] }

export const ICONS_DIR = path.join(process.cwd(), 'public', 'icons')
export const IMG_ENV_DIR = path.join(process.cwd(), 'public', 'img', 'svg', 'environment')
export const PROPOSED_DIR = path.join(process.cwd(), 'public', 'icons-proposed')
export const BACKUP_DIR = path.join(process.cwd(), 'public', 'icons-backup')

export type IconFolder = 'root' | 'equipment' | 'enemy' | 'npc' | 'environment' | 'img-environment'

export type IconFile = {
  /** The sprite symbol id this file becomes. */
  id: string
  /** Path relative to its scan root, e.g. `equipment/head/horned-helmet.svg`. */
  rel: string
  /** URL the browser can load the raw file from. */
  url: string
  bytes: number
  folder: IconFolder
  /** True when another file already claimed this id; the generator skips this one. */
  shadowed: boolean
}

export type ProposedFile = {
  rel: string
  url: string
  bytes: number
  id: string
  /** The live file at the same path, if there is one — approving replaces it. */
  replaces: string | null
}

/** A passed-over alternate kept under `public/icons-backup/<slot>/`, name untouched. */
export type BackupFile = {
  rel: string
  url: string
  bytes: number
  /** The slot folder it sits in: `head`, `body`, … */
  slot: string
}

export type UsageKind = 'item' | 'enemy' | 'giver' | 'traveler' | 'room' | 'spell' | 'skill'
export type Usage = { kind: UsageKind; id: string; name: string; href: string }

/** One card on the page: a thing that draws an icon, with its current and proposed files. */
export type IconRow = {
  kind: UsageKind
  id: string
  name: string
  /** Slot, zone, region, school — one short line under the name. */
  sub: string
  href: string
  /** The sprite symbol the thing draws now; null when it falls back to the bag glyph. */
  iconId: string | null
  /** Live file behind that symbol, if the symbol comes from a file. */
  current: IconFile | null
  /** The proposal that would replace it, matched by live path, then by slug. */
  proposed: ProposedFile | null
  /** Where approving the proposal would write it. */
  target: string | null
  /** How many other things draw the same symbol. */
  sharedWith: number
  /** For items: the equipment slot folder a slug-named file belongs in (`head`), else null. */
  slotFolder: string | null
}

export type IconsData = {
  files: IconFile[]
  proposed: ProposedFile[]
  backups: BackupFile[]
  /** Symbol id → everyone who draws it. */
  usage: Record<string, Usage[]>
  rows: Record<'items' | 'enemies' | 'npcs' | 'rooms' | 'abilities', IconRow[]>
}

/** EquipSlot → the folder its slug-named files live in under `equipment/`. */
export const SLOT_FOLDER: Record<string, string> = {
  MAIN_HAND: 'main-hand', OFF_HAND: 'off-hand', HEAD: 'head', BODY: 'body', HANDS: 'hands', FEET: 'feet',
  RING: 'ring', NECK: 'neck', MOUNT: 'mount', ARTIFACT: 'artifact',
}
const SLOT_LABEL: Record<string, string> = {
  MAIN_HAND: 'Main hand', OFF_HAND: 'Off hand', HEAD: 'Head', BODY: 'Body', HANDS: 'Hands', FEET: 'Feet',
  RING: 'Ring', NECK: 'Neck', MOUNT: 'Mount', ARTIFACT: 'Artifact',
}

// ---- symbol ids, exactly as the generator derives them ---------------------------
export function symbolIdFor(rel: string, root: 'icons' | 'img'): string {
  let id = rel.replace(/\.svg$/, '').replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '')
  if (root === 'img') return `environment-${id.replace(/^environment-/, '')}`
  if (/^equipment\/[^/]+\/[^/]+\.svg$/.test(rel)) id = path.basename(rel, '.svg').replace(/[^a-zA-Z0-9-]/g, '')
  if (rel.startsWith('environment/')) return `environment-${id.replace(/^environment-/, '')}`
  if (rel.startsWith('equipment/')) return `equipment-${id.replace(/^equipment-/, '')}`
  if (rel.startsWith('npc/')) return path.basename(rel, '.svg')
  return id
}

function walk(dir: string, base = ''): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const rel = base ? `${base}/${name}` : name
    if (fs.statSync(full).isDirectory()) out.push(...walk(full, rel))
    else if (name.endsWith('.svg')) out.push(rel)
  }
  return out
}

function folderOf(rel: string): IconFolder {
  const top = rel.includes('/') ? rel.split('/')[0] : 'root'
  return (['equipment', 'enemy', 'npc', 'environment'].includes(top) ? top : 'root') as IconFolder
}

const toUrl = (prefix: string, rel: string) => `${prefix}/${rel.split('/').map(encodeURIComponent).join('/')}`

/** Live files in generator order: root first, then equipment, so shadowing matches the sprite. */
export function listIconFiles(): IconFile[] {
  const rels = walk(ICONS_DIR).sort((a, b) => {
    const ae = a.startsWith('equipment/'), be = b.startsWith('equipment/')
    if (ae !== be) return ae ? 1 : -1
    return a.localeCompare(b)
  })
  const seen = new Set<string>()
  const files: IconFile[] = rels.map((rel) => {
    const id = symbolIdFor(rel, 'icons')
    const shadowed = seen.has(id)
    seen.add(id)
    return { id, rel, url: toUrl('/icons', rel), bytes: fs.statSync(path.join(ICONS_DIR, rel)).size, folder: folderOf(rel), shadowed }
  })
  for (const rel of walk(IMG_ENV_DIR).sort()) {
    const id = symbolIdFor(rel, 'img')
    const shadowed = seen.has(id)
    seen.add(id)
    files.push({ id, rel: `img/${rel}`, url: `/img/svg/environment/${encodeURIComponent(rel)}`, bytes: fs.statSync(path.join(IMG_ENV_DIR, rel)).size, folder: 'img-environment', shadowed })
  }
  return files
}

export function countIconFiles(): number {
  return listIconFiles().filter((f) => !f.shadowed).length
}

export function listProposed(): ProposedFile[] {
  return walk(PROPOSED_DIR).sort().map((rel) => ({
    rel,
    url: toUrl('/icons-proposed', rel),
    bytes: fs.statSync(path.join(PROPOSED_DIR, rel)).size,
    id: symbolIdFor(rel, 'icons'),
    replaces: fs.existsSync(path.join(ICONS_DIR, rel)) ? rel : null,
  }))
}

export function listBackups(): BackupFile[] {
  return walk(BACKUP_DIR).sort().filter((rel) => rel.includes('/')).map((rel) => ({
    rel,
    url: toUrl('/icons-backup', rel),
    bytes: fs.statSync(path.join(BACKUP_DIR, rel)).size,
    slot: rel.split('/')[0],
  }))
}

const FILE = "[A-Za-z0-9 _'().-]+\\.svg"
/** A live or proposed path: root, one of the known folders, or a slot subfolder under equipment. No traversal. */
export function isSafeIconRel(rel: string): boolean {
  return new RegExp(`^(?:(?:enemy|npc|environment)/|equipment/(?:[a-z-]+/)?)?${FILE}$`).test(rel) && !rel.includes('..')
}
/** A backup path: `<slot>/<file>`. */
export function isSafeBackupRel(rel: string): boolean {
  return new RegExp(`^[a-z-]+/${FILE}$`).test(rel) && !rel.includes('..')
}
export function isSlug(s: string): boolean {
  return /^[a-z0-9-]+$/.test(s)
}

const loadDb = cachedWorldToolData('icons-db', () =>
  Promise.all([
    prisma.itemTemplate.findMany({ orderBy: { id: 'asc' }, select: { slug: true, name: true, type: true, equipSlot: true, metadata: true } }),
    prisma.room.findMany({ orderBy: { roomId: 'asc' }, select: { roomId: true, name: true, region: true, icon: true } }),
  ])
)

export async function loadIconsData(): Promise<IconsData> {
  const [items, rooms] = await loadDb()
  const files = listIconFiles()
  const proposed = listProposed()
  const backups = listBackups()
  const byId = new Map(files.filter((f) => !f.shadowed).map((f) => [f.id, f]))
  const proposedByRel = new Map(proposed.map((p) => [p.rel, p]))

  const usage: Record<string, Usage[]> = {}
  const addUse = (id: string | null | undefined, u: Usage) => { if (id) (usage[id] ??= []).push(u) }

  // ---- items: resolve exactly as the inventory does ----------------------------
  const itemRows: IconRow[] = items.map((it) => {
    const meta = (it.metadata ?? {}) as { icon?: string }
    const resolved = resolveItemIcon(meta, it.slug)
    const fallback = resolved === 'inv' && meta.icon !== 'inv' && it.slug !== 'inv'
    const iconId = fallback ? null : resolved
    const current = iconId ? byId.get(iconId) ?? null : null
    addUse(iconId, { kind: 'item', id: it.slug, name: it.name, href: itemHref(it.slug) })
    const slotFolder = it.equipSlot ? SLOT_FOLDER[it.equipSlot] ?? null : null
    const norm = it.slug.replace(/[-\s]/g, '').toLowerCase()
    const candidates = [
      current?.rel,
      slotFolder && `equipment/${slotFolder}/${it.slug}.svg`,
      `equipment/${it.slug}.svg`, `equipment/${norm}.svg`, `${it.slug}.svg`, `${norm}.svg`,
    ].filter(Boolean) as string[]
    const prop = candidates.map((c) => proposedByRel.get(c)).find(Boolean) ?? null
    return {
      kind: 'item', id: it.slug, name: it.name,
      sub: it.equipSlot ? SLOT_LABEL[it.equipSlot] ?? it.equipSlot : it.type === 'CONSUMABLE' ? 'Consumable' : 'Material',
      href: itemHref(it.slug), iconId, current, proposed: prop, target: prop ? prop.rel : null, sharedWith: 0, slotFolder,
    }
  })

  // ---- enemies, npcs, rooms, abilities ----------------------------------------
  const simple = (kind: UsageKind, id: string, name: string, sub: string, href: string, iconId: string | null | undefined): IconRow => {
    const current = iconId ? byId.get(iconId) ?? null : null
    addUse(iconId, { kind, id, name, href })
    const prop = current ? proposedByRel.get(current.rel) ?? null : null
    return { kind, id, name, sub, href, iconId: iconId || null, current, proposed: prop, target: prop ? prop.rel : null, sharedWith: 0, slotFolder: null }
  }
  const enemyRows = ENEMIES.map((e) => simple('enemy', e.slug, e.name, 'Enemy', enemyHref(e.slug), e.icon))
  const npcRows = [
    ...Object.entries(GIVERS).map(([id, g]) => simple('giver', id, g.name, g.roomId ? `Quest giver · room ${g.roomId}` : 'Quest giver', questGiverHref(id), g.icon)),
    ...TRAVELERS.map((t) => simple('traveler', t.id, t.name, 'Traveler', travelerHref(t.id), t.icon)),
  ]
  const roomRows = rooms.map((r) => simple('room', r.roomId, r.name, `${r.roomId} · ${r.region}`, roomHref(r.roomId), r.icon))
  const abilityRows = [
    ...SPELLS.map((s) => simple('spell', s.id, s.name, 'Spell', spellHref(s.id), s.icon)),
    ...SKILLS.map((s) => simple('skill', s.id, s.name, 'Skill', skillHref(s.id), s.icon)),
  ]

  const all = [itemRows, enemyRows, npcRows, roomRows, abilityRows]
  for (const rows of all) for (const r of rows) if (r.iconId) r.sharedWith = (usage[r.iconId]?.length ?? 1) - 1
  // An item whose proposal sits at a slug path while the game draws a different
  // file (Bo draws the root `bo.svg`, its proposal is `equipment/bo.svg`):
  // approve over the file actually drawn, unless other things draw it too.
  for (const r of itemRows) {
    if (r.proposed && r.current && r.proposed.rel !== r.current.rel && r.sharedWith === 0 && r.current.folder !== 'img-environment') r.target = r.current.rel
  }

  return { files, proposed, backups, usage, rows: { items: itemRows, enemies: enemyRows, npcs: npcRows, rooms: roomRows, abilities: abilityRows } }
}
