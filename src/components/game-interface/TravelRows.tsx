'use client'

import type { ReactNode } from 'react'
import EntryRow, { EntryVerb } from '@/components/EntryRow'
import EnemyTraitTags from '@/components/EnemyTraitTags'
import { getEnemyTraits } from '@/lib/game-data/enemy-traits'
import { ABILITY_GRID, ROW_FRAME, ROW_FRAME_MUTED } from './AbilityRows'
import type { BossTeleportTile, WorldRegion } from './WorldGrid'

const { WORLD_REGIONS, VIP_REGIONS, MAP_SHEETS, getSubHubsForRegion, getMapIdForRoom } = require('@/lib/game-data/world-map') as {
  WORLD_REGIONS: WorldRegion[]
  VIP_REGIONS: WorldRegion[]
  MAP_SHEETS: Array<{ id: string; region: string }>
  getSubHubsForRegion: (regionId: string) => Array<{ regionId: string; discoveryId: string; roomId: string; name: string }>
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
  'rocky-flats-underground', 'neverending-mine', 'ocean', 'underwater', 'dark-forest', 'dark-keep', 'despair', 'mountains', 'star-city',
  'room-zero', 'lobby', 'solar-office',
])
function worldFor(roomId: string): string {
  const sheetId = getMapIdForRoom(roomId)
  const sheet = sheetId ? MAP_SHEETS.find((entry) => entry.id === sheetId) : null
  const name = sheetId ? SHEET_FILL_ALIAS[sheetId] ?? sheetId : ''
  if (SHEET_FILLS.has(name)) return name
  return sheet?.region ?? 'grassy-field'
}
const { TELEPORT_MP_COST } = require('@/lib/game-data/teleport-destinations') as { TELEPORT_MP_COST: number }

export interface TravelRowsProps {
  currentRoomId?: string
  /** Landings whose fast travel is open, by discovery id — `Player.discoveredTeleports`. */
  discoveredTeleports: string[]
  /** Why nothing can go right now (party, combat, MP), or null. */
  blockedReason: string | null
  /** The bosses the player has beaten, highest level first. The ladder is not drawn until there is one. */
  bosses: BossTeleportTile[]
  playerMp: number
  onTeleport: (roomId: string) => void
  /** In a fight: the row at the top. Omit out of one. */
  retreat?: ReactNode
  /** Off, only Retreat is drawn: the World has not been found yet. */
  rows?: boolean
}

/**
 * The verb: "Teleport to Grassy Field" where the row is wide enough to carry
 * the name, "Teleport" where it is not. Decided by the list's width (the
 * deck's container): a full-width row has the room from 600px; a sub-hub row
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
 * The Travel tab as rows: the original's teleport page, drawn the way the
 * deck draws everything else so a Go is the same shape as a Cast. Retreat
 * first in a fight. Then three ladders — Regions, Bosses, VIP — each row an
 * icon square in its region's map colour, the landing's name, the hub room
 * under it, the MP where a spell shows its cost, and one verb. A row that
 * cannot go keeps its place and says why in the cost's slot: not found yet,
 * here already, not enough MP, or the party. Sub-hubs (Underwater, the
 * Ranger's Guild) sit indented under their region, so the Blue Ocean's
 * landings read as one place with doors, not as three regions.
 *
 * Regions run in the world's own order, by hub room number — the Grassy
 * Field first, Star City last — with the ones you have found above the ones
 * you have not. Bosses cost their level in MP and come lowest first, the
 * order you met them in, each in its lair's map colour. VIP is the row the original kept past the end of
 * the page.
 */
export default function TravelRows({ currentRoomId, discoveredTeleports, blockedReason, bosses, playerMp, onTeleport, retreat, rows = true }: TravelRowsProps) {
  const regions = (WORLD_REGIONS as WorldRegion[])
    .filter((region) => !!region.hub)
    .map((region) => ({ region, open: region.alwaysOpen === true || discoveredTeleports.includes(region.id) }))
    .sort((a, b) => {
      if (a.open !== b.open) return a.open ? -1 : 1
      return Number(a.region.hub!.roomId) - Number(b.region.hub!.roomId)
    })

  const hubRow = (region: WorldRegion, open: boolean, opts: { sub?: { discoveryId: string; roomId: string; name: string } } = {}) => {
    const hub = opts.sub ?? region.hub!
    const roomId = hub.roomId
    const name = opts.sub ? opts.sub.name : region.name
    const isHere = roomId === currentRoomId
    const tooPoor = open && !blockedReason && playerMp < TELEPORT_MP_COST
    const reason = !open ? 'Not found yet' : isHere ? 'Here' : blockedReason ?? (tooPoor ? 'Not enough MP' : null)
    const label = opts.sub ? `${region.name}, ${opts.sub.name}` : `${region.name}, ${region.hub!.name}`
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
            {open ? (opts.sub ? `#${roomId}` : `${region.hub!.name} · #${roomId}`) : 'Find its map, or walk there, to open the way'}
          </span>
        }
        meta={<span className="text-xs font-bold text-resource-mp tabular-nums whitespace-nowrap">{TELEPORT_MP_COST} MP</span>}
        reason={reason}
        action={
          open ? (
            <EntryVerb
              onClick={() => onTeleport(roomId)}
              disabled={Boolean(reason)}
              fillClass={`fill-world-${region.id}`}
              title={reason ?? `Teleport to ${label} · ${TELEPORT_MP_COST} MP`}
              ariaLabel={reason ? `Teleport to ${label}. ${reason}` : `Teleport to ${label}, ${TELEPORT_MP_COST} MP`}
            >
              <TeleportVerb name={name} paired={!!opts.sub} />
            </EntryVerb>
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
    return (
      <EntryRow
        key={boss.slug}
        density="deck"
        icon={boss.icon}
        iconClass={`fill-world-${world} rounded-md opacity-95`}
        name={boss.name}
        nameTags={
          <span className="shrink-0 rounded border border-resource-gold/40 bg-resource-gold/15 px-1 text-[9px] font-bold uppercase tracking-wider leading-[14px] text-resource-gold">
            L{boss.level}
          </span>
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
          <EntryVerb
            onClick={() => onTeleport(boss.roomId)}
            disabled={Boolean(reason)}
            fillClass={`fill-world-${world}`}
            title={reason === 'Not enough MP' ? `You need ${boss.cost} MP to teleport to ${boss.name}. Rest first.` : reason ?? `Teleport to ${boss.name} · ${boss.cost} MP`}
            ariaLabel={reason ? `Teleport to ${boss.name}. ${reason}` : `Teleport to ${boss.name}, ${boss.cost} MP`}
          >
            <TeleportVerb name={boss.name} />
          </EntryVerb>
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
                  {subs.map((sub) => hubRow(region, discoveredTeleports.includes(sub.discoveryId), { sub }))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {bosses.length > 0 && (
        <>
          <Ladder label="Bosses" note="MP = the boss's level" tone="text-resource-gold" />
          <div className="flex flex-col gap-1.5">{[...bosses].sort((a, b) => a.level - b.level).map(bossRow)}</div>
        </>
      )}
      <Ladder label="VIP" tone="text-fg-muted" />
      <div className="flex flex-col gap-1.5">{(VIP_REGIONS as WorldRegion[]).map((region) => hubRow(region, true))}</div>
    </div>
  )
}
