'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X } from 'lucide-react'
import { QUESTS, GIVERS, listFactionGiverIds, factionStanding, isGiverRevealed, completedSet, questOrderIndex } from '@/lib/game-data/quest-registry'
import { listLiveFactions } from '@/lib/game-data/factions'
import { useGameStore, type QuestProgressRow } from '@/lib/game-state'
import { areRequirementsMet, type QuestRequirement, type RequirementContext } from '@/lib/quest-requirements'
import QuestRequirements from '@/components/QuestRequirements'
import QuestTypeTag from '@/components/QuestTypeTag'
import Icon from '@/components/Icon'
import SubTabButton from '../SubTabButton'

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

type QuestDef = {
  giverId: string
  questType: string
  level: number
  title: string
  summary: string
  objective: string
  nextStep?: string
  requirements?: QuestRequirement[]
  rewards?: { type: string; amount?: number; itemSlug?: string; quantity?: number }[]
}

type GiverDef = {
  name: string
  spokenName?: string
  roomId: string
  icon: string
  faction: string | null
  hint?: string
  quests: string[]
  revealedBy?: { type: string }
}

interface QuestsPanelProps {
  isLoadingQuests: boolean
  isResettingQuests: boolean
  isLoggedIn: boolean
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

const QUEST_DEFS = QUESTS as Record<string, QuestDef>
const GIVER_DEFS = GIVERS as Record<string, GiverDef>

function rewardText(rewards: QuestDef['rewards']): string {
  return (rewards ?? [])
    .map((r) => {
      if (r.type === 'currency') return `${r.amount} Gold`
      if (r.type === 'xp') return `${r.amount} XP`
      if (r.type === 'item') {
        const name = String(r.itemSlug || '')
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
        const qty = r.quantity || 1
        return qty > 1 ? `${name} x${qty}` : name
      }
      return ''
    })
    .filter(Boolean)
    .join(', ')
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

/**
 * One faction's heading in the journal: name, quests done out of total, a
 * bar, and the title once every quest is done. Standing is a count and
 * nothing more, so this is the whole of what a faction shows.
 */
function FactionHeader({ name, done, total, title, kind }: { name: string; done: number; total: number; title: string | null; kind: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const complete = total > 0 && done === total
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-bold uppercase tracking-wide text-fg-bright truncate">{name}</h3>
          {kind === 'guild' && <span className="text-[10px] uppercase tracking-wide text-fg-muted">guild</span>}
        </div>
        <span className={`shrink-0 text-xs font-bold tabular-nums ${complete ? 'text-resource-gold' : 'text-fg-secondary'}`}>
          {done}/{total}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-panel/60">
        <div className={`h-full rounded-full ${complete ? 'bg-resource-gold' : 'bg-resource-mp'}`} style={{ width: `${pct}%` }} />
      </div>
      {complete && title && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-resource-gold">
          <Icon name="trophy" size={12} className="text-resource-gold" />
          {title}
        </div>
      )}
    </div>
  )
}

/** A giver the player has heard of but not yet talked to — the original's "Find these!". */
function NotYetMetCard({ giver }: { giver: GiverDef }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-line-subtle/60 bg-surface-raised/20 px-3 py-2.5">
      <Icon name={giver.icon} size={22} className="mt-0.5 shrink-0 text-fg-muted" />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-fg-primary">{giver.name}</span>
          <span className="rounded border border-line-subtle px-1.5 py-px text-[10px] uppercase tracking-wide text-fg-muted">Not yet met</span>
        </div>
        {giver.hint && <p className="mt-0.5 text-xs text-fg-secondary">{giver.hint}</p>}
      </div>
    </div>
  )
}

