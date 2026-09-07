import {
  QUESTS,
  GIVERS,
  listFactionGiverIds,
  factionStanding,
  isGiverRevealed,
  completedSet,
  questOrderIndex,
} from '@/lib/game-data/quest-registry'
import { listLiveFactions } from '@/lib/game-data/factions'
import {
  areRequirementsMet,
  getVisibleRequirementProgress,
  type QuestRequirement,
  type RequirementContext,
} from '@/lib/quest-requirements'

/**
 * The quest journal's view model, built on the client from the store: quest
 * rows, met givers, inventory, kills and the player. The journal panel and the
 * Quests tab badge both read it, so "ready to turn in" means one thing.
 *
 * Grouping is the original's: by the people of each land and guild. A faction
 * appears once the player has heard of anyone in it; a giver appears as "not
 * yet met" until the first talk, then as their quests.
 */

export type QuestRowState = 'ready' | 'in_progress' | 'completed'

export type JournalQuestDef = {
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

export type JournalGiverDef = {
  name: string
  spokenName?: string
  roomId: string
  icon: string
  faction: string | null
  hint?: string
  quests: string[]
}

export type JournalQuestRow = {
  key: string
  questId: string
  def: JournalQuestDef
  giver: JournalGiverDef
  state: QuestRowState
  /** "2/2" for a single tally, "1 of 3" for several requirements, null when nothing to count. */
  progressLabel: string | null
  /** The quest's level is above the player's. */
  aboveLevel: boolean
}

/**
 * One giver inside a faction: met, with their quests as rows, or not yet met,
 * with nothing but a hint. The journal is grouped this way — faction, then the
 * person — because that is how the original's quest tab read.
 */
export type JournalGiverSection = {
  key: string
  giverId: string
  giver: JournalGiverDef
  met: boolean
  rows: JournalQuestRow[]
  ready: number
  active: number
  done: number
  /** Quests the giver has in total, for the section's done/total. */
  total: number
}

export type JournalGroup = {
  id: string
  name: string
  kind: 'region' | 'guild' | 'grand'
  /** The room-colour token (theme/room-colors.ts) the faction's bar is painted with; null for the Pillar. */
  colorToken: string | null
  standing: { done: number; total: number; complete: boolean; title: string | null } | null
  ready: number
  active: number
  notMet: number
  done: number
  givers: JournalGiverSection[]
}

export type StatusFilter = 'all' | 'active' | 'ready' | 'not_met' | 'done'
export type SortMode = 'world' | 'ready' | 'level' | 'title' | 'reward'

export const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'ready', label: 'Ready' },
  { id: 'not_met', label: 'Not met' },
  { id: 'done', label: 'Done' },
]

export const SORT_MODES: { id: SortMode; label: string }[] = [
  { id: 'world', label: 'World order' },
  { id: 'ready', label: 'Ready first' },
  { id: 'level', label: 'Level' },
  { id: 'title', label: 'Title A–Z' },
  { id: 'reward', label: 'Reward' },
]

const QUEST_DEFS = QUESTS as Record<string, JournalQuestDef>
const GIVER_DEFS = GIVERS as Record<string, JournalGiverDef>

function progressLabelFor(def: JournalQuestDef, ctx: RequirementContext): string | null {
  const progress = getVisibleRequirementProgress(def.requirements, ctx)
  if (progress.length === 0) return null
  if (progress.length === 1) {
    const only = progress[0]
    return only.countable ? `${only.current}/${only.total}` : null
  }
  const met = progress.filter((p) => p.met).length
  return `${met} of ${progress.length}`
}

