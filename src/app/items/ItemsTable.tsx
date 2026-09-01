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
  max: number
  canSell: boolean
  canDrop: boolean
  equipable: boolean // weapon or armor
  sources: {
    rooms: { label: string }[] // e.g. "Sand Crab Nest" or "Room 027 ×2"
    enemies: { name: string; label: string }[] // e.g. { name: "Rat", label: "25%" }
    quests: { label: string }[] // quest title, e.g. "Rat Problem ×5"
    chests: { label: string }[] // chest name, e.g. "Gold Chest ×3"
    searches: { label: string }[] // room name searched, e.g. "Cabin Basement"
    gathers: { label: string }[] // gathered resource, e.g. "Beach ×5 · 5m · shovel"
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
  str: 'text-status-error',
  dex: 'text-status-success',
  mag: 'text-status-info',
  def: 'text-resource-gold',
}

// Groups that count as weapons — used by the "All Weapons" tab.
const WEAPON_GROUPS = ['1H', '2H', 'Ranged']

// Total number of resolved sources across every source type.
function sourceCount(r: ItemRow): number {
  const s = r.sources
  return (
    s.rooms.length +
    s.enemies.length +
    s.quests.length +
    s.chests.length +
    s.searches.length +
    s.gathers.length
  )
}

// An equipable item with no source anywhere — "not available yet".
function isUnavailable(r: ItemRow): boolean {
  return r.equipable && sourceCount(r) === 0
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
      <div className="mb-3 flex flex-wrap gap-1.5 border-b border-line-subtle pb-3">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1 text-sm border transition-colors ${
              tab === t
                ? 'border-line-strong bg-surface-raised text-fg-bright'
                : 'border-line-subtle/80 bg-surface-panel text-fg-secondary hover:border-line-subtle hover:text-fg-bright'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-fg-secondary">
          <input
            type="checkbox"
            checked={grouped}
            onChange={(e) => setGrouped(e.target.checked)}
            className="accent-fg-muted"
          />
          Group by category
        </label>

        {hasUnavailable && (
          <label className="flex items-center gap-2 text-sm text-fg-secondary">
            <input
              type="checkbox"
              checked={hideUnavailable}
              onChange={(e) => setHideUnavailable(e.target.checked)}
              className="accent-fg-muted"
            />
            Hide unavailable
          </label>
        )}

        <button
          onClick={resetView}
          disabled={isDefaultView}
          className="rounded border border-line-subtle/80 bg-surface-panel px-3 py-1 text-sm text-fg-secondary/80 transition-colors hover:border-line-subtle hover:text-fg-bright disabled:cursor-default disabled:opacity-40 disabled:hover:border-line-subtle disabled:hover:text-fg-secondary"
        >
          Reset view
        </button>

        <span className="ml-auto text-xs text-fg-muted">{sorted.length} shown</span>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {sorted.length === 0 && (
          <p className="py-6 text-center text-fg-muted text-sm">No items match this filter.</p>
        )}
        {grid
          ? grid.map((g) => (
              <div key={g.group}>
                <p className="px-1 py-2 text-xs font-semibold uppercase tracking-wide text-fg-secondary">
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
      <div className="hidden md:block overflow-x-auto rounded-lg border border-line-subtle">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-panel text-left text-xs uppercase tracking-wide text-fg-muted">
              <th
                onClick={() => clickHeader('source')}
                className="cursor-pointer select-none px-3 py-2 font-medium hover:text-fg-primary"
              >
                Item
                <SortArrow active={sortKey === 'source'} dir={sortDir} />
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => clickHeader(col.key)}
                  className="cursor-pointer select-none px-3 py-2 text-right font-medium hover:text-fg-primary"
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
                <td colSpan={8} className="px-3 py-6 text-center text-fg-muted">
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
      <tr className="border-t border-line-subtle bg-surface-panel/70">
        <td
          colSpan={8}
          className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-fg-secondary"
        >
          {group} <span className="text-fg-disabled">· {rows.length}</span>
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
    <tr className={`border-t border-line-subtle odd:bg-surface-panel/30 ${dim ? 'opacity-50' : ''}`}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <ItemIcon icon={r.icon} />
          <span className="font-medium text-fg-bright">{r.name}</span>
          {r.weaponType && <Tag>{r.weaponType}</Tag>}
        </div>
      </td>
      <td className="px-3 py-2 text-right">{statCell(r.str, 'str')}</td>
      <td className="px-3 py-2 text-right">{statCell(r.dex, 'dex')}</td>
      <td className="px-3 py-2 text-right">{statCell(r.mag, 'mag')}</td>
      <td className="px-3 py-2 text-right">{statCell(r.def, 'def')}</td>
      <td className="px-3 py-2 text-right text-xs text-fg-secondary">{r.value.toLocaleString()}</td>
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
      className={`rounded-lg border border-line-subtle bg-surface-panel/30 px-3 py-2.5 text-sm ${
        dim ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <ItemIcon icon={r.icon} />
        <span className="font-medium text-fg-bright">{r.name}</span>
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
            <span className="text-fg-disabled uppercase tracking-wide" style={{ fontSize: '10px' }}>
              {label}
            </span>
            {key === 'value' ? (
              <span className="text-[11px] text-fg-secondary">{value.toLocaleString()}</span>
            ) : value ? (
              <span className={STAT_COLOR[key]}>{value}</span>
            ) : (
              <span className="text-fg-disabled">—</span>
            )}
          </div>
        ))}
      </div>
      <Flags r={r} />
      {sourceCount(r) > 0 && (
        <div className="mt-2 border-t border-line-subtle pt-2">
          <SourceCell r={r} />
        </div>
      )}
    </div>
  )
}

// Render a stat number, dimmed dash when zero.
function statCell(value: number, key: 'str' | 'dex' | 'mag' | 'def') {
  if (!value) return <span className="text-fg-disabled">—</span>
  return <span className={STAT_COLOR[key]}>{value}</span>
}

// A labelled row of source chips ("Drops", "Found in", "Quest", …). Renders
// nothing when the list is empty.
function SourceGroup({ label, items }: { label: string; items: { label: string }[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-fg-disabled uppercase tracking-wide" style={{ fontSize: '10px' }}>
        {label}
      </span>
      {items.map((it, i) => (
        <span key={i} className="text-fg-primary">
          {it.label}
        </span>
      ))}
    </div>
  )
}

// Where an item comes from: enemy drops (with chance), room pickups, quest
// rewards, chests, and room searches. Equipable items with no source show
// "not available yet"; other sourceless items show a plain dash.
function SourceCell({ r }: { r: ItemRow }) {
  const { rooms, enemies, quests, chests, searches, gathers } = r.sources
  if (sourceCount(r) === 0) {
    return r.equipable ? (
      <span className="text-[11px] italic text-fg-muted">not available yet</span>
    ) : (
      <span className="text-fg-disabled">—</span>
    )
  }

  return (
    <div className="flex flex-col gap-1 text-[11px]">
      {enemies.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-fg-disabled uppercase tracking-wide" style={{ fontSize: '10px' }}>
            Drops
          </span>
          {enemies.map((e, i) => (
            <span key={i} className="text-fg-primary">
              {e.name} <span className="text-fg-muted">{e.label}</span>
            </span>
          ))}
        </div>
      )}
      <SourceGroup label="Found in" items={rooms} />
      <SourceGroup label="Gather" items={gathers} />
      <SourceGroup label="Quest" items={quests} />
      <SourceGroup label="Chest" items={chests} />
      <SourceGroup label="Search" items={searches} />
    </div>
  )
}

function Flags({ r }: { r: ItemRow }) {
  return (
    <div className="flex flex-wrap gap-1 text-[10px] text-fg-muted">
      {!r.canSell && <Tag>no-sell</Tag>}
      {!r.canDrop && <Tag>no-drop</Tag>}
      {r.max > 0 && <Tag>max {r.max.toLocaleString()}</Tag>}
    </div>
  )
}

function ItemIcon({ icon }: { icon: string | null }) {
  if (!icon) {
    return <span className="inline-block h-5 w-5 rounded bg-surface-raised" aria-hidden />
  }
  return <Icon name={icon} size={20} />
}

function SortArrow({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className={`ml-1 text-[10px] ${active ? 'text-fg-primary' : 'text-fg-disabled'}`}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
    </span>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-line-subtle px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fg-muted">
      {children}
    </span>
  )
}
