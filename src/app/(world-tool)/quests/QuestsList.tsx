'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import Icon from '@/components/Icon'
import QuestTypeTag from '@/components/QuestTypeTag'
import { Field } from '@/components/world-tool/ui'
import { useUrlEnum, useUrlString } from '@/components/world-tool/useUrlState'

// Serializable shapes built by the server page. All text here is already
// resolved from the game data — this component only lays it out.
export type QuestRow = {
  id: string
  questType: string
  level: number
  title: string
  summary: string
  objective: string
  nextStep: string
  reminderDialog: string
  completionDialog: string
  requirements: string[]
  consumesItems: boolean
  rewards: string[]
  /** Titles of the same giver's quests that must be done first. */
  after: string[]
  /** Titles of the quests finishing this one opens. */
  opens: string[]
}

export type GiverGroup = {
  giverId: string
  name: string
  icon: string
  roomId: string
  revealedBy: string
  meetRequirements: string[]
  lockedDialog: string | null
  greeting: string
  hint: string
  quests: QuestRow[]
}

export type FactionGroup = {
  id: string
  name: string
  kind: string
  title: string | null
  membershipQuest: string | null
  givers: GiverGroup[]
}

const TYPE_FILTERS = ['all', 'main', 'side'] as const
type TypeFilter = (typeof TYPE_FILTERS)[number]

const CHIP = 'rounded border px-2.5 py-1 text-xs font-semibold transition-colors'
const CHIP_ON = 'border-accent bg-accent-muted/40 text-accent-hover'
const CHIP_OFF = 'border-line-subtle fill-surface-raised hover:border-line-strong hover:bg-surface-hover/80 hover:text-fg-bright'

const BUTTON = 'rounded border border-line-subtle fill-surface-raised px-3 py-1 text-xs font-semibold transition-colors hover:border-line-strong hover:bg-surface-hover/80 hover:text-fg-bright'

/**
 * The reference list: every faction, every giver, every quest. The search and
 * type filter live in the URL (`?q=`, `?type=`) so a filtered view is a link;
 * which factions are folded is a passing convenience and stays in state.
 */
