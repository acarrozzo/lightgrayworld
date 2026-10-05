'use client'

import { useMemo } from 'react'
import Compass from '@/components/Compass'
import Icon from '@/components/Icon'
import NotificationBadge from '@/components/NotificationBadge'
import { DeckContent, type DeckContentProps } from './Deck'
import { DeckProvider, type DeckContextValue } from './LayerShell'
import RoomShortcuts from './RoomShortcuts'
import { DangerCorner, LedgerFlyout, QuickLinksCorner, type LedgerActions } from './CompassLedger'
import { useGatherRemaining } from '@/hooks/useGatherRemaining'
import { buildRoomShortcuts } from '@/lib/room-shortcuts'
import type { RoomEnemy } from '@/components/RoomBox'
import { useGameStore, type InventoryItem, type Player } from '@/lib/game-state'
import type { GatherCooldownView } from '@/lib/types/room'

const { goldChestFlagForRoom } = require('@/lib/game-data/gold-chests')

/**
 * The Explore panel: the D-pad and its corners, with the Action button under
 * the ring (beside it on the phone strip). Action is Explore's own utility,
 * not a tab: on a wide screen it opens the attack, strike, spell and
 * item block over the compass, and closes from the X in its header,
 * Escape, travelling or dying. The mobile strip has no height for that, so
 * there it opens as a sheet that GameInterface draws.
 */
interface ExplorePanelProps extends LedgerActions {
  room: any
  player: Player | null
  /** For the corner ledger and the shortcut rail. */
  inventory?: InventoryItem[]
  /** Sidebar: what the Action layer draws from when it is open over the compass. */
  deck?: DeckContentProps
  /** The Action layer is open, so its button reads pressed. */
  actionOpen?: boolean
  /** A dot on the Action button: something in the room can be attacked. */
  enemyHere?: boolean
  /** The Action button: open the layer, or close it if it is open. */
  onToggleAction: () => void
  /** Action has been earned: there is something to use. Until then the button is not drawn. */
  actionUnlocked?: boolean
  /** It has just arrived and not been pressed yet. */
  actionFresh?: boolean
  /** The centre of the compass ring: the World tab on its Map. Absent until World has been earned. */
  onOpenMap?: () => void
  onCloseAction?: () => void
  onAction: (action: string | { type: string; data?: any }) => void
  isMoveInProgress?: boolean
  /**
   * Put the compass out of reach — dead, or the crafting sheet is over it.
   * A fight does not: teleport is the way out of one and Retreat is open from
   * the first turn, so the D-pad and Action stay live while a battle is on.
   * `showBattleBadge` gives the compass a light dim instead, so the battle
   * deck still reads as the thing with the attention.
   */
  isDimmed?: boolean
  showBattleBadge?: boolean
  /** Following a party leader: the D-pad greys out, the server refuses moves anyway. */
  isPartyMember?: boolean
  /**
   * 'sidebar' fills the desktop column and can host the Action layer inline; 'strip'
   * sits under the room on mobile, where there is no room for one.
   */
  variant?: 'sidebar' | 'strip'
  isLoadingRoom?: boolean
  /** The action in flight, so a shortcut chip can show it is working. */
  currentAction?: string
  /* The room's present enemy: the shortcut rail's Attack chip. */
  roomEnemy?: RoomEnemy | null
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
  onOpenPoints,
  onOpenSp,
  onOpenInventory,
  deck,
  actionOpen = false,
  enemyHere = false,
  onToggleAction,
  actionUnlocked = true,
  actionFresh = false,
  onOpenMap,
  onCloseAction,
  onAction,
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
  const deckContext = useMemo<DeckContextValue>(
    () => ({ presentation: 'docked', onClose: onCloseAction ?? (() => {}) }),
    [onCloseAction],
  )

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

  const dimmedClasses = isDimmed ? 'opacity-20 pointer-events-none' : showBattleBadge ? 'opacity-70' : ''
  const ledger = { room, player, inventory, onOpenPoints, onOpenSp, onOpenInventory }
  const actionButton = actionUnlocked && (
    <button
      type="button"
      onClick={onToggleAction}
      aria-pressed={actionOpen}
      aria-label="Action — attack, strikes, spells and items"
      title="Action — attack, strikes, spells and items"
      className={`relative flex items-center justify-center font-semibold uppercase tracking-widest border transition-all duration-200 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
        isSidebar ? 'h-9 w-32 flex-row gap-2 rounded-lg text-[10px]' : 'h-11 w-11 flex-col gap-0.5 rounded-lg text-[7px]'
      } ${
        actionOpen
          ? 'fill-action-attack border-fg-bright/20 ring-2 ring-line-focus'
          : actionFresh
          ? 'tab-fresh border-action-attack bg-action-attack/25 text-action-attack'
          : 'border-action-attack/60 bg-action-attack/15 text-action-attack hover:bg-action-attack/25 hover:border-action-attack'
      }`}
    >
      <NotificationBadge value={enemyHere} className="absolute -right-1 -top-1 z-10" />
      <Icon name="hand" size={16} color="current" />
      <span aria-hidden="true">Action</span>
    </button>
  )

  const home = (
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

      {/* Desktop puts Action under the D-pad, centred in whatever height is
          left below the ring (an equal spacer above keeps the ring itself in
          the middle of the column). The short mobile strip puts it beside the
          ring, where the Compass centres it in the space to the ring's right. */}
      <div
        className={`flex transition-opacity duration-300 ${
          isSidebar ? 'min-h-0 w-full flex-1 flex-col items-center' : 'relative w-full items-center justify-center'
        } ${dimmedClasses}`}
      >
        {isSidebar && <div className="min-h-0 flex-1" aria-hidden="true" />}
        <Compass
          room={room}
          onAction={onAction}
          onNavigateToMap={onOpenMap}
          aside={isSidebar ? undefined : actionButton || undefined}
          isMoveInProgress={isMoveInProgress}
          isLocked={isPartyMember}
          large={isSidebar}
          className="w-full"
        />
        {isSidebar && <div className="flex min-h-[3.25rem] w-full flex-1 items-center justify-center">{actionButton}</div>}
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

  if (!isSidebar) return home

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {actionOpen && deck ? (
        <DeckProvider value={deckContext}>
          <div className="flex min-h-0 flex-1 flex-col">
            <DeckContent tab="action" {...deck} />
          </div>
        </DeckProvider>
      ) : (
        home
      )}
    </div>
  )
}
