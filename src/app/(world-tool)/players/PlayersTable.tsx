'use client'

import { useMemo, useState } from 'react'
import { useUrlEnum, useUrlString } from '@/components/world-tool/useUrlState'
import Link from 'next/link'
import Icon from '@/components/Icon'
import { Tag, SortableTh } from '@/components/world-tool/ui'

export type PlayerRow = {
  id: string
  name: string
  level: number
  hpMax: number
  mpMax: number
  room: string
  kills: number
  lastLogin: number // epoch ms
  // detail-only
  characterClass: string
  characterRace: string
  physicalTraining: number
  mentalTraining: number
  weapon: string
  helmet: string
  body: string
  deaths: number
  completedQuests: number
  chestsOpened: number
  dailyChestCount: number
  xp: number
  clicks: number
  uIcon: string
  uIconColor: string
  inFight: boolean
  isActive: boolean
}

// Sortable core columns. `get` pulls the comparison value (string or number).
type SortKey =
  | 'name' | 'level' | 'hpMax' | 'mpMax' | 'kills' | 'deaths'
  | 'physicalTraining' | 'mentalTraining' | 'completedQuests'
  | 'xp' | 'clicks' | 'lastLogin'
const SORTERS: Record<SortKey, (r: PlayerRow) => string | number> = {
  name: (r) => r.name.toLowerCase(),
  level: (r) => r.level,
  hpMax: (r) => r.hpMax,
  mpMax: (r) => r.mpMax,
  kills: (r) => r.kills,
  deaths: (r) => r.deaths,
  physicalTraining: (r) => r.physicalTraining,
  mentalTraining: (r) => r.mentalTraining,
  completedQuests: (r) => r.completedQuests,
  xp: (r) => r.xp,
  clicks: (r) => r.clicks,
  lastLogin: (r) => r.lastLogin,
}
const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'name', label: 'Name', align: 'left' },
  { key: 'level', label: 'Lvl', align: 'right' },
  { key: 'hpMax', label: 'Max HP', align: 'right' },
  { key: 'mpMax', label: 'Max MP', align: 'right' },
  { key: 'physicalTraining', label: 'PT', align: 'right' },
  { key: 'mentalTraining', label: 'MT', align: 'right' },
  { key: 'kills', label: 'Kills', align: 'right' },
  { key: 'deaths', label: 'Deaths', align: 'right' },
  { key: 'completedQuests', label: 'Quests', align: 'right' },
  { key: 'xp', label: 'XP', align: 'right' },
  { key: 'clicks', label: 'Clicks', align: 'right' },
  { key: 'lastLogin', label: 'Last Login', align: 'right' },
]

