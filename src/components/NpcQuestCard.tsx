'use client'

import { useMemo } from 'react'
import { CheckCircle, MessageCircle } from 'lucide-react'
import QUESTS from '@/lib/game-data/quests.json'
import { useGameStore, type KillEntry } from '@/lib/game-state'
import {
  areRequirementsMet,
  getVisibleRequirementProgress,
  type QuestRequirement,
  type RequirementContext,
} from '@/lib/quest-requirements'
import QuestRequirements from './QuestRequirements'
import Icon from './Icon'

type QuestDef = {
  number: number
  questType: 'main' | 'side'
  level: number
  title: string
  objective: string
  giver: { npcId: string; roomId: string; name: string; icon: string }
  requirements?: QuestRequirement[]
  [key: string]: unknown
}

type QuestProgress = {
  id: string
  questId: string
  progress: number
  completed: boolean
  data?: { accepted?: boolean } | null
}

type QuestState = 'talk' | 'in_progress' | 'turn_in' | 'completed'

/**
 * Sentinel questId used when talking to an NPC that has no unlocked quests yet
 * (e.g. the Young Soldier before you've spoken to the Old Man). The backend
 * talk handler ignores the questId in this state and returns its intro/redirect
 * dialogue, so any non-real id works as long as it's used consistently here.
 */
export const PRE_QUEST_TALK_ID = '__pretalk__'

/**
 * The intro "talk to the NPC" quests. They carry a trivially-met `level`
 * requirement (so their data shape matches every other quest), but in the
 * journal we collapse them to a single "Talk to {npc}" button that completes
 * the quest in one click — the secondary Talk + Turn In buttons are hidden.
 *
 * Derived from `isIntro` in quests.json rather than listed here, so adding a
 * quest giver is a data change only. A hand-maintained list silently regressed
 * every NPC added after it was written.
 */
const TALK_COMPLETE_QUEST_IDS = new Set(
  Object.entries(QUESTS as Record<string, { isIntro?: boolean }>)
    .filter(([, def]) => def.isIntro)
    .map(([id]) => id)
)

interface NpcQuestCardProps {
  npcName: string
  npcIcon: string
  questIds: string[]
  quests: QuestProgress[]
  killList: KillEntry[]
  onTurnIn: (questId: string) => void
  onTalk: (questId: string) => void
  loadingQuestId?: string
}

/**
 * Short text summary of what is still missing, used only for the disabled Turn
 * In button's tooltip. The visible readout is <QuestRequirements />.
 */
function unmetSummary(questDef: QuestDef, ctx: RequirementContext): string {
  return getVisibleRequirementProgress(questDef.requirements, ctx)
    .filter((r) => !r.met)
    .map((r) => (r.countable ? `${r.current}/${r.total} ${r.label}` : r.label))
    .join(', ')
}

function resolveQuestState(questDef: QuestDef, progress: QuestProgress, ctx: RequirementContext): QuestState {
  if (progress.completed) return 'completed'
  const reqs = questDef.requirements ?? []
  if (reqs.length === 0) return 'talk'
  return areRequirementsMet(reqs, ctx) ? 'turn_in' : 'in_progress'
}

