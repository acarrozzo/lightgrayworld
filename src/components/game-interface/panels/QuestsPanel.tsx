'use client'

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import QUESTS from '@/lib/game-data/quests.json'
import type { InventoryItem } from '@/lib/game-state'
import { useGameStore } from '@/lib/game-state'

interface Quest {
  id: string
  questId: string
  progress: number
  completed: boolean
}

interface BattleLogEntry {
  id: string
  enemySlug: string
  enemyName: string
  outcome: string
  turnsCount: number
  totalDamageDealt: number
  totalDamageReceived: number
  maxSingleHit: number
  xpEarned: number
  goldEarned: number
  itemsDropped: string[]
  multiplayerBonus: boolean
  createdAt: string
}

interface KillEntry {
  id: string
  monster: string
  kills: number
}

type Tab = 'quests' | 'completed-quests' | 'kill-list' | 'battle-log'

interface QuestsPanelProps {
  quests: Quest[]
  isLoadingQuests: boolean
  isResettingQuests: boolean
  isLoggedIn: boolean
  inventory: InventoryItem[]
  onResetQuests: () => void
  onClose: () => void
}

const QUEST_SUB_TABS: { id: Tab; label: string }[] = [
  { id: 'quests', label: 'Quests' },
  { id: 'completed-quests', label: 'Completed' },
  { id: 'kill-list', label: 'Kill List' },
  { id: 'battle-log', label: 'Battle Log' },
]

function SubTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1.5 h-8 text-sm font-medium transition-all duration-200 flex items-center justify-center rounded-lg shadow-sm hover:shadow flex-shrink-0 ${
        active
          ? 'border-1 border-amber-500 hover:border-amber-400 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300'
          : 'border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  )
}

