'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Globe, Maximize2 } from 'lucide-react'
import MapContent from '@/components/MapContent'
import SubTabButton from './SubTabButton'
import WorldGrid from './WorldGrid'
import type { MapConfigEntry } from './constants'
import { resolveMapView } from './utils'

const { getMapSheet, getSheetsForRegion, getMapIdForRoom } = require('@/lib/game-data/world-map')

interface MapViewProps {
  currentRoomId?: string
  /** The sheet on screen. Owned by GameInterface, which follows the player's room. */
  currentMapId: string
  /** Sheets the player has found, plus the one under their feet. */
  foundMaps: MapConfigEntry[]
  onMapChange: (mapId: string) => void
  /**
   * The sidebar copy has a back arrow to the compass and a Fullscreen control;
   * the fullscreen overlay has its own close button (MapPanel) and leaves room
   * for it at the right of the header.
   */
  variant: 'sidebar' | 'fullscreen'
  onBack?: () => void
  onOpenFullscreen?: () => void
}

/**
 * The Map: one region's sheet with its level chips (Surface / Underground /
 * Sewers / Mine), and a World view — the same grid Fast travel uses — for
 * moving between regions. Sheets the player has not found stay locked in the
 * grid, as the original's maps did until you found them.
 */
export default function MapView({
  currentRoomId,
  currentMapId,
  foundMaps,
  onMapChange,
  variant,
  onBack,
  onOpenFullscreen,
}: MapViewProps) {
  const [showWorld, setShowWorld] = useState(false)

  // Walking somewhere while the map is open snaps it back to the sheet you are
  // on; the World view is for looking around, not a place to be left in.
  useEffect(() => {
    setShowWorld(false)
  }, [currentRoomId])

  const foundIds = foundMaps.map((map) => map.id)
  const sheet = getMapSheet(currentMapId)
  const regionId: string | null = sheet?.region ?? null
  const regionSheets: Array<{ id: string; title: string; level: string }> = regionId
    ? getSheetsForRegion(regionId).filter((s: { id: string }) => foundIds.includes(s.id))
    : []
  const mapView = resolveMapView(currentMapId, foundMaps, currentRoomId)

  const selectRegion = (nextRegionId: string) => {
    const candidates: Array<{ id: string }> = getSheetsForRegion(nextRegionId).filter((s: { id: string }) =>
      foundIds.includes(s.id)
    )
    if (candidates.length === 0) return
    // Prefer the sheet the player is standing on when it belongs to this region.
    const hereId = currentRoomId ? getMapIdForRoom(currentRoomId) : null
    const pick = candidates.find((s) => s.id === hereId) ?? candidates[0]
    onMapChange(pick.id)
    setShowWorld(false)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className={`flex items-center gap-2 border-b border-line-subtle/50 py-2 pl-3 flex-shrink-0 overflow-x-auto ${
          variant === 'fullscreen' ? 'pr-14' : 'pr-3'
        }`}
      >
        {variant === 'sidebar' && onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to the compass"
            title="Back to the compass (Esc)"
            className="-ml-1 rounded p-1 text-fg-secondary transition-colors hover:bg-surface-raised/50 hover:text-fg-bright"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
        )}
        <SubTabButton
          active={showWorld}
          color="sky"
          onClick={() => setShowWorld((v) => !v)}
          ariaPressed={showWorld}
          title="World"
        >
          <Globe size={14} aria-hidden="true" />
          <span>World</span>
        </SubTabButton>
        {!showWorld && regionSheets.length > 1 && (
          <>
            <span className="h-4 w-px bg-line-strong/60 flex-shrink-0" aria-hidden="true" />
            {regionSheets.map((s) => (
              <SubTabButton
                key={s.id}
                active={s.id === currentMapId}
                color="sky"
                onClick={() => onMapChange(s.id)}
                ariaPressed={s.id === currentMapId}
                title={s.title}
              >
                {s.level}
              </SubTabButton>
            ))}
          </>
        )}
        <span className="ml-auto truncate text-[11px] text-fg-muted">{showWorld ? 'Map of the world' : mapView.title}</span>
        {variant === 'sidebar' && onOpenFullscreen && (
          <button
            type="button"
            onClick={onOpenFullscreen}
            aria-label="Open the map full screen"
            title="Open the map full screen"
            className="flex-shrink-0 rounded p-1 text-fg-secondary transition-colors hover:bg-surface-raised/50 hover:text-fg-bright"
          >
            <Maximize2 size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {showWorld ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          <WorldGrid
            mode="map"
            currentRoomId={currentRoomId}
            foundMapIds={foundIds}
            selectedRegionId={regionId}
            onSelectRegion={selectRegion}
          />
        </div>
      ) : (
        <MapContent mapSrc={mapView.src} mapTitle={mapView.title} marker={mapView.marker} />
      )}
    </div>
  )
}