function ActiveQuestCard({ questId, questDef, giver, ctx }: { questId: string; questDef: QuestDef; giver: GiverDef | undefined; ctx: RequirementContext }) {
  // Shared with the NPC card so the journal and the room agree on what
  // "ready" means for every requirement type.
  const isReadyToTurnIn = !!questDef.requirements && questDef.requirements.length > 0 && areRequirementsMet(questDef.requirements, ctx)
  const rewards = rewardText(questDef.rewards)
  return (
    <div key={questId} className="bg-surface-raised/50 border border-line-subtle/50 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <QuestTypeTag type={questDef.questType} />
            {giver?.name && <p className="text-fg-muted text-xs">{giver.name}</p>}
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
        {rewards && (
          <div className="flex items-center gap-2">
            <span className="text-fg-muted text-sm">Reward:</span>
            <span className="text-fg-primary text-sm">{rewards}</span>
          </div>
        )}
      </div>
      <QuestRequirements requirements={questDef.requirements} variant="full" />
      {isReadyToTurnIn && giver && (
        <div className="pt-2 border-t border-line-subtle/50">
          <p className="text-status-success text-sm font-medium">
            Ready to turn in — return to {giver.spokenName ?? giver.name} to complete the quest.
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
}

function CompletedQuestCard({ questId, questDef, giver }: { questId: string; questDef: QuestDef; giver: GiverDef | undefined }) {
  const rewards = rewardText(questDef.rewards)
  return (
    <div key={questId} className="bg-surface-raised/50 border border-line-subtle/50 rounded-lg p-4 space-y-3 opacity-75">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <QuestTypeTag type={questDef.questType} />
            {giver?.name && <p className="text-fg-muted text-xs">{giver.name}</p>}
          </div>
          <h4 className="text-fg-bright font-semibold text-base">{questDef.title}</h4>
          <p className="text-fg-secondary text-sm mt-1">{questDef.summary}</p>
        </div>
        <span className="px-2 py-1 bg-status-success/50 border border-status-success/50 text-status-success text-xs font-semibold rounded">
          Done
        </span>
      </div>
      {rewards && (
        <div className="flex items-center gap-2">
          <span className="text-fg-muted text-sm">Reward:</span>
          <span className="text-fg-primary text-sm">{rewards}</span>
        </div>
      )}
    </div>
  )
}

type FactionGroup = {
  id: string
  name: string
  kind: string
  standing: { done: number; total: number; title: string | null } | null
  givers: { giverId: string; giver: GiverDef; met: boolean; revealed: boolean; active: string[]; completed: string[] }[]
}

/**
 * The journal grouped the way the original's quest tab was: by the people of
 * each land and guild. A faction shows once the player has heard of anyone in
 * it; a giver shows as "not yet met" until the first talk, then as their open
 * quests. The Grand Quest Pillar has no faction and closes the list.
 */
function useFactionGroups(quests: QuestProgressRow[], giversMet: string[]): FactionGroup[] {
  const player = useGameStore((s) => s.player)
  return useMemo(() => {
    const done = completedSet(quests)
    const met = new Set(giversMet)
    const rowsByQuest = new Map(quests.map((q) => [q.questId, q]))
    const revealCtx = {
      done,
      met,
      discoveredTeleports: player?.discoveredTeleports ?? [],
      flags: (player ?? {}) as Record<string, unknown>,
    }
    const giverEntry = (giverId: string) => {
      const giver = GIVER_DEFS[giverId]
      const active: string[] = []
      const completed: string[] = []
      for (const questId of giver.quests) {
        const row = rowsByQuest.get(questId)
        if (!row) continue
        if (row.completed) completed.push(questId)
        else active.push(questId)
      }
      return { giverId, giver, met: met.has(giverId), revealed: isGiverRevealed(giver, revealCtx), active, completed }
    }

    const groups: FactionGroup[] = []
    for (const faction of listLiveFactions()) {
      const givers = listFactionGiverIds(faction.id).map(giverEntry).filter((g) => g.met || g.revealed)
      if (givers.length === 0) continue
      const standing = factionStanding(faction.id, quests)
      groups.push({ id: faction.id, name: faction.name, kind: faction.kind, standing, givers })
    }
    const pillar = Object.keys(GIVER_DEFS).filter((id) => GIVER_DEFS[id].faction === null).map(giverEntry).filter((g) => g.met || g.revealed)
    if (pillar.length > 0) {
      groups.push({ id: 'grand-quests', name: 'Grand Quests', kind: 'grand', standing: null, givers: pillar })
    }
    return groups
  }, [quests, giversMet, player])
}

export default function QuestsPanel({
  isLoadingQuests,
  isResettingQuests,
  isLoggedIn,
  onResetQuests,
  onSkipToChest,
  onClose,
}: QuestsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('quests')
  const getAuthHeaders = useGameStore((s) => s.getAuthHeaders)
  const killList = useGameStore((s) => s.killList)
  const player = useGameStore((s) => s.player)
  const inventory = useGameStore((s) => s.inventory)
  const quests = useGameStore((s) => s.quests)
  const giversMet = useGameStore((s) => s.giversMet)
  const requirementContext: RequirementContext = { inventory, killList, player, quests, giversMet }
  const groups = useFactionGroups(quests, giversMet)

  const activeGroups = groups.filter((g) => g.givers.some((e) => !e.met || e.active.length > 0))
  const completedGroups = groups
    .map((g) => ({ ...g, givers: g.givers.filter((e) => e.completed.length > 0) }))
    .filter((g) => g.givers.length > 0)

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

      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">

        {/* ── Quests tab: by faction, then by giver ── */}
        {activeTab === 'quests' && (
          isLoadingQuests ? (
            <div className="text-fg-secondary text-sm">Unraveling your quest log...</div>
          ) : activeGroups.length === 0 ? (
            <div className="text-fg-secondary text-sm">No active quests. Find someone who needs help.</div>
          ) : (
            activeGroups.map((group) => (
              <section key={group.id} className="space-y-3">
                {group.standing ? (
                  <FactionHeader name={group.name} kind={group.kind} done={group.standing.done} total={group.standing.total} title={group.standing.title} />
                ) : (
                  <h3 className="text-sm font-bold uppercase tracking-wide text-fg-bright">{group.name}</h3>
                )}
                {group.givers.map((entry) =>
                  !entry.met ? (
                    <NotYetMetCard key={entry.giverId} giver={entry.giver} />
                  ) : (
                    [...entry.active]
                      .sort((a, b) => questOrderIndex(a) - questOrderIndex(b))
                      .map((questId) => {
                        const questDef = QUEST_DEFS[questId]
                        if (!questDef) return null
                        return <ActiveQuestCard key={questId} questId={questId} questDef={questDef} giver={entry.giver} ctx={requirementContext} />
                      })
                  )
                )}
              </section>
            ))
          )
        )}

        {/* ── Completed Quests tab ── */}
        {activeTab === 'completed-quests' && (
          <>
            {isLoadingQuests ? (
              <div className="text-fg-secondary text-sm">Loading...</div>
            ) : completedGroups.length === 0 ? (
              <div className="text-fg-secondary text-sm">No completed quests yet.</div>
            ) : (
              completedGroups.map((group) => (
                <section key={group.id} className="space-y-3">
                  {group.standing ? (
                    <FactionHeader name={group.name} kind={group.kind} done={group.standing.done} total={group.standing.total} title={group.standing.title} />
                  ) : (
                    <h3 className="text-sm font-bold uppercase tracking-wide text-fg-bright">{group.name}</h3>
                  )}
                  {group.givers.flatMap((entry) =>
                    [...entry.completed]
                      .sort((a, b) => questOrderIndex(a) - questOrderIndex(b))
                      .map((questId) => {
                        const questDef = QUEST_DEFS[questId]
                        if (!questDef) return null
                        return <CompletedQuestCard key={questId} questId={questId} questDef={questDef} giver={entry.giver} />
                      })
                  )}
                </section>
              ))
            )}

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
                  Resets all quests, met givers and chests to initial state
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
