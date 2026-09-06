'use client'

import { useMemo } from 'react'
import { useUrlEnum, useUrlString } from '@/components/world-tool/useUrlState'
import { Field, ColumnHeading, Dash } from '@/components/world-tool/ui'
import { EntityLink, roomHref, useAnchorTarget } from '@/components/world-tool/EntityLink'

export type SideData = {
  title: string | null
  subtitle: string | null
  description: string
  actions: { command: string; label: string }[]
  exits: string[]
  links: { target: string; label: string }[]
  icon: string | null
  dangerLevel: number | null
  /** Capability flags the recreation carries on the room row (safe, searchable, fire). */
  flags: string[]
  /** Provenance on the original's side, region on the new game's side. */
  note: string | null
}

export type RoomStatus = 'same' | 'differs' | 'not-ported' | 'new-only'

export type CompareRow = {
  roomId: string
  status: RoomStatus
  legacy: SideData | null
  current: SideData | null
  diff: Partial<Record<'title' | 'subtitle' | 'description' | 'actions' | 'exits', boolean>>
}

const STATUS_LABEL: Record<RoomStatus, string> = {
  same: 'same',
  differs: 'differs',
  'not-ported': 'not ported',
  'new-only': 'new only',
}

// Status colours read as a progression: matched, drifted, absent, added.
const STATUS_STYLE: Record<RoomStatus, string> = {
  same: 'border-status-success/50 text-status-success',
  differs: 'border-status-warning/60 text-status-warning',
  'not-ported': 'border-status-error/50 text-status-error',
  'new-only': 'border-status-info/50 text-status-info',
}

const DIR_LABEL: Record<string, string> = {
  north: 'N', northeast: 'NE', east: 'E', southeast: 'SE', south: 'S',
  southwest: 'SW', west: 'W', northwest: 'NW', up: 'Up', down: 'Down',
}

const FILTERS: { key: RoomStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'differs', label: 'Differs' },
  { key: 'not-ported', label: 'Not ported' },
  { key: 'same', label: 'Same' },
  { key: 'new-only', label: 'New only' },
]

export default function RoomDescCompare({ rows }: { rows: CompareRow[] }) {
  const [status, setStatus] = useUrlEnum<RoomStatus | 'all'>(
    'status',
    ['all', 'same', 'differs', 'not-ported', 'new-only'] as const,
    'all'
  )
  const [query, setQuery] = useUrlString('q', '')

  useAnchorTarget()

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length }
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [rows])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false
      if (!q) return true
      return (
        r.roomId.toLowerCase().includes(q) ||
        (r.legacy?.title ?? '').toLowerCase().includes(q) ||
        (r.current?.title ?? '').toLowerCase().includes(q) ||
        (r.legacy?.description ?? '').toLowerCase().includes(q) ||
        (r.current?.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, status, query])

  return (
    <div>
      {/* Controls */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 flex flex-wrap items-center gap-2 border-b border-line-subtle bg-surface-canvas px-4 py-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search id, title or description…"
          className="w-56 rounded border border-line-subtle fill-surface-raised px-2 py-1 text-sm placeholder-fg-muted focus:border-accent focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={
                'rounded border px-2.5 py-1 text-xs font-semibold transition-colors ' +
                (status === f.key
                  ? 'border-accent fill-accent'
                  : 'border-line-subtle fill-surface-raised hover:border-line-strong hover:text-fg-bright')
              }
            >
              {f.label}
              {/* When the chip is filled the count inherits the fill's paired
                  label colour; text-fg-muted on the accent fill was unreadable. */}
              <span className={'ml-1.5 ' + (status === f.key ? 'opacity-70' : 'text-fg-muted')}>
                {counts[f.key] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-fg-muted">{shown.length} shown</span>
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-fg-muted">No rooms match this filter.</p>
      ) : (
        <div className="space-y-4">
          {shown.map((r) => (
            <RoomCompare key={r.roomId} row={r} />
          ))}
        </div>
      )}
    </div>
  )
}