function compare(a: string | number, b: string | number) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function fmtDate(ms: number) {
  const d = new Date(ms)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// Coarse "3 days ago" style label relative to now.
function fmtRelative(ms: number) {
  const diff = Date.now() - ms
  const abs = Math.abs(diff)
  const suffix = diff >= 0 ? 'ago' : 'from now'
  const units: [number, string][] = [
    [60_000, 'min'],
    [3_600_000, 'hour'],
    [86_400_000, 'day'],
    [604_800_000, 'week'],
    [2_592_000_000, 'month'],
    [31_536_000_000, 'year'],
  ]
  if (abs < 60_000) return 'just now'
  let value = abs / 60_000
  let unit = 'min'
  for (let i = 0; i < units.length; i++) {
    const [ms2, name] = units[i]
    const next = units[i + 1]
    if (!next || abs < next[0]) {
      value = Math.floor(abs / ms2)
      unit = name
      break
    }
  }
  return `${value} ${unit}${value === 1 ? '' : 's'} ${suffix}`
}

export default function PlayersTable({ rows }: { rows: PlayerRow[] }) {
  const [sortKey, setSortKey] = useUrlEnum<SortKey>(
    'sort',
    ['name', 'level', 'hpMax', 'mpMax', 'kills', 'deaths', 'physicalTraining',
     'mentalTraining', 'completedQuests', 'xp', 'clicks', 'lastLogin'] as const,
    'level'
  )
  const [sortDir, setSortDir] = useUrlEnum<'asc' | 'desc'>('dir', ['asc', 'desc'] as const, 'desc')
  const [query, setQuery] = useUrlString('q', '')
  const [open, setOpen] = useState<Set<string>>(new Set())

  const getVal = SORTERS[sortKey]

  function clickHeader(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.room.toLowerCase().includes(q)
    )
  }, [rows, query])

  const sorted = useMemo(() => {
    const mult = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => compare(getVal(a), getVal(b)) * mult)
  }, [filtered, getVal, sortDir])

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or room…"
          className="rounded border border-line-subtle fill-surface-panel px-2 py-1 text-sm placeholder-fg-disabled focus:outline-none focus:ring-1 focus:ring-line-strong"
        />
        <span className="ml-auto text-xs text-fg-muted">{sorted.length} shown</span>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {sorted.length === 0 && (
          <p className="py-6 text-center text-sm text-fg-muted">No players match this search.</p>
        )}
        {sorted.map((r) => (
          <PlayerCard key={r.id} r={r} expanded={open.has(r.id)} onToggle={() => toggle(r.id)} />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-line-subtle md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-panel text-left text-xs uppercase tracking-wide text-fg-muted">
              <th className="w-8 px-3 py-2" />
              {COLUMNS.map((col) => (
                <SortableTh
                  key={col.key}
                  label={col.label}
                  align={col.align}
                  active={sortKey === col.key}
                  dir={sortDir}
                  onSort={() => clickHeader(col.key)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <PlayerTr key={r.id} r={r} expanded={open.has(r.id)} onToggle={() => toggle(r.id)} />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-3 py-6 text-center text-fg-muted">
                  No players match this search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PlayerTr({ r, expanded, onToggle }: { r: PlayerRow; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-t border-line-subtle odd:bg-surface-panel/30 hover:bg-surface-raised/50"
      >
        <td className="px-3 py-2 text-center text-fg-muted">{expanded ? '▾' : '▸'}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <Icon name={r.uIcon} size={20} color={r.uIconColor} />
            <Link
              href={`/players/${r.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-accent-hover/80 hover:text-accent-hover hover:underline"
            >
              {r.name}
            </Link>
            {r.inFight && <Tag className="border-status-error text-status-error">in battle</Tag>}
            {!r.isActive && <Tag className="border-line-subtle text-fg-muted">inactive</Tag>}
          </div>
        </td>
        <td className="px-3 py-2 text-right text-status-warning">{r.level}</td>
        <td className="px-3 py-2 text-right text-status-error">{r.hpMax}</td>
        <td className="px-3 py-2 text-right text-resource-mp">{r.mpMax}</td>
        <td className="px-3 py-2 text-right text-action-attack">{r.physicalTraining}</td>
        <td className="px-3 py-2 text-right text-stat-mag">{r.mentalTraining}</td>
        <td className="px-3 py-2 text-right text-fg-primary">{r.kills}</td>
        <td className="px-3 py-2 text-right text-status-error">{r.deaths}</td>
        <td className="px-3 py-2 text-right text-status-success">{r.completedQuests}</td>
        <td className="px-3 py-2 text-right text-status-success">{r.xp.toLocaleString()}</td>
        <td className="px-3 py-2 text-right text-fg-secondary">{r.clicks.toLocaleString()}</td>
        <td className="whitespace-nowrap px-3 py-2 text-right text-fg-secondary">
          {fmtDate(r.lastLogin)}
          <span className="ml-1 text-fg-disabled">({fmtRelative(r.lastLogin)})</span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-line-subtle bg-surface-panel/60">
          <td />
          <td colSpan={COLUMNS.length} className="px-3 py-3">
            <DetailGrid r={r} />
          </td>
        </tr>
      )}
    </>
  )
}

function PlayerCard({ r, expanded, onToggle }: { r: PlayerRow; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-lg border border-line-subtle bg-surface-panel/30 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2">
        <button onClick={onToggle} className="text-fg-muted">{expanded ? '▾' : '▸'}</button>
        <Icon name={r.uIcon} size={20} color={r.uIconColor} />
        <Link href={`/players/${r.id}`} className="font-medium text-accent-hover hover:underline">
          {r.name}
        </Link>
        {r.inFight && <Tag className="border-status-error text-status-error">in battle</Tag>}
        {!r.isActive && <Tag className="border-line-subtle text-fg-muted">inactive</Tag>}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-center text-xs">
        {[
          { label: 'Lvl', value: r.level, color: 'text-status-warning' },
          { label: 'HP', value: r.hpMax, color: 'text-status-error' },
          { label: 'MP', value: r.mpMax, color: 'text-resource-mp' },
          { label: 'Kills', value: r.kills, color: 'text-fg-primary' },
          { label: 'PT', value: r.physicalTraining, color: 'text-action-attack' },
          { label: 'MT', value: r.mentalTraining, color: 'text-stat-mag' },
          { label: 'Quests', value: r.completedQuests, color: 'text-status-success' },
          { label: 'Deaths', value: r.deaths, color: 'text-status-error' },
          { label: 'XP', value: r.xp.toLocaleString(), color: 'text-status-success' },
          { label: 'Clicks', value: r.clicks.toLocaleString(), color: 'text-fg-secondary' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="uppercase tracking-wide text-fg-disabled" style={{ fontSize: '10px' }}>{label}</span>
            <span className={color}>{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 text-xs text-fg-muted">
        last login {fmtDate(r.lastLogin)} <span className="text-fg-disabled">({fmtRelative(r.lastLogin)})</span>
      </div>
      {expanded && (
        <div className="mt-2 border-t border-line-subtle pt-2">
          <DetailGrid r={r} />
        </div>
      )}
    </div>
  )
}

function DetailGrid({ r }: { r: PlayerRow }) {
  const items: { label: string; value: React.ReactNode }[] = [
    { label: 'Class', value: r.characterClass },
    { label: 'Race', value: r.characterRace },
    { label: 'Room', value: r.room },
    { label: 'Weapon', value: r.weapon },
    { label: 'Helmet', value: r.helmet },
    { label: 'Body Armor', value: r.body },
    { label: 'Chests Opened', value: `${r.chestsOpened} / 10` },
    { label: 'Daily Chests', value: r.dailyChestCount },
  ]
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="flex justify-between gap-2 border-b border-line-subtle/60 py-0.5">
          <span className="text-fg-muted">{it.label}</span>
          <span className="text-right text-fg-bright">{it.value}</span>
        </div>
      ))}
    </div>
  )
}


