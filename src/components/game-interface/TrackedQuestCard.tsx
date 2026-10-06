'use client'

import { useEffect, useRef, useState } from 'react'
import { Pin } from 'lucide-react'
import NotificationBadge from '@/components/NotificationBadge'
import type { TrackedQuestView } from '@/lib/tracked-quest'

interface TrackedQuestsProps {
  quests: TrackedQuestView[]
  /** Opens the Quests tab. */
  onOpen: () => void
}

/** One followed quest: title and count on a line, the next step under it. */
function Row({ quest, onOpen }: { quest: TrackedQuestView; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Open in Quests"
      className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-surface-raised/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
    >
      <Pin size={11} className={`mt-[3px] flex-shrink-0 ${quest.ready ? 'text-status-success' : 'text-fg-disabled'}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={`truncate text-xs font-semibold ${quest.ready ? 'text-status-success' : 'text-fg-primary'}`}>{quest.title}</span>
          {quest.progress && <span className={`ml-auto flex-shrink-0 text-[10px] font-bold tabular-nums ${quest.ready ? 'text-status-success' : 'text-fg-muted'}`}>{quest.progress}</span>}
        </span>
        <span className="block truncate text-[11px] text-fg-muted">{quest.step}</span>
      </span>
    </button>
  )
}

/**
 * The quests you are following, beside the compass: a quiet list, each with
 * its next step. Any row opens the Quests tab; the pins there are how you
 * change the list.
 */
export default function TrackedQuests({ quests, onOpen }: TrackedQuestsProps) {
  if (quests.length === 0) return null
  return (
    <div className="w-full divide-y divide-line-subtle/30 rounded-lg border border-line-subtle/40 bg-surface-sunken/40" aria-label="Quests you are following">
      {quests.map((quest) => (
        <Row key={quest.questId} quest={quest} onOpen={onOpen} />
      ))}
    </div>
  )
}

/**
 * The phone version: a small pin button at the strip's corner that opens the
 * same list as a flyout. Closes on a tap outside, Escape, a row, or a room
 * change, so it never lingers over the D-pad.
 */
export function TrackedQuestsButton({ quests, onOpen, roomId }: TrackedQuestsProps & { roomId?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsOpen(false)
  }, [roomId])

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  if (quests.length === 0) return null
  const ready = quests.filter((quest) => quest.ready).length

  return (
    <div ref={rootRef} className="absolute left-2 top-2 z-20">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={`Quests you are following (${quests.length})`}
        title="Quests you are following"
        className="relative flex h-8 w-8 items-center justify-center rounded-md border border-line-strong/70 bg-surface-panel/85 text-fg-secondary shadow-sm backdrop-blur-sm transition-colors hover:bg-surface-raised/80 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <Pin size={14} aria-hidden="true" />
        <NotificationBadge value={ready > 0 ? ready : undefined} className="absolute -right-1 -top-1" />
      </button>
      {isOpen && (
        <div role="dialog" aria-label="Quests you are following" className="absolute left-0 top-9 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-line-strong bg-surface-overlay shadow-xl shadow-black/40">
          <TrackedQuests
            quests={quests}
            onOpen={() => {
              setIsOpen(false)
              onOpen()
            }}
          />
        </div>
      )}
    </div>
  )
}
