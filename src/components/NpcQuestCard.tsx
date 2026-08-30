'use client'

import { useMemo } from 'react'
import { CheckCircle, MessageCircle } from 'lucide-react'
import QUESTS from '@/lib/game-data/quests.json'
import { useGameStore, type KillEntry } from '@/lib/game-state'
import Icon from './Icon'

type QuestDef = {
  number: number
  questType: 'main' | 'side'
  level: number
  title: string
  objective: string
  giver: { npcId: string; roomId: string; name: string; icon: string }
  requirements?: Array<{
    type: string
    itemSlug?: string
    quantity?: number
    count?: number
    displayName?: string
    slot?: string
    notDefault?: boolean
    enemySlug?: string
    minLevel?: number
    flag?: string
  }>
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
 */
const TALK_COMPLETE_QUEST_IDS = new Set(['quest_oldman_000', 'quest_youngsoldier_000', 'quest_jacklumber_intro', 'quest_forestgnome_intro', 'quest_hunterbill_intro'])

/** "training-helmet" -> "Training Helmet". Fallback when no nicer name is available. */
function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Display name for an item-collection requirement. The client has no item
 * catalog, so resolve in order of fidelity: an explicit `displayName` on the
 * requirement (author override, same convention as killCount), then the name
 * from a copy the player already owns, then a humanized slug. Works for any
 * item without per-quest data.
 */
function resolveItemLabel(
  slug: string,
  displayName: string | undefined,
  inventory: ReturnType<typeof useGameStore.getState>['inventory']
): string {
  if (displayName) return displayName
  const owned = inventory.find((i) => i.template.slug === slug)
  return owned?.template.name ?? humanizeSlug(slug)
}

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

function getRequirementProgress(
  req: NonNullable<QuestDef['requirements']>[number],
  progress: number,
  inventory: ReturnType<typeof useGameStore.getState>['inventory'],
  killList: KillEntry[],
  playerLevel: number
): { met: boolean; current: number; total: number; label?: string } {
  if (req.type === 'level') {
    const min = req.minLevel ?? 0
    return { met: playerLevel >= min, current: 1, total: 1 }
  }
  if (req.type === 'killCount') {
    const total = req.count ?? 1
    const current = killList.find((k) => k.monster === req.enemySlug)?.kills ?? 0
    return { met: current >= total, current: Math.min(current, total), total, label: req.displayName }
  }
  if (req.type === 'hasItem') {
    const total = req.quantity ?? 1
    const current = inventory
      .filter((i) => i.template.slug === req.itemSlug)
      .reduce((sum, i) => sum + i.quantity, 0)
    const label = resolveItemLabel(req.itemSlug ?? '', req.displayName, inventory)
    return { met: current >= total, current: Math.min(current, total), total, label }
  }
  if (req.type === 'hasEquippedInSlot') {
    const equipped = inventory.find((i) => i.isEquipped && i.slot === req.slot)
    const met = req.notDefault ? !!equipped : true
    return { met, current: met ? 1 : 0, total: 1 }
  }
  if (req.type === 'hasFlag') {
    const player = useGameStore.getState().player
    const met = req.flag ? !!(player as any)?.[req.flag] : false
    return { met, current: met ? 1 : 0, total: 1 }
  }
  return { met: false, current: 0, total: 1 }
}

function resolveQuestState(
  questDef: QuestDef,
  progress: QuestProgress,
  inventory: ReturnType<typeof useGameStore.getState>['inventory'],
  killList: KillEntry[],
  playerLevel: number
): { state: QuestState; progressLabel?: string } {
  if (progress.completed) return { state: 'completed' }

  const reqs = questDef.requirements ?? []
  if (reqs.length === 0) return { state: 'talk' }

  let allMet = true
  const progressParts: string[] = []

  for (const req of reqs) {
    const result = getRequirementProgress(req, progress.progress, inventory, killList, playerLevel)
    if (!result.met) allMet = false
    if (req.type === 'killCount') {
      progressParts.push(`${result.current}/${result.total} ${result.label ?? req.enemySlug}`)
    } else if (req.type === 'hasItem') {
      progressParts.push(`${result.current}/${result.total} ${result.label ?? req.itemSlug}`)
    }
  }

  if (allMet) return { state: 'turn_in' }
  return { state: 'in_progress', progressLabel: progressParts.join('\n') }
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
  const playerLevel = useGameStore((s) => s.player?.level ?? 0)

  const visibleQuests = useMemo(() => {
    const result: Array<{ questDef: QuestDef; progress: QuestProgress; state: QuestState; progressLabel?: string }> = []

    for (const questId of questIds) {
      const questDef = QUESTS[questId as keyof typeof QUESTS] as QuestDef | undefined
      if (!questDef) continue

      const progress = quests.find((q) => q.questId === questId)
      if (!progress) continue // hidden if locked (no QuestProgress record)

      const { state, progressLabel } = resolveQuestState(questDef, progress, inventory, killList, playerLevel)
      result.push({ questDef, progress, state, progressLabel })
    }

    // No unlocked quests yet (e.g. the Young Soldier before you've talked to the
    // Old Man). Show a single Talk row through the normal display — the backend
    // returns the appropriate "talk to the Old Man first" dialogue.
    if (result.length === 0) {
      result.push({
        questDef: { title: `Talk to ${npcName}`, questType: 'main', number: 0, level: 1, objective: '', giver: { npcId: '', roomId: '', name: npcName, icon: npcIcon } },
        progress: { id: PRE_QUEST_TALK_ID, questId: PRE_QUEST_TALK_ID, progress: 0, completed: false },
        state: 'talk',
      })
      return result
    }

    // Sort by quest number (authored order within each NPC's chain)
    result.sort((a, b) => a.questDef.number - b.questDef.number)

    return result
  }, [questIds, quests, inventory, killList, playerLevel, npcName, npcIcon])

  if (visibleQuests.length === 0) return null

  const showTypeLabels = visibleQuests.length > 1

  return (
    <div className="w-full max-w-[600px] rounded-md border border-white/10 bg-gray-900/60 overflow-hidden">
      {/* NPC header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-gray-800/40">
        {npcIcon && <Icon name={npcIcon} size={20} color="current" />}
        <span className="text-sm font-semibold text-white/80">{npcName}</span>
      </div>

      {/* Quest rows */}
      <div className="flex flex-col divide-y divide-white/5">
        {visibleQuests.map(({ questDef, progress, state, progressLabel }) => {
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
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-blue-500/20 text-blue-300'
                  }`}
                >
                  {questDef.questType === 'main' ? 'Main' : 'Side'}
                </span>
              )}

              {/* Quest info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{questDef.title}</div>
                {isInProgress && progressLabel && (
                  <div className="text-xs text-white/50 mt-0.5 whitespace-pre-line">{progressLabel}</div>
                )}
                {isTurnIn && (
                  <div className="text-xs text-green-400/70 mt-0.5 truncate">{questDef.objective}</div>
                )}
              </div>

              {/* CTA */}
              {isCompleted ? (
                <CheckCircle size={18} className="shrink-0 text-green-600" />
              ) : isTalkComplete ? (
                // Intro quests: single button that completes in one click.
                // Disabled when quest requirements aren't met yet (e.g. chest1 flag).
                <button
                  disabled={isLoading || state === 'in_progress'}
                  onClick={() => onTurnIn(progress.questId)}
                  className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    state === 'in_progress'
                      ? 'bg-gray-700/60 text-gray-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
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
                  className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-500 text-white ${
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
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-300 hover:text-white bg-gray-700/60 hover:bg-gray-600/80 ${
                      isLoading ? 'opacity-60 cursor-wait' : ''
                    }`}
                  >
                    <MessageCircle size={16} />
                    Talk
                  </button>
                  <button
                    disabled={!canTurnIn || isLoading}
                    onClick={() => canTurnIn && onTurnIn(progress.questId)}
                    title={isInProgress && progressLabel ? `Still needed: ${progressLabel}` : undefined}
                    className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                      canTurnIn
                        ? 'bg-green-600 hover:bg-green-500 text-white'
                        : 'bg-gray-700/60 text-gray-500 cursor-not-allowed'
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
