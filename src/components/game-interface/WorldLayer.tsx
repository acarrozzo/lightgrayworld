'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { LocateFixed, Map as MapIcon, Maximize2, PictureInPicture2, Sparkles, X, type LucideIcon } from 'lucide-react'
import MapContent from '@/components/MapContent'
import type { Player } from '@/lib/game-state'
import SubTabButton from './SubTabButton'
import SheetFilmstrip from './SheetFilmstrip'
import WorldGrid, { foundMapIdsFor, type WorldLevel } from './WorldGrid'
import type { MapConfigEntry } from './constants'
import { resolveMapView } from './utils'

const { getMapIdForRoom, TELEPORT_HUBS } = require('@/lib/game-data/world-map')
const { TELEPORT_MP_COST } = require('@/lib/game-data/teleport-destinations')

export type WorldTab = 'map' | 'teleport'

interface TeleportHub {
  regionId: string
  discoveryId: string
  roomId: string
  name: string
  isSubHub: boolean
  alwaysOpen: boolean
}

interface WorldLayerProps {
  /**
   * `docked` fills the Explore sidebar. `overlay` is the full-screen layer;
   * on a wide screen it docks the World grid beside the sheet instead of
   * hiding it behind the World chip.
   */
  variant: 'docked' | 'overlay'
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
  onClose: () => void
  /** docked: expand to the overlay. */
  onFullscreen?: () => void
  /** overlay: return to the sidebar. Hidden where there is no sidebar. */
  onDock?: () => void
}

/** True while the viewport is at least Tailwind's `lg` breakpoint. */
function useIsWide() {
  const [isWide, setIsWide] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return isWide
}

