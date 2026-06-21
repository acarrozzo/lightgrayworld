'use client'

import { useMemo, useState } from 'react'
import Icon from '@/components/Icon'

export type ItemRow = {
  order: number
  slug: string
  name: string
  icon: string | null
  group: string // display group: '1H'/'2H'/'Ranged', equip-slot label, or "Consumable" / "Misc"
  type: string // raw ItemType (EQUIPMENT / CONSUMABLE / MISC)
  weaponType: string | null // '1H' | '2H' | 'Ranged' for weapons, else null
  value: number
  str: number
  dex: number
  mag: number
  def: number
  maxStack: number
  maxPerPlayer: number | null
  canSell: boolean
  canDrop: boolean
  equipable: boolean // weapon or armor — only these resolve world sources
  sources: {
    rooms: { label: string }[] // e.g. "Sand Crab Nest" or "Room 027 ×2"
    enemies: { name: string; label: string }[] // e.g. { name: "Rat", label: "25%" }
  }
}

// Sortable columns. `get` pulls the value used for comparison.
// 'source' keeps the original source order (the default).
type SortKey = 'source' | 'value' | 'str' | 'dex' | 'mag' | 'def'
const SORTERS: Record<SortKey, (r: ItemRow) => number> = {
  source: (r) => r.order,
  value: (r) => r.value,
  str: (r) => r.str,
  dex: (r) => r.dex,
  mag: (r) => r.mag,
  def: (r) => r.def,
}
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'mag', label: 'MAG' },
  { key: 'def', label: 'DEF' },
  { key: 'value', label: 'Value' },
]

// Per-stat colour, mirroring the character sidebar.
const STAT_COLOR: Record<'str' | 'dex' | 'mag' | 'def', string> = {
  str: 'text-red-400',
  dex: 'text-emerald-400',
  mag: 'text-sky-400',
  def: 'text-amber-400',
}

// Groups that count as weapons — used by the "All Weapons" tab.
const WEAPON_GROUPS = ['1H', '2H', 'Ranged']

// An equipable item with no room or enemy source — "not available yet".
function isUnavailable(r: ItemRow): boolean {
  return r.equipable && r.sources.rooms.length === 0 && r.sources.enemies.length === 0
}

