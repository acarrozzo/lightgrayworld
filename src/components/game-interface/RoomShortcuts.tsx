'use client'

import Icon from '@/components/Icon'
import type { RoomShortcut, ShortcutTone } from '@/lib/room-shortcuts'

interface RoomShortcutsProps {
  shortcuts: RoomShortcut[]
  /** Primary actions beyond the cap, folded behind "+N in room". */
  hidden: number
  onAction: (action: string | { type: string; data?: any }) => void
  isLoadingRoom?: boolean
  /** The action in flight, so its chip can show it is working. */
  currentAction?: string
  /** "+N in room": bring the room card's own action list into view. */
  onShowAll?: () => void
}

const BUBBLE_TONE: Record<ShortcutTone, string> = {
  ready: 'bg-fg-bright text-surface-canvas',
  info: 'bg-surface-canvas/80 text-fg-bright',
  wait: 'border border-fg-bright/60 text-fg-bright bg-transparent',
}

/**
 * The room's primary actions as a right-aligned column of chips under the
 * danger line: the original nav's top-right badge column. Each chip is the
 * same button as the room card's, in the same fill, with a count bubble where
 * the original had one — quests ready, the harvest's batch, or a regrow timer.
 * The room card keeps the full list and the result flyout; this is a second
 * trigger for the primary few.
 */
export default function RoomShortcuts({ shortcuts, hidden, onAction, isLoadingRoom = false, currentAction, onShowAll }: RoomShortcutsProps) {
  if (shortcuts.length === 0) return null
  return (
    <div className="flex flex-col items-end gap-1 max-w-[13.5rem]" role="group" aria-label="Room shortcuts">
      {shortcuts.map((shortcut) => {
        const firing = typeof shortcut.fire === 'string' ? shortcut.fire : shortcut.fire.type
        const isWorking = isLoadingRoom && currentAction === firing
        const disabled = shortcut.disabled || isLoadingRoom
        return (
          <button
            key={shortcut.key}
            type="button"
            onClick={() => onAction(shortcut.fire)}
            disabled={disabled}
            title={shortcut.reason ?? (shortcut.bubble ? `${shortcut.label} · ${shortcut.bubble.title}` : shortcut.label)}
            aria-label={`${shortcut.label}${shortcut.bubble ? `, ${shortcut.bubble.title}` : ''}${shortcut.reason ? `. ${shortcut.reason}` : ''}`}
            className={`${shortcut.fillClass} inline-flex max-w-full items-center gap-1.5 h-6 pl-1.5 pr-2 rounded-md text-[11px] font-semibold shadow-sm shadow-shadow transition-all duration-150 active:scale-[0.97] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
              shortcut.muted ? 'opacity-60' : ''
            }`}
          >
            {shortcut.icon && <Icon name={shortcut.icon} size={13} color="current" className="flex-shrink-0" />}
            <span className="truncate">{isWorking ? '…' : shortcut.label}</span>
            {shortcut.bubble && (
              <span
                className={`ml-0.5 inline-flex h-4 min-w-[16px] flex-shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums ${BUBBLE_TONE[shortcut.bubble.tone]}`}
                aria-hidden="true"
              >
                {shortcut.bubble.text}
              </span>
            )}
          </button>
        )
      })}
      {hidden > 0 && (
        <button
          type="button"
          onClick={onShowAll}
          disabled={!onShowAll}
          className="text-[10px] text-fg-muted hover:text-fg-bright hover:underline underline-offset-2 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-line-focus rounded-sm disabled:no-underline"
        >
          +{hidden} in room<span className="text-fg-muted"> ›</span>
        </button>
      )}
    </div>
  )
}
