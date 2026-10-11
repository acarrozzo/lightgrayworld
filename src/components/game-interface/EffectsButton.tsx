'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import StatusStrip from '@/components/StatusStrip'
import type { StatusChip } from '@/lib/status-effects'

/**
 * What is running on you, as one small button in the compass box's corner:
 * the count of effects, green when one of them is poison, and the chips
 * themselves in a popover on tap. The chips used to sit in a row under the
 * verbs, which was the one thing in the strip with no fixed count; this keeps
 * the strip's height a constant and the chips one tap away. Nothing is drawn
 * with nothing running: the button is positioned by its holder, so its
 * absence moves nothing.
 */
export default function EffectsButton({ chips, className = '' }: { chips: StatusChip[]; className?: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chips.length === 0) setOpen(false)
  }, [chips.length])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (chips.length === 0) return null
  const poisoned = chips.some((chip) => chip.tone === 'poison')
  const label = `${chips.length} effect${chips.length === 1 ? '' : 's'} running on you${poisoned ? ', including poison' : ''}`

  return (
    <div ref={rootRef} className={`z-20 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`relative flex h-8 w-8 items-center justify-center rounded-md border bg-surface-panel/85 shadow-sm backdrop-blur-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
          poisoned
            ? 'border-hue-green/60 text-hue-green hover:bg-hue-green/10'
            : 'border-hue-purple/50 text-hue-purple hover:bg-hue-purple/10'
        }`}
      >
        <Sparkles size={14} aria-hidden="true" />
        <span
          className={`absolute -right-1.5 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums ${
            poisoned ? 'fill-hue-green' : 'fill-hue-purple'
          }`}
        >
          {chips.length}
        </span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Effects running on you"
          className="absolute right-0 top-9 w-[min(16rem,calc(100vw-1.5rem))] rounded-lg border border-line-strong bg-surface-overlay p-2.5 shadow-xl shadow-black/40"
        >
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-fg-muted">Running on you</p>
          <StatusStrip chips={chips} />
          <p className="mt-1.5 text-[10px] text-fg-disabled">Each chip says what the next click does.</p>
        </div>
      )}
    </div>
  )
}
