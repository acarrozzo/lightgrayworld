'use client'

import { Sparkles } from 'lucide-react'
import type { Player } from '@/lib/game-state'
import { getRoomMapMarker } from './room-map-positions'

const {
  WORLD_REGIONS,
  VIP_REGIONS,
  getSheetsForRegion,
  getSubHubsForRegion,
  getMapIdForRoom,
} = require('@/lib/game-data/world-map')

export interface WorldRegion {
  id: string
  name: string
  color?: string
  hub?: { roomId: string; name: string }
  subHubs?: Array<{ id: string; roomId: string; name: string }>
  alwaysOpen?: boolean
}

/** A region's extra landing — the ocean's Underwater or Master Temple. */
interface SubHub {
  regionId: string
  discoveryId: string
  roomId: string
  name: string
}

interface MapSheet {
  id: string
  title: string
  src: string
  level: string
}

/**
 * Which layer of the world the Map's grid shows: the surface sheets, or the
 * underground / sewer / mine / underwater sheets beneath them. The original's
 * maps page had the same two grids behind a "Swap level" button.
 */
export type WorldLevel = 'surface' | 'below'

/**
 * Tile fills for Fast travel, one per region that has artwork. Written out
 * literally rather than built from the region's `color` so Tailwind's scanner
 * can see them; the `fill-world-*` classes carry the background and its label
 * colour together.
 */
const REGION_FILL: Record<string, string> = {
  'grassy-field': 'fill-world-grassy-field',
  forest: 'fill-world-forest',
  'red-town': 'fill-world-red-town',
  'rocky-flats': 'fill-world-rocky-flats',
  ocean: 'fill-world-ocean',
  'dark-forest': 'fill-world-dark-forest',
  lobby: 'fill-world-lobby',
  'room-zero': 'fill-world-room-zero',
  'solar-office': 'fill-world-solar-office',
}

/**
 * Every tile is a square, as the original's "map cubes" were: the Fast travel
 * tiles need the height for a glyph above the name, and the Map tiles hold a
 * square sheet of artwork.
 */
const TILE_BASE =
  'relative flex w-full aspect-square flex-col items-center justify-center overflow-hidden rounded-lg text-center transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus'

const LOCKED_CLASSES =
  'bg-surface-raised/40 border border-dashed border-line-strong/60 text-fg-disabled cursor-not-allowed'

const HERE_RING = 'ring-2 ring-fg-bright/80 ring-offset-2 ring-offset-surface-panel'
const SELECTED_RING = 'ring-2 ring-hue-sky ring-offset-2 ring-offset-surface-panel'

interface WorldGridProps {
  /**
   * `teleport` offers each region's hub as a fast-travel destination on a flat
   * colour tile; `map` offers each region's sheets, drawn as the sheet itself.
   * Same grid, same "Not found yet" for anything the player has not reached —
   * this is the original's "Map of Vega" page doing both jobs.
   */
  mode: 'teleport' | 'map'
  currentRoomId?: string
  /** Landings whose fast travel is open, by discovery id — `Player.discoveredTeleports`. */
  discoveredTeleports?: string[]
  /** Sheet ids the player has found (see foundMapIdsFor). */
  foundMapIds?: string[]
  /** teleport: disables every destination and explains why (party, combat, MP). */
  blockedReason?: string | null
  /** map: the region whose sheet is currently on screen. */
  selectedRegionId?: string | null
  /** map: which layer of the world the tiles show. */
  level?: WorldLevel
  onTeleport?: (roomId: string) => void
  /** map: the sheet drawn on the clicked tile. */
  onSelectSheet?: (sheetId: string) => void
  /** Smaller type for the mobile strip. */
  dense?: boolean
}

type TileSheet =
  | { state: 'open'; sheet: MapSheet; found: MapSheet[] }
  | { state: 'locked'; sheet: null; found: [] }
  | { state: 'nothing-below'; sheet: null; found: [] }

/**
 * Which sheet a region's tile draws in the Map's World view.
 *
 * On the surface layer every region shows its surface sheet, except the one
 * the player is standing in, which shows the sheet under their feet — from the
 * sewers, Red Town's tile is the sewers. Below, each region shows its lower
 * sheet, again preferring the one the player stands on. A region with sheets
 * but nothing beneath them says so rather than pretending to be unfound; a
 * region with no sheets at all (the placeholders) stays "Not found yet" on
 * both layers.
 */