export default function NpcQuestCard({
  npcName,
  npcIcon,
  questIds,
  quests,
  killList,
  onTurnIn,
  onTalk,
  loadingQuestId,
}: NpcQuestCardProps) {
  const inventory = useGameStore((s) => s.inventory)
  const player = useGameStore((s) => s.player)

  const visibleQuests = useMemo(() => {
    const ctx: RequirementContext = { inventory, killList, player }
    const pretalkRow = (): { questDef: QuestDef; progress: QuestProgress; state: QuestState } => ({
      questDef: { title: `Talk to ${npcName}`, questType: 'main', number: 0, level: 1, objective: '', giver: { npcId: '', roomId: '', name: npcName, icon: npcIcon } },
      progress: { id: PRE_QUEST_TALK_ID, questId: PRE_QUEST_TALK_ID, progress: 0, completed: false },
      state: 'talk',
    })

    const result: Array<{ questDef: QuestDef; progress: QuestProgress; state: QuestState }> = []

    for (const questId of questIds) {
      const questDef = QUESTS[questId as keyof typeof QUESTS] as QuestDef | undefined
      if (!questDef) continue

      const progress = quests.find((q) => q.questId === questId)
      if (!progress) continue // hidden if locked (no QuestProgress record)

      result.push({ questDef, progress, state: resolveQuestState(questDef, progress, ctx) })
    }

    // No unlocked quests yet (e.g. the Young Soldier before you've talked to the
    // Old Man). Show a single Talk row through the normal display — the backend
    // returns the appropriate "talk to the Old Man first" dialogue.
    if (result.length === 0) return [pretalkRow()]

    // A finished intro "Talk to {npc}" quest has nothing left to say — its whole
    // job was to open the chain, and the follow-ups it started are already on the
    // card. Drop it so the row stays about work the player can still do.
    const active = result.filter(
      ({ progress, state }) => !(state === 'completed' && TALK_COMPLETE_QUEST_IDS.has(progress.questId))
    )
    // Everything the NPC had was that intro (its follow-ups haven't unlocked
    // yet): keep the NPC talkable rather than letting the card vanish.
    if (active.length === 0) return [pretalkRow()]

    // Sort by quest number (authored order within each NPC's chain)
    active.sort((a, b) => a.questDef.number - b.questDef.number)

    return active
  }, [questIds, quests, inventory, killList, player, npcName, npcIcon])

  if (visibleQuests.length === 0) return null

  const showTypeLabels = visibleQuests.length > 1

  return (
    <div className="w-full max-w-[600px] rounded-md border border-fg-bright/10 bg-surface-panel/60 overflow-hidden">
      {/* NPC header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-fg-bright/10 bg-surface-raised/40">
        {npcIcon && <Icon name={npcIcon} size={20} color="current" />}
        <span className="text-sm font-semibold text-fg-bright/80">{npcName}</span>
      </div>

      {/* Quest rows */}
      <div className="flex flex-col divide-y divide-fg-bright/5">
        {visibleQuests.map(({ questDef, progress, state }) => {
          const isLoading = loadingQuestId === progress.questId
          const isTalk = state === 'talk'
          const isTurnIn = state === 'turn_in'
          const isInProgress = state === 'in_progress'
          const isCompleted = state === 'completed'
          const canTurnIn = isTurnIn
          // Intro "talk to NPC" quests: collapse to a single button that completes
          // in one click, hiding the secondary Talk + Turn In buttons.
          const isTalkComplete = !isCompleted && TALK_COMPLETE_QUEST_IDS.has(progress.questId)

          return (
            <div key={progress.questId} className="flex items-center gap-3 px-3 py-2.5">
              {/* Type label */}
              {showTypeLabels && (
                <span
                  className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                    questDef.questType === 'main'
                      ? 'bg-resource-gold/20 text-resource-gold'
                      : 'bg-resource-mp/20 text-resource-mp'
                  }`}
                >
                  {questDef.questType === 'main' ? 'Main' : 'Side'}
                </span>
              )}

              {/* Quest info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-fg-bright truncate">{questDef.title}</div>
                {!isCompleted && (
                  <QuestRequirements requirements={questDef.requirements} variant="compact" className="mt-1" />
                )}
                {isTurnIn && (
                  <div className="text-xs text-status-success/70 mt-0.5 truncate">{questDef.objective}</div>
                )}
              </div>

              {/* CTA */}
              {isCompleted ? (
                <CheckCircle size={18} className="shrink-0 text-status-success" />
              ) : isTalkComplete ? (
                // Intro quests: single button that completes in one click.
                // Disabled when quest requirements aren't met yet (e.g. chest1 flag).
                <button
                  disabled={isLoading || state === 'in_progress'}
                  onClick={() => onTurnIn(progress.questId)}
                  className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    state === 'in_progress'
                      ? 'bg-surface-hover/60 text-fg-muted cursor-not-allowed'
                      : 'bg-accent hover:bg-accent-hover text-fg-bright'
                  } ${isLoading ? 'opacity-60 cursor-wait' : ''}`}
                >
                  <MessageCircle size={16} />
                  {isLoading ? '...' : `Talk to ${npcName}`}
                </button>
              ) : isTalk ? (
                // No-requirement quests: Talk only — completion happens via modal button
                <button
                  disabled={isLoading}
                  onClick={() => onTalk(progress.questId)}
                  className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors bg-accent hover:bg-accent-hover text-fg-bright ${
                    isLoading ? 'opacity-60 cursor-wait' : ''
                  }`}
                >
                  <MessageCircle size={16} />
                  {isLoading ? '...' : `Talk to ${npcName}`}
                </button>
              ) : (
                // Quests with requirements: Talk (always enabled) + Turn In (enabled when met)
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    disabled={isLoading}
                    onClick={() => onTalk(progress.questId)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-fg-primary hover:text-fg-bright bg-surface-hover/60 hover:bg-surface-selected/80 ${
                      isLoading ? 'opacity-60 cursor-wait' : ''
                    }`}
                  >
                    <MessageCircle size={16} />
                    Talk
                  </button>
                  <button
                    disabled={!canTurnIn || isLoading}
                    onClick={() => canTurnIn && onTurnIn(progress.questId)}
                    title={isInProgress ? `Still needed: ${unmetSummary(questDef, { inventory, killList, player })}` : undefined}
                    className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                      canTurnIn
                        ? 'bg-status-success/80 hover:bg-status-success text-fg-bright'
                        : 'bg-surface-hover/60 text-fg-muted cursor-not-allowed'
                    } ${isLoading ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    {isLoading ? '...' : 'Turn In'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
