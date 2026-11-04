'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useGameStore } from '@/lib/game-state'
import {
  applyKillView,
  buildKillList,
  DEFAULT_KILL_VIEW,
  isKillViewFiltered,
  KILL_FILTERS,
  toneStyle,
  type KillBox,
  type KillRow,
  type KillView,
} from '@/lib/kill-list'
import { CHIP, CHIP_IDLE, CHIP_GROUP_ON } from '@/components/ItemFilterBar'
import BestiaryCard, { type CardNav } from './BestiaryCard'
import FightReplay from './FightReplay'

interface KillListTabProps {
  getAuthHeaders: () => Record<string, string>
  onOpenPlayerProfile?: (player: { id: string; username: string; level: number; uIcon?: string | null; uIconColor?: string | null }) => void
}

const VIEW_KEY = 'lg:kill-list-view'

function loadView(): KillView {
  try {
    const raw = window.localStorage.getItem(VIEW_KEY)
    if (!raw) return DEFAULT_KILL_VIEW
    const parsed = JSON.parse(raw) as Partial<KillView>
    const filter = KILL_FILTERS.some((f) => f.id === parsed.filter) ? parsed.filter! : 'all'
    return { filter, hideCleared: Boolean(parsed.hideCleared), hereOnly: Boolean(parsed.hereOnly) }
  } catch {
    return DEFAULT_KILL_VIEW
  }
}

function saveView(view: KillView) {
  try {
    window.localStorage.setItem(VIEW_KEY, JSON.stringify(view))
  } catch {
    // a per-device convenience only
  }
}

/** The gold R the original pinned on a rare enemy's row. */
export function RareChip({ dim = false }: { dim?: boolean }) {
  return (
    <span
      title="Rare"
      aria-label="Rare"
      className={`inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[3px] text-[10px] font-bold leading-none ${
        dim ? 'bg-resource-gold/25 text-fg-muted' : 'bg-resource-gold text-fg-on-accent'
      }`}
    >
      R
    </span>
  )
}

/**
 * The Kill List, as the original drew it: one box per area in world order,
 * the level range beside the heading, every enemy of the area listed from
 * the day the map is found — gray until killed, then `lvl N`, the name in
 * its color and the count in gold — and the TOTAL on top. What this adds:
 * a per-box count, a roster bar, the enemies that beat you or got away
 * marked met, filters for a phone, and a bestiary card behind every killed
 * name. Kills come from the store (the server counted them); the marks ride
 * on the same fetch.
 */
