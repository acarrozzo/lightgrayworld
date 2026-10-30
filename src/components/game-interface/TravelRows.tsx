'use client'

import type { ReactNode } from 'react'
import { Map as MapIcon } from 'lucide-react'
import EntryRow, { EntryVerb } from '@/components/EntryRow'
import EnemyTraitTags from '@/components/EnemyTraitTags'
import { getEnemyTraits } from '@/lib/game-data/enemy-traits'
import { ABILITY_GRID, ROW_FRAME, ROW_FRAME_MUTED } from './AbilityRows'

export interface WorldRegion {
  id: string
  name: string
  color?: string
  hub?: { roomId: string; name: string }
  subHubs?: Array<{ id: string; roomId: string; name: string }>
  alwaysOpen?: boolean
}

/**
 * A boss landing the player has opened — one entry of `BOSS_TELEPORTS`: the
 * boss's record from bosses.generated.js (stats and the perk flags
 * getEnemyTraits reads) plus where it lands and what it costs.
 */
export interface BossTeleportTile {
  slug: string
  roomId: string
  name: string
  level: number
  icon: string
  hp: number
  att: number
  def: number
  /** MP, the boss's level. */
  cost: number
  specials?: string[]
  isFlying?: boolean
  damageType?: 'MELEE' | 'RANGED' | 'MAGIC'
  [perk: string]: unknown
}

/** A region's extra landing: found by standing in it, or — a guild hall — open to the guild's members. */
interface SubHub {
  regionId: string
  discoveryId: string
  roomId: string
  name: string
  unlockedByMembership?: string | null
}

const { WORLD_REGIONS, VIP_REGIONS, MAP_SHEETS, getSubHubsForRegion, getMapIdForRoom } = require('@/lib/game-data/world-map') as {
  WORLD_REGIONS: WorldRegion[]
  VIP_REGIONS: WorldRegion[]
  MAP_SHEETS: Array<{ id: string; region: string }>
  getSubHubsForRegion: (regionId: string) => SubHub[]
  getMapIdForRoom: (roomId: string) => string | null
}

/**
 * The world colour a boss row wears: its lair's map sheet, so the Despair's
 * bosses are the Despair's hue and the mine's the mine's, falling back to the
 * region when the sheet has no fill of its own. The three sheets whose fill is
 * named differently from the sheet are mapped by hand.
 */
const SHEET_FILL_ALIAS: Record<string, string> = { 'ocean-underwater': 'underwater', 'dark-forest-upper': 'dark-keep', 'the-despair': 'despair' }
const SHEET_FILLS = new Set([
  'grassy-field', 'grassy-field-underground', 'forest', 'forest-underground', 'red-town', 'red-town-sewers', 'rocky-flats',
  'rocky-flats-underground', 'neverending-mine', 'ocean', 'underwater', 'dark-forest', 'dark-keep', 'despair', 'swamp', 'mountains', 'star-city',
  'room-zero', 'lobby', 'solar-office',
])
function worldFor(roomId: string): string {
  const sheetId = getMapIdForRoom(roomId)
  const sheet = sheetId ? MAP_SHEETS.find((entry) => entry.id === sheetId) : null
  const name = sheetId ? SHEET_FILL_ALIAS[sheetId] ?? sheetId : ''
  if (SHEET_FILLS.has(name)) return name
  return sheet?.region ?? 'grassy-field'
}
const { TELEPORT_MP_COST, groupBossTeleportsByRegion, bossSheetLevel } = require('@/lib/game-data/teleport-destinations') as {
  TELEPORT_MP_COST: number
  groupBossTeleportsByRegion: (bosses: BossTeleportTile[]) => Array<{ region: WorldRegion; bosses: BossTeleportTile[] }>
  bossSheetLevel: (roomId: string) => string | null
}

