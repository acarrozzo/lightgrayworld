'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Search, ChevronDown, Check, Circle, HelpCircle } from 'lucide-react'
import { useGameStore } from '@/lib/game-state'
import type { RequirementContext } from '@/lib/quest-requirements'
import {
  buildJournal,
  applyJournalView,
  loadJournalPrefs,
  saveJournalPrefs,
  isGroupCollapsed,
  toggleGroupCollapsed,
  isSectionCollapsed,
  toggleSectionCollapsed,
  sectionsAcrossFactions,
  rowsAcrossSections,
  unmetAcrossSections,
  DEFAULT_PREFS,
  isViewFiltered,
  STATUS_FILTERS,
  SORT_MODES,
  type JournalGroup,
  type JournalGiverSection,
  type JournalQuestRow,
  type JournalPrefs,
  type SortMode,
} from '@/lib/quest-journal'
import { CHIP, CHIP_IDLE, CHIP_GROUP_ON, CHIP_SLOT_ON } from '@/components/ItemFilterBar'
import { getFaction } from '@/lib/game-data/factions'
import { ROOM_COLOR_TOKENS } from '@/lib/theme/room-colors'
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

type Tab = 'quests' | 'kill-list' | 'battle-log'

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
  { id: 'kill-list', label: 'Kill List' },
  { id: 'battle-log', label: 'Battle Log' },
]