export default function KillListTab({ getAuthHeaders, onOpenPlayerProfile }: KillListTabProps) {
  const killList = useGameStore((s) => s.killList)
  const killMarks = useGameStore((s) => s.killMarks)
  const player = useGameStore((s) => s.player)

  const model = useMemo(
    () => buildKillList({ kills: killList, marks: killMarks, flags: player, currentRoomId: player?.currentRoom ?? null }),
    [killList, killMarks, player]
  )

  // Per-device: the filter, and which boxes are folded. Loaded after mount
  // so the server-rendered markup and the first client paint agree.
  const [view, setView] = useState<KillView>(DEFAULT_KILL_VIEW)
  const [folded, setFolded] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    setView(loadView())
    // A phone starts with every box folded but the ones underfoot; a wide
    // screen shows them all open, as the original page did.
    if (window.matchMedia('(max-width: 640px)').matches) {
      setFolded(new Set(model.boxes.filter((box) => !box.here).map((box) => box.area.id)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const updateView = useCallback((next: KillView) => {
    setView(next)
    saveView(next)
  }, [])
  const toggleFold = (id: string) =>
    setFolded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const [selected, setSelected] = useState<string | null>(null)
  const [replay, setReplay] = useState<{ id: string; back: string } | null>(null)

  const shown = useMemo(() => applyKillView(model.boxes, view), [model.boxes, view])
  const anyHere = model.boxes.some((box) => box.here)
  const allFolded = shown.length > 0 && shown.every((box) => folded.has(box.area.id))
  const foldAll = (fold: boolean) => setFolded(fold ? new Set(model.boxes.map((box) => box.area.id)) : new Set())

  // The killed enemies in the order the list shows them (the view's boxes
  // first, the whole list when the open card is filtered out of it), so the
  // card's prev and next walk the page as it reads.
  const killedOrder = useMemo(() => {
    const inView = shown.flatMap((box) => box.rows.filter((row) => row.kills > 0).map((row) => row.enemy))
    if (selected && !inView.some((enemy) => enemy.slug === selected)) {
      return model.boxes.flatMap((box) => box.rows.filter((row) => row.kills > 0).map((row) => row.enemy))
    }
    return inView
  }, [shown, model.boxes, selected])
  const cardNav = useMemo<CardNav | undefined>(() => {
    if (!selected) return undefined
    const index = killedOrder.findIndex((enemy) => enemy.slug === selected)
    if (index < 0) return undefined
    const prev = killedOrder[index - 1]
    const next = killedOrder[index + 1]
    return {
      index,
      count: killedOrder.length,
      prev: prev ? { slug: prev.slug, name: prev.name } : null,
      next: next ? { slug: next.slug, name: next.name } : null,
    }
  }, [killedOrder, selected])

  // ← and → step through the cards while one is open and nothing is being typed.
  useEffect(() => {
    if (!selected || replay || !cardNav) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      const to = event.key === 'ArrowLeft' ? cardNav.prev : cardNav.next
      if (!to) return
      event.preventDefault()
      setSelected(to.slug)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, replay, cardNav])

  if (replay) {
    return (
      <FightReplay
        battleId={replay.id}
        backLabel={replay.back}
        getAuthHeaders={getAuthHeaders}
        onBack={() => setReplay(null)}
        onOpenPlayerProfile={onOpenPlayerProfile}
      />
    )
  }
  if (selected) {
    const box = model.boxes.find((b) => b.rows.some((r) => r.enemy.slug === selected))
    const row = box?.rows.find((r) => r.enemy.slug === selected)
    if (box && row && row.kills > 0) {
      return (
        <BestiaryCard
          row={row}
          box={box}
          getAuthHeaders={getAuthHeaders}
          onBack={() => setSelected(null)}
          onWatch={(id) => setReplay({ id, back: row.enemy.name })}
          nav={cardNav}
          onSelect={setSelected}
        />
      )
    }
  }

  const rosterPct = model.roster > 0 ? Math.round((model.killed / model.roster) * 100) : 0

  return (
    <div className="@container space-y-3">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-resource-gold">Kill List</h2>
          <p className="text-[11px] text-fg-muted">Every enemy on every map you have found. Gray names are still out there.</p>
        </div>
        <div className="ml-auto flex items-stretch gap-2">
          <div className="rounded-lg border border-line-subtle/60 bg-surface-panel/60 px-3 py-1.5 text-right">
            <div className="text-[10px] tracking-[0.06em] text-fg-muted">TOTAL</div>
            <div className="text-xl font-bold leading-tight tabular-nums text-status-error">{model.total.toLocaleString()}</div>
          </div>
          <div className="min-w-[7rem] rounded-lg border border-line-subtle/60 bg-surface-panel/60 px-3 py-1.5 text-right">
            <div className="text-[10px] tracking-[0.06em] text-fg-muted">ROSTER</div>
            <div className="text-xl font-bold leading-tight tabular-nums text-fg-bright">
              {model.killed}
              <span className="text-xs font-medium text-fg-muted"> of {model.roster}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-raised" aria-hidden="true">
              <div className="h-full rounded-full bg-status-success" style={{ width: `${rosterPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div role="group" aria-label="Show" className="flex flex-wrap items-center gap-1.5">
          {KILL_FILTERS.map((f) => {
            const active = view.filter === f.id
            return (
              <button key={f.id} type="button" aria-pressed={active} onClick={() => updateView({ ...view, filter: f.id })} className={`${CHIP} ${active ? CHIP_GROUP_ON : CHIP_IDLE}`}>
                {f.label}
              </button>
            )
          })}
        </div>
        {anyHere && (
          <button
            type="button"
            aria-pressed={view.hereOnly}
            onClick={() => updateView({ ...view, hereOnly: !view.hereOnly })}
            title="Only the areas on the map you are standing on"
            className={`${CHIP} ${view.hereOnly ? 'fill-status-success border-status-success/50' : `${CHIP_IDLE} text-status-success`}`}
          >
            ● Here
          </button>
        )}
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] text-fg-muted">
          <input
            type="checkbox"
            checked={view.hideCleared}
            onChange={(e) => updateView({ ...view, hideCleared: e.target.checked })}
            className="h-3.5 w-3.5 accent-[var(--resource-gold)]"
          />
          Hide cleared areas
        </label>
        {isKillViewFiltered(view) && (
          <button type="button" onClick={() => updateView(DEFAULT_KILL_VIEW)} className="text-[11px] text-status-warning underline-offset-2 hover:underline">
            Clear
          </button>
        )}
        {shown.length > 1 && (
          <button type="button" onClick={() => foldAll(!allFolded)} className="text-[11px] text-fg-secondary underline-offset-2 hover:text-fg-bright hover:underline">
            {allFolded ? 'Expand all' : 'Collapse all'}
          </button>
        )}
      </div>

      {model.boxes.length === 0 ? (
        <p className="text-sm text-fg-muted">Nothing on the list yet. Find a map, or kill something.</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-fg-muted">{view.hideCleared && !isKillViewFiltered({ ...view, hideCleared: false }) ? 'Every area you have found is cleared.' : 'Nothing matches that filter.'}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 @[40rem]:grid-cols-2">
          {shown.map((box) => (
            <KillBoxView key={box.area.id} box={box} folded={folded.has(box.area.id)} onToggle={() => toggleFold(box.area.id)} onOpen={(slug) => setSelected(slug)} />
          ))}
        </div>
      )}

      {model.hidden.length > 0 && !view.hereOnly && (
        <div className="space-y-1.5">
          {model.hidden.slice(0, 3).map((box) => (
            <div key={box.area.id} className="flex items-center gap-3 rounded-lg border border-dashed border-line-subtle/60 bg-surface-canvas/40 px-3 py-2 text-[12px] text-fg-disabled">
              <span className="font-bold text-fg-disabled">{box.area.name}</span>
              <span>lvl {box.area.levels}</span>
              <span className="ml-auto">map not found</span>
            </div>
          ))}
          {model.hidden.length > 3 && (
            <p className="text-center text-[11px] text-fg-disabled">
              {model.hidden.length - 3} more area{model.hidden.length - 3 === 1 ? '' : 's'}. Find their maps to see what lives there.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** One area's box: the heading with its range and count, then its rows. */
function KillBoxView({ box, folded, onToggle, onOpen }: { box: KillBox; folded: boolean; onToggle: () => void; onOpen: (slug: string) => void }) {
  const pct = box.total > 0 ? Math.round((box.killed / box.total) * 100) : 0
  return (
    <section aria-label={box.area.name} className={`rounded-xl border bg-surface-panel/60 ${box.here ? 'border-status-success/40' : 'border-line-subtle/60'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!folded}
        className="flex w-full items-center gap-2 rounded-t-xl px-3 py-2 text-left hover:bg-surface-raised/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <span className="truncate text-[15px] font-bold" style={toneStyle(box.area.tone)}>{box.area.name}</span>
        <span className="shrink-0 rounded bg-surface-raised px-1.5 text-[10px] text-fg-secondary">lvl {box.area.levels}</span>
        {box.here && <span className="shrink-0 text-[9px] font-bold tracking-[0.06em] text-status-success">● HERE</span>}
        <span className={`ml-auto shrink-0 text-[11px] tabular-nums ${box.cleared ? 'text-status-success' : 'text-fg-muted'}`}>
          {box.killed} of {box.total}{box.cleared ? ' ✓' : ''}
        </span>
        {folded && (
          <span className="h-1 w-11 shrink-0 overflow-hidden rounded-full bg-surface-raised" aria-hidden="true">
            <span className={`block h-full rounded-full ${box.cleared ? 'bg-resource-gold' : 'bg-status-success'}`} style={{ width: `${pct}%` }} />
          </span>
        )}
        <ChevronDown size={12} className={`shrink-0 text-fg-disabled transition-transform ${folded ? '-rotate-90' : ''}`} aria-hidden="true" />
      </button>
      {!folded && (
        <div className="flex flex-col px-3 pb-2">
          {box.rows.map((row) => (
            <KillRowView key={row.enemy.slug} row={row} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * One enemy's line. Killed: `lvl N`, the R if rare, the name in its tone,
 * the count in gold, and the row opens its card. Met: the name in gray and
 * what happened ("killed you ×2"). Unknown: the gray name and nothing else,
 * the original's dark-gray line.
 */
function KillRowView({ row, onOpen }: { row: KillRow; onOpen: (slug: string) => void }) {
  const { enemy } = row
  const killed = row.state === 'killed'
  const met = row.state === 'met'
  const nameClass = killed ? 'font-medium text-fg-bright' : met ? 'text-fg-muted' : 'text-fg-disabled'
  const inner = (
    <>
      <span className={`w-9 shrink-0 text-[11px] text-fg-muted ${killed ? '' : 'invisible'}`}>lvl {enemy.level}</span>
      {enemy.rare && <RareChip dim={!killed} />}
      <span className={`truncate ${nameClass}`} style={killed ? toneStyle(enemy.nameTone) : undefined}>{enemy.name}</span>
      {killed ? (
        <span className="ml-auto shrink-0 font-bold tabular-nums text-resource-gold">{row.kills.toLocaleString()}</span>
      ) : met ? (
        <span className="ml-auto flex shrink-0 items-center gap-2 text-[10px]">
          {row.losses > 0 && <span className="text-status-error">killed you ×{row.losses}</span>}
          {row.fled > 0 && <span className="text-fg-muted">fled ×{row.fled}</span>}
        </span>
      ) : null}
    </>
  )
  if (!killed) {
    return <div className="flex min-h-[28px] items-center gap-1.5 text-[13px] tabular-nums">{inner}</div>
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(enemy.slug)}
      title={`${enemy.name}: your record, its drops, who felled it first`}
      className="-mx-1.5 flex min-h-[28px] items-center gap-1.5 rounded px-1.5 text-left text-[13px] tabular-nums transition-colors hover:bg-surface-raised/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      {inner}
    </button>
  )
}
