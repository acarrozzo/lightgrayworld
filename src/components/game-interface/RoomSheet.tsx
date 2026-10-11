'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ICON_BUTTON } from './LayerShell'

interface RoomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * The room, over the fight. While the battle card is pinned the room card
 * has no place under it, so the strip's Room chip opens it here: a bottom
 * sheet on a phone, a centred dialog on a wide screen, filling the room
 * column and no more (the tab bar under it stays in reach). The same
 * `RoomBox` as always sits inside, so its actions, supplies and the people
 * standing here are all a tap away without leaving the fight.
 */
export default function RoomSheet({ open, onClose, title, children }: RoomSheetProps) {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    bodyRef.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (opener && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end lg:items-center lg:justify-center lg:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-surface-canvas/60 backdrop-blur-[2px]" />
      <div
        ref={bodyRef}
        tabIndex={-1}
        className="relative flex max-h-[82%] min-h-0 w-full flex-col rounded-t-2xl border-t border-line-strong bg-surface-overlay shadow-2xl shadow-black/50 focus:outline-none lg:max-h-[88%] lg:max-w-2xl lg:rounded-2xl lg:border"
      >
        <div className="mx-auto mt-2 h-1 w-9 flex-shrink-0 rounded-full bg-line-strong lg:hidden" aria-hidden="true" />
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-line-subtle/50 py-2 pl-3 pr-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-hue-blue">{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" title="Close (Esc)" className={ICON_BUTTON}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  )
}