function BattleLogTab({ getAuthHeaders }: { getAuthHeaders: () => Record<string, string> }) {
  const [logs, setLogs] = useState<BattleLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/player/battle-log', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) setLogs(data.logs)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
      setLoaded(true)
    }
  }, [getAuthHeaders])

  useEffect(() => {
    if (!loaded) fetchLogs()
  }, [loaded, fetchLogs])

  if (isLoading) return <p className="text-gray-500 text-sm">Loading battle log...</p>
  if (loaded && logs.length === 0) return <p className="text-gray-500 text-sm">No battles recorded yet.</p>

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const isWin = log.outcome === 'WIN'
        const date = new Date(log.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        return (
          <div
            key={log.id}
            className={`rounded-lg border p-3 space-y-2 ${isWin ? 'border-green-800/40 bg-green-950/20' : 'border-red-900/40 bg-red-950/10'}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isWin ? 'bg-green-800/60 text-green-300' : 'bg-red-900/60 text-red-400'}`}>
                  {isWin ? 'WIN' : 'LOSS'}
                </span>
                <span className="text-sm font-semibold text-white">{log.enemyName}</span>
                {log.multiplayerBonus && (
                  <span className="text-[10px] text-blue-400 bg-blue-900/30 px-1 rounded">group</span>
                )}
              </div>
              <span className="text-[10px] text-gray-600">{date}</span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Turns</p>
                <p className="text-xs font-semibold text-gray-200">{log.turnsCount}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Dealt</p>
                <p className="text-xs font-semibold text-gray-200">{log.totalDamageDealt}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Received</p>
                <p className="text-xs font-semibold text-gray-200">{log.totalDamageReceived}</p>
              </div>
              <div>
                <p className="text-[10px] text-yellow-600 uppercase tracking-wide">Best Hit</p>
                <p className="text-xs font-semibold text-yellow-300">{log.maxSingleHit}</p>
              </div>
            </div>
            {isWin && (
              <div className="flex items-center gap-3 text-[11px] text-gray-400 pt-0.5 border-t border-gray-800/40">
                <span className="text-green-400">+{log.xpEarned} XP</span>
                <span className="text-yellow-400">+{log.goldEarned} Gold</span>
                {log.itemsDropped.length > 0 && (
                  <span className="text-purple-400">+{log.itemsDropped.join(', ')}</span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function KillListTab({ getAuthHeaders }: { getAuthHeaders: () => Record<string, string> }) {
  const [kills, setKills] = useState<KillEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const fetchKills = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/player/kill-list', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) setKills(data.kills)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
      setLoaded(true)
    }
  }, [getAuthHeaders])

  useEffect(() => {
    if (!loaded) fetchKills()
  }, [loaded, fetchKills])

  if (isLoading) return <p className="text-gray-500 text-sm">Loading kill list...</p>
  if (loaded && kills.length === 0) return <p className="text-gray-500 text-sm">No kills recorded yet.</p>

  const total = kills.reduce((sum, k) => sum + k.kills, 0)

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">{total} total kills across {kills.length} creature{kills.length !== 1 ? 's' : ''}</p>
      {kills.map((entry) => (
        <div key={entry.id} className="flex items-center justify-between bg-gray-800/40 border border-gray-700/40 rounded-lg px-3 py-2">
          <span className="text-sm text-gray-200 capitalize">{entry.monster.replace(/-/g, ' ')}</span>
          <span className="text-sm font-bold text-red-400">{entry.kills} kill{entry.kills !== 1 ? 's' : ''}</span>
        </div>
      ))}
    </div>
  )
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
  const [activeTab, setActiveTab] = useState<Tab>('quests')
  const getAuthHeaders = useGameStore((s) => s.getAuthHeaders)
  const killList = useGameStore((s) => s.killList)

  // killCount progress is tracked in the kill list, not on quest.progress (which stays 0 for these quests)
  const getKillCount = (enemySlug: string) =>
    killList.find((k) => k.monster === enemySlug)?.kills ?? 0

  return (
    <div className="relative w-full h-full flex flex-col min-h-0">
      <button
        onClick={onClose}
        className="absolute top-2 right-3 z-30 p-2 text-gray-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-gray-800/50"
        title="Close"
        aria-label="Close"
      >
        <X size={20} />
      </button>

      <div className="flex gap-2 border-b border-gray-700/50 pl-4 pr-12 md:pr-12 py-2 flex-shrink-0">
        <div className="flex-1 flex items-center justify-center gap-2 flex-nowrap overflow-x-auto">
          {QUEST_SUB_TABS.map((tab) => (
            <SubTabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </SubTabButton>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">

        {/* ── Quests tab (active only) ── */}
        {activeTab === 'quests' && (
          <>
            {isLoadingQuests ? (
              <div className="text-gray-400 text-sm">Unraveling your quest log...</div>
            ) : (() => {
              const activeQuests = [...quests]
                .sort((a, b) => {
                  const aNum = QUESTS[a.questId as keyof typeof QUESTS]?.number || 999
                  const bNum = QUESTS[b.questId as keyof typeof QUESTS]?.number || 999
                  return aNum - bNum
                })
                .filter(q => !q.completed)

              if (activeQuests.length === 0) {
                return <div className="text-gray-400 text-sm">No active quests.</div>
              }

              return (
                <div className="space-y-4">
                  {activeQuests.map((quest) => {
                    const questDef = QUESTS[quest.questId as keyof typeof QUESTS]
                    if (!questDef) return null

                    let isReadyToTurnIn = false
                    if (questDef.completionMode === 'turn_in' && questDef.requirements) {
                      isReadyToTurnIn = questDef.requirements.every((req: any) => {
                        if (req.type === 'hasItem') {
                          const item = inventory.find((i: any) => i.template.slug === req.itemSlug)
                          return item && item.quantity >= (req.quantity || 1)
                        }
                        if (req.type === 'killCount') return getKillCount(req.enemySlug) >= req.count
                        return false
                      })
                    }

                    return (
                      <div key={quest.id} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            {questDef.giver?.name && (
                              <p className="text-gray-500 text-xs mb-1">{questDef.giver.name}</p>
                            )}
                            <h4 className="text-white font-semibold text-base">{questDef.title}</h4>
                            <p className="text-gray-400 text-sm mt-1">{questDef.summary}</p>
                          </div>
                          <span className="px-2 py-1 bg-blue-900/50 border border-blue-700/50 text-blue-300 text-xs font-semibold rounded">
                            Active
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-sm">Objective:</span>
                            <span className="text-gray-300 text-sm">{questDef.objective}</span>
                          </div>
                          {questDef.rewards && questDef.rewards.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-sm">Reward:</span>
                              <span className="text-gray-300 text-sm">
                                {questDef.rewards.map((r: any) => {
                                  if (r.type === 'currency') return `${r.amount} Gold`
                                  if (r.type === 'xp') return `${r.amount} XP`
                                  if (r.type === 'item') {
                                    const name = String(r.itemSlug || '')
                                      .split('-')
                                      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                                      .join(' ')
                                    const qty = r.quantity || 1
                                    return qty > 1 ? `${name} x${qty}` : name
                                  }
                                  return ''
                                }).filter(Boolean).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                        {questDef.requirements?.some((req: any) => req.type === 'killCount') && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-sm">Progress:</span>
                            <span className="text-gray-300 text-sm">
                              {questDef.requirements
                                .filter((req: any) => req.type === 'killCount')
                                .map((req: any) => `${Math.min(getKillCount(req.enemySlug), req.count)}/${req.count} ${req.displayName} defeated`)
                                .join(', ')}
                            </span>
                          </div>
                        )}
                        {isReadyToTurnIn && questDef.giver && (
                          <div className="pt-2 border-t border-gray-700/50">
                            <p className="text-green-400 text-sm font-medium">
                              Ready to turn in — return to {questDef.giver.name} to complete the quest.
                            </p>
                          </div>
                        )}
                        {questDef.nextStep && (
                          <div className="pt-2 border-t border-gray-700/50">
                            <p className="text-gray-500 text-xs mt-2">Next: {questDef.nextStep}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </>
        )}

        {/* ── Completed Quests tab ── */}
        {activeTab === 'completed-quests' && (
          <>
            {isLoadingQuests ? (
              <div className="text-gray-400 text-sm">Loading...</div>
            ) : (() => {
              const completedQuests = [...quests]
                .sort((a, b) => {
                  const aNum = QUESTS[a.questId as keyof typeof QUESTS]?.number || 999
                  const bNum = QUESTS[b.questId as keyof typeof QUESTS]?.number || 999
                  return aNum - bNum
                })
                .filter(q => q.completed)

              if (completedQuests.length === 0) {
                return <div className="text-gray-400 text-sm">No completed quests yet.</div>
              }

              return (
                <div className="space-y-4">
                  {completedQuests.map((quest) => {
                    const questDef = QUESTS[quest.questId as keyof typeof QUESTS]
                    if (!questDef) return null
                    return (
                      <div key={quest.id} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 space-y-3 opacity-75">
                        <div className="flex items-start justify-between">
                          <div>
                            {questDef.giver?.name && (
                              <p className="text-gray-500 text-xs mb-1">{questDef.giver.name}</p>
                            )}
                            <h4 className="text-white font-semibold text-base">{questDef.title}</h4>
                            <p className="text-gray-400 text-sm mt-1">{questDef.summary}</p>
                          </div>
                          <span className="px-2 py-1 bg-green-900/50 border border-green-700/50 text-green-300 text-xs font-semibold rounded">
                            Done
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
              )
            })()}

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
          </>
        )}

        {/* ── Kill List tab ── */}
        {activeTab === 'kill-list' && (
          <KillListTab getAuthHeaders={getAuthHeaders} />
        )}

        {/* ── Battle Log tab ── */}
        {activeTab === 'battle-log' && (
          <BattleLogTab getAuthHeaders={getAuthHeaders} />
        )}
      </div>
    </div>
  )
}
