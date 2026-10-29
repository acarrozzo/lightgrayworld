'use client'

import React, { useCallback, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useDismissable } from './useDismissable'

export type FeedSwitch = {
  key: string
  label: string
  on: boolean
  onToggle: () => void
}

type Props = {
  switches: FeedSwitch[]
  onJumpToTop: () => void
  /** How many lines Clear would wipe; the confirm step says so. */
  lineCount: number
  onClear: () => void
}

/**
 * The sliders button at the header's right edge and the popover it opens:
 * the display switches, Jump to top, and a two-step Clear feed. It floats
 * over the list rather than pushing it down.
 */
export default function FeedOptionsMenu({ switches, onJumpToTop, lineCount, onClear }: Props) {
  const [open, setOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    setConfirmClear(false)
  }, [])
  useDismissable(open, close, rootRef)

  return (
    <div ref={rootRef} className="relative ml-auto">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Feed options"
        title="Feed options"
        className={`px-2 py-1.5 rounded-md border transition-colors ${
          open
            ? 'fill-accent border-accent hover:bg-accent-hover'
            : 'fill-surface-panel text-fg-secondary border-line-subtle hover:bg-surface-raised/60'
        }`}
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Feed options"
          className="absolute right-0 top-full mt-1.5 z-20 min-w-[200px] p-1.5 rounded-md border border-line-strong fill-surface-raised shadow-lg shadow-black/40 flex flex-col gap-0.5"
        >
          <div className="px-2 pt-1 pb-0.5 text-[9px] font-mono uppercase tracking-widest text-fg-muted">Display</div>
          {switches.map((s) => (
            <button
              key={s.key}
              type="button"
              role="switch"
              aria-checked={s.on}
              onClick={s.onToggle}
              className="flex items-center justify-between gap-3 px-2 py-1.5 rounded text-xs font-mono text-fg-secondary hover:bg-surface-hover transition-colors"
            >
              <span>{s.label}</span>
              <span
                aria-hidden="true"
                className={`relative inline-block w-7 h-3.5 rounded-full transition-colors ${s.on ? 'bg-accent' : 'bg-line-strong'}`}
              >
                <span
                  className={`absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all ${
                    s.on ? 'left-[15px] bg-surface-canvas' : 'left-0.5 bg-fg-secondary'
                  }`}
                />
              </span>
            </button>
          ))}

          <div className="my-1 h-px bg-line-strong" aria-hidden="true" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onJumpToTop()
              close()
            }}
            className="px-2 py-1.5 rounded text-left text-xs font-mono text-fg-secondary hover:bg-surface-hover transition-colors"
          >
            Jump to top
          </button>

          {confirmClear ? (
            <div className="flex items-center gap-1.5 px-2 py-1">
              <button
                type="button"
                onClick={() => {
                  onClear()
                  close()
                }}
                className="flex-1 px-2 py-1 rounded text-xs font-mono border border-status-error/70 bg-status-error/10 text-status-error hover:bg-status-error/20 transition-colors"
              >
                Clear {lineCount} {lineCount === 1 ? 'line' : 'lines'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-2 py-1 rounded text-xs font-mono text-fg-secondary hover:bg-surface-hover transition-colors"
              >
                Keep
              </button>
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => setConfirmClear(true)}
              disabled={lineCount === 0}
              className="px-2 py-1.5 rounded text-left text-xs font-mono text-status-error hover:bg-surface-hover disabled:text-fg-muted disabled:hover:bg-transparent transition-colors"
            >
              Clear feed…
            </button>
          )}
        </div>
      )}
    </div>
  )
}