function resolveTileSheet(
  region: WorldRegion,
  level: WorldLevel,
  foundMapIds: string[],
  hereSheetId: string | null,
): TileSheet {
  const sheets: MapSheet[] = getSheetsForRegion(region.id)
  const layer = level === 'below' ? sheets.filter((sheet) => sheet.level !== 'Surface') : sheets
  if (layer.length === 0) {
    return sheets.length === 0 ? { state: 'locked', sheet: null, found: [] } : { state: 'nothing-below', sheet: null, found: [] }
  }
  const found = layer.filter((sheet) => foundMapIds.includes(sheet.id))
  if (found.length === 0) return { state: 'locked', sheet: null, found: [] }
  const here = found.find((sheet) => sheet.id === hereSheetId)
  const surface = level === 'surface' ? found.find((sheet) => sheet.level === 'Surface') : undefined
  return { state: 'open', sheet: here ?? surface ?? found[0], found }
}

/** The "you are here" dot the Map view draws, at tile size. */
function HereDot({ x, y }: { x: number; y: number }) {
  return (
    <span
      className="pointer-events-none absolute z-10"
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: 'translate(-50%, -50%)' }}
      aria-hidden="true"
    >
      <span className="absolute inset-0 -m-1.5 rounded-full bg-resource-gold/40 animate-ping" />
      <span className="block h-2.5 w-2.5 rounded-full border-2 border-line-subtle bg-resource-gold" />
    </span>
  )
}

