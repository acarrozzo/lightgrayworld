'use client'

import { useMemo, useState } from 'react'
import Icon from '@/components/Icon'

export type EnemyRow = {
  order: number
  slug: string
  zone: string
  name: string
  icon: string
  level: number
  hp: number
  att: number
  def: number
  xp: number
  goldMin: number
  goldMax: number
  isAggressive: boolean
  isFlying: boolean
  isFriendly: boolean
  drops: { name: string; chance: number }[]
}

// Sortable columns. `get` pulls the value used for comparison.
// 'source' keeps the original source-file order (the default).
type SortKey = 'source' | 'level' | 'hp' | 'att' | 'def' | 'xp' | 'gold'
const SORTERS: Record<SortKey, (r: EnemyRow) => number> = {
  source: (r) => r.order,
  level: (r) => r.level,
  hp: (r) => r.hp,
  att: (r) => r.att,
  def: (r) => r.def,
  xp: (r) => r.xp,
  gold: (r) => r.goldMax,
}
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'level', label: 'Lvl' },
  { key: 'hp', label: 'HP' },
  { key: 'att', label: 'ATT' },
  { key: 'def', label: 'DEF' },
  { key: 'xp', label: 'XP' },
  { key: 'gold', label: 'Gold' },
]

export default function EnemiesTable({
  rows,
  zones,
}: {
  rows: EnemyRow[]
  zones: string[]
}) {
  const [area, setArea] = useState<string>('all')
  const [grouped, setGrouped] = useState<boolean>(true)
  const [sortKey, setSortKey] = useState<SortKey>('source')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const getVal = SORTERS[sortKey]

  function clickHeader(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // Filter, then sort.
  const filtered = useMemo(
    () => (area === 'all' ? rows : rows.filter((r) => r.zone === area)),
    [rows, area]
  )
  const sorted = useMemo(() => {
    const mult = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => (getVal(a) - getVal(b)) * mult)
  }, [filtered, getVal, sortDir])

  // When grouping, split the already-sorted rows into zone buckets in zone order.
  const groups = useMemo(() => {
    if (!grouped) return null
    const map = new Map<string, EnemyRow[]>()
    for (const r of sorted) {
      if (!map.has(r.zone)) map.set(r.zone, [])
      map.get(r.zone)!.push(r)
    }
    return zones.filter((z) => map.has(z)).map((z) => ({ zone: z, rows: map.get(z)! }))
  }, [grouped, sorted, zones])

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-400">
          Area
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-600"
          >
            <option value="all">All areas</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={grouped}
            onChange={(e) => setGrouped(e.target.checked)}
            className="accent-gray-500"
          />
          Group by area
        </label>

        <span className="ml-auto text-xs text-gray-500">
          {sorted.length} shown
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-500">
              <th
                onClick={() => clickHeader('source')}
                className="cursor-pointer select-none px-3 py-2 font-medium hover:text-gray-300"
              >
                Enemy
                <SortArrow active={sortKey === 'source'} dir={sortDir} />
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => clickHeader(col.key)}
                  className="cursor-pointer select-none px-3 py-2 text-right font-medium hover:text-gray-300"
                >
                  {col.label}
                  <SortArrow active={sortKey === col.key} dir={sortDir} />
                </th>
              ))}
              <th className="px-3 py-2 font-medium">Drops</th>
            </tr>
          </thead>
          <tbody>
            {groups
              ? groups.map((g) => (
                  <GroupBlock key={g.zone} zone={g.zone} rows={g.rows} />
                ))
              : sorted.map((r) => <EnemyTr key={r.slug} r={r} />)}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                  No enemies match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GroupBlock({ zone, rows }: { zone: string; rows: EnemyRow[] }) {
  return (
    <>
      <tr className="border-t border-gray-800 bg-gray-900/70">
        <td
          colSpan={8}
          className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400"
        >
          {zone}
        </td>
      </tr>
      {rows.map((r) => (
        <EnemyTr key={r.slug} r={r} />
      ))}
    </>
  )
}

function EnemyTr({ r }: { r: EnemyRow }) {
  return (
    <tr className="border-t border-gray-800 odd:bg-gray-900/30">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon name={r.icon} size={20} />
          <span className="font-medium text-gray-100">{r.name}</span>
          {r.isFlying && <Tag>flying</Tag>}
          {r.isFriendly && <Tag>friendly</Tag>}
        </div>
      </td>
      <td className="px-3 py-2 text-right text-gray-400">{r.level}</td>
      <td className="px-3 py-2 text-right text-gray-300">{r.hp}</td>
      <td className="px-3 py-2 text-right text-gray-300">{r.att}</td>
      <td className="px-3 py-2 text-right text-gray-300">{r.def}</td>
      <td className="px-3 py-2 text-right text-gray-300">{r.xp}</td>
      <td className="px-3 py-2 text-right text-gray-400">
        {r.goldMin}–{r.goldMax}
      </td>
      <td className="px-3 py-2 text-gray-400">
        {r.drops.length === 0
          ? '—'
          : r.drops.map((d) => `${d.name} (${d.chance}%)`).join(', ')}
      </td>
    </tr>
  )
}

function SortArrow({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className={`ml-1 text-[10px] ${active ? 'text-gray-300' : 'text-gray-700'}`}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
    </span>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
      {children}
    </span>
  )
}
