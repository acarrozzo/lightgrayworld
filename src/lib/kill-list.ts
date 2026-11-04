import type { CSSProperties } from 'react'
import type { KillEntry, KillMark } from '@/lib/game-state'
import { foundSheetIds, sheetForRoom } from '@/lib/world-atlas'

/**
 * The Kill List, as the page draws it.
 *
 * The original's kl.php listed every enemy of every area from day one, gray
 * until killed, in 27 boxes in world order. This builds that page from the
 * registry (roster.generated.js: every enemy's area, level, rank, rare and
 * tone) and three things the player owns: their KillList rows, the Battle
 * Log's marks (deaths to an enemy, fights broken off), and the map sheets
 * they have found. A box shows once its sheet is found — set foot there and
 * it is — or once anything in it has been killed, for the enemies that roam
 * onto other sheets. Nothing here is authoritative: the server counted the
 * kills; this only arranges them.
 */

export interface RosterEnemy {
  slug: string
  name: string
  zone: string
  area: string
  level: number
  rank?: 'boss' | 'miniboss'
  lair?: string
  rare?: boolean
  nameTone?: string
  icon: string
  damageType: 'MELEE' | 'RANGED' | 'MAGIC'
  isAggressive: boolean
  isFlying: boolean
  isFriendly: boolean
  hp: number
  att: number
  def: number
}

export interface KillArea {
  id: string
  name: string
  /** The original's hand-written level range, e.g. "5–30". */
  levels: string
  /** The map sheet (world-map.js) whose discovery shows the box. */
  sheet: string
  /** The heading's color, in the original stylesheet's words (KL_TONE_VARS). */
  tone: string
}

const { ENEMY_ROSTER } = require('@/lib/game-data/roster.generated') as { ENEMY_ROSTER: RosterEnemy[] }
const { KL_AREAS } = require('@/lib/game-data/kill-list-areas') as { KL_AREAS: KillArea[] }

export const ROSTER: readonly RosterEnemy[] = ENEMY_ROSTER
export const AREAS: readonly KillArea[] = KL_AREAS
const ROSTER_BY_SLUG = new Map(ENEMY_ROSTER.map((enemy) => [enemy.slug, enemy]))

export function rosterEnemy(slug: string): RosterEnemy | null {
  return ROSTER_BY_SLUG.get(slug) ?? null
}

export function killArea(id: string): KillArea | null {
  return AREAS.find((area) => area.id === id) ?? null
}

/** Never fought, fought and lost or left, or felled at least once. */
export type KillState = 'unknown' | 'met' | 'killed'

export interface KillRow {
  enemy: RosterEnemy
  kills: number
  /** Fights this enemy won. "Killed you ×N." */
  losses: number
  /** Fights with it broken off. */
  fled: number
  state: KillState
}

export interface KillBox {
  area: KillArea
  /** In level order, the registry's order within a level. */
  rows: KillRow[]
  killed: number
  total: number
  cleared: boolean
  /** Its sheet is found, or something in it is dead: the box is drawn. */
  found: boolean
  /** On the sheet the player is standing on. */
  here: boolean
}

export interface KillListModel {
  /** The boxes drawn, in world order. */
  boxes: KillBox[]
  /** The boxes still dark, in world order. */
  hidden: KillBox[]
  /** Every kill ever, the original's TOTAL. Counts retired slugs too. */
  total: number
  /** Enemies on the list with at least one kill. */
  killed: number
  /** Enemies on the list. */
  roster: number
  /** Boxes with nothing left alive. */
  cleared: number
}

export interface KillListInput {
  kills: readonly KillEntry[]
  marks?: readonly KillMark[]
  /** The player row's map flags (`grassyFieldMap`, ...), or null before login. */
  flags: object | null | undefined
  currentRoomId?: string | null
}

