'use client'

import React from 'react'
import { getTabButtonColorClasses, type TabColor } from '@/lib/tabColors'

interface SubTabButtonProps {
  active: boolean
  /** Accent used when active. Inactive always uses the shared sub-tab gray. */
  color: TabColor | string
  onClick?: () => void
  className?: string
  title?: string
  ariaPressed?: boolean
  ref?: React.Ref<HTMLButtonElement>
  children: React.ReactNode
}

/**
 * The button used by every sub-tab row (Explore, Players, Quests, map picker).
 * Sub-tabs sit one level below the main tab strip: the active state reuses that
 * strip's accent, while the inactive state stays a flatter gray so the two rows
 * read as different levels.
 */
const INACTIVE_CLASSES =
  'border-1 border-line-strong/80 hover:border-line-strong bg-transparent hover:bg-surface-raised/30 text-fg-secondary hover:text-fg-primary'

export default function SubTabButton({
  active,
  color,
  onClick,
  className = '',
  title,
  ariaPressed,
  ref,
  children,
}: SubTabButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={ariaPressed}
      className={`px-2.5 h-7 text-xs gap-1.5 font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow flex-shrink-0 whitespace-nowrap ${
        active ? getTabButtonColorClasses(color, true) : INACTIVE_CLASSES
      } ${className}`}
    >
      {children}
    </button>
  )
}