export default function QuestsList({ groups }: { groups: FactionGroup[] }) {
  const [search, setSearch] = useUrlString('q', '')
  const [type, setType] = useUrlEnum<TypeFilter>('type', TYPE_FILTERS, 'all')

  // Faction sections folded by id; everything starts open.
  const [folded, setFolded] = useState<Set<string>>(() => new Set())
  // Quest cards open by id. A user toggling a single card syncs back into this
  // set, so Expand/Collapse all stays consistent afterward.
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())

  const needle = search.trim().toLowerCase()
  const visible = useMemo(() => {
    const matches = (q: QuestRow, giver: GiverGroup) => {
      if (type !== 'all' && q.questType !== type) return false
      if (!needle) return true
      return `${q.title} ${q.objective} ${q.summary} ${giver.name}`.toLowerCase().includes(needle)
    }
    return groups
      .map((f) => ({
        ...f,
        givers: f.givers
          .map((g) => ({ ...g, quests: g.quests.filter((q) => matches(q, g)) }))
          .filter((g) => g.quests.length > 0),
      }))
      .filter((f) => f.givers.length > 0)
  }, [groups, type, needle])

  const allIds = useMemo(() => visible.flatMap((f) => f.givers.flatMap((g) => g.quests.map((q) => q.id))), [visible])
  const totalShown = allIds.length
  const totalAll = useMemo(() => groups.reduce((n, f) => n + f.givers.reduce((m, g) => m + g.quests.length, 0), 0), [groups])
  const filtering = needle.length > 0 || type !== 'all'

  function setOpen(id: string, open: boolean) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })
  }
  function toggleFold(id: string) {
    setFolded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const allFolded = visible.length > 0 && visible.every((f) => folded.has(f.id))

  if (groups.length === 0) {
    return <p className="py-6 text-center text-sm text-fg-muted">No quests found.</p>
  }
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quests, objectives, givers"
            aria-label="Search quests"
            className="w-full rounded border border-line-subtle fill-surface-raised pl-7 pr-2 py-1 text-xs placeholder:text-fg-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          />
        </label>
        <div className="flex items-center gap-1" role="group" aria-label="Quest type">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={`${CHIP} ${type === t ? CHIP_ON : CHIP_OFF}`}
            >
              {t === 'all' ? 'All' : t === 'main' ? 'Main' : 'Side'}
            </button>
          ))}
        </div>
        <span className="text-xs text-fg-muted">
          {filtering ? `${totalShown} of ${totalAll} quests` : `${totalAll} quests`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setFolded(allFolded ? new Set() : new Set(visible.map((f) => f.id)))} className={BUTTON}>
            {allFolded ? 'Expand factions' : 'Collapse factions'}
          </button>
          <button type="button" onClick={() => setOpenIds(new Set(allIds))} className={BUTTON}>
            Open all cards
          </button>
          <button type="button" onClick={() => setOpenIds(new Set())} className={BUTTON}>
            Close all cards
          </button>
        </div>
      </div>

      {visible.length === 0 && <p className="py-6 text-center text-sm text-fg-muted">Nothing matches that filter.</p>}

      {visible.map((faction) => {
        const total = faction.givers.reduce((sum, g) => sum + g.quests.length, 0)
        const isFolded = folded.has(faction.id)
        return (
          <section key={faction.id} className="space-y-5">
            <button
              type="button"
              onClick={() => toggleFold(faction.id)}
              aria-expanded={!isFolded}
              className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 border-b-2 border-line-strong pb-2 text-left hover:bg-surface-hover/30 rounded-t"
            >
              <span className={`text-[10px] text-fg-disabled transition-transform ${isFolded ? '' : 'rotate-90'}`}>▶</span>
              <h2 className="text-xl font-bold text-fg-bright">{faction.name}</h2>
              <span className="text-xs uppercase tracking-wide text-fg-muted">{faction.kind}</span>
              {faction.membershipQuest && (
                <span className="text-xs text-fg-secondary">Membership: complete “{faction.membershipQuest}”</span>
              )}
              {faction.title && (
                <span className="text-xs text-resource-gold">All done: {faction.title}</span>
              )}
              <span className="ml-auto text-xs text-fg-muted">
                {faction.givers.length} giver{faction.givers.length === 1 ? '' : 's'} · {total} quests
              </span>
            </button>
            {!isFolded &&
              faction.givers.map((g) => (
                <div key={g.giverId}>
                  <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line-subtle pb-2">
                    <Icon name={g.icon} size={40} />
                    <h3 className="text-lg font-semibold text-fg-bright">{g.name}</h3>
                    <span className="text-xs text-fg-muted">Room {g.roomId}</span>
                    <span className="ml-auto text-xs text-fg-muted">{g.quests.length} quests</span>
                  </div>
                  <div className="mb-3 space-y-1 text-sm">
                    <Field label="Revealed">
                      <span className="text-fg-secondary">{g.revealedBy}</span>
                    </Field>
                    {g.hint && (
                      <Field label="Hint">
                        <span className="text-fg-secondary">{g.hint}</span>
                      </Field>
                    )}
                    {g.meetRequirements.length > 0 && (
                      <Field label="Will talk when">
                        <span className="text-fg-secondary">{g.meetRequirements.join('; ')}</span>
                        {g.lockedDialog && <span className="block italic text-fg-muted">“{g.lockedDialog}”</span>}
                      </Field>
                    )}
                    <Field label="Greeting">
                      <span className="italic text-fg-secondary">“{g.greeting}”</span>
                    </Field>
                  </div>
                  <div className="space-y-2">
                    {g.quests.map((q, i) => (
                      <QuestCard
                        key={q.id}
                        q={q}
                        index={i + 1}
                        open={openIds.has(q.id)}
                        onToggle={(open) => setOpen(q.id, open)}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </section>
        )
      })}
    </div>
  )
}

function QuestCard({
  q,
  index,
  open,
  onToggle,
}: {
  q: QuestRow
  index: number
  open: boolean
  onToggle: (open: boolean) => void
}) {
  return (
    <details
      open={open}
      onToggle={(e) => onToggle(e.currentTarget.open)}
      className="group rounded-lg border border-line-subtle bg-surface-panel/30 open:bg-surface-panel/50"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm">
        <span className="w-6 shrink-0 text-right text-xs text-fg-muted">{index}</span>
        <span className="font-medium text-fg-bright">{q.title}</span>
        <QuestTypeTag type={q.questType} variant="outlined" />
        <span className="ml-auto flex items-center gap-3">
          <span className="text-xs text-fg-muted">Lvl {q.level}</span>
          <span className="text-[10px] text-fg-disabled transition-transform group-open:rotate-90">▶</span>
        </span>
      </summary>

      <div className="space-y-3 border-t border-line-subtle px-3 py-3 text-sm">
        <p className="italic text-fg-secondary">{q.summary}</p>

        <Field label="Objective">
          <span className="text-fg-bright">{q.objective}</span>
        </Field>

        {q.after.length > 0 && (
          <Field label="Opens after">
            <span className="text-fg-secondary">{q.after.join(', ')}</span>
          </Field>
        )}

        <Field label="Requirements">
          <ul className="space-y-0.5">
            {q.requirements.map((r, i) => (
              <li key={i} className="text-fg-primary">• {r}</li>
            ))}
            {q.consumesItems && (
              <li className="text-xs text-fg-muted">Required items are consumed on turn-in.</li>
            )}
          </ul>
        </Field>

        <Field label="Rewards">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {q.rewards.length === 0 ? (
              <span className="text-fg-muted">None</span>
            ) : (
              q.rewards.map((r, i) => (
                <span key={i} className="text-resource-gold">{r}</span>
              ))
            )}
          </div>
        </Field>

        <Field label="Next step">
          <span className="text-fg-secondary">{q.nextStep}</span>
        </Field>

        <Field label="Reminder">
          <span className="italic text-fg-secondary">“{q.reminderDialog}”</span>
        </Field>

        <Field label="On completion">
          <span className="italic text-fg-secondary">“{q.completionDialog}”</span>
        </Field>

        {q.opens.length > 0 && (
          <Field label="Opens">
            <div className="flex flex-wrap gap-2">
              {q.opens.map((u, i) => (
                <span
                  key={i}
                  className="rounded border border-accent bg-accent-muted/40 px-2 py-0.5 text-xs text-accent-hover"
                >
                  {u}
                </span>
              ))}
            </div>
          </Field>
        )}
      </div>
    </details>
  )
}