export interface TravelRowsProps {
  currentRoomId?: string
  /** Landings whose fast travel is open, by discovery id — `Player.discoveredTeleports`. */
  discoveredTeleports: string[]
  /** The guilds the player belongs to, by faction id — `memberGuildIds` over the quest rows. */
  memberships?: string[]
  /** Why nothing can go right now (party, combat, MP), or null. */
  blockedReason: string | null
  /** The bosses the player has beaten, highest level first. The ladder is not drawn until there is one. */
  bosses: BossTeleportTile[]
  playerMp: number
  onTeleport: (roomId: string) => void
  /** A row to draw above the ladders, if a holder has one. */
  retreat?: ReactNode
  /** Open the map on a landing, its card open. Rows whose sheet is not found get no map button. */
  onShowOnMap?: (roomId: string) => void
  /** Sheet ids the player has found. */
  foundMapIds?: string[]
  /** Off, only `retreat` is drawn. */
  rows?: boolean
}

/**
 * The verb: "Teleport to Grassy Field" where the row is wide enough to carry
 * the name, "Teleport" where it is not. Decided by the list's width (the
 * holder's container): a full-width row has the room from 600px; a sub-hub row
 * sharing its line with another only from 1000px.
 */
function TeleportVerb({ name, paired = false }: { name: string; paired?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <span className={paired ? 'hidden @min-[1000px]:inline' : 'hidden @min-[600px]:inline'}>Teleport to {name}</span>
      <span className={paired ? '@min-[1000px]:hidden' : '@min-[600px]:hidden'}>Teleport</span>
    </span>
  )
}

