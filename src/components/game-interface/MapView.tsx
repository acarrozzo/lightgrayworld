'use client'

import { useEffect, useState } from 'react'
import { Globe, Maximize2, X } from 'lucide-react'
import MapContent from '@/components/MapContent'
import SubTabButton from './SubTabButton'
import WorldGrid, { type WorldLevel } from './WorldGrid'
import type { MapConfigEntry } from './constants'
import { resolveMapView } from './utils'

const { getMapSheet, getSheetsForRegion } = require('@/lib/game-data/world-map')

interface MapViewProps {
  currentRoomId?: string
  /** The sheet on screen. Owned by GameInterface, which follows the player's room. */
  currentMapId: string
  /** Sheets the player has found, plus the one under their feet. */
  foundMaps: MapConfigEntry[]
  onMapChange: (mapId: string) => void
  /** The sidebar copy also offers a Fullscreen control; both close from the X at top right. */
  variant: 'sidebar' | 'fullscreen'
  onClose: () => void
  onOpenFullscreen?: () => void
}

/**
 * The Map: one region's sheet with its level chips (Surface / Underground /
 * Sewers / Mine), and a World view — the same grid Fast travel uses — for
 * moving between regions. The World view draws each region as its own sheet,
 * with a Surface / Below switch like the original maps page's "Swap level".
 * Sheets the player has not found stay locked in the grid, as the original's
 * maps did until you found them.
 */
export default function MapView({
  currentRoomId,
  currentMapId,
  foundMaps,
  onMapChange,
  variant,
  onClose,
  onOpenFullscreen,
}: MapViewProps) {
  const [showWorld, setShowWorld] = useState(false)
  const [worldLevel, setWorldLevel] = useState<WorldLevel>('surface')

  // Walking somewhere while the map is open snaps it back to the sheet you are
  // on; the World view is for looking around, not a place to be left in.
  useEffect(() => {
    setShowWorld(false)
    setWorldLevel('surface')
  }, [currentRoomId])

  const foundIds = foundMaps.map((map) => map.id)
  const sheet = getMapSheet(currentMapId)
  const regionId: string | null = sheet?.region ?? null
  const regionSheets: Array<{ id: string; title: string; level: string }> = regionId
    ? getSheetsForRegion(regionId).filter((s: { id: string }) => foundIds.includes(s.id))
    : []
  const mapView = resolveMapView(currentMapId, foundMaps, currentRoomId)

  const toggleWorld = () => {
    setWorldLevel('surface')
    setShowWorld((v) => !v)
  }

  const selectSheet = (sheetId: string) => {
    onMapChange(sheetId)
    setShowWorld(false)
  }

  const headerTitle = showWorld ? (worldLevel === 'below' ? 'Below the world' : 'Map of the world') : mapView.title

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 border-b border-line-subtle/50 py-2 pl-3 pr-2 flex-shrink-0 overflow-x-auto">
        <SubTabButton active={showWorld} color="sky" onClick={toggleWorld} ariaPressed={showWorld} title="World">
          <Globe size={14} aria-hidden="true" />
          <span>World</span>
        </SubTabButton>
        {showWorld ? (
          <>
            <span className="h-4 w-px bg-line-strong/60 flex-shrink-0" aria-hidden="true" />
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
        ) : (
          regionSheets.length > 1 && (
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
          )
        )}
        <span className="ml-auto truncate text-[11px] text-fg-muted">{headerTitle}</span>
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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the map"
          title="Close (Esc)"
          className="flex-shrink-0 rounded p-1 text-fg-secondary transition-colors hover:bg-surface-raised/50 hover:text-fg-bright"
        >
          <X size={variant === 'fullscreen' ? 20 : 16} aria-hidden="true" />
        </button>
      </div>

      {showWorld ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {/* The sidebar is 420px wide; full screen, the squares would grow to
              the overlay's width, so the grid keeps a sidebar-like width there. */}
          <div className={variant === 'fullscreen' ? 'mx-auto max-w-[520px]' : ''}>
            <WorldGrid
              mode="map"
              currentRoomId={currentRoomId}
              foundMapIds={foundIds}
              selectedRegionId={regionId}
              level={worldLevel}
              onSelectSheet={selectSheet}
            />
          </div>
        </div>
      ) : (
        <MapContent mapSrc={mapView.src} mapTitle={mapView.title} marker={mapView.marker} />
      )}
    </div>
  )
}