function RoomCompare({ row }: { row: CompareRow }) {
  const { legacy, current, diff } = row
  return (
    <section
      data-anchor={row.roomId}
      className="overflow-hidden rounded-lg border border-line-subtle bg-surface-panel/30"
    >
      {/* Room header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle bg-surface-panel/70 px-3 py-2">
        <EntityLink
          href={roomHref(row.roomId)}
          title={`Room ${row.roomId} in the World Atlas`}
          className="font-mono text-sm font-bold"
        >
          #{row.roomId}
        </EntityLink>
        <span className="text-sm text-fg-secondary">
          {legacy?.title ?? current?.title ?? '—'}
        </span>
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[row.status]}`}
        >
          {STATUS_LABEL[row.status]}
        </span>
        {row.status === 'differs' && (
          <span className="flex flex-wrap items-center gap-1">
            {(['title', 'subtitle', 'description', 'actions', 'exits'] as const)
              .filter((f) => diff[f])
              .map((f) => (
                <span
                  key={f}
                  className="rounded bg-status-warning/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-warning"
                >
                  {f}
                </span>
              ))}
          </span>
        )}
      </div>

      {/* Two columns: original left, new right. Stacks on narrow screens. */}
      <div className="grid grid-cols-1 divide-y divide-line-subtle md:grid-cols-2 md:divide-x md:divide-y-0">
        <Side title="Original" side={legacy} diff={diff} which="legacy" />
        <Side title="New game" side={current} diff={diff} which="current" />
      </div>
    </section>
  )
}

function Side({
  title,
  side,
  diff,
  which,
}: {
  title: string
  side: SideData | null
  diff: CompareRow['diff']
  which: 'legacy' | 'current'
}) {
  if (!side) {
    return (
      <div className="px-3 py-4">
        <ColumnHeading>{title}</ColumnHeading>
        <p className="mt-2 text-sm italic text-fg-disabled">
          {which === 'legacy'
            ? 'No room with this id in the original game.'
            : 'Not ported to the new game yet.'}
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-2.5 px-3 py-3">
      <div className="flex items-center gap-2">
        <ColumnHeading>{title}</ColumnHeading>
        <span className="ml-auto flex flex-wrap items-center gap-1 text-[10px] text-fg-disabled">
          {side.dangerLevel != null && <Chip>danger {side.dangerLevel}</Chip>}
          {side.icon && <Chip>{side.icon}</Chip>}
          {side.flags.map((f) => (
            <Chip key={f}>{f}</Chip>
          ))}
          {side.note && <span className="font-mono">{side.note}</span>}
        </span>
      </div>

      <Field label="Title" labelWidth="5.5rem" changed={diff.title}>
        <span className="font-semibold text-fg-bright">{side.title ?? <Dash />}</span>
      </Field>

      <Field label="Subtitle" labelWidth="5.5rem" changed={diff.subtitle}>
        {side.subtitle ? (
          <span className="italic text-fg-secondary">{side.subtitle}</span>
        ) : (
          <Dash />
        )}
      </Field>

      <Field label="Description" labelWidth="5.5rem" changed={diff.description}>
        {side.description ? (
          side.description.split('\n\n').map((p, i) => (
            <p key={i} className={i > 0 ? 'mt-1.5 text-fg-primary' : 'text-fg-primary'}>
              {p}
            </p>
          ))
        ) : (
          <Dash />
        )}
      </Field>

      <Field label="Actions" labelWidth="5.5rem" changed={diff.actions}>
        {side.actions.length === 0 ? (
          <Dash />
        ) : (
          <div className="flex flex-wrap gap-1">
            {side.actions.map((a) => (
              <span
                key={a.command}
                title={a.label !== a.command ? `Label: ${a.label}` : undefined}
                className="rounded border border-line-subtle bg-surface-raised/60 px-1.5 py-0.5 font-mono text-[11px] text-fg-primary"
              >
                {a.command}
              </span>
            ))}
          </div>
        )}
      </Field>

      {side.links.length > 0 && (
        <Field label="Panels" labelWidth="5.5rem">
          <div className="flex flex-wrap gap-1">
            {side.links.map((l) => (
              <span
                key={l.target}
                className="rounded border border-accent/50 px-1.5 py-0.5 text-[11px] text-accent-hover"
              >
                {l.label}
              </span>
            ))}
          </div>
        </Field>
      )}

      <Field label="Exits" labelWidth="5.5rem" changed={diff.exits}>
        {side.exits.length === 0 ? (
          <Dash />
        ) : (
          <div className="flex flex-wrap gap-1">
            {side.exits.map((e) => (
              <span
                key={e}
                className="rounded border border-line-subtle px-1.5 py-0.5 text-[11px] font-semibold text-fg-secondary"
              >
                {DIR_LABEL[e] ?? e}
              </span>
            ))}
          </div>
        )}
      </Field>
    </div>
  )
}




function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-line-subtle px-1 py-0.5 uppercase tracking-wide">
      {children}
    </span>
  )
}
