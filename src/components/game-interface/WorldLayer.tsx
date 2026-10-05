'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Globe, LocateFixed, Map as MapIcon, Sparkles } from 'lucide-react'
import MapContent from '@/components/MapContent'
import type { Player } from '@/lib/game-state'
import LayerShell, { HeaderTabs, ICON_BUTTON, useDeck } from './LayerShell'
import SubTabButton from './SubTabButton'
import SheetFilmstrip from './SheetFilmstrip'
import WorldGrid, { foundMapIdsFor, type WorldLevel } from './WorldGrid'
import type { MapConfigEntry } from './constants'
import { resolveMapView } from './utils'

const { getMapIdForRoom, TELEPORT_HUBS } = require('@/lib/game-data/world-map')
const { TELEPORT_MP_COST } = require('@/lib/game-data/teleport-destinations')

export type WorldTab = 'teleport' | 'map' | 'world'

interface TeleportHub {
  regionId: string
  discoveryId: string
  roomId: string
  name: string
  isSubHub: boolean
  alwaysOpen: boolean
}

interface WorldLayerProps {
  tab: WorldTab
  onTabChange: (tab: WorldTab) => void
  player: Player | null
  currentRoomId?: string
  /** The sheet on screen. Owned by GameInterface, which follows the player's room. */
  currentMapId: string
  /** Sheets the player has found, plus the one under their feet, in world order. */
  foundMaps: MapConfigEntry[]
  onMapChange: (mapId: string) => void
  onTeleport: (roomId: string) => void
  teleportBlockedReason?: string | null
}

/**
 * The world layer: Teleport and Map as two sub-tabs under one header, in the
 * left column or as a phone's page. The World tab opens it on Teleport; the
 * centre of the compass ring opens it on the Map.
 *
 * Teleport is the grid of landings. Map is one sheet, with every found sheet
 * in a filmstrip beneath it and, on the sheet itself, the button that
 * teleports to its landing. World Map is the nine regions at a glance, with a
 * switch for what lies under them; picking a region opens its sheet.
 */
