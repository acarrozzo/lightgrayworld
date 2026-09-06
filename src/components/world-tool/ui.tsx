'use client'

/**
 * Shared presentational primitives for the World Tool pages.
 *
 * Each page grew its own copy of these — three `SortArrow`s, four `Tag`s with
 * three different signatures, two `Section`s, two `Field`s — so a "flying" chip
 * in the Bestiary and a "hidden" chip in the Atlas were unrelated code that
 * merely looked alike, and a fix to one never reached the others. These are the
 * one set, kept deliberately small and unopinionated: layout and behaviour stay
 * in the pages, only the repeated shapes live here.
 */

import type { LucideIcon } from 'lucide-react'

/**
 * The neutral outlined chip — "flying", "no-sell", "max 99".
 *
 * `className` replaces the default colours rather than adding to them: Tailwind
 * resolves competing utilities by their order in the generated stylesheet, not
 * by their order in the class attribute, so `border-line-subtle` and a caller's
 * `border-status-error` would fight unpredictably if both were emitted.
 */
export function Tag({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  // whitespace-nowrap because these are short labels in narrow table cells:
  // "max 999" was breaking across two lines inside its own border.
  const base = 'rounded border px-1.5 py-0.5 text-[10px] whitespace-nowrap uppercase tracking-wide'
  return (
    <span className={className ? `${base} ${className}` : `${base} border-line-subtle text-fg-muted`}>
      {children}
    </span>
  )
}

/**
 * A chip that carries a meaning through colour — a gate, a reveal, a lever.
 *
 * Takes a resolved CSS colour (a `var(--…)` from the theme) rather than a class,
 * because the colour is chosen per-row from data. Smaller and tighter than
 * `Tag`: these annotate a line of text rather than label a row.
 */
export function ToneChip({
  color,
  icon: Icon,
  children,
}: {
  color: string
  icon?: LucideIcon
  children: React.ReactNode
}) {
  return (
    <span
      className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {children}
    </span>
  )
}

export function SortArrow({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className={`ml-1 text-[10px] ${active ? 'text-fg-primary' : 'text-fg-disabled'}`}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
    </span>
  )
}

/**
 * A sortable column header.
 *
 * The control is a real `<button>` inside the `<th>`, not an `onClick` on the
 * cell: the tables were previously sortable by mouse only — no focus, no
 * Enter/Space, and nothing announcing the sort. `aria-sort` on the header is
 * what a screen reader reads; the button is what a keyboard reaches.
 */
export function SortableTh({
  label,
  active,
  dir,
  onSort,
  align = 'left',
  className = '',
}: {
  label: React.ReactNode
  active: boolean
  dir: 'asc' | 'desc'
  onSort: () => void
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-3 py-2 font-medium ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
    >
      <button
        type="button"
        onClick={onSort}
        className={
          'flex w-full items-center gap-0 rounded-sm select-none hover:text-fg-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent ' +
          (align === 'right' ? 'justify-end' : 'justify-start')
        }
      >
        {label}
        <SortArrow active={active} dir={dir} />
      </button>
    </th>
  )
}

/** A titled block with an optional leading icon. */
export function Section({
  icon: Icon,
  title,
  children,
}: {
  icon?: LucideIcon
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 border-b border-line-subtle pb-1 text-xs font-bold uppercase tracking-wide text-fg-secondary">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {title}
      </h3>
      {children}
    </section>
  )
}

/**
 * A labelled row in a detail panel. `changed` marks the field as differing from
 * a counterpart, which is what the Room Desc comparison hangs its diff on.
 */
export function Field({
  label,
  labelWidth = '7rem',
  changed,
  children,
}: {
  label: string
  labelWidth?: string
  changed?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2 text-sm" style={{ gridTemplateColumns: `${labelWidth} 1fr` }}>
      <span
        className={
          'text-xs font-semibold uppercase tracking-wide ' +
          (changed ? 'text-status-warning' : 'text-fg-muted')
        }
      >
        {label}
      </span>
      <div className={changed ? 'border-l-2 border-status-warning/50 pl-2' : ''}>{children}</div>
    </div>
  )
}

/** Italic placeholder for an empty section. */
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs italic text-fg-disabled">{children}</p>
}

/** A dimmed em dash, for a single value that is absent. */
export function Dash() {
  return <span className="text-fg-disabled">—</span>
}

/** A label/value line in a stat block. */
export function Stat({
  label,
  value,
  color = 'text-fg-bright',
}: {
  label: string
  value: React.ReactNode
  color?: string
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-line-subtle/60 py-1 text-sm">
      <span className="text-fg-muted">{label}</span>
      <span className={`text-right ${color}`}>{value}</span>
    </div>
  )
}

/** The small all-caps heading over a column of a comparison. */
export function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold uppercase tracking-widest text-fg-muted">{children}</h3>
  )
}
