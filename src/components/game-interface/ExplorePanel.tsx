'use client'

import Compass from '@/components/Compass'
import WorldLayer, { type WorldTab } from './WorldLayer'
import { DangerCorner, LedgerFlyout, QuickLinksCorner, type LedgerActions } from './CompassLedger'
import type { MapConfigEntry } from './constants'
import type { InventoryItem, Player } from '@/lib/game-state'

/**
 * What the Explore panel is showing. `compass` is the panel itself — the
 * D-pad and the actions — and `world` is the Map / Teleport layer docked over
 * it, opened from the Map and Teleport pills under the action buttons or the
 * mini-map in the D-pad's centre. The layer closes from the X in its own
 * header; Escape, travelling, or entering battle also return to the compass.
 * The mobile strip has no height for the layer, so there every one of those
 * controls opens the full-screen overlay instead.
 */
export type ExploreSubView = 'compass' | 'world'

interface ExplorePanelProps extends LedgerActions {
  room: any
  player: Player | null
  /** For the corner ledger: the equipped weapon and helmet by name. */
  inventory?: InventoryItem[]
  subView: ExploreSubView
  worldTab: WorldTab
  onWorldTabChange: (tab: WorldTab) => void
  /** Sidebar: open the layer docked (or full screen, if that is how it was last used). */
  onOpenWorldDocked: (tab: WorldTab) => void
  /** Strip: open the full-screen overlay. */
  onOpenWorldOverlay: (tab: WorldTab) => void
  onCloseWorld: () => void
  /** Docked layer's full-screen control. */
  onExpandWorld: () => void
  onAction: (action: string | { type: string; data?: any }) => void
  onTeleport: (roomId: string) => void
  teleportBlockedReason?: string | null
  currentMapId: string
  availableMaps: MapConfigEntry[]
  onMapChange: (mapId: string) => void
  isMoveInProgress?: boolean
  /**
   * Put the compass out of reach — dead, or the crafting sheet is over it.
   * A fight does not: teleport is the way out of one and Retreat is open from
   * the first turn, so the D-pad and its Map / Teleport controls stay live
   * while a battle is on. `showBattleBadge` gives them a light dim instead, so
   * the battle deck still reads as the thing with the attention.
   */
  isDimmed?: boolean
  showBattleBadge?: boolean
  /** Following a party leader: the D-pad greys out, the server refuses moves anyway. */
  isPartyMember?: boolean
  /**
   * 'sidebar' fills the desktop column and can host the layer inline; 'strip'
   * sits under the room on mobile, where there is no room for it — there the
   * Map and Teleport buttons open the full-screen overlay directly.
   */
  variant?: 'sidebar' | 'strip'
  isLoadingRoom?: boolean
}

export default function ExplorePanel({
  room,
  player,
  inventory,
  onOpenTraining,
  onOpenStats,
  onOpenBook,
  onOpenInventory,
  subView,
  worldTab,
  onWorldTabChange,
  onOpenWorldDocked,
  onOpenWorldOverlay,
  onCloseWorld,
  onExpandWorld,
  onAction,
  onTeleport,
  teleportBlockedReason = null,
  currentMapId,
  availableMaps,
  onMapChange,
  isMoveInProgress = false,
  isDimmed = false,
  showBattleBadge = false,
  isPartyMember = false,
  variant = 'sidebar',
  isLoadingRoom = false,
}: ExplorePanelProps) {
  const isSidebar = variant === 'sidebar'
  // Only the sidebar is tall enough to hold the layer; the mobile strip sends
  // every map and teleport affordance straight to the full-screen overlay.
  const openWorld = isSidebar ? onOpenWorldDocked : onOpenWorldOverlay

  if (isSidebar && subView === 'world') {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <WorldLayer
          variant="docked"
          tab={worldTab}
          onTabChange={onWorldTabChange}
          player={player}
          currentRoomId={room?.roomId}
          currentMapId={currentMapId}
          foundMaps={availableMaps}
          onMapChange={onMapChange}
          onTeleport={onTeleport}
          teleportBlockedReason={teleportBlockedReason}
          onClose={onCloseWorld}
          onFullscreen={onExpandWorld}
        />
      </div>
    )
  }

  const dimmedClasses = isDimmed ? 'opacity-20 pointer-events-none' : showBattleBadge ? 'opacity-70' : ''
  const ledger = { room, player, inventory, onOpenTraining, onOpenStats, onOpenBook, onOpenInventory }

  return (
    <div
      className={`relative flex flex-col items-center justify-center ${
        isSidebar ? 'flex-1 min-h-0 p-4 gap-3' : 'px-2 py-3'
      }`}
    >
      {/* The corner ledger, from the original nav band: points / weapon / gold
          with their links top-left, where the original kept its quick links;
          danger and room top-right. Dims with the compass; the room card
          carries the same facts in battle. The strip has no corners to spare,
          so there the whole ledger sits behind one button at the top-left and
          opens as a flyout. */}
      {!isSidebar && <LedgerFlyout {...ledger} />}
      {isSidebar && (
        <>
          <div className={`absolute top-2 left-2 z-10 transition-opacity duration-300 ${dimmedClasses}`}>
            <QuickLinksCorner {...ledger} />
          </div>
          <div className={`absolute top-2 right-2 z-10 transition-opacity duration-300 ${dimmedClasses}`}>
            <DangerCorner room={room} player={player} />
          </div>
        </>
      )}

      {/* Desktop stacks the actions under the D-pad; the short mobile strip puts
          them in a column beside it to save vertical space. The Compass keeps a
          48px left inset for its up/down buttons. */}
      <div
        className={`flex transition-opacity duration-300 ${
          isSidebar ? 'flex-col items-center gap-4' : 'relative w-full items-center justify-center'
        } ${dimmedClasses}`}
      >
        <Compass
          room={room}
          onAction={onAction}
          onNavigateToMap={() => openWorld('map')}
          onOpenTeleport={() => openWorld('teleport')}
          isTeleportDisabled={isLoadingRoom}
          isMoveInProgress={isMoveInProgress}
          isLocked={isPartyMember}
          className="w-full"
        />
      </div>
      {isSidebar && isPartyMember && !isDimmed && (
        <p className="text-[11px] text-status-info/70">Following your party — leave to move freely.</p>
      )}
      {/* The badge used to sit dead centre, over a compass nothing could click
          anyway. The compass is live in a fight now, and the centre of the ring
          is the mini-map button, so it sits under the ring instead of on top of
          a control. */}
      {showBattleBadge && (
        <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 z-10">
          <span className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-status-error/90 bg-surface-canvas/70 border border-status-error/25 rounded-lg backdrop-blur-sm">
            In Battle
          </span>
        </div>
      )}
    </div>
  )
}
