'use client'

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import SubTabButton from './SubTabButton'

/**
 * Where a tab or layer is drawn: `docked` in the left column of a wide screen,
 * `sheet` on a phone (a full page for a tab, a bottom sheet for Action). The
 * frame around it supplies this; the layer reads it.
 */
export type DeckPresentation = 'docked' | 'sheet'

export interface DeckContextValue {
  presentation: DeckPresentation
  /** Back to the compass. Escape does the same; GameInterface owns that. */
  onClose: () => void
}

const DeckContext = createContext<DeckContextValue | null>(null)
export const DeckProvider = DeckContext.Provider

export function useDeck(): DeckContextValue {
  const value = useContext(DeckContext)
  if (!value) throw new Error('useDeck must be used inside a deck')
  return value
}

interface LayerShellProps {
  title: string
  icon: ReactNode
  /** The text colour role of the title and icon: the tab's accent. */
  toneClass: string
  /** Replaces the icon and title at the header's left: the tab's sub-tabs. */
  lead?: ReactNode
  /** The layer lays out and scrolls its own body. */
  flush?: boolean
  footer?: ReactNode
  children: ReactNode
}

export const ICON_BUTTON = 'flex-shrink-0 rounded p-1 text-fg-secondary transition-colors hover:bg-surface-raised/50 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus'

/**
 * The frame every tab and layer shares: a one-line header with its sub-tabs
 * (or its name) and close, a body, an optional footer line.
 *
 * Opening one moves keyboard focus into it, so Tab continues from the layer
 * rather than from wherever the tile that opened it was; closing it hands
 * focus back to that tile.
 */
export default function LayerShell({ title, icon, toneClass, lead, flush = false, footer, children }: LayerShellProps) {
  const { presentation, onClose } = useDeck()
  const isSheet = presentation === 'sheet'
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // A link that opened this layer may already have put focus inside it (the
    // bag's search box, a ringed book entry); leave that alone.
    if (root && !root.contains(document.activeElement)) root.focus({ preventScroll: true })
    return () => {
      // Only if focus was still in here and would otherwise fall to the page.
      const active = document.activeElement
      const lost = !active || active === document.body || (root !== null && root.contains(active))
      if (lost && opener && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  return (
    <div ref={rootRef} tabIndex={-1} role="region" aria-label={title} className="flex h-full min-h-0 flex-1 flex-col focus:outline-none">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-line-subtle/50 py-2 pl-3 pr-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {lead ?? (
            <>
              <span className={`flex flex-shrink-0 ${toneClass}`}>{icon}</span>
              <span className={`text-sm font-semibold ${toneClass}`}>{title}</span>
            </>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" title="Close (Esc)" className={ICON_BUTTON}>
          <X size={isSheet ? 20 : 16} aria-hidden="true" />
        </button>
      </div>
      {flush ? (
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {children}
          <ScrollEnd />
        </div>
      )}
      {footer && <div className="flex h-10 flex-shrink-0 items-center justify-between gap-2 border-t border-line-subtle/40 px-3 text-[11px] text-fg-secondary">{footer}</div>}
    </div>
  )
}

interface HeaderTab<T extends string> {
  id: T
  label: string
  icon?: ReactNode
  /** After the label: a count, or an absolutely placed badge. */
  extra?: ReactNode
}

/**
 * Sub-tabs for a layer's header, passed as its `lead`: the pages inside one
 * tab (Char | Skill book | Spell book; Quests | Kill list | Battle log), in
 * the tab's own accent. Clicking the active one returns to the tab's main
 * page. Taller on a phone, where a thumb has to find them.
 */
export function HeaderTabs<T extends string>({
  label,
  color,
  tabs,
  active,
  home,
  onChange,
}: {
  label: string
  color: string
  tabs: HeaderTab<T>[]
  active: T
  /** The tab's main page: clicking the active sub-tab returns here. */
  home: T
  onChange: (id: T) => void
}) {
  return (
    <div role="group" aria-label={label} // The padding is room for a badge that hangs off a pill's corner: a scroll
      // container clips whatever leaves it, and a clipped dot also made the row
      // think it had something to scroll to.
      className="flex min-w-0 items-center gap-2 overflow-x-auto px-1.5 py-1.5 -mx-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => (
        <SubTabButton
          key={tab.id}
          active={active === tab.id}
          color={color}
          ariaPressed={active === tab.id}
          onClick={() => onChange(active === tab.id ? home : tab.id)}
          className="max-lg:h-9 max-lg:px-3"
        >
          {tab.icon}
          {tab.label}
          {tab.extra}
        </SubTabButton>
      ))}
    </div>
  )
}

/**
 * The end of a scrolling tab: a short rule, then air. Lets the last row be
 * scrolled up off the bottom edge instead of sitting hard against it, and
 * says plainly that there is nothing more below.
 */
export function ScrollEnd() {
  return (
    <div className="flex h-56 flex-shrink-0 flex-col items-center gap-2 pt-10" aria-hidden="true">
      <span className="h-px w-12 bg-line-subtle/70" />
      <span className="h-1 w-1 rounded-full bg-line-strong/70" />
    </div>
  )
}

/** A quiet "Open spell book ›" style link for a layer's footer. */
export function LayerLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="whitespace-nowrap text-fg-secondary hover:text-fg-bright hover:underline underline-offset-2 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-line-focus rounded-sm"
    >
      {children}
      <span className="text-fg-muted"> ›</span>
    </button>
  )
}
