'use client'

import { ArrowLeft } from 'lucide-react'
import Compass from '@/components/Compass'
import BasicActionButtons from '@/components/BasicActionButtons'
import WorldGrid, { foundMapIdsFor } from './WorldGrid'
import MapView from './MapView'
import type { MapConfigEntry } from './constants'
import type { Player } from '@/lib/game-state'

const { TELEPORT_MP_COST } = require('@/lib/game-data/teleport-destinations')

/**
 * What the Explore panel is showing. `compass` is the panel itself — the
 * D-pad and the actions — and the other two are layers that open over it:
 * Fast travel from the Teleport button, the Map from the mini-map in the
 * D-pad's centre (sidebar only; the mobile strip opens the full-screen map
 * instead). Escape, the back arrow, travelling, or entering battle all return
 * to the compass.
 */
export type ExploreSubView = 'compass' | 'teleport' | 'map'

interface ExplorePanelProps {
  room: any
  player: Player | null
  subView: ExploreSubView
  onSubViewChange: (view: ExploreSubView) => void
  onAction: (action: string | { type: string; data?: any }) => void
  onTeleport: (roomId: string) => void
  teleportBlockedReason?: string | null
  /** Opens the map as a layer of this panel (sidebar only). */
  onShowMap: () => void
  /** Opens the full-screen map overlay. */
  onOpenMapFullscreen: () => void
  currentMapId: string
  availableMaps: MapConfigEntry[]
  onMapChange: (mapId: string) => void
  isMoveInProgress?: boolean
  /** Dim the compass (battle / crafting). */
  isDimmed?: boolean
  showBattleBadge?: boolean
  /** Following a party leader: the D-pad greys out, the server refuses moves anyway. */
  isPartyMember?: boolean
  /**
   * 'sidebar' fills the desktop column and can host the map inline; 'strip'
   * sits under the room on mobile, where there is no room for a map — there the
   * mini-map opens the full-screen overlay directly.
   */
  variant?: 'sidebar' | 'strip'
  /** Latest action result, for the flyout on the basic-action buttons. */
  actionResult?: any
  isLoadingRoom?: boolean
  currentAction?: string
}

export default function ExplorePanel({
  room,
  player,
  subView,
  onSubViewChange,
  onAction,
  onTeleport,
  teleportBlockedReason = null,
  onShowMap,
  onOpenMapFullscreen,
  currentMapId,
  availableMaps,
  onMapChange,
  isMoveInProgress = false,
  isDimmed = false,
  showBattleBadge = false,
  isPartyMember = false,
  variant = 'sidebar',
  actionResult,
  isLoadingRoom = false,
  currentAction = '',
}: ExplorePanelProps) {
  const isSidebar = variant === 'sidebar'
  // Only the sidebar is tall enough to hold a map; the mobile strip sends every
  // map affordance straight to the full-screen overlay.
  const showMapHere = isSidebar ? onShowMap : onOpenMapFullscreen
  const isTeleport = subView === 'teleport'
  const isMap = isSidebar && subView === 'map'
  const backToCompass = () => onSubViewChange('compass')

  if (isMap) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <MapView
          variant="sidebar"
          currentRoomId={room?.roomId}
          currentMapId={currentMapId}
          foundMaps={availableMaps}
          onMapChange={onMapChange}
          onBack={backToCompass}
          onOpenFullscreen={onOpenMapFullscreen}
        />
      </div>
    )
  }

  if (isTeleport) {
    return (
      <div className={`min-h-0 overflow-y-auto ${isSidebar ? 'flex-1' : 'max-h-[340px]'}`}>
        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={backToCompass}
              aria-label="Back to the compass"
              title="Back to the compass (Esc)"
              className="-ml-1 rounded p-1 text-fg-secondary transition-colors hover:bg-surface-raised/50 hover:text-fg-bright"
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
            <h2 className="text-sm font-semibold text-fg-bright">Fast travel</h2>
            <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-fg-muted">Esc to close</span>
            <span className="ml-auto text-[11px] font-semibold text-resource-mp" title="Each fast travel costs MP">
              MP cost: {TELEPORT_MP_COST}
            </span>
          </div>

          {teleportBlockedReason && (
            <p className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-[11px] leading-relaxed text-status-error/90">
              {teleportBlockedReason}
            </p>
          )}

          <WorldGrid
            mode="teleport"
            currentRoomId={room?.roomId}
            discoveredTeleports={player?.discoveredTeleports ?? []}
            foundMapIds={foundMapIdsFor(player, room?.roomId)}
            blockedReason={teleportBlockedReason}
            onTeleport={onTeleport}
            dense={!isSidebar}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative flex flex-col items-center justify-center ${
        isSidebar ? 'flex-1 min-h-0 p-4 gap-3' : 'px-2 py-3'
      }`}
    >
      {/* Desktop stacks the actions under the D-pad; the short mobile strip puts
          them in a column beside it to save vertical space. The Compass keeps a
          48px left inset for its up/down buttons. */}
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
          isLocked={isPartyMember}
          className={
            isSidebar
              ? 'w-full sm:max-w-[380px] max-w-[320px] mx-auto'
              : 'w-[272px] sm:w-[304px] shrink-0 pl-12'
          }
        />
        <BasicActionButtons
          onAction={onAction}
          actionResult={actionResult}
          isLoadingRoom={isLoadingRoom}
          currentAction={currentAction}
          containerClassName={
            isSidebar ? 'flex flex-wrap justify-center gap-2' : 'flex flex-col gap-1.5 shrink-0'
          }
          sizeClassName={isSidebar ? 'px-4 py-1.5 text-sm' : 'px-2.5 py-1.5 text-xs w-full'}
        >
          {/* Teleport takes the slot Look used to hold, in the MP blue: fast
              travel costs MP, and the original's teleport page wore that blue. */}
          <button
            type="button"
            onClick={() => onSubViewChange('teleport')}
            disabled={isLoadingRoom}
            title={`Fast travel — ${TELEPORT_MP_COST} MP`}
            className={`${
              isSidebar ? 'px-4 py-1.5 text-sm' : 'px-2.5 py-1.5 text-xs w-full'
            } fill-resource-mp shadow-sm shadow-shadow disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium whitespace-nowrap transition-all duration-200 hover:shadow-md active:scale-[0.97]`}
          >
            Teleport
          </button>
        </BasicActionButtons>
      </div>
      {isSidebar && isPartyMember && !isDimmed && (
        <p className="text-[11px] text-status-info/70">Following your party — leave to move freely.</p>
      )}
      {showBattleBadge && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
          <span className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-status-error/90 bg-surface-canvas/70 border border-status-error/25 rounded-lg backdrop-blur-sm">
            In Battle
          </span>
        </div>
      )}
    </div>
  )
}