/** The map button at a row's end: the landing on its sheet, card open. */
function ShowOnMap({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Show ${name} on the map`}
      title={`Show ${name} on the map`}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line-strong/80 text-hue-sky transition-colors hover:border-hue-sky hover:bg-surface-raised/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <MapIcon size={15} aria-hidden="true" />
    </button>
  )
}

/** A ladder's heading, the Items tab's: a word in the ladder's colour, a note after it. */
function Ladder({ label, note, tone }: { label: string; note?: string; tone: string }) {
  return (
    <span className={`flex items-baseline gap-1.5 px-1 pt-1 text-[9px] font-bold uppercase tracking-wider ${tone}`}>
      {label}
      {note && <span className="font-mono text-[9px] font-medium normal-case tracking-normal text-fg-disabled">{note}</span>}
    </span>
  )
}

/**
 * The World tab's Teleport page as rows: the original's teleport page, drawn
 * the way the action deck draws everything else so a Go is the same shape as
 * a Cast. Three ladders — Regions, Bosses, VIP — each row an
 * icon square in its region's map colour, the landing's name, the hub room
 * under it, the MP where a spell shows its cost, and one verb. A row that
 * cannot go keeps its place and says why in the cost's slot: not found yet,
 * here already, not enough MP, or the party. Sub-hubs (Underwater, the
 * Ranger's Guild) sit indented under their region, so the Blue Ocean's
 * landings read as one place with doors, not as three regions. The four
 * guild halls are sub-hubs of the region that holds them — the original's
 * grid had a square per guild beside the places — open to members and drawn
 * for everyone else exactly like a landing not yet found.
 *
 * Regions run in the world's own order, by hub room number — the Grassy
 * Field first, Star City last — with the ones you have found above the ones
 * you have not. Bosses cost their level in MP and sit under a heading per
 * region, in the same order and colour as the Regions ladder, lowest level
 * first within a region (a tie goes to the sheet nearer the surface). A lair
 * off the surface says which sheet it is on (Underground, Sewers, Mine…) in
 * a chip, and each row keeps its own sheet's colour. VIP is the row the
 * original kept past the end of the page.
 */
export default function TravelRows({ currentRoomId, discoveredTeleports, memberships = [], blockedReason, bosses, playerMp, onTeleport, retreat, rows = true, onShowOnMap, foundMapIds = [] }: TravelRowsProps) {
  /** The map button for a landing whose sheet has been found, else nothing. */
  const mapButton = (roomId: string, name: string) => {
    const sheetId = getMapIdForRoom(roomId)
    if (!onShowOnMap || !sheetId || !foundMapIds.includes(sheetId)) return null
    return <ShowOnMap name={name} onClick={() => onShowOnMap(roomId)} />
  }

  /** A sub-hub is open by membership when it is a guild hall, by discovery otherwise. */
  const subOpen = (sub: SubHub) =>
    sub.unlockedByMembership ? memberships.includes(sub.unlockedByMembership) : discoveredTeleports.includes(sub.discoveryId)

  const regions = (WORLD_REGIONS as WorldRegion[])
    .filter((region) => !!region.hub)
    .map((region) => ({ region, open: region.alwaysOpen === true || discoveredTeleports.includes(region.id) }))
    .sort((a, b) => {
      if (a.open !== b.open) return a.open ? -1 : 1
      return Number(a.region.hub!.roomId) - Number(b.region.hub!.roomId)
    })

  const hubRow = (region: WorldRegion, open: boolean, opts: { sub?: SubHub } = {}) => {
    const hub = opts.sub ?? region.hub!
    const roomId = hub.roomId
    const name = opts.sub ? opts.sub.name : region.name
    const isHere = roomId === currentRoomId
    const tooPoor = open && !blockedReason && playerMp < TELEPORT_MP_COST
    const reason = !open ? 'Not found yet' : isHere ? 'Here' : blockedReason ?? (tooPoor ? 'Not enough MP' : null)
    const label = opts.sub ? `${region.name}, ${opts.sub.name}` : `${region.name}, ${region.hub!.name}`
    // The same muted row for anything shut, with the hint matched to what opens it.
    const closedHint = opts.sub?.unlockedByMembership ? 'Join the guild to open the way' : 'Find its map, or walk there, to open the way'
    return (
      <EntryRow
        key={opts.sub ? opts.sub.discoveryId : region.id}
        density="deck"
        icon="magicstar"
        iconSize={15}
        iconClass={open ? `fill-world-${region.id} rounded-md opacity-95` : 'rounded-md bg-surface-raised/60 text-fg-disabled'}
        name={name}
        subline={
          <span className="text-[10px] text-fg-muted tabular-nums truncate">
            {open ? (opts.sub ? `#${roomId}` : `${region.hub!.name} · #${roomId}`) : closedHint}
          </span>
        }
        meta={<span className="text-xs font-bold text-resource-mp tabular-nums whitespace-nowrap">{TELEPORT_MP_COST} MP</span>}
        reason={reason}
        action={
          open ? (
            <>
              {mapButton(roomId, name)}
              <EntryVerb
                onClick={() => onTeleport(roomId)}
                disabled={Boolean(reason)}
                fillClass={`fill-world-${region.id}`}
                title={reason ?? `Teleport to ${label} · ${TELEPORT_MP_COST} MP`}
                ariaLabel={reason ? `Teleport to ${label}. ${reason}` : `Teleport to ${label}, ${TELEPORT_MP_COST} MP`}
              >
                <TeleportVerb name={name} paired={!!opts.sub} />
              </EntryVerb>
            </>
          ) : undefined
        }
        className={`${open ? ROW_FRAME : ROW_FRAME_MUTED} ${opts.sub ? 'ml-4' : ''}`}
        style={open ? { borderLeftColor: `var(--world-${region.id})` } : undefined}
      />
    )
  }

  const bossRow = (boss: BossTeleportTile) => {
    const isHere = boss.roomId === currentRoomId
    const tooPoor = !blockedReason && playerMp < boss.cost
    const reason = isHere ? 'Here' : blockedReason ?? (tooPoor ? 'Not enough MP' : null)
    const world = worldFor(boss.roomId)
    // The sheet under the lair, when it is not the region's surface: the
    // heading names the region, the chip says Underground, Sewers, Mine…
    const sheetLevel = bossSheetLevel(boss.roomId)
    return (
      <EntryRow
        key={boss.slug}
        density="deck"
        icon={boss.icon}
        iconClass={`fill-world-${world} rounded-md opacity-95`}
        name={boss.name}
        nameTags={
          <>
            <span className="shrink-0 rounded border border-resource-gold/40 bg-resource-gold/15 px-1 text-[9px] font-bold uppercase tracking-wider leading-[14px] text-resource-gold">
              L{boss.level}
            </span>
            {sheetLevel && (
              <span className="shrink-0 rounded border border-line-strong px-1 text-[9px] font-semibold uppercase tracking-wider leading-[14px] text-fg-muted">
                {sheetLevel}
              </span>
            )}
          </>
        }
        subline={
          <>
            <span className="text-[10px] text-fg-muted tabular-nums whitespace-nowrap">
              #{boss.roomId} · {boss.hp} HP · {boss.att} ATT · {boss.def} DEF
            </span>
            <EnemyTraitTags traits={getEnemyTraits(boss)} />
          </>
        }
        meta={<span className="text-xs font-bold text-resource-mp tabular-nums whitespace-nowrap">{boss.cost} MP</span>}
        reason={reason}
        action={
          <>
            {mapButton(boss.roomId, boss.name)}
            <EntryVerb
              onClick={() => onTeleport(boss.roomId)}
              disabled={Boolean(reason)}
              fillClass={`fill-world-${world}`}
              title={reason === 'Not enough MP' ? `You need ${boss.cost} MP to teleport to ${boss.name}. Rest first.` : reason ?? `Teleport to ${boss.name} · ${boss.cost} MP`}
              ariaLabel={reason ? `Teleport to ${boss.name}. ${reason}` : `Teleport to ${boss.name}, ${boss.cost} MP`}
            >
              <TeleportVerb name={boss.name} />
            </EntryVerb>
          </>
        }
        className={ROW_FRAME}
        style={{ borderLeftColor: `var(--world-${world})` }}
      />
    )
  }

  if (!rows) return <div className="flex flex-col gap-1.5">{retreat}</div>

  return (
    <div className="flex flex-col gap-1.5">
      {retreat}
      <Ladder label="Regions" note={`${TELEPORT_MP_COST} MP each`} tone="text-hue-sky" />
      {/* A region's row runs the full width; only its sub-hubs pair up when
          the list is wide enough for two. */}
      <div className="flex flex-col gap-1.5">
        {regions.map(({ region, open }) => {
          const subs = getSubHubsForRegion(region.id)
          return (
            <div key={region.id} className="flex flex-col gap-1.5">
              {hubRow(region, open)}
              {subs.length > 0 && (
                <div className={ABILITY_GRID}>
                  {subs.map((sub) => hubRow(region, subOpen(sub), { sub }))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {bosses.length > 0 && (
        <>
          <Ladder label="Bosses" note="MP = the boss's level" tone="text-resource-gold" />
          {/* The beaten bosses laid over the world: a group per region, the
              Regions ladder's order and colour, so the page reads as one world
              twice — the doors, then the trophies. Only regions with a kill
              are drawn, and the heading is the name alone: no count, so the
              page never hints at what a region still hides. */}
          <div className="flex flex-col gap-1.5">
            {groupBossTeleportsByRegion(bosses).map(({ region, bosses: group }) => (
              <div key={region.id} className="flex flex-col gap-1.5">
                <span
                  className="flex items-center gap-1.5 px-1 pt-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: `var(--world-${region.id})` }}
                >
                  {region.name}
                  <span aria-hidden="true" className="h-px flex-1 bg-surface-hover/40" />
                </span>
                {group.map(bossRow)}
              </div>
            ))}
          </div>
        </>
      )}
      <Ladder label="VIP" tone="text-fg-muted" />
      <div className="flex flex-col gap-1.5">{(VIP_REGIONS as WorldRegion[]).map((region) => hubRow(region, true))}</div>
    </div>
  )
}
