'use client'

import { X } from 'lucide-react'
import QUESTS from '@/lib/game-data/quests.json'
import type { InventoryItem } from '@/lib/game-state'

interface Quest {
  id: string
  questId: string
  progress: number
  completed: boolean
}

interface QuestsPanelProps {
  quests: Quest[]
  isLoadingQuests: boolean
  isResettingQuests: boolean
  isLoggedIn: boolean
  inventory: InventoryItem[]
  onResetQuests: () => void
  onClose: () => void
}

export default function QuestsPanel({
  quests,
  isLoadingQuests,
  isResettingQuests,
  isLoggedIn,
  inventory,
  onResetQuests,
  onClose,
}: QuestsPanelProps) {
  return (
    <div className="relative w-full h-full">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-gray-800/50"
        title="Close"
        aria-label="Close"
      >
        <X size={20} />
      </button>
      <div className="space-y-4 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-white">Quests</h3>
        {isLoadingQuests ? (
          <div className="text-gray-400 text-sm">Unraveling your quest log...</div>
        ) : quests.length === 0 ? (
          <div className="text-gray-400 text-sm">No quests.</div>
        ) : (
          <div className="space-y-6">
            {/* Active Quests */}
            {(() => {
              // Sort quests by number before filtering
              const sortedQuests = [...quests].sort((a, b) => {
                const aDef = QUESTS[a.questId as keyof typeof QUESTS]
                const bDef = QUESTS[b.questId as keyof typeof QUESTS]
                const aNum = aDef?.number || 999
                const bNum = bDef?.number || 999
                return aNum - bNum
              })
              const activeQuests = sortedQuests.filter(q => !q.completed)
              return activeQuests.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-3">Active</h4>
                  <div className="space-y-4">
                    {activeQuests.map((quest) => {
                      const questDef = QUESTS[quest.questId as keyof typeof QUESTS]
                      if (!questDef) return null

                      // Check if ready to turn in (for turn_in completion mode)
                      let isReadyToTurnIn = false
                      if (questDef.completionMode === 'turn_in' && questDef.requirements) {
                        const hasAllRequirements = questDef.requirements.every((req: any) => {
                          if (req.type === 'hasItem') {
                            const item = inventory.find(i => i.template.slug === req.itemSlug)
                            return item && item.quantity >= (req.quantity || 1)
                          }
                          return false
                        })
                        isReadyToTurnIn = hasAllRequirements
                      }

                      return (
                        <div
                          key={quest.id}
                          className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              {questDef.giver?.name && (
                                <p className="text-gray-500 text-xs mb-1">
                                  {questDef.giver.name}
                                </p>
                              )}
                              <h4 className="text-white font-semibold text-base">
                                {questDef.title}
                              </h4>
                              <p className="text-gray-400 text-sm mt-1">
                                {questDef.summary}
                              </p>
                            </div>
                            <span className="px-2 py-1 bg-blue-900/50 border border-blue-700/50 text-blue-300 text-xs font-semibold rounded">
                              Active
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-sm">Objective:</span>
                              <span className="text-gray-300 text-sm">
                                {questDef.objective}
                              </span>
                            </div>
                            {questDef.rewards && questDef.rewards.length > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-sm">Reward:</span>
                                <span className="text-gray-300 text-sm">
                                  {questDef.rewards.map((r: any, idx: number) => {
                                    if (r.type === 'currency') return `${r.amount} Gold`
                                    if (r.type === 'xp') return `${r.amount} XP`
                                    return ''
                                  }).filter(Boolean).join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                          {isReadyToTurnIn && questDef.giver && (
                            <div className="pt-2 border-t border-gray-700/50">
                              <p className="text-yellow-400 text-sm font-medium">
                                Ready to turn in — return to {questDef.giver.roomId === '003' ? 'the Old Man' : `Room ${questDef.giver.roomId}`} to complete the quest.
                              </p>
                            </div>
                          )}
                          {questDef.nextStep && (
                            <div className="pt-2 border-t border-gray-700/50">
                              <p className="text-gray-500 text-xs mt-2">
                                Next: {questDef.nextStep}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null
            })()}

            {/* Completed Quests */}
            {(() => {
              // Sort quests by number before filtering
              const sortedQuests = [...quests].sort((a, b) => {
                const aDef = QUESTS[a.questId as keyof typeof QUESTS]
                const bDef = QUESTS[b.questId as keyof typeof QUESTS]
                const aNum = aDef?.number || 999
                const bNum = bDef?.number || 999
                return aNum - bNum
              })
              const completedQuests = sortedQuests.filter(q => q.completed)
              return completedQuests.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-3">Completed</h4>
                  <div className="space-y-4">
                    {completedQuests.map((quest) => {
                      const questDef = QUESTS[quest.questId as keyof typeof QUESTS]
                      if (!questDef) return null

                      return (
                        <div
                          key={quest.id}
                          className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 space-y-3 opacity-75"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              {questDef.giver?.name && (
                                <p className="text-gray-500 text-xs mb-1">
                                  {questDef.giver.name}
                                </p>
                              )}
                              <h4 className="text-white font-semibold text-base">
                                {questDef.title}
                              </h4>
                              <p className="text-gray-400 text-sm mt-1">
                                {questDef.summary}
                              </p>
                            </div>
                            <span className="px-2 py-1 bg-green-900/50 border border-green-700/50 text-green-300 text-xs font-semibold rounded">
                              Completed
                            </span>
                          </div>
                          {questDef.rewards && questDef.rewards.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-sm">Reward:</span>
                              <span className="text-gray-300 text-sm">
                                {questDef.rewards.map((r: any) => {
                                  if (r.type === 'currency') return `${r.amount} Gold`
                                  if (r.type === 'xp') return `${r.amount} XP`
                                  return ''
                                }).filter(Boolean).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null
            })()}
          </div>
        )}
        {/* Reset Quests Button */}
        {!isLoadingQuests && (
          <div className="mt-6 pt-4 border-t border-gray-700/50">
            <button
              onClick={onResetQuests}
              disabled={isResettingQuests || !isLoggedIn}
              className="w-full px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 hover:border-red-600/70 text-red-400 hover:text-red-300 text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResettingQuests ? 'Resetting...' : 'Reset Quests to Initial State'}
            </button>
            <p className="mt-2 text-xs text-gray-500 text-center">
              Resets all quests except Quest 001 (for testing)
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

