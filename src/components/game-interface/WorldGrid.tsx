'use client'

import type { Player } from '@/lib/game-state'

const {
  WORLD_REGIONS,
  VIP_REGIONS,
  getSheetsForRegion,
  getWorldRegionForRoom,
} = require('@/lib/game-data/world-map')

export interface WorldRegion {
  id: string
  name: string
  color?: string
  hub?: { roomId: string; name: string }
  alwaysOpen?: boolean
}

interface MapSheet {
  id: string
  title: string
  level: string
}

/**
 * Tile fills, one per region that has artwork. Written out literally rather
 * than built from the region's `color` so Tailwind's scanner can see them; the
 * `fill-world-*` classes carry the background and its label colour together.
 */
const REGION_FILL: Record<string, string> = {
  'grassy-field': 'fill-world-grassy-field',
  forest: 'fill-world-forest',
  'red-town': 'fill-world-red-town',
  'rocky-flats': 'fill-world-rocky-flats',
  lobby: 'fill-world-lobby',
  'room-zero': 'fill-world-room-zero',
  'solar-office': 'fill-world-solar-office',
}

const LOCKED_CLASSES =
  'bg-surface-raised/40 border border-dashed border-line-strong/60 text-fg-disabled cursor-not-allowed'

interface WorldGridProps {
  /**
   * `teleport` offers each region's hub as a fast-travel destination;
   * `map` offers each region's map sheets. Same grid, same colours, same
   * "Not found yet" for anything the player has not reached — this is the
   * original's "Map of Vega" page doing both jobs.
   */
  mode: 'teleport' | 'map'
  currentRoomId?: string
  /** Region ids whose fast travel is open — `Player.discoveredTeleports`. */
  discoveredTeleports?: string[]
  /** Sheet ids the player has found (see getUnlockedMaps). */
  foundMapIds?: string[]
  /** teleport: disables every destination and explains why (party, combat, MP). */
  blockedReason?: string | null
  /** map: the region whose sheet is currently on screen. */
  selectedRegionId?: string | null
  onTeleport?: (roomId: string) => void
  onSelectRegion?: (regionId: string) => void
  /** Shorter tiles for the mobile strip. */
  dense?: boolean
}

export default function WorldGrid({
  mode,
  currentRoomId,
  discoveredTeleports = [],
  foundMapIds = [],
  blockedReason = null,
  selectedRegionId = null,
  onTeleport,
  onSelectRegion,
  dense = false,
}: WorldGridProps) {
  const hereRegionId: string | null = currentRoomId ? (getWorldRegionForRoom(currentRoomId)?.id ?? null) : null

  const renderTile = (region: WorldRegion) => {
    const sheets: MapSheet[] = getSheetsForRegion(region.id)
    const foundSheets = sheets.filter((sheet) => foundMapIds.includes(sheet.id))

    const isOpen =
      mode === 'teleport'
        ? !!region.hub && (region.alwaysOpen === true || discoveredTeleports.includes(region.id))
        : foundSheets.length > 0
    const isHere = mode === 'teleport' ? region.hub?.roomId === currentRoomId : region.id === hereRegionId
    const isSelected = mode === 'map' && region.id === selectedRegionId
    const isBlocked = mode === 'teleport' && !!blockedReason
    const isDisabled = !isOpen || (mode === 'teleport' && (isHere || isBlocked))

    let subtitle: string
    if (!isOpen) subtitle = 'Not found yet'
    else if (isHere) subtitle = 'You are here'
    else if (mode === 'teleport') subtitle = region.hub?.name ?? ''
    else subtitle = foundSheets.map((sheet) => sheet.level).join(' · ')

    const label =
      mode === 'teleport'
        ? isOpen
          ? `Fast travel to ${region.name}${region.hub ? `, ${region.hub.name}` : ''}`
          : `${region.name}: not found yet`
        : isOpen
          ? `Open the ${region.name} map`
          : `${region.name} map: not found yet`

    const fill = region.color ? REGION_FILL[region.id] : ''
    const openClasses = isOpen
      ? `${fill} shadow-sm shadow-shadow ${isDisabled ? '' : 'hover:brightness-110 active:scale-[0.98]'}`
      : LOCKED_CLASSES
    const stateClasses = isBlocked && isOpen && !isHere ? 'opacity-50 cursor-not-allowed' : ''
    const ringClasses = isHere
      ? 'ring-2 ring-fg-bright/80 ring-offset-2 ring-offset-surface-panel'
      : isSelected
        ? 'ring-2 ring-hue-sky ring-offset-2 ring-offset-surface-panel'
        : ''

    return (
      <button
        key={region.id}
        type="button"
        disabled={isDisabled}
        aria-label={label}
        aria-pressed={mode === 'map' ? isSelected : undefined}
        title={isBlocked && isOpen && !isHere ? blockedReason ?? undefined : label}
        onClick={() => {
          if (isDisabled) return
          if (mode === 'teleport' && region.hub) onTeleport?.(region.hub.roomId)
          if (mode === 'map') onSelectRegion?.(region.id)
        }}
        className={`flex flex-col items-center justify-center rounded-lg px-1 text-center transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
          dense ? 'h-14' : 'h-[72px]'
        } ${openClasses} ${stateClasses} ${ringClasses} ${isDisabled && isOpen ? 'cursor-default' : ''}`}
      >
        <span className={`font-bold leading-tight ${dense ? 'text-[11px]' : 'text-xs'}`}>{region.name}</span>
        {subtitle && (
          <span className={`leading-tight ${dense ? 'text-[9px]' : 'text-[10px]'} ${isOpen ? 'opacity-80' : ''}`}>
            {subtitle}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">{WORLD_REGIONS.map(renderTile)}</div>
      <div className="flex items-center gap-2 mt-1">
        <div className="h-px flex-1 bg-surface-hover/40" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-resource-gold/70">VIP</span>
        <div className="h-px flex-1 bg-surface-hover/40" />
      </div>
      <div className="grid grid-cols-3 gap-2">{VIP_REGIONS.map(renderTile)}</div>
    </div>
  )
}

/** Sheet ids a player has found, from the flags on their row. */
export function foundMapIdsFor(player: Player | null | undefined, currentRoomId?: string): string[] {
  const { MAP_SHEETS, getMapIdForRoom } = require('@/lib/game-data/world-map')
  const found = new Set<string>()
  for (const sheet of MAP_SHEETS as Array<{ id: string; flag: keyof Player }>) {
    if (player && player[sheet.flag]) found.add(sheet.id)
  }
  // The sheet under the player's feet is always readable — the arrival unlock
  // is written a beat after the move, and the compass already shows it anyway.
  if (currentRoomId) found.add(getMapIdForRoom(currentRoomId))
  return Array.from(found)
}