export default function ItemsTable({
  rows,
  groups,
}: {
  rows: ItemRow[]
  groups: string[]
}) {
  const [tab, setTab] = useState<string>('All')
  const [grouped, setGrouped] = useState<boolean>(true)
  const [hideUnavailable, setHideUnavailable] = useState<boolean>(false)

  // Whether any unavailable items exist at all — hide the toggle if not.
  const hasUnavailable = useMemo(() => rows.some(isUnavailable), [rows])

  // Tab list: All, then "All Weapons" (if any weapons exist), then every group
  // in source order.
  const tabs = useMemo(() => {
    const hasWeapons = groups.some((g) => WEAPON_GROUPS.includes(g))
    return ['All', ...(hasWeapons ? ['All Weapons'] : []), ...groups]
  }, [groups])
  const [sortKey, setSortKey] = useState<SortKey>('source')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const getVal = SORTERS[sortKey]

  // Whether the view matches the default page view (All tab, grouped by
  // category, items in seed-file order). Used to disable the reset control
  // when there's nothing to reset.
  const isDefaultView =
    tab === 'All' && grouped && !hideUnavailable && sortKey === 'source' && sortDir === 'asc'

  // Restore the default display: no category filter, grouped by category, and
  // items in their original seed-file order (not alphabetical).
  function resetView() {
    setTab('All')
    setGrouped(true)
    setHideUnavailable(false)
    setSortKey('source')
    setSortDir('asc')
  }

  // Header clicks cycle through three states: descending → ascending → none.
  // The first click sorts highest-first; the "none" state reverts to the
  // default sort (seed-file order). Clicking a different column starts a fresh
  // descending sort on that column.
  function clickHeader(key: SortKey) {
    if (key !== sortKey) {
      setSortKey(key)
      setSortDir('desc')
      return
    }
    if (sortDir === 'desc') {
      setSortDir('asc')
    } else {
      // Third click: clear the sort back to the default seed order.
      setSortKey('source')
      setSortDir('asc')
    }
  }

  // Filter, then sort.
  const filtered = useMemo(() => {
    let result = rows
    if (tab === 'All Weapons') result = rows.filter((r) => WEAPON_GROUPS.includes(r.group))
    else if (tab !== 'All') result = rows.filter((r) => r.group === tab)
    if (hideUnavailable) result = result.filter((r) => !isUnavailable(r))
    return result
  }, [rows, tab, hideUnavailable])
  const sorted = useMemo(() => {
    const mult = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => (getVal(a) - getVal(b)) * mult)
  }, [filtered, getVal, sortDir])

  // When grouping, split the already-sorted rows into slot buckets in group order.
  const grid = useMemo(() => {
    if (!grouped) return null
    const map = new Map<string, ItemRow[]>()
    for (const r of sorted) {
      if (!map.has(r.group)) map.set(r.group, [])
      map.get(r.group)!.push(r)
    }
    return groups.filter((g) => map.has(g)).map((g) => ({ group: g, rows: map.get(g)! }))
  }, [grouped, sorted, groups])

  return (
    <div>
      {/* Category tabs */}
      <div className="mb-3 flex flex-wrap gap-1.5 border-b border-gray-800 pb-3">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1 text-sm border transition-colors ${
              tab === t
                ? 'border-gray-500 bg-gray-800 text-gray-100'
                : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700 hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={grouped}
            onChange={(e) => setGrouped(e.target.checked)}
            className="accent-gray-500"
          />
          Group by category
        </label>

        {hasUnavailable && (
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={hideUnavailable}
              onChange={(e) => setHideUnavailable(e.target.checked)}
              className="accent-gray-500"
            />
            Hide unavailable
          </label>
        )}

        <button
          onClick={resetView}
          disabled={isDefaultView}
          className="rounded border border-gray-800 bg-gray-900 px-3 py-1 text-sm text-gray-400 transition-colors hover:border-gray-700 hover:text-gray-200 disabled:cursor-default disabled:opacity-40 disabled:hover:border-gray-800 disabled:hover:text-gray-400"
        >
          Reset view
        </button>

        <span className="ml-auto text-xs text-gray-500">{sorted.length} shown</span>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {sorted.length === 0 && (
          <p className="py-6 text-center text-gray-500 text-sm">No items match this filter.</p>
        )}
        {grid
          ? grid.map((g) => (
              <div key={g.group}>
                <p className="px-1 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {g.group}
                </p>
                {g.rows.map((r) => (
                  <ItemCard key={r.slug} r={r} />
                ))}
              </div>
            ))
          : sorted.map((r) => <ItemCard key={r.slug} r={r} />)}
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
                Item
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
              <th className="px-3 py-2 font-medium">Flags</th>
              <th className="px-3 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {grid
              ? grid.map((g) => <GroupBlock key={g.group} group={g.group} rows={g.rows} />)
              : sorted.map((r) => <ItemTr key={r.slug} r={r} />)}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                  No items match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GroupBlock({ group, rows }: { group: string; rows: ItemRow[] }) {
  return (
    <>
      <tr className="border-t border-gray-800 bg-gray-900/70">
        <td
          colSpan={8}
          className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400"
        >
          {group} <span className="text-gray-600">· {rows.length}</span>
        </td>
      </tr>
      {rows.map((r) => (
        <ItemTr key={r.slug} r={r} />
      ))}
    </>
  )
}

function ItemTr({ r }: { r: ItemRow }) {
  // Dim the whole row when an equipable item has no known world source.
  const dim = isUnavailable(r)
  return (
    <tr className={`border-t border-gray-800 odd:bg-gray-900/30 ${dim ? 'opacity-50' : ''}`}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <ItemIcon icon={r.icon} />
          <span className="font-medium text-gray-100">{r.name}</span>
          {r.weaponType && <Tag>{r.weaponType}</Tag>}
        </div>
      </td>
      <td className="px-3 py-2 text-right">{statCell(r.str, 'str')}</td>
      <td className="px-3 py-2 text-right">{statCell(r.dex, 'dex')}</td>
      <td className="px-3 py-2 text-right">{statCell(r.mag, 'mag')}</td>
      <td className="px-3 py-2 text-right">{statCell(r.def, 'def')}</td>
      <td className="px-3 py-2 text-right text-xs text-gray-400">{r.value.toLocaleString()}</td>
      <td className="px-3 py-2">
        <Flags r={r} />
      </td>
      <td className="px-3 py-2">
        <SourceCell r={r} />
      </td>
    </tr>
  )
}

function ItemCard({ r }: { r: ItemRow }) {
  const dim = isUnavailable(r)
  return (
    <div
      className={`rounded-lg border border-gray-800 bg-gray-900/30 px-3 py-2.5 text-sm ${
        dim ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <ItemIcon icon={r.icon} />
        <span className="font-medium text-gray-100">{r.name}</span>
        {r.weaponType && <Tag>{r.weaponType}</Tag>}
      </div>
      <div className="grid grid-cols-5 gap-1 text-center text-xs mb-2">
        {([
          { label: 'STR', value: r.str, key: 'str' as const },
          { label: 'DEX', value: r.dex, key: 'dex' as const },
          { label: 'MAG', value: r.mag, key: 'mag' as const },
          { label: 'DEF', value: r.def, key: 'def' as const },
          { label: 'Value', value: r.value, key: 'value' as const },
        ]).map(({ label, value, key }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-gray-600 uppercase tracking-wide" style={{ fontSize: '10px' }}>
              {label}
            </span>
            {key === 'value' ? (
              <span className="text-[11px] text-gray-400">{value.toLocaleString()}</span>
            ) : value ? (
              <span className={STAT_COLOR[key]}>{value}</span>
            ) : (
              <span className="text-gray-700">—</span>
            )}
          </div>
        ))}
      </div>
      <Flags r={r} />
      {r.equipable && (
        <div className="mt-2 border-t border-gray-800 pt-2">
          <SourceCell r={r} />
        </div>
      )}
    </div>
  )
}

// Render a stat number, dimmed dash when zero.
function statCell(value: number, key: 'str' | 'dex' | 'mag' | 'def') {
  if (!value) return <span className="text-gray-700">—</span>
  return <span className={STAT_COLOR[key]}>{value}</span>
}

// Where an equipable item comes from: enemy drops (with chance) and rooms.
// Non-equipable items (consumables/misc) show a plain dash — sources aren't
// resolved for them. Equipable items with no source show "not available yet".
function SourceCell({ r }: { r: ItemRow }) {
  if (!r.equipable) return <span className="text-gray-700">—</span>

  const { rooms, enemies } = r.sources
  if (rooms.length === 0 && enemies.length === 0) {
    return <span className="text-[11px] italic text-gray-500">not available yet</span>
  }

  return (
    <div className="flex flex-col gap-1 text-[11px]">
      {enemies.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-gray-600 uppercase tracking-wide" style={{ fontSize: '10px' }}>
            Drops
          </span>
          {enemies.map((e, i) => (
            <span key={i} className="text-gray-300">
              {e.name} <span className="text-gray-500">{e.label}</span>
            </span>
          ))}
        </div>
      )}
      {rooms.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-gray-600 uppercase tracking-wide" style={{ fontSize: '10px' }}>
            Found in
          </span>
          {rooms.map((rm, i) => (
            <span key={i} className="text-gray-300">
              {rm.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Flags({ r }: { r: ItemRow }) {
  return (
    <div className="flex flex-wrap gap-1 text-[10px] text-gray-500">
      {!r.canSell && <Tag>no-sell</Tag>}
      {!r.canDrop && <Tag>no-drop</Tag>}
      {r.maxStack > 1 && <Tag>stack {r.maxStack.toLocaleString()}</Tag>}
      {r.maxPerPlayer != null && <Tag>max {r.maxPerPlayer.toLocaleString()}</Tag>}
    </div>
  )
}

function ItemIcon({ icon }: { icon: string | null }) {
  if (!icon) {
    return <span className="inline-block h-5 w-5 rounded bg-gray-800" aria-hidden />
  }
  return <Icon name={icon} size={20} />
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
