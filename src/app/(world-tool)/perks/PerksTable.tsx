'use client'

import { useMemo } from 'react'
import { useUrlEnum, useUrlString, useUrlFlag } from '@/components/world-tool/useUrlState'
import { useIsWide } from '@/components/world-tool/useIsWide'
import Icon from '@/components/Icon'
import { Tag, SortableTh } from '@/components/world-tool/ui'
import { EntityLink, enemyHref, useAnchorTarget } from '@/components/world-tool/EntityLink'

export type PerkGrade = 'rolled' | 'pure' | 'pierce' | 'divine'

export type PerkCarrier = { slug: string; name: string; level: number; zone: string; note: string }

export type PerkRow = {
  /** Catalog order: attack perks in the order they resolve, then the standing ones by group. */
  order: number
  id: string
  group: string
  groupLabel: string
  name: string
  when: string
  /** The proc chance where one is fixed for every carrier; null otherwise. */
  chance: number | null
  icon: string | null
  grade: PerkGrade | null
  rule: string
  answer: string
  carriers: PerkCarrier[]
}

export type PerkEnemyRow = {
  slug: string
  name: string
  icon: string
  level: number
  zone: string
  hp: number
  att: number
  def: number
  perks: { id: string; label: string; name: string }[]
}

const GRADES: { id: PerkGrade; name: string; enemy: string; you: string; share: string }[] = [
  { id: 'rolled', name: 'Rolled', enemy: 'rand(0, ATT)', you: 'rand(0, DEF)', share: '17% · 8% · 4%' },
  { id: 'pure', name: 'Pure', enemy: 'full ATT, no roll', you: 'rand(0, DEF)', share: '50% · 25% · 12.5%' },
  { id: 'pierce', name: 'Pierce', enemy: 'rand(0, ATT)', you: 'nothing', share: '50% · 50% · 50%' },
  { id: 'divine', name: 'Divine', enemy: 'full ATT, no roll', you: 'nothing', share: '100% · 100% · 100%' },
]
const GRADE_RANK: Record<PerkGrade, number> = { rolled: 1, pure: 2, pierce: 3, divine: 4 }
const GRADE_TAG: Record<PerkGrade, string> = {
  rolled: 'border-line-subtle text-fg-muted',
  pure: 'border-status-warning/50 text-status-warning',
  pierce: 'border-hue-purple/50 text-hue-purple',
  divine: 'border-status-error/50 text-status-error',
}

type PerkSort = 'order' | 'name' | 'chance' | 'grade' | 'count' | 'minLevel' | 'maxLevel'
const PERK_SORTERS: Record<PerkSort, (p: PerkRow) => number | string> = {
  order: (p) => p.order,
  name: (p) => p.name.toLowerCase(),
  // Perks with no fixed chance sort after every one that has one.
  chance: (p) => p.chance ?? 2,
  grade: (p) => (p.grade ? GRADE_RANK[p.grade] : 0),
  count: (p) => p.carriers.length,
  minLevel: (p) => (p.carriers.length ? p.carriers[0].level : Infinity),
  maxLevel: (p) => (p.carriers.length ? p.carriers[p.carriers.length - 1].level : -1),
}

type EnemySort = 'level' | 'name' | 'area' | 'hp' | 'att' | 'def' | 'count'
// 'area' sorts by the world's own area order, which only the component knows.
const ENEMY_SORTERS: Record<Exclude<EnemySort, 'area'>, (e: PerkEnemyRow) => number | string> = {
  level: (e) => e.level,
  name: (e) => e.name.toLowerCase(),
  hp: (e) => e.hp,
  att: (e) => e.att,
  def: (e) => e.def,
  count: (e) => e.perks.length,
}

function compare(a: number | string, b: number | string) {
  return typeof a === 'string' || typeof b === 'string' ? String(a).localeCompare(String(b)) : a - b
}

const SELECT_CLASS =
  'rounded border border-line-subtle fill-surface-panel px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-line-strong'

