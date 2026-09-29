'use client'

import { useMemo } from 'react'
import Compass from '@/components/Compass'
import WorldLayer, { type WorldTab } from './WorldLayer'
import BagLayer from './BagLayer'
import GearLayer from './GearLayer'
import Dock, { type DockLayer } from './Dock'
import RoomShortcuts from './RoomShortcuts'
import { DangerCorner, LedgerFlyout, QuickLinksCorner, type LedgerActions } from './CompassLedger'
import type { MapConfigEntry } from './constants'
import { getRoomMapView } from './utils'
import { useGatherRemaining } from '@/hooks/useGatherRemaining'
import { buildRoomShortcuts, type RoomShortcutEnemy } from '@/lib/room-shortcuts'
import { useGameStore, type InventoryItem, type Player } from '@/lib/game-state'
import type { GatherCooldownView } from '@/lib/types/room'

const { goldChestFlagForRoom } = require('@/lib/game-data/gold-chests')

/**
 * What the Explore panel is showing. `compass` is the panel itself — the
 * D-pad, the corners, the dock — and the rest are the layers docked over it:
 * `world` (Map / Teleport), `bag` (quick-use consumables) and `gear` (what you
 * are wearing), each opened from the dock under the ring. A layer closes from
 * the X in its own header; Escape, travelling, or dying also return to the
 * compass. The mobile strip has no height for a layer, so there the dock sits
 * beside the ring and opens the full-screen World overlay or a bottom sheet.
 */
export type ExploreSubView = 'compass' | 'world' | 'bag' | 'gear'

interface ExplorePanelProps extends LedgerActions {
  room: any
  player: Player | null
  /** For the corner ledger and the Gear and Bag layers. */
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
  /** Gear and Bag: docked in the sidebar, a bottom sheet from the strip. GameInterface passes the right one per variant. */
  onOpenGear: () => void
  onOpenBag: () => void
  onCloseLayer: () => void
  /** Which dock tile reads pressed: the layer open in this variant's home. */
  activeLayer?: DockLayer | null
  onUseItem: (playerItemId: string, action: string) => void
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
   * the first turn, so the D-pad and the dock stay live while a battle is on.
   * `showBattleBadge` gives them a light dim instead, so the battle deck still
   * reads as the thing with the attention.
   */
  isDimmed?: boolean
  showBattleBadge?: boolean
  /** Following a party leader: the D-pad greys out, the server refuses moves anyway. */
  isPartyMember?: boolean
  /**
   * 'sidebar' fills the desktop column and can host the layers inline; 'strip'
   * sits under the room on mobile, where there is no room for them.
   */
  variant?: 'sidebar' | 'strip'
  isLoadingRoom?: boolean
  /** The action in flight, so a shortcut chip can show it is working. */
  currentAction?: string
  /* The room's primary actions, for the shortcut rail (sidebar only). */
  roomEnemy?: RoomShortcutEnemy | null
  isInBattle?: boolean
  gatherCooldowns?: GatherCooldownView[]
  actionResult?: any
}

const NO_COOLDOWNS: GatherCooldownView[] = []

