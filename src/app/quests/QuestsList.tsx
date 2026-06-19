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
    return <p className="py-6 text-center text-sm text-gray-500">No quests found.</p>
  }
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpenIds(new Set(allIds))}
          className="rounded border border-gray-700 bg-gray-800/60 px-3 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-700/80 hover:text-white"
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={() => setOpenIds(new Set())}
          className="rounded border border-gray-700 bg-gray-800/60 px-3 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-700/80 hover:text-white"
        >
          Collapse all
        </button>
      </div>
      {groups.map((g) => (
        <section key={g.npcId}>
          <div className="mb-3 flex items-center gap-2 border-b border-gray-800 pb-2">
            <Icon name={g.icon} size={40} />
            <h2 className="text-lg font-semibold text-gray-100">{g.name}</h2>
            <span className="text-xs text-gray-500">Room {g.roomId}</span>
            <span className="ml-auto text-xs text-gray-500">{g.quests.length} quests</span>
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
      className="group rounded-lg border border-gray-800 bg-gray-900/30 open:bg-gray-900/50"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm">
        <span className="w-6 shrink-0 text-right text-xs text-gray-500">{q.number}</span>
        <span className="font-medium text-gray-100">{q.title}</span>
        <QuestTypeTag type={q.questType} />
        <span className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-500">Lvl {q.level}</span>
          <span className="text-[10px] text-gray-600 transition-transform group-open:rotate-90">▶</span>
        </span>
      </summary>

      <div className="space-y-3 border-t border-gray-800 px-3 py-3 text-sm">
        <p className="italic text-gray-400">{q.summary}</p>

        <Field label="Objective">
          <span className="text-gray-200">{q.objective}</span>
        </Field>

        <Field label="Requirements">
          <ul className="space-y-0.5">
            {q.requirements.map((r, i) => (
              <li key={i} className="text-gray-300">• {r}</li>
            ))}
            {q.consumesItems && (
              <li className="text-xs text-gray-500">Required items are consumed on turn-in.</li>
            )}
          </ul>
        </Field>

        <Field label="Rewards">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {q.rewards.map((r, i) => (
              <span key={i} className="text-amber-300">{r}</span>
            ))}
          </div>
        </Field>

        <Field label="Next step">
          <span className="text-gray-400">{q.nextStep}</span>
        </Field>

        <Field label="Reminder">
          <span className="italic text-gray-400">“{q.reminderDialog}”</span>
        </Field>

        <Field label="On completion">
          <span className="italic text-gray-400">“{q.completionDialog}”</span>
        </Field>

        {q.unlocks.length > 0 && (
          <Field label="Chain">
            <div className="flex flex-wrap gap-2">
              {q.unlocks.map((u, i) => (
                <span
                  key={i}
                  className="rounded border border-indigo-800 bg-indigo-950/40 px-2 py-0.5 text-xs text-indigo-300"
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
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
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
          ? 'border-amber-700 text-amber-300'
          : 'border-indigo-700 text-indigo-300')
      }
    >
      {type}
    </span>
  )
}
