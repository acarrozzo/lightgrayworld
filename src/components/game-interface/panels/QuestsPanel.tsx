'use client'

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import QUESTS from '@/lib/game-data/quests.json'
import type { InventoryItem } from '@/lib/game-state'
import { useGameStore } from '@/lib/game-state'
import { areRequirementsMet } from '@/lib/quest-requirements'
import QuestRequirements from '@/components/QuestRequirements'
import QuestTypeTag from '@/components/QuestTypeTag'
import SubTabButton from '../SubTabButton'

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
  onSkipToChest: () => void
  onClose: () => void
}

const QUEST_SUB_TABS: { id: Tab; label: string }[] = [
  { id: 'quests', label: 'Quests' },
  { id: 'completed-quests', label: 'Completed' },
  { id: 'kill-list', label: 'Kill List' },
  { id: 'battle-log', label: 'Battle Log' },
]

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

  if (isLoading) return <p className="text-fg-muted text-sm">Loading battle log...</p>
  if (loaded && logs.length === 0) return <p className="text-fg-muted text-sm">No battles recorded yet.</p>

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const isWin = log.outcome === 'WIN'
        const date = new Date(log.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        return (
          <div
            key={log.id}
            className={`rounded-lg border p-3 space-y-2 ${isWin ? 'border-status-success/40 bg-status-success/20' : 'border-status-error/40 bg-status-error/10'}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isWin ? 'bg-status-success/60 text-status-success' : 'bg-status-error/60 text-status-error'}`}>
                  {isWin ? 'WIN' : 'LOSS'}
                </span>
                <span className="text-sm font-semibold text-fg-bright">{log.enemyName}</span>
                {log.multiplayerBonus && (
                  <span className="text-[10px] text-resource-mp bg-resource-mp/30 px-1 rounded">group</span>
                )}
              </div>
              <span className="text-[10px] text-fg-disabled">{date}</span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center">
              <div>
                <p className="text-[10px] text-fg-muted uppercase tracking-wide">Turns</p>
                <p className="text-xs font-semibold text-fg-bright">{log.turnsCount}</p>
              </div>
              <div>
                <p className="text-[10px] text-fg-muted uppercase tracking-wide">Dealt</p>
                <p className="text-xs font-semibold text-fg-bright">{log.totalDamageDealt}</p>
              </div>
              <div>
                <p className="text-[10px] text-fg-muted uppercase tracking-wide">Received</p>
                <p className="text-xs font-semibold text-fg-bright">{log.totalDamageReceived}</p>
              </div>
              <div>
                <p className="text-[10px] text-status-warning uppercase tracking-wide">Best Hit</p>
                <p className="text-xs font-semibold text-status-warning">{log.maxSingleHit}</p>
              </div>
            </div>
            {isWin && (
              <div className="flex items-center gap-3 text-[11px] text-fg-secondary pt-0.5 border-t border-line-subtle/40">
                <span className="text-status-success">+{log.xpEarned} XP</span>
                <span className="text-status-warning">+{log.goldEarned} Gold</span>
                {log.itemsDropped.length > 0 && (
                  <span className="text-stat-mag">+{log.itemsDropped.join(', ')}</span>
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

  if (isLoading) return <p className="text-fg-muted text-sm">Loading kill list...</p>
  if (loaded && kills.length === 0) return <p className="text-fg-muted text-sm">No kills recorded yet.</p>

  const total = kills.reduce((sum, k) => sum + k.kills, 0)

  return (
    <div className="space-y-2">
      <p className="text-xs text-fg-muted">{total} total kills across {kills.length} creature{kills.length !== 1 ? 's' : ''}</p>
      {kills.map((entry) => (
        <div key={entry.id} className="flex items-center justify-between bg-surface-raised/40 border border-line-subtle/40 rounded-lg px-3 py-2">
          <span className="text-sm text-fg-bright capitalize">{entry.monster.replace(/-/g, ' ')}</span>
          <span className="text-sm font-bold text-status-error">{entry.kills} kill{entry.kills !== 1 ? 's' : ''}</span>
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
  onSkipToChest,
  onClose,
}: QuestsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('quests')
  const getAuthHeaders = useGameStore((s) => s.getAuthHeaders)
  const killList = useGameStore((s) => s.killList)
  const player = useGameStore((s) => s.player)
  const requirementContext = { inventory, killList, player }

  return (
    <div className="relative w-full h-full flex flex-col min-h-0">
      <button
        onClick={onClose}
        className="absolute top-2 right-3 z-30 p-2 text-fg-secondary hover:text-fg-bright transition-colors duration-200 rounded-lg hover:bg-surface-raised/50"
        title="Close"
        aria-label="Close"
      >
        <X size={20} />
      </button>

      <div className="flex gap-2 border-b border-line-subtle/50 pl-4 pr-12 md:pr-12 py-2 flex-shrink-0">
        <div className="flex-1 flex items-center justify-start gap-2 flex-nowrap overflow-x-auto">
          {QUEST_SUB_TABS.map((tab) => (
            <SubTabButton
              key={tab.id}
              active={activeTab === tab.id}
              color="gold"
              // Clicking the active sub-tab returns to Quests, this panel's core content.
              onClick={() => setActiveTab(activeTab === tab.id ? 'quests' : tab.id)}
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
              <div className="text-fg-secondary text-sm">Unraveling your quest log...</div>
            ) : (() => {
              const activeQuests = [...quests]
                .sort((a, b) => {
                  const aNum = QUESTS[a.questId as keyof typeof QUESTS]?.number || 999
                  const bNum = QUESTS[b.questId as keyof typeof QUESTS]?.number || 999
                  return aNum - bNum
                })
                .filter(q => !q.completed)

              if (activeQuests.length === 0) {
                return <div className="text-fg-secondary text-sm">No active quests.</div>
              }

              return (
                <div className="space-y-4">
                  {activeQuests.map((quest) => {
                    const questDef = QUESTS[quest.questId as keyof typeof QUESTS]
                    if (!questDef) return null

                    // Shared with the NPC card so the journal and the room agree
                    // on what "ready" means for every requirement type.
                    const isReadyToTurnIn =
                      questDef.completionMode === 'turn_in' &&
                      !!questDef.requirements &&
                      areRequirementsMet(questDef.requirements, requirementContext)

                    return (
                      <div key={quest.id} className="bg-surface-raised/50 border border-line-subtle/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <QuestTypeTag type={questDef.questType} />
                              {questDef.giver?.name && (
                                <p className="text-fg-muted text-xs">{questDef.giver.name}</p>
                              )}
                            </div>
                            <h4 className="text-fg-bright font-semibold text-base">{questDef.title}</h4>
                            <p className="text-fg-secondary text-sm mt-1">{questDef.summary}</p>
                          </div>
                          <span className="px-2 py-1 bg-resource-mp/50 border border-resource-mp/50 text-resource-mp text-xs font-semibold rounded">
                            Active
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-fg-muted text-sm">Objective:</span>
                            <span className="text-fg-primary text-sm">{questDef.objective}</span>
                          </div>
                          {questDef.rewards && questDef.rewards.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-fg-muted text-sm">Reward:</span>
                              <span className="text-fg-primary text-sm">
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
                        <QuestRequirements requirements={questDef.requirements} variant="full" />
                        {isReadyToTurnIn && questDef.giver && (
                          <div className="pt-2 border-t border-line-subtle/50">
                            <p className="text-status-success text-sm font-medium">
                              Ready to turn in — return to {questDef.giver.name} to complete the quest.
                            </p>
                          </div>
                        )}
                        {questDef.nextStep && (
                          <div className="pt-2 border-t border-line-subtle/50">
                            <p className="text-fg-muted text-xs mt-2">Next: {questDef.nextStep}</p>
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
              <div className="text-fg-secondary text-sm">Loading...</div>
            ) : (() => {
              const completedQuests = [...quests]
                .sort((a, b) => {
                  const aNum = QUESTS[a.questId as keyof typeof QUESTS]?.number || 999
                  const bNum = QUESTS[b.questId as keyof typeof QUESTS]?.number || 999
                  return aNum - bNum
                })
                .filter(q => q.completed)

              if (completedQuests.length === 0) {
                return <div className="text-fg-secondary text-sm">No completed quests yet.</div>
              }

              return (
                <div className="space-y-4">
                  {completedQuests.map((quest) => {
                    const questDef = QUESTS[quest.questId as keyof typeof QUESTS]
                    if (!questDef) return null
                    return (
                      <div key={quest.id} className="bg-surface-raised/50 border border-line-subtle/50 rounded-lg p-4 space-y-3 opacity-75">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <QuestTypeTag type={questDef.questType} />
                              {questDef.giver?.name && (
                                <p className="text-fg-muted text-xs">{questDef.giver.name}</p>
                              )}
                            </div>
                            <h4 className="text-fg-bright font-semibold text-base">{questDef.title}</h4>
                            <p className="text-fg-secondary text-sm mt-1">{questDef.summary}</p>
                          </div>
                          <span className="px-2 py-1 bg-status-success/50 border border-status-success/50 text-status-success text-xs font-semibold rounded">
                            Done
                          </span>
                        </div>
                        {questDef.rewards && questDef.rewards.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-fg-muted text-sm">Reward:</span>
                            <span className="text-fg-primary text-sm">
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
              <div className="mt-6 pt-4 border-t border-line-subtle/50 space-y-3">
                <button
                  onClick={onResetQuests}
                  disabled={isResettingQuests || !isLoggedIn}
                  className="w-full px-4 py-2 bg-status-error/20 hover:bg-status-error/30 border border-status-error/50 hover:border-status-error/70 text-status-error/80 hover:text-status-error text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResettingQuests ? 'Resetting...' : 'Reset Quests to Initial State'}
                </button>
                <p className="mt-1 text-xs text-fg-muted text-center">
                  Resets all quests and chest to initial state
                </p>
                <button
                  onClick={onSkipToChest}
                  disabled={isResettingQuests || !isLoggedIn}
                  className="w-full px-4 py-2 bg-resource-gold/20 hover:bg-resource-gold/30 border border-resource-gold/50 hover:border-resource-gold/70 text-resource-gold/80 hover:text-resource-gold text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResettingQuests ? 'Resetting...' : 'Skip to Chest / Jack Flow'}
                </button>
                <p className="mt-1 text-xs text-fg-muted text-center">
                  Completes Old Man &amp; Young Soldier quests, resets chest
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