export function buildKillList({ kills, marks = [], flags, currentRoomId }: KillListInput): KillListModel {
  const killsBySlug = new Map(kills.map((k) => [k.monster, k.kills]))
  const marksBySlug = new Map(marks.map((m) => [m.enemySlug, m]))
  const found = new Set(foundSheetIds(flags, currentRoomId))
  const here = currentRoomId ? sheetForRoom(currentRoomId) : null

  const rowsByArea = new Map<string, KillRow[]>()
  let killedCount = 0
  for (const enemy of ROSTER) {
    const kills = killsBySlug.get(enemy.slug) ?? 0
    const mark = marksBySlug.get(enemy.slug)
    const losses = mark?.losses ?? 0
    const fled = mark?.fled ?? 0
    const state: KillState = kills > 0 ? 'killed' : losses + fled > 0 ? 'met' : 'unknown'
    if (kills > 0) killedCount += 1
    const list = rowsByArea.get(enemy.area) ?? []
    list.push({ enemy, kills, losses, fled, state })
    rowsByArea.set(enemy.area, list)
  }

  const all: KillBox[] = AREAS.map((area) => {
    const rows = (rowsByArea.get(area.id) ?? []).slice().sort((a, b) => a.enemy.level - b.enemy.level)
    const killed = rows.filter((row) => row.kills > 0).length
    const total = rows.length
    return {
      area,
      rows,
      killed,
      total,
      cleared: total > 0 && killed === total,
      found: found.has(area.sheet) || killed > 0,
      here: here !== null && area.sheet === here,
    }
  })

  return {
    boxes: all.filter((box) => box.found),
    hidden: all.filter((box) => !box.found),
    total: kills.reduce((sum, k) => sum + k.kills, 0),
    killed: killedCount,
    roster: ROSTER.length,
    cleared: all.filter((box) => box.cleared).length,
  }
}

export type KillFilter = 'all' | 'unkilled' | 'bosses' | 'rare'

export const KILL_FILTERS: { id: KillFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unkilled', label: 'Unkilled' },
  { id: 'bosses', label: 'Bosses' },
  { id: 'rare', label: 'Rare' },
]

export interface KillView {
  filter: KillFilter
  hideCleared: boolean
  /** Only the boxes on the sheet the player stands on. */
  hereOnly: boolean
}

export const DEFAULT_KILL_VIEW: KillView = { filter: 'all', hideCleared: false, hereOnly: false }

function rowPasses(row: KillRow, filter: KillFilter): boolean {
  switch (filter) {
    case 'unkilled':
      return row.state !== 'killed'
    case 'bosses':
      return Boolean(row.enemy.rank)
    case 'rare':
      return Boolean(row.enemy.rare)
    default:
      return true
  }
}

/**
 * The boxes a view leaves: rows that fail the filter drop out of their box,
 * a box left empty drops out, a cleared box drops out when asked, and the
 * Here chip keeps only the sheet underfoot. The counts on a box stay the
 * whole box's, so "3 of 4" still means the area.
 */
export function applyKillView(boxes: readonly KillBox[], view: KillView): KillBox[] {
  const out: KillBox[] = []
  for (const box of boxes) {
    if (view.hideCleared && box.cleared) continue
    if (view.hereOnly && !box.here) continue
    const rows = view.filter === 'all' ? box.rows : box.rows.filter((row) => rowPasses(row, view.filter))
    if (rows.length === 0) continue
    out.push(rows === box.rows ? box : { ...box, rows })
  }
  return out
}

export function isKillViewFiltered(view: KillView): boolean {
  return view.filter !== 'all' || view.hideCleared || view.hereOnly
}

/** The kill tiers the bestiary card's ladder marks. */
export const KILL_TIERS = [1, 10, 100, 1000] as const

/**
 * The original stylesheet's color classes, as the Kill List used them, each
 * placed on a theme token: the hues by name, the region greens on the
 * regions, the page's own grays on the text ranks. `black` and `ddgray` were
 * the original's near-invisible names (the Gatekeeper, the Despair's heading)
 * and sit on the disabled rank, which is as dark as this page goes.
 */
export const KL_TONE_VARS: Record<string, string> = {
  yellowgreen: '--world-grassy-field',
  gray: '--fg-muted',
  lgray: '--fg-secondary',
  ddgray: '--fg-disabled',
  white: '--fg-bright',
  black: '--fg-disabled',
  green: '--hue-green',
  darkgreen: '--world-dark-forest',
  blue: '--hue-blue',
  darkblue: '--world-ocean',
  lightblue: '--mood-sacred',
  red: '--hue-red',
  lightred: '--hue-red',
  gold: '--hue-gold',
  lightbrown: '--terrain-dirt',
  purple: '--hue-violet',
  medpurple: '--hue-purple',
  lightpurple: '--mood-arcane',
}

/** An inline color for a tone, or nothing for a plain name. */
export function toneStyle(tone: string | null | undefined): CSSProperties | undefined {
  const token = tone ? KL_TONE_VARS[tone] : undefined
  return token ? { color: `var(${token})` } : undefined
}

/** The Char page's line under Kills: "41 of 180 on the list · 3 areas cleared". */
export function killRecordNote(model: Pick<KillListModel, 'killed' | 'roster' | 'cleared'>): string {
  const parts = [`${model.killed} of ${model.roster} on the list`]
  if (model.cleared > 0) parts.push(`${model.cleared} area${model.cleared === 1 ? '' : 's'} cleared`)
  return parts.join(' · ')
}