export default function WorldLayer({
  tab,
  onTabChange,
  player,
  currentRoomId,
  currentMapId,
  foundMaps,
  onMapChange,
  onTeleport,
  teleportBlockedReason = null,
}: WorldLayerProps) {
  const { presentation } = useDeck()
  const variant = presentation === 'docked' ? 'docked' : 'overlay'
  const [worldLevel, setWorldLevel] = useState<WorldLevel>('surface')

  // Walking somewhere puts the World Map back on the surface.
  useEffect(() => {
    setWorldLevel('surface')
  }, [currentRoomId])

  const foundIds = useMemo(() => foundMaps.map((map) => map.id), [foundMaps])
  const foundMapIds = useMemo(() => foundMapIdsFor(player, currentRoomId), [player, currentRoomId])
  const discoveredTeleports = useMemo(() => player?.discoveredTeleports ?? [], [player?.discoveredTeleports])
  const hereMapId: string | null = currentRoomId ? getMapIdForRoom(currentRoomId) : null
  const mapView = resolveMapView(currentMapId, foundMaps, currentRoomId)
  const regionId: string | null = foundMaps.find((map) => map.id === currentMapId)?.region ?? null

  const selectSheet = useCallback(
    (mapId: string) => {
      onMapChange(mapId)
      // From the World Map, picking a region is asking to see its sheet.
      onTabChange('map')
    },
    [onMapChange, onTabChange],
  )

  /** Step to the previous or next found sheet, wrapping at the ends. */
  const stepSheet = useCallback(
    (delta: 1 | -1) => {
      if (foundIds.length < 2) return
      const index = foundIds.indexOf(currentMapId)
      const next = foundIds[(index + delta + foundIds.length) % foundIds.length]
      if (next) selectSheet(next)
    },
    [foundIds, currentMapId, selectSheet],
  )

  // Left and right arrows step through the sheets while a sheet is on screen.
  // Typing in the command line or chat is left alone.
  useEffect(() => {
    if (tab !== 'map') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      event.preventDefault()
      stepSheet(event.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab, stepSheet])

  // The landing on the sheet you are looking at, if its teleport is open to
  // you: the region's hub, or a sub-hub drawn on this sheet (the ocean's
  // Underwater sits on the underwater sheet, not the surface one).
  const { bridgeHub, sheetHasHub } = useMemo(() => {
    const onSheet = (TELEPORT_HUBS as TeleportHub[]).filter((hub) => getMapIdForRoom(hub.roomId) === currentMapId)
    const open = onSheet.filter((hub) => hub.alwaysOpen || discoveredTeleports.includes(hub.discoveryId))
    return { bridgeHub: open.find((hub) => !hub.isSubHub) ?? open[0] ?? null, sheetHasHub: onSheet.length > 0 }
  }, [currentMapId, discoveredTeleports])
  const isAtBridgeHub = !!bridgeHub && bridgeHub.roomId === currentRoomId

  const canGoHere = !!hereMapId && currentMapId !== hereMapId
  const goHere = () => {
    if (hereMapId) selectSheet(hereMapId)
  }

  const headerTitle = tab === 'teleport' ? '' : tab === 'world' ? (worldLevel === 'below' ? 'Under the world' : 'The world') : mapView.title

  const levelChips = (
    <>
      <SubTabButton
        active={worldLevel === 'surface'}
        color="sky"
        onClick={() => setWorldLevel('surface')}
        ariaPressed={worldLevel === 'surface'}
        title="The surface of each region"
      >
        Surface
      </SubTabButton>
      <SubTabButton
        active={worldLevel === 'below'}
        color="sky"
        onClick={() => setWorldLevel('below')}
        ariaPressed={worldLevel === 'below'}
        title="What lies under each region: undergrounds, sewers, the mine, the sea floor"
      >
        Underground
      </SubTabButton>
    </>
  )

  const hereButton = canGoHere && (
    <button
      type="button"
      onClick={goHere}
      aria-label="Back to the map you are standing on"
      title="Back to the map you are standing on"
      className={ICON_BUTTON}
    >
      <LocateFixed size={15} aria-hidden="true" />
    </button>
  )

  const worldGrid = (
    <WorldGrid
      mode="map"
      currentRoomId={currentRoomId}
      foundMapIds={foundMapIds}
      selectedRegionId={regionId}
      level={worldLevel}
      onSelectSheet={selectSheet}
    />
  )

  // The teleport for the sheet on screen, on the map itself: a button in the
  // sheet's corner when its landing is open to you, a quiet note when you are
  // standing on it or have not found it, nothing when the sheet has none.
  const bridgeState = bridgeHub ? (isAtBridgeHub ? 'here' : 'open') : sheetHasHub ? 'locked' : 'none'
  const mapTeleport =
    bridgeState === 'open' && bridgeHub ? (
      <button
        type="button"
        disabled={!!teleportBlockedReason}
        title={teleportBlockedReason ?? `Teleport to ${bridgeHub.name}`}
        onClick={() => {
          if (!teleportBlockedReason) onTeleport(bridgeHub.roomId)
        }}
        className="absolute bottom-3 right-3 z-10 flex h-9 items-center gap-2 rounded-lg border border-fg-bright/20 fill-resource-mp px-3 text-xs font-semibold shadow-lg shadow-black/40 transition-all hover:brightness-110 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
      >
        <Sparkles size={14} aria-hidden="true" />
        <span>Teleport to {bridgeHub.name}</span>
        <span className="rounded-full bg-surface-canvas/30 px-1.5 py-px text-[10px]">{TELEPORT_MP_COST} MP</span>
      </button>
    ) : bridgeState !== 'none' ? (
      <span className="pointer-events-none absolute bottom-3 right-3 z-10 flex h-7 items-center gap-1.5 rounded-lg border border-line-strong/60 bg-surface-canvas/80 px-2.5 text-[11px] font-medium text-fg-secondary backdrop-blur-sm">
        {bridgeState === 'here' ? <LocateFixed size={13} aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" className="opacity-60" />}
        {bridgeState === 'here' ? 'You are here' : 'Teleport not found yet'}
      </span>
    ) : null

  const sheetColumn = (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <MapContent
          mapSrc={mapView.src}
          mapTitle={mapView.title}
          marker={mapView.marker}
          onSwipe={(direction) => stepSheet(direction === 'next' ? 1 : -1)}
        />
        {mapTeleport}
      </div>
      <SheetFilmstrip sheets={foundMaps} currentMapId={currentMapId} currentRoomId={currentRoomId} onSelect={selectSheet} />
    </>
  )

  const lead = (
    <>
      <HeaderTabs
        label="Teleport, Map or World Map"
        color="sky"
        active={tab}
        home="teleport"
        onChange={onTabChange}
        tabs={[
          { id: 'teleport', label: 'Teleport', icon: <Sparkles size={14} aria-hidden="true" /> },
          { id: 'map', label: 'Map', icon: <MapIcon size={14} aria-hidden="true" /> },
          { id: 'world', label: 'World Map', icon: <Globe size={14} aria-hidden="true" /> },
        ]}
      />
      <span className="ml-auto min-w-0 truncate text-[11px] text-fg-muted">{headerTitle}</span>
      {tab === 'map' && hereButton}
    </>
  )

  return (
    <LayerShell title="World" icon={<Globe size={15} aria-hidden="true" />} toneClass="text-hue-sky" lead={lead} flush>
      {tab === 'map' ? (
        <div className="flex min-h-0 flex-1 flex-col">{sheetColumn}</div>
      ) : tab === 'world' ? (
        // The nine regions as their own maps, tight, with the level under them
        // one switch away. Picking one opens its sheet on the Map tab.
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className={`flex flex-col gap-2 ${variant === 'overlay' ? 'mx-auto max-w-[520px]' : ''}`}>
            <div className="flex items-center gap-2">{levelChips}</div>
            {worldGrid}
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className={`flex flex-col gap-2 ${variant === 'overlay' ? 'mx-auto max-w-[520px]' : ''}`}>
              {teleportBlockedReason && (
                <p className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-[11px] leading-relaxed text-status-error/90">
                  {teleportBlockedReason}
                </p>
              )}
              <WorldGrid
                mode="teleport"
                currentRoomId={currentRoomId}
                discoveredTeleports={discoveredTeleports}
                foundMapIds={foundMapIds}
                blockedReason={teleportBlockedReason}
                onTeleport={onTeleport}
              />
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2 border-t border-line-subtle/40 px-3 py-2 text-[11px]">
            <span className="font-semibold text-resource-mp" title="Each teleport costs MP">
              MP cost: {TELEPORT_MP_COST}
            </span>
            <span className="truncate text-fg-muted">Any hub you have stood in</span>
          </div>
        </>
      )}
    </LayerShell>
  )
}