export default function PerksTable({
  perks,
  enemies,
  zones,
  groups,
}: {
  perks: PerkRow[]
  enemies: PerkEnemyRow[]
  zones: string[]
  groups: { id: string; label: string; blurb: string }[]
}) {
  const [view, setView] = useUrlEnum<'perks' | 'enemies'>('view', ['perks', 'enemies'] as const, 'perks')
  const [query, setQuery] = useUrlString('q', '')
  const [group, setGroup] = useUrlString('group', 'all')
  const [grade, setGrade] = useUrlString('grade', 'all')
  const [area, setArea] = useUrlString('area', 'all')
  const [perkId, setPerkId] = useUrlString('perk', 'all')
  const [grouped, setGrouped] = useUrlFlag('grouped', true)
  const [showCarriers, setShowCarriers] = useUrlFlag('carriers', true)
  const [showGrades, setShowGrades] = useUrlFlag('grades', true)
  const [showPerkless, setShowPerkless] = useUrlFlag('all', false)
  const [perkSort, setPerkSort] = useUrlEnum<PerkSort>(
    'sort',
    ['order', 'name', 'chance', 'grade', 'count', 'minLevel', 'maxLevel'] as const,
    'order'
  )
  const [enemySort, setEnemySort] = useUrlEnum<EnemySort>(
    'esort',
    ['level', 'name', 'area', 'hp', 'att', 'def', 'count'] as const,
    'level'
  )
  const [sortDir, setSortDir] = useUrlEnum<'asc' | 'desc'>('dir', ['asc', 'desc'] as const, 'asc')

  useAnchorTarget()
  const wide = useIsWide()
  const needle = query.trim().toLowerCase()
  const mult = sortDir === 'asc' ? 1 : -1
  const gradeOf = useMemo(() => new Map(perks.map((p) => [p.id, p.grade])), [perks])

  function sortPerksBy(key: PerkSort) {
    if (key === perkSort) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setPerkSort(key)
      setSortDir(key === 'count' || key === 'maxLevel' ? 'desc' : 'asc')
    }
  }
  function sortEnemiesBy(key: EnemySort) {
    if (key === enemySort) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setEnemySort(key)
      setSortDir(key === 'count' ? 'desc' : 'asc')
    }
  }

  // Perks view: the area narrows each perk's carriers, and a perk nobody in
  // that area carries drops out.
  const shownPerks = useMemo(() => {
    const get = PERK_SORTERS[perkSort]
    return perks
      .map((p) => (area === 'all' ? p : { ...p, carriers: p.carriers.filter((c) => c.zone === area) }))
      .filter((p) => (area === 'all' ? true : p.carriers.length > 0))
      .filter((p) => group === 'all' || p.group === group)
      .filter((p) => grade === 'all' || p.grade === grade)
      .filter(
        (p) =>
          !needle ||
          p.name.toLowerCase().includes(needle) ||
          p.rule.toLowerCase().includes(needle) ||
          p.when.toLowerCase().includes(needle) ||
          p.carriers.some((c) => c.name.toLowerCase().includes(needle))
      )
      .sort((a, b) => compare(get(a), get(b)) * mult || a.order - b.order)
  }, [perks, area, group, grade, needle, perkSort, mult])

  const perkGroups = useMemo(() => {
    if (!grouped) return null
    return groups
      .map((g) => ({ ...g, rows: shownPerks.filter((p) => p.group === g.id) }))
      .filter((g) => g.rows.length > 0)
  }, [grouped, groups, shownPerks])

  const shownEnemies = useMemo(() => {
    const get =
      enemySort === 'area' ? (e: PerkEnemyRow) => zones.indexOf(e.zone) : ENEMY_SORTERS[enemySort]
    return enemies
      .filter((e) => showPerkless || e.perks.length > 0)
      .filter((e) => area === 'all' || e.zone === area)
      .filter((e) => perkId === 'all' || e.perks.some((p) => p.id === perkId))
      .filter((e) => grade === 'all' || e.perks.some((p) => gradeOf.get(p.id) === grade))
      .filter(
        (e) =>
          !needle ||
          e.name.toLowerCase().includes(needle) ||
          e.perks.some((p) => p.label.toLowerCase().includes(needle) || p.name.toLowerCase().includes(needle))
      )
      .sort((a, b) => compare(get(a), get(b)) * mult || a.level - b.level)
  }, [enemies, zones, showPerkless, area, perkId, grade, gradeOf, needle, enemySort, mult])

  const shownCount = view === 'perks' ? shownPerks.length : shownEnemies.length

  return (
    <div>
      {showGrades && <GradesTable />}

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded border border-line-subtle text-sm" role="group" aria-label="View">
          {(['perks', 'enemies'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={
                'px-3 py-1 focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent ' +
                (view === v ? 'bg-surface-panel font-semibold text-fg-bright' : 'text-fg-muted hover:text-fg-primary')
              }
            >
              {v === 'perks' ? 'By perk' : 'By enemy'}
            </button>
          ))}
        </div>

        <input
          id="perk-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={view === 'perks' ? 'Search perks, rules, enemies' : 'Search enemies or perks'}
          aria-label="Search"
          className={`${SELECT_CLASS} w-56`}
        />

        {view === 'perks' ? (
          <label className="flex items-center gap-2 text-sm text-fg-secondary">
            Group
            <select id="perk-group" value={group} onChange={(e) => setGroup(e.target.value)} className={SELECT_CLASS}>
              <option value="all">All groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex items-center gap-2 text-sm text-fg-secondary">
            Perk
            <select id="perk-carried" value={perkId} onChange={(e) => setPerkId(e.target.value)} className={SELECT_CLASS}>
              <option value="all">Any perk</option>
              {perks.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-2 text-sm text-fg-secondary">
          Grade
          <select id="perk-grade" value={grade} onChange={(e) => setGrade(e.target.value)} className={SELECT_CLASS}>
            <option value="all">Any grade</option>
            {GRADES.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-fg-secondary">
          Area
          <select id="perk-area" value={area} onChange={(e) => setArea(e.target.value)} className={SELECT_CLASS}>
            <option value="all">All areas</option>
            {zones.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </label>

        {view === 'perks' && (
          <>
            <label className="flex items-center gap-2 text-sm text-fg-secondary">
              <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} className="accent-fg-muted" />
              Group
            </label>
            <label className="flex items-center gap-2 text-sm text-fg-secondary">
              <input type="checkbox" checked={showCarriers} onChange={(e) => setShowCarriers(e.target.checked)} className="accent-fg-muted" />
              Carriers
            </label>
          </>
        )}
        {view === 'enemies' && (
          <label className="flex items-center gap-2 text-sm text-fg-secondary">
            <input type="checkbox" checked={showPerkless} onChange={(e) => setShowPerkless(e.target.checked)} className="accent-fg-muted" />
            Enemies with no perks
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-fg-secondary">
          <input type="checkbox" checked={showGrades} onChange={(e) => setShowGrades(e.target.checked)} className="accent-fg-muted" />
          Grades key
        </label>

        <span className="ml-auto text-xs text-fg-muted">{shownCount} shown</span>
      </div>

      {view === 'perks' && !wide && (
        <div className="space-y-2">
          {shownPerks.length === 0 && <p className="py-6 text-center text-sm text-fg-muted">No perks match this filter.</p>}
          {(perkGroups ?? [{ id: 'all', label: '', blurb: '', rows: shownPerks }]).map((g) => (
            <div key={g.id}>
              {g.label && <p className="px-1 py-2 text-xs font-semibold uppercase tracking-wide text-fg-secondary">{g.label}</p>}
              <div className="space-y-2">
                {g.rows.map((p) => <PerkCard key={p.id} p={p} showCarriers={showCarriers} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'perks' && wide && (
        <div className="overflow-x-auto rounded-lg border border-line-subtle">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-panel text-left text-xs uppercase tracking-wide text-fg-muted">
                <SortableTh label="Perk" active={perkSort === 'name' || perkSort === 'order'} dir={sortDir} onSort={() => sortPerksBy(perkSort === 'order' ? 'name' : 'order')} />
                <SortableTh label="When" active={perkSort === 'chance'} dir={sortDir} onSort={() => sortPerksBy('chance')} />
                <SortableTh label="Grade" active={perkSort === 'grade'} dir={sortDir} onSort={() => sortPerksBy('grade')} />
                <SortableTh label="Enemies" active={perkSort === 'count'} dir={sortDir} onSort={() => sortPerksBy('count')} />
                <SortableTh label="From" align="right" active={perkSort === 'minLevel'} dir={sortDir} onSort={() => sortPerksBy('minLevel')} />
                <SortableTh label="To" align="right" active={perkSort === 'maxLevel'} dir={sortDir} onSort={() => sortPerksBy('maxLevel')} />
                <th className="px-3 py-2 font-medium">Rule and answer</th>
              </tr>
            </thead>
            <tbody>
              {perkGroups
                ? perkGroups.map((g) => (
                    <PerkGroupBlock key={g.id} label={g.label} blurb={g.blurb} rows={g.rows} showCarriers={showCarriers} />
                  ))
                : shownPerks.map((p) => <PerkTr key={p.id} p={p} showCarriers={showCarriers} />)}
              {shownPerks.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-fg-muted">No perks match this filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'enemies' && !wide && (
        <div className="space-y-2">
          {shownEnemies.length === 0 && <p className="py-6 text-center text-sm text-fg-muted">No enemies match this filter.</p>}
          {shownEnemies.map((e) => (
            <div key={e.slug} className="rounded-lg border border-line-subtle bg-surface-panel/30 px-3 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <Icon name={e.icon} size={20} />
                <EntityLink href={enemyHref(e.slug)}>{e.name}</EntityLink>
                <span className="ml-auto tabular-nums text-status-warning">L{e.level}</span>
              </div>
              <p className="mt-1 text-xs tabular-nums text-fg-muted">{e.zone} · {e.hp} / {e.att} / {e.def}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {e.perks.map((p) => <PerkTag key={p.id} perk={p} grade={gradeOf.get(p.id) ?? null} onPick={setPerkId} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'enemies' && wide && (
        <div className="overflow-x-auto rounded-lg border border-line-subtle">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-panel text-left text-xs uppercase tracking-wide text-fg-muted">
                <SortableTh label="Enemy" active={enemySort === 'name'} dir={sortDir} onSort={() => sortEnemiesBy('name')} />
                <SortableTh label="Lvl" align="right" active={enemySort === 'level'} dir={sortDir} onSort={() => sortEnemiesBy('level')} />
                <SortableTh label="Area" active={enemySort === 'area'} dir={sortDir} onSort={() => sortEnemiesBy('area')} />
                <SortableTh label="HP" align="right" active={enemySort === 'hp'} dir={sortDir} onSort={() => sortEnemiesBy('hp')} />
                <SortableTh label="ATT" align="right" active={enemySort === 'att'} dir={sortDir} onSort={() => sortEnemiesBy('att')} />
                <SortableTh label="DEF" align="right" active={enemySort === 'def'} dir={sortDir} onSort={() => sortEnemiesBy('def')} />
                <SortableTh label="Perks" align="right" active={enemySort === 'count'} dir={sortDir} onSort={() => sortEnemiesBy('count')} />
                <th className="px-3 py-2 font-medium">Carries</th>
              </tr>
            </thead>
            <tbody>
              {shownEnemies.map((e) => (
                <tr key={e.slug} className="border-t border-line-subtle odd:bg-surface-panel/30">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Icon name={e.icon} size={20} />
                      <EntityLink href={enemyHref(e.slug)} title={`${e.name} on the Enemies page`}>{e.name}</EntityLink>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-status-warning">{e.level}</td>
                  <td className="px-3 py-2 text-fg-secondary">{e.zone}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-status-error">{e.hp}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-fg-primary">{e.att}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-fg-primary">{e.def}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-fg-secondary">{e.perks.length}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {e.perks.length === 0 && <span className="text-fg-disabled">—</span>}
                      {e.perks.map((p) => <PerkTag key={p.id} perk={p} grade={gradeOf.get(p.id) ?? null} onPick={setPerkId} />)}
                    </div>
                  </td>
                </tr>
              ))}
              {shownEnemies.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-fg-muted">No enemies match this filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** The key every grade tag on the page refers to. */
function GradesTable() {
  return (
    <section className="mb-5 rounded-lg border border-line-subtle bg-surface-panel p-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-fg-secondary">The four grades of hit</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-fg-muted">
              <th className="py-1.5 pr-4 font-medium">Grade</th>
              <th className="py-1.5 pr-4 font-medium">Its side</th>
              <th className="py-1.5 pr-4 font-medium">Your side</th>
              <th className="py-1.5 font-medium">Damage as a share of ATT, at DEF = ATT · 2× · 4×</th>
            </tr>
          </thead>
          <tbody>
            {GRADES.map((g) => (
              <tr key={g.id} className="border-t border-line-subtle">
                <td className="py-1.5 pr-4"><Tag className={GRADE_TAG[g.id]}>{g.name}</Tag></td>
                <td className="py-1.5 pr-4 text-fg-secondary">{g.enemy}</td>
                <td className="py-1.5 pr-4 text-fg-secondary">{g.you}</td>
                <td className="py-1.5 tabular-nums text-fg-primary">{g.share}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 max-w-3xl text-xs text-fg-muted">
        An enemy that carries Pure or Divine Attack lands every roll of every hit at full ATT, so its Power Attack is
        3 × ATT and its Critical 10 ×. On an enemy that carries Pierce, nothing it does is ever blocked.
      </p>
    </section>
  )
}

/** A perk as an enemy carries it. Clicking it filters the enemy view to that perk. */
function PerkTag({
  perk,
  grade,
  onPick,
}: {
  perk: { id: string; label: string; name: string }
  grade: PerkGrade | null
  onPick: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(perk.id)}
      title={`Show every enemy with ${perk.name}`}
      className="rounded-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
    >
      <Tag className={grade && grade !== 'rolled' ? GRADE_TAG[grade] : undefined}>{perk.label}</Tag>
    </button>
  )
}

function PerkName({ p }: { p: PerkRow }) {
  return (
    <div className="flex items-center gap-2">
      {p.icon ? <Icon name={p.icon} size={20} className="shrink-0 text-fg-secondary" /> : <span className="inline-block w-5 shrink-0" />}
      <span className="font-medium text-fg-bright">{p.name}</span>
    </div>
  )
}

function Carriers({ list }: { list: PerkCarrier[] }) {
  if (list.length === 0) return <p className="text-xs text-fg-disabled">No enemy carries it yet.</p>
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {list.map((c) => (
        <li key={c.slug} className="whitespace-nowrap">
          <EntityLink href={enemyHref(c.slug)} title={c.zone}>{c.name}</EntityLink>
          <span className="ml-1 tabular-nums text-fg-muted">L{c.level}{c.note ? ` · ${c.note}` : ''}</span>
        </li>
      ))}
    </ul>
  )
}

function PerkGroupBlock({
  label,
  blurb,
  rows,
  showCarriers,
}: {
  label: string
  blurb: string
  rows: PerkRow[]
  showCarriers: boolean
}) {
  return (
    <>
      <tr className="border-t border-line-subtle bg-surface-panel/70">
        <td colSpan={7} className="px-3 py-1.5 text-xs text-fg-muted">
          <span className="mr-2 font-semibold uppercase tracking-wide text-fg-secondary">{label}</span>
          {blurb}
        </td>
      </tr>
      {rows.map((p) => <PerkTr key={p.id} p={p} showCarriers={showCarriers} />)}
    </>
  )
}

function PerkTr({ p, showCarriers }: { p: PerkRow; showCarriers: boolean }) {
  const first = p.carriers[0]
  const last = p.carriers[p.carriers.length - 1]
  return (
    <tr data-anchor={p.id} className="border-t border-line-subtle align-top odd:bg-surface-panel/30">
      <td className="px-3 py-2 whitespace-nowrap"><PerkName p={p} /></td>
      <td className="px-3 py-2 text-fg-secondary">{p.when}</td>
      <td className="px-3 py-2">
        {p.grade ? <Tag className={GRADE_TAG[p.grade]}>{p.grade}</Tag> : <span className="text-fg-disabled">—</span>}
      </td>
      <td className="px-3 py-2 min-w-[16rem]">
        <p className="text-base font-bold leading-tight tabular-nums text-fg-bright">
          {p.carriers.length}
          <span className="ml-1 text-xs font-normal text-fg-muted">{p.carriers.length === 1 ? 'enemy' : 'enemies'}</span>
        </p>
        {showCarriers && p.carriers.length > 0 && <div className="mt-1.5"><Carriers list={p.carriers} /></div>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-status-warning">{first ? first.level : '—'}</td>
      <td className="px-3 py-2 text-right tabular-nums text-status-warning">{last ? last.level : '—'}</td>
      <td className="px-3 py-2 min-w-[18rem]">
        <p className="max-w-xl text-fg-secondary">{p.rule}</p>
        {p.answer && (
          <p className="mt-1 max-w-xl text-fg-muted">
            <span className="font-semibold text-status-success">Answer:</span> {p.answer}
          </p>
        )}
      </td>
    </tr>
  )
}

function PerkCard({ p, showCarriers }: { p: PerkRow; showCarriers: boolean }) {
  return (
    <div data-anchor={p.id} className="rounded-lg border border-line-subtle bg-surface-panel/30 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <PerkName p={p} />
        <Tag>{p.when}</Tag>
        {p.grade && <Tag className={GRADE_TAG[p.grade]}>{p.grade}</Tag>}
        <span className="ml-auto text-xs tabular-nums text-fg-muted">
          {p.carriers.length} {p.carriers.length === 1 ? 'enemy' : 'enemies'}
        </span>
      </div>
      {showCarriers && p.carriers.length > 0 && <div className="mt-2"><Carriers list={p.carriers} /></div>}
      <p className="mt-2 text-fg-secondary">{p.rule}</p>
      {p.answer && (
        <p className="mt-1 text-fg-muted">
          <span className="font-semibold text-status-success">Answer:</span> {p.answer}
        </p>
      )}
    </div>
  )
}