export function buildJournal(ctx: RequirementContext): JournalGroup[] {
  const quests = ctx.quests ?? []
  const giversMet = ctx.giversMet ?? []
  const done = completedSet(quests)
  const met = new Set(giversMet)
  const rowsByQuest = new Map(quests.map((q) => [q.questId, q]))
  const player = ctx.player
  const playerLevel = player?.level ?? 1
  const revealCtx = {
    done,
    met,
    discoveredTeleports: player?.discoveredTeleports ?? [],
    flags: (player ?? {}) as Record<string, unknown>,
  }

  const sectionForGiver = (giverId: string): JournalGiverSection | null => {
    const giver = GIVER_DEFS[giverId]
    if (!giver) return null
    const base = { key: `giver:${giverId}`, giverId, giver, ready: 0, active: 0, done: 0, total: giver.quests.length }
    if (!met.has(giverId)) {
      return isGiverRevealed(giver, revealCtx) ? { ...base, met: false, rows: [] } : null
    }
    const rows: JournalQuestRow[] = []
    for (const questId of giver.quests) {
      const row = rowsByQuest.get(questId)
      const def = QUEST_DEFS[questId]
      if (!row || !def) continue
      const reqs = def.requirements ?? []
      const state: QuestRowState = row.completed
        ? 'completed'
        : reqs.length > 0 && areRequirementsMet(reqs, ctx)
          ? 'ready'
          : 'in_progress'
      rows.push({
        key: `quest:${questId}`,
        questId,
        def,
        giver,
        state,
        progressLabel: row.completed ? null : progressLabelFor(def, ctx),
        aboveLevel: def.level > playerLevel,
      })
    }
    return {
      ...base,
      met: true,
      rows,
      ready: rows.filter((r) => r.state === 'ready').length,
      active: rows.filter((r) => r.state !== 'completed').length,
      done: rows.filter((r) => r.state === 'completed').length,
    }
  }

  const makeGroup = (
    id: string,
    name: string,
    kind: JournalGroup['kind'],
    colorToken: string | null,
    giverIds: string[],
    standing: JournalGroup['standing']
  ): JournalGroup | null => {
    const givers = giverIds.map(sectionForGiver).filter((g): g is JournalGiverSection => g !== null)
    if (givers.length === 0) return null
    return {
      id,
      name,
      kind,
      colorToken,
      standing,
      ready: givers.reduce((n, g) => n + g.ready, 0),
      active: givers.reduce((n, g) => n + g.active, 0),
      notMet: givers.filter((g) => !g.met).length,
      done: givers.reduce((n, g) => n + g.done, 0),
      givers,
    }
  }

  const groups: JournalGroup[] = []
  for (const faction of listLiveFactions()) {
    const standing = factionStanding(faction.id, quests)
    const group = makeGroup(
      faction.id,
      faction.name,
      faction.kind as 'region' | 'guild',
      faction.colorToken ?? null,
      listFactionGiverIds(faction.id),
      standing ? { done: standing.done, total: standing.total, complete: standing.complete, title: standing.title } : null
    )
    if (group) groups.push(group)
  }
  const pillarIds = Object.keys(GIVER_DEFS).filter((id) => GIVER_DEFS[id].faction === null)
  const pillar = makeGroup('grand-quests', 'Grand Quests', 'grand', null, pillarIds, null)
  if (pillar) groups.push(pillar)
  return groups
}

/** How many quests are ready to turn in across the journal — the tab badge. */
export function countReadyQuests(ctx: RequirementContext): number {
  return buildJournal(ctx).reduce((sum, g) => sum + g.ready, 0)
}

export type JournalView = { status: StatusFilter; sort: SortMode; search: string }

function questMatchesSearch(row: JournalQuestRow, needle: string): boolean {
  if (!needle) return true
  return `${row.def.title} ${row.def.objective} ${row.giver.name}`.toLowerCase().includes(needle)
}

function questMatchesStatus(row: JournalQuestRow, status: StatusFilter): boolean {
  switch (status) {
    case 'all':
      return true
    case 'active':
      return row.state !== 'completed'
    case 'ready':
      return row.state === 'ready'
    case 'done':
      return row.state === 'completed'
    default:
      return false
  }
}

function unmetMatches(section: JournalGiverSection, status: StatusFilter, needle: string): boolean {
  if (status !== 'all' && status !== 'not_met') return false
  if (!needle) return true
  return `${section.giver.name} ${section.giver.hint ?? ''}`.toLowerCase().includes(needle)
}

const STATE_RANK: Record<QuestRowState, number> = { ready: 0, in_progress: 1, completed: 2 }

function rewardValue(def: JournalQuestDef): { xp: number; gold: number } {
  let xp = 0
  let gold = 0
  for (const r of def.rewards ?? []) {
    if (r.type === 'xp') xp += r.amount ?? 0
    if (r.type === 'currency') gold += r.amount ?? 0
  }
  return { xp, gold }
}

/** Order quest rows by a sort mode; world order is the tiebreak for every other mode. */
export function sortQuestRows(rows: JournalQuestRow[], mode: SortMode): JournalQuestRow[] {
  const byWorld = (a: JournalQuestRow, b: JournalQuestRow) => questOrderIndex(a.questId) - questOrderIndex(b.questId)
  const sorted = [...rows]
  switch (mode) {
    case 'ready':
      return sorted.sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || byWorld(a, b))
    case 'level':
      return sorted.sort((a, b) => a.def.level - b.def.level || byWorld(a, b))
    case 'title':
      return sorted.sort((a, b) => a.def.title.localeCompare(b.def.title) || byWorld(a, b))
    case 'reward': {
      // Richest first: XP, then gold.
      return sorted.sort((a, b) => {
        const ra = rewardValue(a.def)
        const rb = rewardValue(b.def)
        return rb.xp - ra.xp || rb.gold - ra.gold || byWorld(a, b)
      })
    }
    default:
      return sorted.sort(byWorld)
  }
}

/**
 * Filter and order the groups for display. Quest rows sort by the chosen mode
 * inside their giver; a giver with nothing left to show is dropped, and so is
 * a faction with no givers left.
 */