function rewardText(rewards: { type: string; amount?: number; itemSlug?: string; quantity?: number }[] | undefined): string {
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
    .join(' · ')
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

/** The glyph that says a row's state at a glance. */
function StateGlyph({ state }: { state: JournalQuestRow['state'] | 'not_met' }) {
  if (state === 'not_met') return <HelpCircle size={14} className="shrink-0 text-fg-muted" aria-label="Not yet met" />
  if (state === 'completed') return <Check size={14} className="shrink-0 text-status-success" aria-label="Done" />
  if (state === 'ready') return <Circle size={12} className="shrink-0 fill-status-success text-status-success" aria-label="Ready to turn in" />
  return <Circle size={12} className="shrink-0 text-fg-muted" aria-label="In progress" />
}

/**
 * One quest as a row that opens — the same shape as an inventory row. Closed
 * it says title, giver, progress and readiness; open it adds the summary,
 * objective, requirements, rewards and next step.
 */
function QuestRow({
  row,
  open,
  onToggle,
  showGiver = false,
  showFaction = false,
}: {
  row: JournalQuestRow
  open: boolean
  onToggle: () => void
  /** Name the giver on the row — their heading is switched off. */
  showGiver?: boolean
  /** Name the faction on the row — its heading is switched off. */
  showFaction?: boolean
}) {
  const isReady = row.state === 'ready'
  const isDone = row.state === 'completed'
  const factionName = row.giver.faction ? getFaction(row.giver.faction)?.name ?? null : null
  // A finished quest is a line, not a card: its subtext waits inside the open view.
  const secondLine = isDone
    ? ''
    : [showGiver ? row.giver.name : null, showFaction ? factionName : null, open ? null : row.def.objective].filter(Boolean).join(' · ')
  const frame = isReady ? 'border-status-success/50 border-l-[3px] border-l-status-success' : 'border-line-subtle/40'
  const surface = open ? 'bg-surface-raised/35' : 'bg-surface-raised/20 hover:bg-surface-raised/35'
  const dim = isDone || row.aboveLevel ? 'opacity-70' : ''
  const rewards = rewardText(row.def.rewards)

  return (
    <div className={`border transition-colors duration-150 ${frame} ${surface} ${open ? 'rounded-md' : 'rounded-md'} ${dim}`}>
      <div className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 ${isDone ? 'min-h-[34px]' : 'min-h-[44px]'}`}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left py-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <StateGlyph state={row.state} />
          <span className="min-w-0 flex flex-col gap-px">
            <span className="flex items-baseline gap-1.5 min-w-0">
              <span className={`text-[13px] font-semibold truncate ${isDone ? 'text-status-success' : 'text-fg-bright'}`}>{row.def.title}</span>
              <QuestTypeTag type={row.def.questType} className="hidden sm:inline-flex" />
            </span>
            {secondLine && <span className="text-[11px] text-fg-muted truncate">{secondLine}</span>}
          </span>
        </button>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {row.aboveLevel && !isDone && (
            <span
              className="text-[10px] font-semibold leading-[16px] px-1.5 rounded-md border border-status-warning/50 text-status-warning tabular-nums"
              title={`Recommended level ${row.def.level}`}
            >
              L{row.def.level}
            </span>
          )}
          {row.progressLabel && (
            <span className={`text-[11px] font-bold tabular-nums ${isReady ? 'text-status-success' : 'text-fg-secondary'}`}>{row.progressLabel}</span>
          )}
          {isReady && (
            <span className="text-[9px] font-semibold uppercase tracking-[0.08em] leading-[14px] px-1 rounded-sm border border-status-success/50 text-status-success">
              Ready
            </span>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-label={open ? 'Hide details' : 'Show details'}
            className="w-5 h-8 flex items-center justify-center text-fg-muted hover:text-fg-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-line-subtle/40 px-3 py-2.5 space-y-2 text-sm">
          <p className="italic text-fg-secondary">{row.def.summary}</p>
          <div className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted pt-0.5">Given by</span>
            <span className="text-fg-secondary">
              {row.giver.name}
              {factionName ? ` · ${factionName}` : ''} · room {row.giver.roomId}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted pt-0.5">Objective</span>
            <span className="text-fg-primary">{row.def.objective}</span>
            {rewards && (
              <>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted pt-0.5">Reward</span>
                <span className="text-resource-gold">{rewards}</span>
              </>
            )}
            {row.def.level > 1 && (
              <>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted pt-0.5">Level</span>
                <span className={row.aboveLevel ? 'text-status-warning' : 'text-fg-secondary'}>{row.def.level}{row.aboveLevel ? ' — above yours' : ''}</span>
              </>
            )}
          </div>
          {!isDone && <QuestRequirements requirements={row.def.requirements} variant="full" />}
          {isReady && (
            <p className="text-status-success text-sm font-medium">
              Ready to turn in — return to {row.giver.spokenName ?? row.giver.name} (room {row.giver.roomId}).
            </p>
          )}
          {!isDone && !isReady && row.def.nextStep && (
            <p className="text-fg-muted text-xs">Next: {row.def.nextStep}</p>
          )}
        </div>
      )}
    </div>
  )
}

/** A giver the player has heard of but not yet talked to — the original's "Find these!". */
function GiverRow({ section, open, onToggle }: { section: JournalGiverSection; open: boolean; onToggle: () => void }) {
  const row = section
  return (
    <div className={`border border-dashed border-line-subtle/60 rounded-md transition-colors duration-150 ${open ? 'bg-surface-raised/25' : 'bg-surface-raised/10 hover:bg-surface-raised/25'}`}>
      <div className="flex items-center gap-1.5 min-h-[44px] pl-2.5 pr-1.5 py-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left py-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <StateGlyph state="not_met" />
          <Icon name={row.giver.icon} size={22} className="shrink-0 text-fg-muted" />
          <span className="min-w-0 flex flex-col gap-px">
            <span className="text-[13px] font-semibold text-fg-primary truncate">{row.giver.name}</span>
            <span className="text-[11px] text-fg-muted truncate">Not yet met</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? 'Hide hint' : 'Show hint'}
          className="w-5 h-8 flex items-center justify-center text-fg-muted hover:text-fg-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="border-t border-line-subtle/40 px-3 py-2.5 text-sm text-fg-secondary">
          {row.giver.hint || `Find ${row.giver.spokenName ?? row.giver.name} in room ${row.giver.roomId}.`}
        </div>
      )}
    </div>
  )
}

/**
 * A met giver's heading inside their faction: icon, name, room, their quests
 * done out of total, and how many are ready. Folds on its own.
 */
function GiverHeader({
  section,
  collapsed,
  onToggle,
  showFaction = false,
}: {
  section: JournalGiverSection
  collapsed: boolean
  onToggle: () => void
  showFaction?: boolean
}) {
  const allDone = section.total > 0 && section.done === section.total
  const factionName = showFaction && section.giver.faction ? getFaction(section.giver.faction)?.name ?? null : showFaction ? 'Grand Quests' : null
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="w-full flex items-center gap-2 rounded px-1 py-1 text-left hover:bg-surface-raised/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <ChevronDown size={12} className={`shrink-0 text-fg-muted transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      <Icon name={section.giver.icon} size={20} className={`shrink-0 ${allDone ? 'text-fg-muted' : 'text-fg-primary'}`} />
      <span className={`text-[12px] font-semibold truncate ${allDone ? 'text-fg-secondary' : 'text-fg-bright'}`}>{section.giver.name}</span>
      <span className="hidden sm:inline text-[10px] text-fg-muted">room {section.giver.roomId}</span>
      {factionName && <span className="text-[10px] uppercase tracking-wide text-fg-muted truncate">{factionName}</span>}
      {section.ready > 0 && (
        <span className="text-[10px] font-bold leading-[16px] px-1.5 rounded-md border border-status-success/50 bg-status-success/15 text-status-success tabular-nums">
          {section.ready} ready
        </span>
      )}
      <span className={`ml-auto shrink-0 text-[11px] font-bold tabular-nums ${allDone ? 'text-status-success' : 'text-fg-secondary'}`}>
        {section.done}/{section.total}
      </span>
    </button>
  )
}

/**
 * A faction's heading: fold toggle, name, quests done out of total, the bar,
 * how many are ready, and the title once every quest is done. Standing is a
 * count and nothing more, so this is the whole of what a faction shows.
 */
function GroupHeader({ group, collapsed, onToggle }: { group: JournalGroup; collapsed: boolean; onToggle: () => void }) {
  const standing = group.standing
  const pct = standing && standing.total > 0 ? Math.round((standing.done / standing.total) * 100) : 0
  const complete = !!standing?.complete
  const barVar = group.colorToken ? ROOM_COLOR_TOKENS[group.colorToken] ?? null : null
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="w-full text-left rounded-md px-1 py-1.5 hover:bg-surface-raised/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <div className="flex items-center gap-2">
        <ChevronDown size={14} className={`shrink-0 text-fg-muted transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        <span className="text-sm font-bold uppercase tracking-wide text-fg-bright truncate">{group.name}</span>
        {group.kind === 'guild' && <span className="text-[10px] uppercase tracking-wide text-fg-muted">guild</span>}
        {group.ready > 0 && (
          <span className="text-[10px] font-bold leading-[16px] px-1.5 rounded-md border border-status-success/50 bg-status-success/15 text-status-success tabular-nums">
            {group.ready} ready
          </span>
        )}
        {collapsed && group.notMet > 0 && (
          <span className="text-[10px] text-fg-muted">{group.notMet} not met</span>
        )}
        <span className="ml-auto shrink-0 flex items-center gap-2">
          {complete && standing?.title && (
            <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-resource-gold">
              <Icon name="trophy" size={12} className="text-resource-gold" />
              {standing.title}
            </span>
          )}
          {standing && (
            <span className={`text-xs font-bold tabular-nums ${complete ? 'text-resource-gold' : 'text-fg-secondary'}`}>
              {standing.done}/{standing.total}
            </span>
          )}
        </span>
      </div>
      {standing && (
        <div className="mt-1.5 ml-6 h-1 overflow-hidden rounded-full bg-surface-panel/60">
          {/* The bar wears the colour the faction's rooms are titled in — a town's world colour, a guild's own. */}
          <div
            className={`h-full rounded-full ${barVar ? '' : 'bg-resource-mp'}`}
            style={{ width: `${pct}%`, ...(barVar ? { backgroundColor: `var(${barVar})` } : {}) }}
          />
        </div>
      )}
      {complete && standing?.title && (
        <div className="sm:hidden mt-1 ml-6 flex items-center gap-1 text-[11px] font-semibold text-resource-gold">
          <Icon name="trophy" size={12} className="text-resource-gold" />
          {standing.title}
        </div>
      )}
    </button>
  )
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

  // Per-device conveniences: folded factions, filter, sort. Loaded after mount
  // so the server-rendered markup and the first client paint agree.
  const [prefs, setPrefs] = useState<JournalPrefs>(DEFAULT_PREFS)
  useEffect(() => {
    setPrefs(loadJournalPrefs())
  }, [])
  const updatePrefs = useCallback((next: JournalPrefs) => {
    setPrefs(next)
    saveJournalPrefs(next)
  }, [])

  const [search, setSearch] = useState('')
  const [openRows, setOpenRows] = useState<Set<string>>(() => new Set())
  const toggleRow = (key: string) =>
    setOpenRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const ctx: RequirementContext = useMemo(
    () => ({ inventory, killList, player, quests, giversMet }),
    [inventory, killList, player, quests, giversMet]
  )
  const groups = useMemo(() => buildJournal(ctx), [ctx])
  const view = useMemo(
    () => applyJournalView(groups, { status: prefs.status, sort: prefs.sort, search }),
    [groups, prefs.status, prefs.sort, search]
  )

  const totals = useMemo(() => {
    const t = { all: 0, active: 0, ready: 0, not_met: 0, done: 0 }
    for (const g of groups) {
      t.active += g.active
      t.ready += g.ready
      t.not_met += g.notMet
      t.done += g.done
      t.all += g.givers.reduce((n, sec) => n + (sec.met ? sec.rows.length : 1), 0)
    }
    return t
  }, [groups])

  // What folds depends on which headings are on: factions when they show,
  // otherwise the NPCs; a flat list has nothing to fold.
  const topSections = useMemo(() => sectionsAcrossFactions(view).filter((sec) => sec.met), [view])
  const allCollapsed = prefs.groupFaction
    ? view.length > 0 && view.every((g) => isGroupCollapsed(g, prefs))
    : topSections.length > 0 && topSections.every((sec) => isSectionCollapsed(sec, prefs))
  const canFold = prefs.groupFaction || prefs.groupNpc
  const foldAll = (fold: boolean) => {
    if (prefs.groupFaction) {
      const ids = groups.map((g) => g.id)
      updatePrefs({ ...prefs, collapsed: fold ? [...new Set([...prefs.collapsed.filter((id) => id.startsWith('giver:')), ...ids])] : prefs.collapsed.filter((id) => id.startsWith('giver:')), unfolded: fold ? [] : ids })
      return
    }
    const keys = sectionsAcrossFactions(groups).filter((sec) => sec.met).map((sec) => sec.key)
    updatePrefs({
      ...prefs,
      collapsed: fold ? [...new Set([...prefs.collapsed.filter((id) => !id.startsWith('giver:')), ...keys])] : prefs.collapsed.filter((id) => !id.startsWith('giver:')),
      unfolded: fold ? prefs.unfolded.filter((id) => !id.startsWith('giver:')) : [...new Set([...prefs.unfolded, ...keys])],
    })
  }
  const showGiverOnRows = !prefs.groupNpc
  const showFactionOnRows = !prefs.groupFaction && !prefs.groupNpc
  const showFactionOnGivers = !prefs.groupFaction

  /** A met giver's heading plus rows, folded or not. */
  const renderSection = (section: JournalGiverSection, indent: boolean) => {
    const sectionCollapsed = isSectionCollapsed(section, prefs)
    const live = groups.flatMap((g) => g.givers).find((sec) => sec.key === section.key) ?? section
    return (
      <div key={section.key} className="space-y-1">
        <GiverHeader
          section={live}
          collapsed={sectionCollapsed}
          onToggle={() => updatePrefs(toggleSectionCollapsed(section, prefs))}
          showFaction={showFactionOnGivers}
        />
        {!sectionCollapsed && (
          <div className={`space-y-1.5 ml-0 ${indent ? 'sm:ml-5' : ''}`}>
            {section.rows.map((row) => (
              <QuestRow key={row.key} row={row} open={openRows.has(row.key)} onToggle={() => toggleRow(row.key)} showFaction={showFactionOnRows} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderUnmet = (section: JournalGiverSection) => (
    <GiverRow key={section.key} section={section} open={openRows.has(section.key)} onToggle={() => toggleRow(section.key)} />
  )

  /** The rows of one faction with NPC headings off: one list, re-sorted across the faction. */
  const renderFlatRows = (sections: JournalGiverSection[], indent: boolean) => (
    <div className={`space-y-1.5 ml-0 ${indent ? 'sm:ml-6' : ''}`}>
      {rowsAcrossSections(sections, prefs.sort).map((row) => (
        <QuestRow key={row.key} row={row} open={openRows.has(row.key)} onToggle={() => toggleRow(row.key)} showGiver={showGiverOnRows} showFaction={showFactionOnRows} />
      ))}
      {unmetAcrossSections(sections).map(renderUnmet)}
    </div>
  )

  /**
   * The four layouts of the same view. Faction and NPC headings each switch
   * off independently; with both off the journal is one sorted list.
   */
  const renderJournal = () => {
    if (prefs.groupFaction) {
      return view.map((group) => {
        const collapsed = isGroupCollapsed(group, prefs)
        return (
          <section key={group.id} className="space-y-1.5">
            <GroupHeader
              group={groups.find((g) => g.id === group.id) ?? group}
              collapsed={collapsed}
              onToggle={() => updatePrefs(toggleGroupCollapsed(group, prefs))}
            />
            {!collapsed &&
              (prefs.groupNpc ? (
                <div className="space-y-2 ml-0 sm:ml-6">
                  {group.givers.map((section) => (section.met ? renderSection(section, true) : renderUnmet(section)))}
                </div>
              ) : (
                renderFlatRows(group.givers, true)
              ))}
          </section>
        )
      })
    }
    const sections = sectionsAcrossFactions(view)
    if (prefs.groupNpc) {
      return <div className="space-y-2">{sections.map((section) => (section.met ? renderSection(section, true) : renderUnmet(section)))}</div>
    }
    return renderFlatRows(sections, false)
  }

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
              {tab.id === 'quests' && totals.ready > 0 && (
                <span className="ml-1 text-[10px] font-bold text-status-success tabular-nums">{totals.ready}</span>
              )}
            </SubTabButton>
          ))}
        </div>
      </div>

      {activeTab === 'quests' && (
        <div className="flex-shrink-0 border-b border-line-subtle/50 px-4 py-2 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const count = totals[f.id]
              const active = prefs.status === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => updatePrefs({ ...prefs, status: f.id })}
                  className={`${CHIP} ${active ? CHIP_GROUP_ON : CHIP_IDLE}`}
                >
                  <span>{f.label}</span>
                  {count > 0 && (
                    <span className={`text-[10px] font-normal tabular-nums ${f.id === 'ready' ? 'text-status-success' : active ? 'text-fg-bright/60' : 'text-fg-secondary/60'}`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="flex items-center gap-1 text-[11px] text-fg-muted" role="group" aria-label="Group by">
              <span>Group by</span>
              <button
                type="button"
                aria-pressed={prefs.groupFaction}
                onClick={() => updatePrefs({ ...prefs, groupFaction: !prefs.groupFaction })}
                className={`${CHIP} ${prefs.groupFaction ? CHIP_SLOT_ON : CHIP_IDLE}`}
              >
                {prefs.groupFaction ? <Check size={11} aria-hidden="true" /> : <span className="inline-block w-[11px]" aria-hidden="true" />}
                Faction
              </button>
              <button
                type="button"
                aria-pressed={prefs.groupNpc}
                onClick={() => updatePrefs({ ...prefs, groupNpc: !prefs.groupNpc })}
                className={`${CHIP} ${prefs.groupNpc ? CHIP_SLOT_ON : CHIP_IDLE}`}
              >
                {prefs.groupNpc ? <Check size={11} aria-hidden="true" /> : <span className="inline-block w-[11px]" aria-hidden="true" />}
                NPC
              </button>
            </span>
            <label className="flex items-center gap-1 text-[11px] text-fg-muted">
              <span>Sort</span>
              <select
                value={prefs.sort}
                onChange={(e) => updatePrefs({ ...prefs, sort: e.target.value as SortMode })}
                className="rounded border border-line-subtle/50 bg-surface-raised px-1.5 py-1 text-[11px] text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                aria-label="Sort quests"
              >
                {SORT_MODES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <label className="relative flex-1 min-w-0">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search quests, givers, objectives"
                aria-label="Search quests"
                className="w-full rounded border border-line-subtle/50 bg-surface-raised pl-7 pr-2 py-1 text-[12px] text-fg-primary placeholder:text-fg-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
              />
            </label>
            {isViewFiltered(prefs, search) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  updatePrefs({ ...prefs, status: 'all', sort: 'world' })
                }}
                className="shrink-0 text-[11px] text-status-warning hover:text-fg-bright underline-offset-2 hover:underline"
                title="Reset filter, sort and search"
              >
                Clear
              </button>
            )}
            {canFold && (
              <button
                type="button"
                onClick={() => foldAll(!allCollapsed)}
                className="shrink-0 text-[11px] text-fg-secondary hover:text-fg-bright underline-offset-2 hover:underline"
              >
                {allCollapsed ? 'Expand all' : 'Collapse all'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5">

        {/* ── Quests tab: by faction, rows that open ── */}
        {activeTab === 'quests' && (
          isLoadingQuests ? (
            <div className="text-fg-secondary text-sm">Unraveling your quest log...</div>
          ) : view.length === 0 ? (
            <div className="text-fg-secondary text-sm">
              {groups.length === 0
                ? 'No quests yet. Find someone who needs help.'
                : search.trim()
                  ? 'Nothing matches that search.'
                  : prefs.status === 'ready'
                    ? 'Nothing is ready to turn in.'
                    : prefs.status === 'not_met'
                      ? 'You have met everyone you know of.'
                      : prefs.status === 'done'
                        ? 'No completed quests yet.'
                        : 'No active quests.'}
            </div>
          ) : (
            renderJournal()
          )
        )}

        {activeTab === 'quests' && !isLoadingQuests && isLoggedIn && (
          <div className="mt-8 pt-4 border-t border-line-subtle/50 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-disabled">Testing</p>
            <button
              onClick={onResetQuests}
              disabled={isResettingQuests}
              className="w-full px-4 py-2 bg-status-error/20 hover:bg-status-error/30 border border-status-error/50 hover:border-status-error/70 text-status-error/80 hover:text-status-error text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResettingQuests ? 'Resetting...' : 'Reset Quests to Initial State'}
            </button>
            <p className="mt-1 text-xs text-fg-muted text-center">
              Resets all quests, met givers and chests to initial state
            </p>
            <button
              onClick={onSkipToChest}
              disabled={isResettingQuests}
              className="w-full px-4 py-2 bg-resource-gold/20 hover:bg-resource-gold/30 border border-resource-gold/50 hover:border-resource-gold/70 text-resource-gold/80 hover:text-resource-gold text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResettingQuests ? 'Resetting...' : 'Skip to Chest / Jack Flow'}
            </button>
            <p className="mt-1 text-xs text-fg-muted text-center">
              Completes Old Man &amp; Young Soldier quests, resets chest
            </p>
          </div>
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
