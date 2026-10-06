'use client'

import { useMemo } from 'react'
import Compass from '@/components/Compass'
import Icon from '@/components/Icon'
import NotificationBadge from '@/components/NotificationBadge'
import { DeckContent, type DeckContentProps } from './Deck'
import { DeckProvider, type DeckContextValue } from './LayerShell'
import BasicActionButtons from '@/components/BasicActionButtons'
import StatusStrip from '@/components/StatusStrip'
import TrackedQuests, { TrackedQuestsButton } from './TrackedQuestCard'
import type { TrackedQuestView } from '@/lib/tracked-quest'
import { statusChips } from '@/lib/status-effects'
import type { InventoryItem, Player } from '@/lib/game-state'


/**
 * The Explore panel is where you act. The D-pad, with each exit named under
 * it once you have been through; the four verbs beneath — Attack, Search,
 * Rest, and All actions, which opens the strike, spell and item block over
 * the compass; what is running on you as chips; and above it all the quests
 * you are following, each with its next step. The room card keeps the
 * room's own hand-authored actions; these are the ones you can always do.
 *
 * Action closes from the X in its header, Escape, travelling or dying. The
 * mobile strip has no height for that layer, so there it opens as a sheet
 * that GameInterface draws.
 */
interface ExplorePanelProps {
  room: any
  player: Player | null
  /** For the status chips. */
  inventory?: InventoryItem[]
  /** The quests being followed, and how to open them. */
  trackedQuests?: TrackedQuestView[]
  onOpenTrackedQuest?: () => void
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
  /** The action in flight, so its verb can show it is working. */
  currentAction?: string
  /** The last action's result, for the flyout that anchors to the verb that caused it. */
  actionResult?: any
}

const NO_QUESTS: TrackedQuestView[] = []

/** "In Battle" at the bottom of the panel: the compass is live in a fight, so the badge keeps off the controls. */
function BattleBadge() {
  return (
    <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 z-10">
      <span className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-status-error/90 bg-surface-canvas/70 border border-status-error/25 rounded-lg backdrop-blur-sm">
        In Battle
      </span>
    </div>
  )
}

export default function ExplorePanel({
  room,
  player,
  inventory = [],
  trackedQuests = NO_QUESTS,
  onOpenTrackedQuest,
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
  actionResult,
}: ExplorePanelProps) {
  const isSidebar = variant === 'sidebar'
  const deckContext = useMemo<DeckContextValue>(
    () => ({ presentation: 'docked', onClose: onCloseAction ?? (() => {}) }),
    [onCloseAction],
  )

  // What is running on you, as the Char panel shows it: regen, tea, poison, wings.
  const chips = useMemo(() => statusChips(player, inventory), [player, inventory])

  const dimmedClasses = isDimmed ? 'opacity-20 pointer-events-none' : showBattleBadge ? 'opacity-70' : ''
  const actionButton = actionUnlocked && (
    <button
      type="button"
      onClick={onToggleAction}
      aria-pressed={actionOpen}
      aria-label="All actions — attack, strikes, spells and items"
      title="All actions — attack, strikes, spells and items"
      className={`relative flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-medium transition-all duration-200 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
        isSidebar ? 'h-10 px-4 text-sm' : 'h-11 flex-1 px-2 text-sm'
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
      <span>All actions</span>
    </button>
  )

  // The four verbs in one row: the three the original always showed, and
  // Action. BasicActionButtons owns the result flyout, so a Search's answer
  // appears over the Search button here.
  const basicVerbs = (
    <BasicActionButtons
      onAction={onAction}
      actionResult={actionResult}
      isLoadingRoom={isLoadingRoom}
      currentAction={currentAction}
      containerClassName={isSidebar ? 'flex items-center justify-center gap-2' : 'flex flex-1 items-center gap-2'}
      fill={!isSidebar}
      sizeClassName={isSidebar ? 'h-10 px-4 text-sm' : 'h-11 px-2 text-sm'}
    />
  )

  if (!isSidebar) {
    // The phone strip: the pin for followed quests at the corner, the ring,
    // then the four verbs sharing the width as thumb targets.
    return (
      <div className="relative flex flex-col items-center gap-2.5 px-2 py-3">
        {onOpenTrackedQuest && <TrackedQuestsButton quests={trackedQuests} onOpen={onOpenTrackedQuest} roomId={room?.roomId} />}
        <div className={`flex w-full flex-col items-center gap-2.5 transition-opacity duration-300 ${dimmedClasses}`}>
          <Compass room={room} onAction={onAction} onNavigateToMap={onOpenMap} isMoveInProgress={isMoveInProgress} isLocked={isPartyMember} className="w-full" />
          <div className="flex w-full items-center gap-2">
            {basicVerbs}
            {actionButton}
          </div>
          <StatusStrip chips={chips} className="justify-center" />
        </div>
        {showBattleBadge && <BattleBadge />}
      </div>
    )
  }

  // The column: the ring in the middle, the followed quests centred in the
  // space above it, the verbs (All actions on its own line) and the status
  // chips centred in the space below.
  const home = (
    <div className="relative flex min-h-0 flex-1 flex-col items-center p-4">
      <div className={`flex min-h-0 w-full flex-1 flex-col items-center justify-center py-2 transition-opacity duration-300 ${dimmedClasses}`}>
        {onOpenTrackedQuest && <TrackedQuests quests={trackedQuests} onOpen={onOpenTrackedQuest} />}
      </div>
      <div className={`w-full transition-opacity duration-300 ${dimmedClasses}`}>
        <Compass room={room} onAction={onAction} onNavigateToMap={onOpenMap} isMoveInProgress={isMoveInProgress} isLocked={isPartyMember} large className="w-full" />
      </div>
      <div className={`flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 py-2 transition-opacity duration-300 ${dimmedClasses}`}>
        {basicVerbs}
        {actionButton}
        <StatusStrip chips={chips} className="justify-center" />
      </div>
      {isPartyMember && !isDimmed && <p className="text-[11px] text-status-info/70">Following your party — leave to move freely.</p>}
      {showBattleBadge && <BattleBadge />}
    </div>
  )

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
