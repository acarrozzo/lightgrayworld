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
  killList: KillEntry[]
): { met: boolean; current: number; total: number; label?: string } {
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
    return { met: current >= total, current: Math.min(current, total), total }
  }
  if (req.type === 'hasEquippedInSlot') {
    const equipped = inventory.find((i) => i.isEquipped && i.slot === req.slot)
    const met = req.notDefault ? !!equipped : true
    return { met, current: met ? 1 : 0, total: 1 }
  }
  return { met: false, current: 0, total: 1 }
}

function resolveQuestState(
  questDef: QuestDef,
  progress: QuestProgress,
  inventory: ReturnType<typeof useGameStore.getState>['inventory'],
  killList: KillEntry[]
): { state: QuestState; progressLabel?: string } {
  if (progress.completed) return { state: 'completed' }

  const reqs = questDef.requirements ?? []
  if (reqs.length === 0) return { state: 'talk' }

  let allMet = true
  const progressParts: string[] = []

  for (const req of reqs) {
    const result = getRequirementProgress(req, progress.progress, inventory, killList)
    if (!result.met) allMet = false
    if (req.type === 'killCount') {
      progressParts.push(`${result.current}/${result.total} ${result.label ?? req.enemySlug}`)
    } else if (req.type === 'hasItem') {
      progressParts.push(`${result.current}/${result.total} ${req.itemSlug}`)
    }
  }

  if (allMet) return { state: 'turn_in' }
  return { state: 'in_progress', progressLabel: progressParts.join(', ') }
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

  const visibleQuests = useMemo(() => {
    const result: Array<{ questDef: QuestDef; progress: QuestProgress; state: QuestState; progressLabel?: string }> = []

    for (const questId of questIds) {
      const questDef = QUESTS[questId as keyof typeof QUESTS] as QuestDef | undefined
      if (!questDef) continue

      const progress = quests.find((q) => q.questId === questId)
      if (!progress) continue // hidden if locked (no QuestProgress record)

      const { state, progressLabel } = resolveQuestState(questDef, progress, inventory, killList)
      result.push({ questDef, progress, state, progressLabel })
    }

    // Sort: main quests first (by number), then side quests by level then number
    result.sort((a, b) => {
      const aIsMain = a.questDef.questType === 'main'
      const bIsMain = b.questDef.questType === 'main'
      if (aIsMain !== bIsMain) return aIsMain ? -1 : 1
      if (!aIsMain && a.questDef.level !== b.questDef.level) {
        return a.questDef.level - b.questDef.level
      }
      return a.questDef.number - b.questDef.number
    })

    return result
  }, [questIds, quests, inventory, killList])

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
                  <div className="text-xs text-white/50 mt-0.5">{progressLabel}</div>
                )}
                {isTurnIn && (
                  <div className="text-xs text-green-400/70 mt-0.5 truncate">{questDef.objective}</div>
                )}
              </div>

              {/* CTA */}
              {isCompleted ? (
                <CheckCircle size={18} className="shrink-0 text-green-600" />
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
