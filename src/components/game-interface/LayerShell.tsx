'use client'

import type { ReactNode } from 'react'
import { X, type LucideIcon } from 'lucide-react'

interface LayerShellProps {
  title: string
  icon: LucideIcon
  /** The text colour role of the title and icon: the colour of the dock tile that opened it. */
  toneClass: string
  /** `docked` fills the Explore sidebar; `sheet` is the phone's bottom sheet, with a grab handle and a capped height. */
  variant: 'docked' | 'sheet'
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}

const ICON_BUTTON = 'flex-shrink-0 rounded p-1 text-fg-secondary transition-colors hover:bg-surface-raised/50 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus'

/**
 * The frame the Gear and Bag layers share with the World layer: a one-line
 * header with the close control at its right, a scrolling body, an optional
 * footer line. Escape closes it too; GameInterface owns that.
 */
export default function LayerShell({ title, icon: TitleIcon, toneClass, variant, onClose, footer, children }: LayerShellProps) {
  const isSheet = variant === 'sheet'
  return (
    <div className={`flex min-h-0 flex-col ${isSheet ? 'max-h-[70dvh]' : 'h-full'}`}>
      {isSheet && <div className="mx-auto mt-2 h-1 w-9 flex-shrink-0 rounded-full bg-line-strong" aria-hidden="true" />}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-line-subtle/50 py-2 pl-3 pr-2">
        <TitleIcon size={15} className={toneClass} aria-hidden="true" />
        <span className={`text-sm font-semibold ${toneClass}`}>{title}</span>
        <button type="button" onClick={onClose} aria-label="Close" title="Close (Esc)" className={`ml-auto ${ICON_BUTTON}`}>
          <X size={isSheet ? 20 : 16} aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">{children}</div>
      {footer && <div className="flex h-10 flex-shrink-0 items-center justify-between gap-2 border-t border-line-subtle/40 px-3 text-[11px] text-fg-secondary">{footer}</div>}
    </div>
  )
}

/** A quiet "Open the bag ›" style link for a layer's footer. */
export function LayerLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-fg-secondary hover:text-fg-bright hover:underline underline-offset-2 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-line-focus rounded-sm"
    >
      {children}
      <span className="text-fg-muted"> ›</span>
    </button>
  )
}
