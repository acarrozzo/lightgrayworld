'use client'

import { useMemo, useState } from 'react'
import Icon from '@/components/Icon'

// Serializable shapes built by the server page. All text here is already
// resolved from the game data — this component only lays it out.
export type QuestRow = {
  id: string
  number: number
  questType: string
  level: number
  title: string
  summary: string
  objective: string
  nextStep: string
  reminderDialog: string
  completionDialog: string
  npcId: string
  requirements: string[]
  consumesItems: boolean
  rewards: string[]
  unlocks: string[]
}

export type QuestGroup = {
  npcId: string
  name: string
  icon: string
  roomId: string
  quests: QuestRow[]
}

export default function QuestsList({ groups }: { groups: QuestGroup[] }) {
  // Track which quest cards are open by id. A user toggling a single card syncs
  // back into this set, so Expand/Collapse all stays consistent afterward.
  const allIds = useMemo(() => groups.flatMap((g) => g.quests.map((q) => q.id)), [groups])
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())

  function setOpen(id: string, open: boolean) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })
  }

  if (groups.length === 0) {
    return <p className="py-6 text-center text-sm text-fg-muted">No quests found.</p>
  }
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpenIds(new Set(allIds))}
          className="rounded border border-line-subtle fill-surface-raised px-3 py-1 text-xs font-semibold transition-colors hover:border-line-strong hover:bg-surface-hover/80 hover:text-fg-bright"
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={() => setOpenIds(new Set())}
          className="rounded border border-line-subtle fill-surface-raised px-3 py-1 text-xs font-semibold transition-colors hover:border-line-strong hover:bg-surface-hover/80 hover:text-fg-bright"
        >
          Collapse all
        </button>
      </div>
      {groups.map((g) => (
        <section key={g.npcId}>
          <div className="mb-3 flex items-center gap-2 border-b border-line-subtle pb-2">
            <Icon name={g.icon} size={40} />
            <h2 className="text-lg font-semibold text-fg-bright">{g.name}</h2>
            <span className="text-xs text-fg-muted">Room {g.roomId}</span>
            <span className="ml-auto text-xs text-fg-muted">{g.quests.length} quests</span>
          </div>
          <div className="space-y-2">
            {g.quests.map((q) => (
              <QuestCard
                key={q.id}
                q={q}
                open={openIds.has(q.id)}
                onToggle={(open) => setOpen(q.id, open)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function QuestCard({
  q,
  open,
  onToggle,
}: {
  q: QuestRow
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
        <span className="w-6 shrink-0 text-right text-xs text-fg-muted">{q.number}</span>
        <span className="font-medium text-fg-bright">{q.title}</span>
        <QuestTypeTag type={q.questType} />
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
            {q.rewards.map((r, i) => (
              <span key={i} className="text-resource-gold">{r}</span>
            ))}
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

        {q.unlocks.length > 0 && (
          <Field label="Chain">
            <div className="flex flex-wrap gap-2">
              {q.unlocks.map((u, i) => (
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{label}</span>
      <div>{children}</div>
    </div>
  )
}

function QuestTypeTag({ type }: { type: string }) {
  const isMain = type === 'main'
  return (
    <span
      className={
        'rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ' +
        (isMain
          ? 'border-resource-gold text-resource-gold'
          : 'border-accent text-accent-hover')
      }
    >
      {type}
    </span>
  )
}
