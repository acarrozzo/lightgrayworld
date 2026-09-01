'use client'

import { Compass as CompassIcon, Map as MapIcon, Maximize2 } from 'lucide-react'
import Icon from '@/components/Icon'
import Compass from '@/components/Compass'
import BasicActionButtons, { type BasicActionSurface } from '@/components/BasicActionButtons'
import MapContent from '@/components/MapContent'
import TeleportList, { type TeleportLocation } from './TeleportList'
import SubTabButton from './SubTabButton'
import { getTabIconColorClass } from '@/lib/tabColors'
import { resolveMapView } from './utils'
import type { MapConfigEntry } from './constants'

export type ExploreSubView = 'compass' | 'teleport' | 'map'

interface ExplorePanelProps {
  room: any
  subView: ExploreSubView
  onSubViewChange: (view: ExploreSubView) => void
  onAction: (action: string | { type: string; data?: any }) => void
  onTeleport: (roomId: string) => void
  teleportLocations: TeleportLocation[]
  teleportBlockedReason?: string | null
  /** Opens the map as a sub-view of this panel (sidebar only). */
  onShowMap: () => void
  /** Opens the full-screen map overlay. */
  onOpenMapFullscreen: () => void
  currentMapId: string
  availableMaps: MapConfigEntry[]
  onMapChange: (mapId: string) => void
  isMoveInProgress?: boolean
  /** Dim the compass (battle / crafting) without hiding the sub-tabs. */
  isDimmed?: boolean
  showBattleBadge?: boolean
  /**
   * 'sidebar' fills the desktop column and can host the map inline; 'strip'
   * sits under the room on mobile, where there is no room for a map — there the
   * Map control opens the full-screen overlay directly.
   */
  variant?: 'sidebar' | 'strip'
  /** Latest action result, for the flyout on the basic-action buttons. */
  actionResult?: any
  isLoadingRoom?: boolean
  currentAction?: string
  /** Basic-action flyout ownership — shared with the room's copy of the buttons. */
  activeActionSurface?: BasicActionSurface
  onActionSurfaceChange?: (surface: BasicActionSurface) => void
}

export default function ExplorePanel({
  room,
  subView,
  onSubViewChange,
  onAction,
  onTeleport,
  teleportLocations,
  teleportBlockedReason = null,
  onShowMap,
  onOpenMapFullscreen,
  currentMapId,
  availableMaps,
  onMapChange,
  isMoveInProgress = false,
  isDimmed = false,
  showBattleBadge = false,
  variant = 'sidebar',
  actionResult,
  isLoadingRoom = false,
  currentAction = '',
  activeActionSurface = 'explore',
  onActionSurfaceChange,
}: ExplorePanelProps) {
  const isSidebar = variant === 'sidebar'
  // Only the sidebar is tall enough to hold a map; the mobile strip sends every
  // map affordance straight to the full-screen overlay.
  const showMapHere = isSidebar ? onShowMap : onOpenMapFullscreen
  const isCompass = subView === 'compass'
  const isTeleport = subView === 'teleport'
  const isMap = isSidebar && subView === 'map'
  const mapView = resolveMapView(currentMapId, availableMaps, room?.roomId)

  return (
    <>
      {/* Sub-tabs — one level below the Explore tab itself. Clicking the active
          one toggles back to the Compass, this panel's core content, so a
          sub-tab is never a one-way door. */}
      <div className="flex items-center gap-2 px-3 pt-1 pb-1.5 border-b border-line-subtle/50 flex-shrink-0 overflow-x-auto">
        <SubTabButton
          active={isCompass}
          color="green"
          onClick={() => onSubViewChange('compass')}
          ariaPressed={isCompass}
          title="Compass"
        >
          <CompassIcon size={14} className={getTabIconColorClass('green', isCompass)} aria-hidden="true" />
          <span>Compass</span>
        </SubTabButton>
        <SubTabButton
          active={isTeleport}
          color="violet"
          onClick={() => onSubViewChange(isTeleport ? 'compass' : 'teleport')}
          ariaPressed={isTeleport}
          title="Teleport"
        >
          <Icon name="ironskin" size={14} className={getTabIconColorClass('violet', isTeleport)} />
          <span>Teleport</span>
        </SubTabButton>
        {!isSidebar && <span className="w-1 h-1 rounded-full bg-surface-selected flex-shrink-0" aria-hidden="true" />}
        <SubTabButton
          active={isMap}
          color="sky"
          onClick={isMap ? () => onSubViewChange('compass') : showMapHere}
          ariaPressed={isSidebar ? isMap : undefined}
          title={isSidebar ? 'Map' : 'Open Map'}
        >
          <MapIcon size={14} className={getTabIconColorClass('sky', isMap)} aria-hidden="true" />
          <span>Map</span>
        </SubTabButton>
      </div>

      {isMap ? (
        <div className="flex-1 min-h-0 flex flex-col relative">
          <MapContent
            mapSrc={mapView.src}
            mapTitle={mapView.title}
            availableMaps={mapView.options}
            currentMapId={currentMapId}
            onMapChange={onMapChange}
            marker={mapView.marker}
          />
          <button
            type="button"
            onClick={onOpenMapFullscreen}
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded fill-surface-raised px-3 py-1.5 text-sm font-medium shadow-lg transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas"
            title="Open the map full screen"
          >
            <Maximize2 size={14} aria-hidden="true" />
            Fullscreen
          </button>
        </div>
      ) : isTeleport ? (
        <div className={`min-h-0 overflow-y-auto ${isSidebar ? 'flex-1' : 'max-h-[300px]'}`}>
          <TeleportList
            locations={teleportLocations}
            currentRoomId={room?.roomId}
            onTeleport={onTeleport}
            blockedReason={teleportBlockedReason}
          />
        </div>
      ) : (
        <div
          className={`relative flex items-center justify-center ${
            isSidebar ? 'flex-1 min-h-0 p-4' : 'px-2 py-3'
          }`}
        >
          {/* Desktop stacks the basic actions under the D-pad; the short mobile
              strip puts them in a column beside it to save vertical space. The
              Compass keeps a 48px left inset for its up/down buttons. */}
          <div
            className={`flex transition-opacity duration-300 ${
              isSidebar ? 'flex-col items-center gap-4' : 'flex-row items-center justify-center gap-2'
            } ${isDimmed ? 'opacity-20 pointer-events-none' : ''}`}
          >
            <Compass
              room={room}
              onAction={onAction}
              onNavigateToMap={showMapHere}
              isMoveInProgress={isMoveInProgress}
              className={
                isSidebar
                  ? 'w-full sm:max-w-[380px] max-w-[320px] mx-auto'
                  : 'w-[272px] sm:w-[304px] shrink-0 pl-12'
              }
            />
            <BasicActionButtons
              surface="explore"
              activeSurface={activeActionSurface}
              onActionSurfaceChange={onActionSurfaceChange}
              onAction={onAction}
              actionResult={actionResult}
              isLoadingRoom={isLoadingRoom}
              currentAction={currentAction}
              containerClassName={
                isSidebar ? 'flex flex-wrap justify-center gap-2' : 'flex flex-col gap-1.5 shrink-0'
              }
              sizeClassName={isSidebar ? 'px-4 py-1.5 text-sm' : 'px-2.5 py-1.5 text-xs w-full'}
            />
          </div>
          {showBattleBadge && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
              <span className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-status-error/90 bg-surface-canvas/70 border border-status-error/25 rounded-lg backdrop-blur-sm">
                In Battle
              </span>
            </div>
          )}
        </div>
      )}
    </>
  )
}
