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
  drops: { name: string; chance: number; tag?: 'always' | 'first-kill' }[]
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

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {sorted.length === 0 && (
          <p className="py-6 text-center text-gray-500 text-sm">No enemies match this filter.</p>
        )}
        {groups
          ? groups.map((g) => (
              <div key={g.zone}>
                <p className="px-1 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{g.zone}</p>
                {g.rows.map((r) => <EnemyCard key={r.slug} r={r} />)}
              </div>
            ))
          : sorted.map((r) => <EnemyCard key={r.slug} r={r} />)}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-800">
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
      <td className="px-3 py-2 text-right text-yellow-400">{r.level}</td>
      <td className="px-3 py-2 text-right text-red-400">{r.hp}</td>
      <td className="px-3 py-2 text-right text-gray-300">{r.att}</td>
      <td className="px-3 py-2 text-right text-gray-300">{r.def}</td>
      <td className="px-3 py-2 text-right text-green-400">{r.xp}</td>
      <td className="px-3 py-2 text-right text-gray-400">
        {r.goldMin}–{r.goldMax}
      </td>
      <td className="px-3 py-2 text-gray-400">
        {r.drops.length === 0
          ? '—'
          : r.drops.map((d, i) => {
              const [label, nameColor] =
                d.tag === 'always'     ? ['always', 'text-blue-400'] :
                d.tag === 'first-kill' ? ['1st',    'text-green-400'] :
                                         [`${d.chance}%`, 'text-gray-300']
              return (
                <span key={i}>
                  {i > 0 && <span className="text-gray-600">, </span>}
                  <span className={nameColor}>{d.name}</span>
                  <span className="text-gray-500"> ({label})</span>
                </span>
              )
            })}
      </td>
    </tr>
  )
}

function EnemyCard({ r }: { r: EnemyRow }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/30 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <Icon name={r.icon} size={20} />
        <span className="font-medium text-gray-100">{r.name}</span>
        {r.isFlying && <Tag>flying</Tag>}
        {r.isFriendly && <Tag>friendly</Tag>}
      </div>
      <div className="grid grid-cols-6 gap-1 text-center text-xs mb-2">
        {[
          { label: 'Lvl', value: r.level, color: 'text-yellow-400' },
          { label: 'HP',  value: r.hp,    color: 'text-red-400' },
          { label: 'ATT', value: r.att,   color: 'text-gray-300' },
          { label: 'DEF', value: r.def,   color: 'text-gray-300' },
          { label: 'XP',  value: r.xp,    color: 'text-green-400' },
          { label: 'Gold', value: `${r.goldMin}–${r.goldMax}`, color: 'text-gray-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-gray-600 uppercase tracking-wide" style={{ fontSize: '10px' }}>{label}</span>
            <span className={color}>{value}</span>
          </div>
        ))}
      </div>
      {r.drops.length > 0 && (
        <div className="text-xs text-gray-400 flex flex-wrap gap-x-2 gap-y-0.5">
          {r.drops.map((d, i) => {
            const [label, nameColor] =
              d.tag === 'always'     ? ['always', 'text-blue-400'] :
              d.tag === 'first-kill' ? ['1st',    'text-green-400'] :
                                       [`${d.chance}%`, 'text-gray-300']
            return (
              <span key={i}>
                <span className={nameColor}>{d.name}</span>
                <span className="text-gray-500"> ({label})</span>
              </span>
            )
          })}
        </div>
      )}
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

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
      {children}
    </span>
  )
}
