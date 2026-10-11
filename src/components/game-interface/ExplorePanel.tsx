'use client'

import { useMemo } from 'react'
import Compass from '@/components/Compass'
import Icon from '@/components/Icon'
import NotificationBadge from '@/components/NotificationBadge'
import { DeckContent, type DeckContentProps } from './Deck'
import { DeckProvider, type DeckContextValue } from './LayerShell'
import BasicActionButtons from '@/components/BasicActionButtons'
import EffectsButton from './EffectsButton'
import TrackedQuests, { TrackedQuestsButton } from './TrackedQuestCard'
import type { TrackedQuestView } from '@/lib/tracked-quest'
import { statusChips } from '@/lib/status-effects'
import type { InventoryItem, Player } from '@/lib/game-state'


/**
 * The Explore panel is where you act. The D-pad, Up and Down in a column on
 * its left as the original had them; the four verbs — Attack, Search, Rest,
 * and All actions, which opens the strike, spell and item block over the
 * compass — under the ring in the column and to its right on a phone; what
 * is running on you behind one small Effects button in the corner; and above
 * it all the quests you are following, each with its next step. The room
 * card keeps the room's own hand-authored actions; these are the ones you
 * can always do.
 *
 * The phone strip has one height, always: the ring's, plus its padding.
 * Nothing in it is added or removed as things happen — Up and Down are
 * drawn faint when the room has neither, the corners are absolute, the
 * chips are behind a button — so the room above never jumps. The one
 * deliberate change is the fold to a bar during a fight, which GameInterface
 * draws instead of this.
 *
 * Action closes from the X in its header, Escape, travelling or dying. On a
 * phone it opens as a page over the room that GameInterface draws.
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
  // Blue, the Explore tab's own accent, not the attack red: it opens a
  // block, it does not swing. "Actions" on a phone, where the column is narrow.
  const actionButton = actionUnlocked && (
    <button
      type="button"
      onClick={onToggleAction}
      aria-pressed={actionOpen}
      aria-label="All actions — attack, strikes, spells and items"
      title="All actions — attack, strikes, spells and items"
      className={`relative flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-medium transition-all duration-200 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
        isSidebar ? 'h-10 px-4 text-sm' : 'h-9 w-20 px-1 text-xs'
      } ${
        actionOpen
          ? 'fill-hue-blue border-fg-bright/20 ring-2 ring-line-focus'
          : actionFresh
          ? 'tab-fresh border-hue-blue bg-hue-blue/25 text-hue-blue'
          : 'border-hue-blue/60 bg-hue-blue/15 text-hue-blue hover:bg-hue-blue/25 hover:border-hue-blue'
      }`}
    >
      <NotificationBadge value={enemyHere} className="absolute -right-1 -top-1 z-10" />
      <Icon name="hand" size={isSidebar ? 16 : 14} color="current" />
      <span>{isSidebar ? 'All actions' : 'Actions'}</span>
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
      containerClassName={isSidebar ? 'flex items-center justify-center gap-2' : 'flex flex-col items-stretch gap-1.5'}
      sizeClassName={isSidebar ? 'h-10 px-4 text-sm' : 'h-9 w-20 px-1 text-xs'}
    />
  )

  if (!isSidebar) {
    // The phone strip: the pin and the Effects button in the corners, the
    // ring with Up and Down on its left and the four verbs stacked on its
    // right. One height, the ring's plus padding, whatever the room has.
    return (
      <div className="relative px-1 py-2.5">
        {onOpenTrackedQuest && <TrackedQuestsButton quests={trackedQuests} onOpen={onOpenTrackedQuest} roomId={room?.roomId} />}
        <EffectsButton chips={chips} className="absolute right-2 top-2" />
        <div className={`transition-opacity duration-300 ${dimmedClasses}`}>
          <Compass
            room={room}
            onAction={onAction}
            onNavigateToMap={onOpenMap}
            isMoveInProgress={isMoveInProgress}
            isLocked={isPartyMember}
            className="w-full"
            side={
              <div className="flex flex-col items-stretch gap-1.5">
                {basicVerbs}
                {actionButton}
              </div>
            }
          />
        </div>
      </div>
    )
  }

  // The column: the ring in the middle, Up and Down on its left, the followed
  // quests centred in the space above it, the verbs (All actions on its own
  // line) centred in the space below, the Effects button in the corner.
  const home = (
    <div className="relative flex min-h-0 flex-1 flex-col items-center p-4">
      <EffectsButton chips={chips} className="absolute right-3 top-3" />
      <div className={`flex min-h-0 w-full flex-1 flex-col items-center justify-center py-2 transition-opacity duration-300 ${dimmedClasses}`}>
        {onOpenTrackedQuest && <TrackedQuests quests={trackedQuests} onOpen={onOpenTrackedQuest} />}
      </div>
      <div className={`w-full transition-opacity duration-300 ${dimmedClasses}`}>
        <Compass room={room} onAction={onAction} onNavigateToMap={onOpenMap} isMoveInProgress={isMoveInProgress} isLocked={isPartyMember} large className="w-full" />
      </div>
      <div className={`flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 py-2 transition-opacity duration-300 ${dimmedClasses}`}>
        {basicVerbs}
        {actionButton}
      </div>
      {isPartyMember && !isDimmed && <p className="text-[11px] text-status-info/70">Following your party — leave to move freely.</p>}
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