export default function WorldGrid({
  mode,
  currentRoomId,
  discoveredTeleports = [],
  foundMapIds = [],
  blockedReason = null,
  selectedRegionId = null,
  level = 'surface',
  onTeleport,
  onSelectSheet,
  dense = false,
}: WorldGridProps) {
  const hereSheetId: string | null = currentRoomId ? getMapIdForRoom(currentRoomId) : null
  const hereMarker = currentRoomId ? getRoomMapMarker(currentRoomId) : null
  const nameClass = `font-bold leading-tight ${dense ? 'text-[11px]' : 'text-xs'}`
  const subClass = `leading-tight ${dense ? 'text-[9px]' : 'text-[10px]'}`

  const renderLockedTile = (region: WorldRegion, label: string, subtitle = 'Not found yet') => (
    <button type="button" disabled aria-label={label} title={label} className={`${TILE_BASE} px-1 ${LOCKED_CLASSES}`}>
      <span className={nameClass}>{region.name}</span>
      <span className={subClass}>{subtitle}</span>
    </button>
  )

  // --- Map: the sheet itself, name over the art --------------------------------
  const renderMapTile = (region: WorldRegion) => {
    const resolved = resolveTileSheet(region, level, foundMapIds, hereSheetId)

    if (resolved.state === 'nothing-below') {
      return (
        <div className={`${TILE_BASE} px-1 border border-line-strong/40 bg-surface-raised/25 text-fg-disabled`}>
          <span className={`${nameClass} font-semibold`}>{region.name}</span>
          <span className={subClass}>Nothing below</span>
        </div>
      )
    }
    if (resolved.state === 'locked') return renderLockedTile(region, `${region.name} map: not found yet`)

    const { sheet, found } = resolved
    const isHere = sheet.id === hereSheetId
    const isSelected = region.id === selectedRegionId
    const subtitle = isHere ? 'You are here' : found.map((s) => s.level).join(' · ')
    const label = `Open the ${sheet.title} map`
    const ringClasses = isHere ? HERE_RING : isSelected ? SELECTED_RING : ''

    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={isSelected}
        title={label}
        onClick={() => onSelectSheet?.(sheet.id)}
        className={`${TILE_BASE} bg-surface-raised shadow-sm shadow-shadow hover:brightness-110 active:scale-[0.98] ${ringClasses}`}
      >
        <img
          src={sheet.src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
        {isHere && hereMarker && <HereDot x={hereMarker.x} y={hereMarker.y} />}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface-canvas/90 via-surface-canvas/60 to-transparent px-1 pb-1 pt-4 text-fg-bright [text-shadow:0_1px_2px_var(--shadow)]">
          <span className={`block ${nameClass}`}>{region.name}</span>
          <span className={`block ${subClass} opacity-85`}>{subtitle}</span>
        </span>
      </button>
    )
  }

  // --- Fast travel: flat colour, a glyph over the name ------------------------
  const renderTeleportTile = (region: WorldRegion) => {
    const isOpen = !!region.hub && (region.alwaysOpen === true || discoveredTeleports.includes(region.id))
    if (!isOpen) return renderLockedTile(region, `${region.name}: not found yet`)

    const isHere = region.hub?.roomId === currentRoomId
    const isBlocked = !!blockedReason
    const isDisabled = isHere || isBlocked
    const subtitle = isHere ? 'You are here' : region.hub?.name ?? ''
    const label = `Fast travel to ${region.name}${region.hub ? `, ${region.hub.name}` : ''}`
    const fill = REGION_FILL[region.id] ?? ''

    return (
      <button
        type="button"
        disabled={isDisabled}
        aria-label={label}
        title={isBlocked && !isHere ? blockedReason ?? undefined : label}
        onClick={() => {
          if (!isDisabled && region.hub) onTeleport?.(region.hub.roomId)
        }}
        className={`${TILE_BASE} gap-1 px-1 ${fill} shadow-sm shadow-shadow ${
          isDisabled ? 'cursor-default' : 'hover:brightness-110 active:scale-[0.98]'
        } ${isBlocked && !isHere ? 'opacity-50 cursor-not-allowed' : ''} ${isHere ? HERE_RING : ''}`}
      >
        <Sparkles size={dense ? 18 : 22} aria-hidden="true" className="opacity-95" />
        <span className={nameClass}>{region.name}</span>
        {subtitle && <span className={`${subClass} opacity-80`}>{subtitle}</span>}
      </button>
    )
  }

  const renderTile = (region: WorldRegion) => {
    const tile = mode === 'map' ? renderMapTile(region) : renderTeleportTile(region)

    // A region's sub-hubs — the ocean's Underwater and Master Temple — sit
    // under its tile as their own small buttons, exactly the second row of
    // squares the original's teleport page gave them. Only fast travel has
    // them; the map view has nothing to select below a region.
    const subHubs: SubHub[] = mode === 'teleport' ? getSubHubsForRegion(region.id) : []
    if (subHubs.length === 0) return <div key={region.id}>{tile}</div>

    const isBlocked = !!blockedReason
    const fill = REGION_FILL[region.id] ?? ''
    return (
      <div key={region.id} className="flex flex-col gap-1">
        {tile}
        <div className="grid grid-cols-2 gap-1">
          {subHubs.map((hub) => {
            const hubOpen = discoveredTeleports.includes(hub.discoveryId)
            const hubHere = hub.roomId === currentRoomId
            const hubDisabled = !hubOpen || hubHere || isBlocked
            const hubLabel = hubOpen
              ? `Fast travel to ${region.name}, ${hub.name}`
              : `${region.name}, ${hub.name}: not found yet`
            return (
              <button
                key={hub.discoveryId}
                type="button"
                disabled={hubDisabled}
                aria-label={hubLabel}
                title={isBlocked && hubOpen && !hubHere ? blockedReason ?? undefined : hubLabel}
                onClick={() => {
                  if (hubDisabled) return
                  onTeleport?.(hub.roomId)
                }}
                className={`rounded-md px-1 py-1 text-center leading-tight transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                  dense ? 'text-[9px]' : 'text-[10px]'
                } ${
                  hubOpen
                    ? `${fill} shadow-sm shadow-shadow ${hubDisabled ? 'cursor-default' : 'hover:brightness-110 active:scale-[0.98]'}`
                    : LOCKED_CLASSES
                } ${isBlocked && hubOpen && !hubHere ? 'opacity-50 cursor-not-allowed' : ''} ${
                  hubHere ? 'ring-2 ring-fg-bright/80 ring-offset-1 ring-offset-surface-panel' : ''
                }`}
              >
                <span className="block font-semibold">{hub.name}</span>
                <span className={`block ${hubOpen ? 'opacity-80' : ''}`}>
                  {hubHere ? 'You are here' : hubOpen ? 'Fast travel' : 'Not found yet'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // The VIP rooms are single sheets with nothing beneath them, so the Below
  // layer has no row to draw for them.
  const showVip = !(mode === 'map' && level === 'below')

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 items-start">{WORLD_REGIONS.map(renderTile)}</div>
      {showVip ? (
        <>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-px flex-1 bg-surface-hover/40" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-resource-gold/70">VIP</span>
            <div className="h-px flex-1 bg-surface-hover/40" />
          </div>
          <div className="grid grid-cols-3 gap-2">{VIP_REGIONS.map(renderTile)}</div>
        </>
      ) : (
        <p className="mt-1 text-[11px] text-fg-muted">The VIP rooms have no lower level.</p>
      )}
    </div>
  )
}

/** Sheet ids a player has found, from the flags on their row. */
export function foundMapIdsFor(player: Player | null | undefined, currentRoomId?: string): string[] {
  const { MAP_SHEETS } = require('@/lib/game-data/world-map')
  const found = new Set<string>()
  for (const sheet of MAP_SHEETS as Array<{ id: string; flag: keyof Player }>) {
    if (player && player[sheet.flag]) found.add(sheet.id)
  }
  // The sheet under the player's feet is always readable — the arrival unlock
  // is written a beat after the move, and the compass already shows it anyway.
  if (currentRoomId) found.add(getMapIdForRoom(currentRoomId))
  return Array.from(found)
}