export function applyJournalView(groups: JournalGroup[], view: JournalView): JournalGroup[] {
  const needle = view.search.trim().toLowerCase()
  const out: JournalGroup[] = []
  for (const group of groups) {
    const givers: JournalGiverSection[] = []
    for (const section of group.givers) {
      if (!section.met) {
        if (unmetMatches(section, view.status, needle)) givers.push(section)
        continue
      }
      const rows = section.rows.filter((row) => questMatchesStatus(row, view.status) && questMatchesSearch(row, needle))
      if (rows.length === 0) continue
      givers.push({ ...section, rows: sortQuestRows(rows, view.sort) })
    }
    if (givers.length === 0) continue
    out.push({ ...group, givers })
  }
  return out
}

/**
 * The other three ways to lay the same view out, for when a grouping is
 * switched off. Rows are re-sorted across whatever was merged, so "level"
 * with no grouping is one ladder from the whole journal.
 */
export function sectionsAcrossFactions(groups: JournalGroup[]): JournalGiverSection[] {
  return groups.flatMap((g) => g.givers)
}

export function rowsAcrossSections(sections: JournalGiverSection[], mode: SortMode): JournalQuestRow[] {
  return sortQuestRows(sections.filter((s) => s.met).flatMap((s) => s.rows), mode)
}

export function unmetAcrossSections(sections: JournalGiverSection[]): JournalGiverSection[] {
  return sections.filter((s) => !s.met)
}

/** Per-device journal conveniences: which headings are folded, the grouping, the filter, the sort. */
export type JournalPrefs = {
  collapsed: string[]
  /** Finished factions start folded; these are the ones the player unfolded anyway. */
  unfolded: string[]
  status: StatusFilter
  sort: SortMode
  /** Faction headings on or off. */
  groupFaction: boolean
  /** NPC headings on or off. */
  groupNpc: boolean
}

export const JOURNAL_PREFS_KEY = 'lg:quest-journal'

export const DEFAULT_PREFS: JournalPrefs = { collapsed: [], unfolded: [], status: 'all', sort: 'world', groupFaction: true, groupNpc: true }

export function loadJournalPrefs(): JournalPrefs {
  try {
    const raw = localStorage.getItem(JOURNAL_PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<JournalPrefs>
    return {
      collapsed: Array.isArray(parsed.collapsed) ? parsed.collapsed.filter((x) => typeof x === 'string') : [],
      unfolded: Array.isArray(parsed.unfolded) ? parsed.unfolded.filter((x) => typeof x === 'string') : [],
      status: STATUS_FILTERS.some((f) => f.id === parsed.status) ? (parsed.status as StatusFilter) : 'all',
      sort: SORT_MODES.some((s) => s.id === parsed.sort) ? (parsed.sort as SortMode) : 'world',
      groupFaction: typeof parsed.groupFaction === 'boolean' ? parsed.groupFaction : true,
      groupNpc: typeof parsed.groupNpc === 'boolean' ? parsed.groupNpc : true,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function saveJournalPrefs(prefs: JournalPrefs): void {
  try {
    localStorage.setItem(JOURNAL_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Storage may be unavailable (private mode, blocked site data); the journal still works.
  }
}

/** A group is folded when the player folded it, or when it is finished and they never unfolded it. */
export function isGroupCollapsed(group: JournalGroup, prefs: JournalPrefs): boolean {
  if (prefs.collapsed.includes(group.id)) return true
  if (group.standing?.complete && !prefs.unfolded.includes(group.id)) return true
  return false
}

/** Every one of the giver's quests turned in. */
export function isSectionFinished(section: JournalGiverSection): boolean {
  return section.met && section.total > 0 && section.done === section.total
}

/**
 * A giver's rows fold independently of their faction and are remembered the
 * same way: folded when the player folded them, or when the giver is finished
 * with and the player never unfolded them.
 */
export function isSectionCollapsed(section: JournalGiverSection, prefs: JournalPrefs): boolean {
  if (prefs.collapsed.includes(section.key)) return true
  if (isSectionFinished(section) && !prefs.unfolded.includes(section.key)) return true
  return false
}

export function toggleSectionCollapsed(section: JournalGiverSection, prefs: JournalPrefs): JournalPrefs {
  const collapsed = isSectionCollapsed(section, prefs)
  return {
    ...prefs,
    collapsed: collapsed ? prefs.collapsed.filter((id) => id !== section.key) : [...new Set([...prefs.collapsed, section.key])],
    unfolded: collapsed ? [...new Set([...prefs.unfolded, section.key])] : prefs.unfolded.filter((id) => id !== section.key),
  }
}

/** True when any of filter, sort or search is off its default. */
export function isViewFiltered(prefs: Pick<JournalPrefs, 'status' | 'sort'>, search: string): boolean {
  return prefs.status !== 'all' || prefs.sort !== 'world' || search.trim().length > 0
}

export function toggleGroupCollapsed(group: JournalGroup, prefs: JournalPrefs): JournalPrefs {
  const collapsed = isGroupCollapsed(group, prefs)
  return {
    ...prefs,
    collapsed: collapsed ? prefs.collapsed.filter((id) => id !== group.id) : [...new Set([...prefs.collapsed, group.id])],
    unfolded: collapsed ? [...new Set([...prefs.unfolded, group.id])] : prefs.unfolded.filter((id) => id !== group.id),
  }
}
