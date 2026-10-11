'use client'

import { useMemo } from 'react'
import Compass from '@/components/Compass'
import BasicActionButtons from '@/components/BasicActionButtons'
import EffectsButton from './EffectsButton'
import TrackedQuests, { TrackedQuestsButton } from './TrackedQuestCard'
import type { TrackedQuestView } from '@/lib/tracked-quest'
import { statusChips } from '@/lib/status-effects'
import type { InventoryItem, Player } from '@/lib/game-state'


/**
 * The Explore panel is where you move. The D-pad, Up and Down in a column on
 * its left as the original had them; the three verbs the original always
 * showed — Attack, Search, Rest — under the ring in the column and to its
 * right on a phone; what is running on you behind one small Effects button in
 * the corner; and above it all the quests you are following, each with its
 * next step. The room card keeps the room's own hand-authored actions; these
 * are the ones you can always do. Strikes, spells and items are the Actions
 * tab, one tile over.
 *
 * The phone strip has one height, always: the ring's, plus its padding.
 * Nothing in it is added or removed as things happen — Up and Down are
 * drawn faint when the room has neither, the corners are absolute, the
 * chips are behind a button — so the room above never jumps. The one
 * deliberate change is the fold to a bar during a fight, which GameInterface
 * draws instead of this.
 */
interface ExplorePanelProps {
  room: any
  player: Player | null
  /** For the status chips. */
  inventory?: InventoryItem[]
  /** The quests being followed, and how to open them. */
  trackedQuests?: TrackedQuestView[]
  onOpenTrackedQuest?: () => void
  /** The centre of the compass ring: the World tab on its Map. Absent until World has been earned. */
  onOpenMap?: () => void
  onAction: (action: string | { type: string; data?: any }) => void
  isMoveInProgress?: boolean
  /**
   * Put the compass out of reach — dead, or the crafting sheet is over it.
   * A fight does not: teleport is the way out of one and Retreat is open from
   * the first turn, so the D-pad stays live while a battle is on.
   * `showBattleBadge` gives the compass a light dim instead, so the battle
   * deck still reads as the thing with the attention.
   */
  isDimmed?: boolean
  showBattleBadge?: boolean
  /** Following a party leader: the D-pad greys out, the server refuses moves anyway. */
  isPartyMember?: boolean
  /** 'sidebar' fills the desktop column; 'strip' sits under the room on mobile. */
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
  onOpenMap,
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

  // What is running on you, as the Char panel shows it: regen, tea, poison, wings.
  const chips = useMemo(() => statusChips(player, inventory), [player, inventory])

  const dimmedClasses = isDimmed ? 'opacity-20 pointer-events-none' : showBattleBadge ? 'opacity-70' : ''
  // The three verbs the original always showed. BasicActionButtons owns the
  // result flyout, so a Search's answer appears over the Search button here.
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
    // ring with Up and Down on its left and the three verbs stacked on its
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
            side={<div className="flex flex-col items-stretch gap-1.5">{basicVerbs}</div>}
          />
        </div>
      </div>
    )
  }

  // The column: the ring in the middle, Up and Down on its left, the followed
  // quests centred in the space above it, the verbs centred in the space
  // below, the Effects button in the corner.
  return (
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
      </div>
      {isPartyMember && !isDimmed && <p className="text-[11px] text-status-info/70">Following your party — leave to move freely.</p>}
    </div>
  )
}
