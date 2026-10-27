'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Minimize2, X } from 'lucide-react'
import type { Player } from '@/lib/game-state'
import { StatBar } from '@/components/GameHeader'

/** The icon buttons of a full-screen header: a touch-sized square. */
export const FULL_ICON = 'grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-fg-secondary transition-colors hover:bg-surface-raised/60 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus'

interface FullScreenFrameProps {
  /** The dialog's name for a screen reader: "World, full screen". */
  label: string
  /** The header's left: the layer's sub-tabs. */
  tabs: ReactNode
  /** Whose HP and MP ride in the header; left out, no vitals line is drawn. */
  player?: Player | null
  /** The layer's own switches, drawn before Leave and Close. */
  toggles?: ReactNode
  /** Back to the docked layer. Escape does the same; GameInterface owns that. */
  onLeave: () => void
  /** Back to the compass. */
  onClose: () => void
  children: ReactNode
}

/**
 * A tab over the whole window: its sub-tabs, a slim HP/MP line, the layer's
 * own switches, back to the docked tab, close. On a phone the vitals take a
 * second line. The World map and the Skills and Spells book both wear it, so
 * full screen looks and behaves the same wherever it is found.
 *
 * Portalled to the body, so it covers the side panels and the header alike.
 * Keyboard focus moves into it on open and back to whatever opened it on
 * close.
 */
export default function FullScreenFrame({ label, tabs, player = null, toggles = null, onLeave, onClose, children }: FullScreenFrameProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  // Portals need a document: nothing is drawn until the first client render.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    rootRef.current?.focus({ preventScroll: true })
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [mounted])

  if (!mounted) return null

  const vitals = player ? (
    <div className="flex items-center gap-2" aria-label="Vitals">
      <StatBar className="w-[104px]" pct={player.hpMax > 0 ? (player.hp / player.hpMax) * 100 : 0} fillClass="bg-gradient-to-r from-fill-resource-hp to-resource-hp" label="HP" value={`HP ${player.hp}/${player.hpMax}`} />
      <StatBar className="w-[104px]" pct={player.mpMax > 0 ? (player.mp / player.mpMax) * 100 : 0} fillClass="bg-gradient-to-r from-fill-resource-mp to-resource-mp" label="MP" value={`MP ${player.mp}/${player.mpMax}`} />
    </div>
  ) : null

  return createPortal(
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-40 flex flex-col bg-surface-canvas focus:outline-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line-subtle/60 bg-surface-panel py-1.5 pl-3 pr-2">
        <div className="flex min-w-0 flex-1 items-center">{tabs}</div>
        {vitals && <div className="order-last flex w-full justify-center sm:order-none sm:ml-auto sm:w-auto">{vitals}</div>}
        <div className="ml-auto flex flex-shrink-0 items-center gap-0.5 sm:ml-0">
          {toggles}
          <button type="button" onClick={onLeave} aria-label="Leave full screen" title="Leave full screen (Esc)" className={FULL_ICON}>
            <Minimize2 size={16} aria-hidden="true" />
          </button>
          <button type="button" onClick={onClose} aria-label="Close" title="Close" className={FULL_ICON}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>,
    document.body,
  )
}
