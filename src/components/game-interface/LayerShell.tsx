'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'
import SubTabButton from './SubTabButton'

/**
 * Where a deck tab is drawn: `docked` over the compass in the Explore column,
 * `overlay` full screen on a wide display, `sheet` rising from the bottom of a
 * phone. The frame around the tab supplies it; the tab's own layer reads it.
 */
export type DeckPresentation = 'docked' | 'overlay' | 'sheet'

export interface DeckContextValue {
  presentation: DeckPresentation
  /** Back to the compass. Escape does the same; GameInterface owns that. */
  onClose: () => void
  /** Docked ⇄ full screen. Absent where there is nothing to dock into. */
  onToggleFullscreen?: () => void
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
  /** The text colour role of the title and icon: the colour of the dock tile that opened it. */
  toneClass: string
  /** Replaces the icon and title at the header's left: the World layer's own two tabs. */
  lead?: ReactNode
  /** The layer lays out and scrolls its own body. */
  flush?: boolean
  footer?: ReactNode
  children: ReactNode
}

export const ICON_BUTTON = 'flex-shrink-0 rounded p-1 text-fg-secondary transition-colors hover:bg-surface-raised/50 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus'

/**
 * The frame every deck layer shares: a one-line header with full screen and
 * close at its right, a body, an optional footer line. A phone sheet has
 * nothing to dock into, so there the header carries only the close.
 */
export default function LayerShell({ title, icon, toneClass, lead, flush = false, footer, children }: LayerShellProps) {
  const { presentation, onClose, onToggleFullscreen } = useDeck()
  const isSheet = presentation === 'sheet'
  const isOverlay = presentation === 'overlay'
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="@container flex flex-shrink-0 items-center gap-2 border-b border-line-subtle/50 py-2 pl-3 pr-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {lead ?? (
              <>
                <span className={`flex flex-shrink-0 ${toneClass}`}>{icon}</span>
                <span className={`text-sm font-semibold ${toneClass}`}>{title}</span>
              </>
            )}
          </div>
          {/* Labelled, not a bare icon: it is how every tab gets room without leaving it. */}
          {!isSheet && onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              title={isOverlay ? 'Back to the sidebar' : 'Open full screen'}
              className="flex h-7 flex-shrink-0 items-center gap-1.5 rounded-md border border-line-strong/70 bg-surface-raised/40 px-2 text-[11px] font-semibold text-fg-primary transition-colors hover:border-line-focus hover:bg-surface-raised hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              {isOverlay ? <Minimize2 size={13} aria-hidden="true" /> : <Maximize2 size={13} aria-hidden="true" />}
              <span className={lead ? '@max-[420px]:hidden' : ''}>{isOverlay ? 'Dock' : 'Full screen'}</span>
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close" title="Close (Esc)" className={ICON_BUTTON}>
            <X size={isOverlay || isSheet ? 20 : 16} aria-hidden="true" />
          </button>
      </div>
      {flush ? (
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          <div className={isOverlay ? 'mx-auto w-full max-w-[520px]' : ''}>
            {children}
            <ScrollEnd />
          </div>
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
}

/**
 * Sub-tabs for a layer's header, passed as its `lead`: the pages inside one
 * tab (Char | Skill book | Spell book). The same buttons the Quests and
 * Players sub-tab rows use, in the tab's own accent.
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
  /** The tab's main page: clicking the active sub-tab returns here, as the Quests row does. */
  home: T
  onChange: (id: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex min-w-0 items-center gap-2 overflow-x-auto">
      {tabs.map((tab) => (
        <SubTabButton key={tab.id} active={active === tab.id} color={color} ariaPressed={active === tab.id} onClick={() => onChange(active === tab.id ? home : tab.id)}>
          {tab.icon}
          {tab.label}
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
