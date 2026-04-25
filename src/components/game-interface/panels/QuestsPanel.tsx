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

type Tab = 'quests' | 'battle-log' | 'kill-list'

interface QuestsPanelProps {
  quests: Quest[]
  isLoadingQuests: boolean
  isResettingQuests: boolean
  isLoggedIn: boolean
  inventory: InventoryItem[]
  onResetQuests: () => void
  onClose: () => void
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-xs font-semibold transition-colors duration-150 ${
        active
          ? 'text-white border-b-2 border-blue-500'
          : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent'
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

      <div className="p-4 sm:p-6 pb-0">
        <h3 className="text-lg font-semibold text-white mb-3">Quests & Records</h3>
        <div className="flex border-b border-gray-700/60">
          <TabButton active={activeTab === 'quests'} onClick={() => setActiveTab('quests')}>Quests</TabButton>
          <TabButton active={activeTab === 'battle-log'} onClick={() => setActiveTab('battle-log')}>Battle Log</TabButton>
          <TabButton active={activeTab === 'kill-list'} onClick={() => setActiveTab('kill-list')}>Kill List</TabButton>
        </div>
      </div>

      <div className="p-4 sm:p-6 pt-4 space-y-4">

        {/* ── Quests tab ── */}
        {activeTab === 'quests' && (
          <>
            {isLoadingQuests ? (
              <div className="text-gray-400 text-sm">Unraveling your quest log...</div>
            ) : quests.length === 0 ? (
              <div className="text-gray-400 text-sm">No quests.</div>
            ) : (
              <div className="space-y-6">
                {/* Active Quests */}
                {(() => {
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

                          let isReadyToTurnIn = false
                          if (questDef.completionMode === 'turn_in' && questDef.requirements) {
                            const hasAllRequirements = questDef.requirements.every((req: any) => {
                              if (req.type === 'hasItem') {
                                const item = inventory.find((i: any) => i.template.slug === req.itemSlug)
                                return item && item.quantity >= (req.quantity || 1)
                              }
                              if (req.type === 'killCount') {
                                return quest.progress >= req.count
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
                                      .map((req: any) => `${Math.min(quest.progress, req.count)}/${req.count} ${req.displayName} defeated`)
                                      .join(', ')}
                                  </span>
                                </div>
                              )}
                              {isReadyToTurnIn && questDef.giver && (
                                <div className="pt-2 border-t border-gray-700/50">
                                  <p className="text-yellow-400 text-sm font-medium">
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
                    </div>
                  ) : null
                })()}

                {/* Completed Quests */}
                {(() => {
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
                                    <p className="text-gray-500 text-xs mb-1">{questDef.giver.name}</p>
                                  )}
                                  <h4 className="text-white font-semibold text-base">{questDef.title}</h4>
                                  <p className="text-gray-400 text-sm mt-1">{questDef.summary}</p>
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

        {/* ── Battle Log tab ── */}
        {activeTab === 'battle-log' && (
          <BattleLogTab getAuthHeaders={getAuthHeaders} />
        )}

        {/* ── Kill List tab ── */}
        {activeTab === 'kill-list' && (
          <KillListTab getAuthHeaders={getAuthHeaders} />
        )}
      </div>
    </div>
  )
}