/** Bring the room card's own action list into view: the "+N in room" link. */
function showRoomActions() {
  if (typeof document === 'undefined') return
  document.querySelector('.roomboxActions')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function ExplorePanel({
  room,
  player,
  inventory = [],
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
  onOpenGear,
  onOpenBag,
  onCloseLayer,
  activeLayer = null,
  onUseItem,
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
  currentAction,
  roomEnemy = null,
  isInBattle = false,
  gatherCooldowns = NO_COOLDOWNS,
  actionResult,
}: ExplorePanelProps) {
  const isSidebar = variant === 'sidebar'
  // Only the sidebar is tall enough to hold a layer; the mobile strip sends
  // Map and Teleport to the full-screen overlay and Gear and Bag to a sheet.
  const openWorld = isSidebar ? onOpenWorldDocked : onOpenWorldOverlay
  const openDock = (layer: DockLayer) => {
    if (layer === 'map' || layer === 'teleport') openWorld(layer)
    else if (layer === 'gear') onOpenGear()
    else onOpenBag()
  }

  // The shortcut rail reads the same store the room card reads, so a quest
  // turned in from the Quests tab drops the bubble here in the same render.
  const quests = useGameStore((s) => s.quests)
  const killList = useGameStore((s) => s.killList)
  const giversMet = useGameStore((s) => s.giversMet)
  const goldChestFlag = goldChestFlagForRoom(room?.roomId) as string | null
  const goldChestOpened = useGameStore((s) => (goldChestFlag ? Boolean((s.player as any)?.[goldChestFlag]) : false))
  const { gatherRemaining } = useGatherRemaining(gatherCooldowns, room?.roomId, actionResult)
  const rail = useMemo(() => {
    if (!isSidebar || !room?.roomId) return { shortcuts: [], hidden: 0 }
    return buildRoomShortcuts({
      roomId: room.roomId,
      enemy: roomEnemy,
      isInBattle,
      gatherCooldowns,
      gatherRemaining,
      inventory,
      quests,
      killList,
      player,
      giversMet,
      goldChestOpened,
    })
  }, [isSidebar, room?.roomId, roomEnemy, isInBattle, gatherCooldowns, gatherRemaining, inventory, quests, killList, player, giversMet, goldChestOpened])

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

  if (isSidebar && subView === 'bag' && player) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <BagLayer
          variant="docked"
          inventory={inventory}
          player={player}
          disabled={isLoadingRoom}
          onUse={onUseItem}
          onOpenInventory={(filter, openItemId) => onOpenInventory?.(filter, openItemId)}
          onClose={onCloseLayer}
        />
      </div>
    )
  }

  if (isSidebar && subView === 'gear' && player) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <GearLayer
          variant="docked"
          inventory={inventory}
          player={player}
          disabled={isLoadingRoom}
          onAction={onAction}
          onOpenInventory={(filter, openItemId) => onOpenInventory?.(filter, openItemId)}
          onClose={onCloseLayer}
        />
      </div>
    )
  }

  const dimmedClasses = isDimmed ? 'opacity-20 pointer-events-none' : showBattleBadge ? 'opacity-70' : ''
  const ledger = { room, player, inventory, onOpenTraining, onOpenStats, onOpenBook, onOpenInventory }
  const mapTitle = room?.roomId ? getRoomMapView(room.roomId).title : null
  const dock = (
    <Dock
      variant={isSidebar ? 'row' : 'column'}
      active={activeLayer}
      onOpen={openDock}
      teleportDisabled={isLoadingRoom}
      mapTitle={mapTitle}
    />
  )

  return (
    <div
      className={`relative flex flex-col items-center justify-center ${
        isSidebar ? 'flex-1 min-h-0 p-4 gap-3' : 'px-2 py-3'
      }`}
    >
      {/* The corner ledger, from the original nav band: points / weapon / gold
          with their links top-left, where the original kept its quick links;
          the room, its danger, and the room's primary actions top-right, where
          the original kept its badge column. Dims with the compass; the room
          card carries the same facts in battle. The strip has no corners to
          spare, so there the ledger sits behind one button at the top-left and
          the room card keeps the actions. */}
      {!isSidebar && <LedgerFlyout {...ledger} />}
      {isSidebar && (
        <>
          <div className={`absolute top-2 left-2 z-10 transition-opacity duration-300 ${dimmedClasses}`}>
            <QuickLinksCorner {...ledger} />
          </div>
          <div className={`absolute top-2 right-2 z-10 flex flex-col items-end gap-2 transition-opacity duration-300 ${dimmedClasses}`}>
            <DangerCorner room={room} player={player} />
            <RoomShortcuts
              shortcuts={rail.shortcuts}
              hidden={rail.hidden}
              onAction={onAction}
              isLoadingRoom={isLoadingRoom}
              currentAction={currentAction}
              onShowAll={showRoomActions}
            />
          </div>
        </>
      )}

      {/* Desktop stacks the dock under the D-pad; the short mobile strip puts
          it in the column beside the ring to save vertical space. The Compass
          keeps a matching inset on both sides for its two columns. */}
      <div
        className={`flex transition-opacity duration-300 ${
          isSidebar ? 'flex-col items-center gap-4' : 'relative w-full items-center justify-center'
        } ${dimmedClasses}`}
      >
        <Compass
          room={room}
          onAction={onAction}
          onNavigateToMap={() => openWorld('map')}
          aside={isSidebar ? undefined : dock}
          isMoveInProgress={isMoveInProgress}
          isLocked={isPartyMember}
          className="w-full"
        />
        {isSidebar && dock}
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