function TabButton({
  active,
  icon: Icon,
  label,
  activeClasses,
  onClick,
  divided = false,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  activeClasses: string
  onClick: () => void
  divided?: boolean
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex h-7 items-center gap-1.5 px-2.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus ${
        divided ? 'border-l border-line-strong/80' : ''
      } ${active ? activeClasses : 'text-fg-secondary hover:bg-surface-raised/30 hover:text-fg-primary'}`}
    >
      <Icon size={14} aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}

const ICON_BUTTON = 'flex-shrink-0 rounded p-1 text-fg-secondary transition-colors hover:bg-surface-raised/50 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus'

/**
 * The world layer: Map and Fast travel as two tabs under one header, docked in
 * the Explore sidebar or full screen. The Map tab shows one sheet with every
 * found sheet in a filmstrip beneath it, a World grid of the regions (a rail
 * beside the sheet when the screen is wide), a Here chip back to your own
 * sheet, and a footer that fast-travels to the hub of the sheet you are
 * looking at. The Teleport tab is the fast-travel grid.
 */
export default function WorldLayer({
  variant,
  tab,
  onTabChange,
  player,
  currentRoomId,
  currentMapId,
  foundMaps,
  onMapChange,
  onTeleport,
  teleportBlockedReason = null,
  onClose,
  onFullscreen,
  onDock,
}: WorldLayerProps) {
  const [showWorld, setShowWorld] = useState(false)
  const [worldLevel, setWorldLevel] = useState<WorldLevel>('surface')
  const isWide = useIsWide()
  const hasRail = variant === 'overlay' && isWide
  // The World grid shows in the sheet's place on narrow screens; a wide overlay
  // has it in the rail instead, so the column never needs to switch.
  const worldInColumn = showWorld && !hasRail

  // Walking somewhere while the layer is open snaps the Map back to the sheet
  // you are on; the World view is for looking around, not a place to be left in.
  useEffect(() => {
    setShowWorld(false)
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
      setShowWorld(false)
    },
    [onMapChange],
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
    if (tab !== 'map' || worldInColumn) return
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
  }, [tab, worldInColumn, stepSheet])

  // The landing on the sheet you are looking at, if its fast travel is open to
  // you: the region's hub, or a sub-hub drawn on this sheet (the ocean's
  // Underwater sits on the underwater sheet, not the surface one).
  const { bridgeHub, sheetHasHub } = useMemo(() => {
    const onSheet = (TELEPORT_HUBS as TeleportHub[]).filter((hub) => getMapIdForRoom(hub.roomId) === currentMapId)
    const open = onSheet.filter((hub) => hub.alwaysOpen || discoveredTeleports.includes(hub.discoveryId))
    return { bridgeHub: open.find((hub) => !hub.isSubHub) ?? open[0] ?? null, sheetHasHub: onSheet.length > 0 }
  }, [currentMapId, discoveredTeleports])
  const isAtBridgeHub = !!bridgeHub && bridgeHub.roomId === currentRoomId

  const canGoHere = !!hereMapId && (showWorld || currentMapId !== hereMapId)
  const goHere = () => {
    if (hereMapId) selectSheet(hereMapId)
  }

  const headerTitle =
    tab === 'teleport' ? '' : worldInColumn ? (worldLevel === 'below' ? 'Below the world' : 'Map of the world') : mapView.title

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
        Below
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

  // The fast-travel line under the sheet keeps its height whatever it says, so
  // the sheet does not jump between maps you can travel to and maps you cannot.
  const bridgeState = worldInColumn ? 'world' : bridgeHub ? (isAtBridgeHub ? 'here' : 'open') : sheetHasHub ? 'locked' : 'none'
  const bridgeFooter = (
    <div className="flex h-12 flex-shrink-0 items-center justify-center border-t border-line-subtle/40 px-3">
      {bridgeState === 'open' && bridgeHub ? (
        <button
          type="button"
          disabled={!!teleportBlockedReason}
          title={teleportBlockedReason ?? undefined}
          onClick={() => {
            if (!teleportBlockedReason) onTeleport(bridgeHub.roomId)
          }}
          className="flex h-8 items-center gap-2 rounded-lg border border-resource-mp/50 px-3 text-xs font-semibold text-resource-mp transition-colors hover:bg-resource-mp/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-resource-mp disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <Sparkles size={14} aria-hidden="true" />
          <span>Fast travel to {bridgeHub.name}</span>
          <span className="rounded-full bg-resource-mp/20 px-1.5 py-px text-[10px]">{TELEPORT_MP_COST} MP</span>
        </button>
      ) : (
        <span className="flex h-8 items-center gap-2 rounded-lg border border-dashed border-line-strong/60 px-3 text-xs font-medium text-fg-muted">
          {bridgeState === 'here' ? <LocateFixed size={14} aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" className="opacity-60" />}
          <span>
            {bridgeState === 'here'
              ? 'You are here'
              : bridgeState === 'locked'
                ? 'Fast travel here: not found yet'
                : bridgeState === 'world'
                  ? 'Pick a map to see its fast travel'
                  : 'No fast travel on this map'}
          </span>
        </span>
      )}
    </div>
  )

  const sheetColumn = (
    <>
      {worldInColumn ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className={`flex flex-col gap-3 ${variant === 'overlay' ? 'mx-auto max-w-[520px]' : ''}`}>
            <div className="flex items-center gap-2">{levelChips}</div>
            {worldGrid}
          </div>
        </div>
      ) : (
        <MapContent
          mapSrc={mapView.src}
          mapTitle={mapView.title}
          marker={mapView.marker}
          onSwipe={(direction) => stepSheet(direction === 'next' ? 1 : -1)}
        />
      )}
      {bridgeFooter}
      <SheetFilmstrip
        sheets={foundMaps}
        currentMapId={currentMapId}
        currentRoomId={currentRoomId}
        onSelect={selectSheet}
        onSelectWorld={hasRail ? undefined : () => setShowWorld(true)}
        worldSelected={worldInColumn}
        onClose={onClose}
      />
    </>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Row 1: the two tabs, the sheet's name, full screen or dock, close. */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-line-subtle/50 py-2 pl-3 pr-2">
        <div role="tablist" aria-label="Map or Teleport" className="flex flex-shrink-0 overflow-hidden rounded-lg border border-line-strong/80 shadow-sm">
          <TabButton active={tab === 'map'} icon={MapIcon} label="Map" activeClasses="bg-hue-sky/15 text-hue-sky" onClick={() => onTabChange('map')} />
          <TabButton
            active={tab === 'teleport'}
            icon={Sparkles}
            label="Teleport"
            activeClasses="bg-resource-mp/15 text-resource-mp"
            onClick={() => onTabChange('teleport')}
            divided
          />
        </div>
        <span className="ml-auto min-w-0 truncate text-[11px] text-fg-muted">{headerTitle}</span>
        {tab === 'map' && !hasRail && hereButton}
        {variant === 'docked' && onFullscreen && (
          <button type="button" onClick={onFullscreen} aria-label="Open full screen" title="Full screen" className={ICON_BUTTON}>
            <Maximize2 size={14} aria-hidden="true" />
          </button>
        )}
        {variant === 'overlay' && onDock && (
          <button type="button" onClick={onDock} aria-label="Back to the sidebar" title="Back to the sidebar" className={`hidden lg:flex ${ICON_BUTTON}`}>
            <PictureInPicture2 size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Close" title="Close (Esc)" className={ICON_BUTTON}>
          <X size={variant === 'overlay' ? 20 : 16} aria-hidden="true" />
        </button>
      </div>

      {tab === 'map' ? (
        hasRail ? (
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col border-r border-line-subtle/40">{sheetColumn}</div>
            <aside className="flex w-[400px] flex-shrink-0 flex-col min-h-0" aria-label="Map of the world">
              <div className="flex flex-shrink-0 items-center gap-2 border-b border-line-subtle/40 py-1.5 pl-3 pr-2">
                {levelChips}
                <span className="ml-auto truncate text-[11px] text-fg-muted">{worldLevel === 'below' ? 'Below the world' : 'Map of the world'}</span>
                {canGoHere && (
                  <button
                    type="button"
                    onClick={goHere}
                    title="Back to the map you are standing on"
                    className="flex h-7 flex-shrink-0 items-center gap-1 rounded-lg border border-dashed border-line-strong/80 px-2 text-[11px] font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                  >
                    <LocateFixed size={13} aria-hidden="true" />
                    <span>Here</span>
                  </button>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">{worldGrid}</div>
            </aside>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">{sheetColumn}</div>
        )
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
          {/* The same bottom bar shape as the Map tab's strip: the cost on the left, close pinned at the right. */}
          <div className="flex flex-shrink-0 items-center gap-2 border-t border-line-subtle/40 py-2 pl-3 pr-1.5 text-[11px]">
            <span className="font-semibold text-resource-mp" title="Each fast travel costs MP">
              MP cost: {TELEPORT_MP_COST}
            </span>
            <span className="truncate text-fg-muted">Any hub you have stood in</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              title="Close (Esc)"
              className="ml-auto flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-line-strong/70 text-fg-secondary transition-colors hover:bg-surface-raised/50 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
