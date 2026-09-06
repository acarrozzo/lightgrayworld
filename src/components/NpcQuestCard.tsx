'use client'

import { useMemo } from 'react'
import { CheckCircle, MessageCircle } from 'lucide-react'
import { QUESTS, questOrderIndex } from '@/lib/game-data/quest-registry'
import { useGameStore, type KillEntry, type QuestProgressRow } from '@/lib/game-state'
import {
  areRequirementsMet,
  getVisibleRequirementProgress,
  type QuestRequirement,
  type RequirementContext,
} from '@/lib/quest-requirements'
import QuestRequirements from './QuestRequirements'
import QuestTypeTag, { type QuestType } from './QuestTypeTag'
import Icon from './Icon'

type QuestDef = {
  giverId: string
  questType: QuestType
  level: number
  title: string
  objective: string
  requirements?: QuestRequirement[]
  [key: string]: unknown
}

type QuestState = 'talk' | 'in_progress' | 'turn_in' | 'completed'

/**
 * Sentinel questId used when talking to a giver the player has not met yet.
 * The talk handler ignores the questId in this state: the first talk is the
 * meeting, which records it, opens the giver's quests, and shows the greeting.
 */
export const PRE_QUEST_TALK_ID = '__pretalk__'

interface NpcQuestCardProps {
  npcName: string
  npcIcon: string
  questIds: string[]
  quests: QuestProgressRow[]
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

function resolveQuestState(questDef: QuestDef, progress: QuestProgressRow, ctx: RequirementContext): QuestState {
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
  const giversMet = useGameStore((s) => s.giversMet)

  const visibleQuests = useMemo(() => {
    const ctx: RequirementContext = { inventory, killList, player, quests, giversMet }
    const pretalkRow = (): { questDef: QuestDef; progress: QuestProgressRow; state: QuestState } => ({
      questDef: { giverId: '', title: `Talk to ${npcName}`, questType: 'side', level: 1, objective: '' },
      progress: { id: PRE_QUEST_TALK_ID, questId: PRE_QUEST_TALK_ID, progress: 0, completed: false },
      state: 'talk',
    })

    const result: Array<{ questDef: QuestDef; progress: QuestProgressRow; state: QuestState }> = []

    for (const questId of questIds) {
      const questDef = (QUESTS as Record<string, QuestDef>)[questId]
      if (!questDef) continue

      const progress = quests.find((q) => q.questId === questId)
      if (!progress) continue // not open yet: no row

      result.push({ questDef, progress, state: resolveQuestState(questDef, progress, ctx) })
    }

    // Nothing open — the giver has not been met (or has nothing yet). One Talk
    // row keeps them talkable; the server answers with the greeting or the
    // giver's locked line.
    if (result.length === 0) return [pretalkRow()]

    result.sort((a, b) => questOrderIndex(a.progress.questId) - questOrderIndex(b.progress.questId))

    return result
  }, [questIds, quests, giversMet, inventory, killList, player, npcName])

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
          const isPretalk = progress.questId === PRE_QUEST_TALK_ID

          return (
            <div key={progress.questId} className="flex items-center gap-3 px-3 py-2.5">
              {/* Type label */}
              {showTypeLabels && !isPretalk && <QuestTypeTag type={questDef.questType} />}

              {/* Quest info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-fg-bright truncate">{questDef.title}</div>
                {!isCompleted && !isPretalk && (
                  <QuestRequirements requirements={questDef.requirements} variant="compact" className="mt-1" />
                )}
                {isTurnIn && (
                  <div className="text-xs text-status-success/70 mt-0.5 truncate">{questDef.objective}</div>
                )}
              </div>

              {/* CTA */}
              {isCompleted ? (
                <CheckCircle size={18} className="shrink-0 text-status-success" />
              ) : isTalk ? (
                // Meeting the giver, or a quest with nothing to bring: Talk only —
                // completion happens via the modal button.
                <button
                  disabled={isLoading}
                  onClick={() => onTalk(progress.questId)}
                  className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors fill-accent hover:bg-accent-hover ${
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
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:text-fg-bright fill-surface-hover hover:bg-surface-selected/80 ${
                      isLoading ? 'opacity-60 cursor-wait' : ''
                    }`}
                  >
                    <MessageCircle size={16} />
                    Talk
                  </button>
                  <button
                    disabled={!canTurnIn || isLoading}
                    onClick={() => canTurnIn && onTurnIn(progress.questId)}
                    title={isInProgress ? `Still needed: ${unmetSummary(questDef, { inventory, killList, player, quests, giversMet })}` : undefined}
                    className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                      canTurnIn
                        ? 'fill-status-success'
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
