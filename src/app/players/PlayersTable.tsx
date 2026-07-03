'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/Icon'

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
  const [sortKey, setSortKey] = useState<SortKey>('level')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())

  const getVal = SORTERS[sortKey]

  function clickHeader(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
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
          className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
        />
        <span className="ml-auto text-xs text-gray-500">{sorted.length} shown</span>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {sorted.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500">No players match this search.</p>
        )}
        {sorted.map((r) => (
          <PlayerCard key={r.id} r={r} expanded={open.has(r.id)} onToggle={() => toggle(r.id)} />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-gray-800 md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="w-8 px-3 py-2" />
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => clickHeader(col.key)}
                  className={
                    'cursor-pointer select-none px-3 py-2 font-medium hover:text-gray-300 ' +
                    (col.align === 'right' ? 'text-right' : 'text-left')
                  }
                >
                  {col.label}
                  <SortArrow active={sortKey === col.key} dir={sortDir} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <PlayerTr key={r.id} r={r} expanded={open.has(r.id)} onToggle={() => toggle(r.id)} />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-3 py-6 text-center text-gray-500">
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
        className="cursor-pointer border-t border-gray-800 odd:bg-gray-900/30 hover:bg-gray-800/50"
      >
        <td className="px-3 py-2 text-center text-gray-500">{expanded ? '▾' : '▸'}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <Icon name={r.uIcon} size={20} color={r.uIconColor} />
            <Link
              href={`/players/${r.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-indigo-300 hover:text-indigo-200 hover:underline"
            >
              {r.name}
            </Link>
            {r.inFight && <Tag className="border-red-800 text-red-400">in battle</Tag>}
            {!r.isActive && <Tag className="border-gray-700 text-gray-500">inactive</Tag>}
          </div>
        </td>
        <td className="px-3 py-2 text-right text-yellow-400">{r.level}</td>
        <td className="px-3 py-2 text-right text-red-400">{r.hpMax}</td>
        <td className="px-3 py-2 text-right text-blue-400">{r.mpMax}</td>
        <td className="px-3 py-2 text-right text-orange-400">{r.physicalTraining}</td>
        <td className="px-3 py-2 text-right text-purple-400">{r.mentalTraining}</td>
        <td className="px-3 py-2 text-right text-gray-300">{r.kills}</td>
        <td className="px-3 py-2 text-right text-red-300">{r.deaths}</td>
        <td className="px-3 py-2 text-right text-emerald-400">{r.completedQuests}</td>
        <td className="px-3 py-2 text-right text-green-400">{r.xp.toLocaleString()}</td>
        <td className="px-3 py-2 text-right text-gray-400">{r.clicks.toLocaleString()}</td>
        <td className="whitespace-nowrap px-3 py-2 text-right text-gray-400">
          {fmtDate(r.lastLogin)}
          <span className="ml-1 text-gray-600">({fmtRelative(r.lastLogin)})</span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-gray-800 bg-gray-900/60">
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
    <div className="rounded-lg border border-gray-800 bg-gray-900/30 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2">
        <button onClick={onToggle} className="text-gray-500">{expanded ? '▾' : '▸'}</button>
        <Icon name={r.uIcon} size={20} color={r.uIconColor} />
        <Link href={`/players/${r.id}`} className="font-medium text-indigo-300 hover:underline">
          {r.name}
        </Link>
        {r.inFight && <Tag className="border-red-800 text-red-400">in battle</Tag>}
        {!r.isActive && <Tag className="border-gray-700 text-gray-500">inactive</Tag>}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-center text-xs">
        {[
          { label: 'Lvl', value: r.level, color: 'text-yellow-400' },
          { label: 'HP', value: r.hpMax, color: 'text-red-400' },
          { label: 'MP', value: r.mpMax, color: 'text-blue-400' },
          { label: 'Kills', value: r.kills, color: 'text-gray-300' },
          { label: 'PT', value: r.physicalTraining, color: 'text-orange-400' },
          { label: 'MT', value: r.mentalTraining, color: 'text-purple-400' },
          { label: 'Quests', value: r.completedQuests, color: 'text-emerald-400' },
          { label: 'Deaths', value: r.deaths, color: 'text-red-300' },
          { label: 'XP', value: r.xp.toLocaleString(), color: 'text-green-400' },
          { label: 'Clicks', value: r.clicks.toLocaleString(), color: 'text-gray-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="uppercase tracking-wide text-gray-600" style={{ fontSize: '10px' }}>{label}</span>
            <span className={color}>{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 text-xs text-gray-500">
        last login {fmtDate(r.lastLogin)} <span className="text-gray-600">({fmtRelative(r.lastLogin)})</span>
      </div>
      {expanded && (
        <div className="mt-2 border-t border-gray-800 pt-2">
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
        <div key={it.label} className="flex justify-between gap-2 border-b border-gray-800/60 py-0.5">
          <span className="text-gray-500">{it.label}</span>
          <span className="text-right text-gray-200">{it.value}</span>
        </div>
      ))}
    </div>
  )
}

function SortArrow({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className={`ml-1 text-[10px] ${active ? 'text-gray-300' : 'text-gray-700'}`}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
    </span>
  )
}

function Tag({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${className}`}>
      {children}
    </span>
  )
}
