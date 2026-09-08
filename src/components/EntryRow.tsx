'use client'

import React, { type ReactNode } from 'react'
import Icon from './Icon'

/**
 * One line for anything the player owns or knows: a bag item, a shop listing, a
 * learned spell, a skill, a consumable in the battle deck.
 *
 * The shape is always the same, and it is the shape that makes the row safe to
 * press in a fight: the frame is a plain container, the icon and text are a
 * *separate* button that opens something, and the thing that acts — Drink,
 * Cast, Use, Buy — is its own control at the end. Nothing about tapping a name
 * can spend a turn or an item. A row with no `onOpen` has an inert body, which
 * is what the battle deck wants: there, only the verb does anything at all.
 *
 * Two densities. `bag` is the row the inventory, the shop and the crafting
 * sheet have always drawn, kept to the pixel; `deck` is the tighter one the
 * command deck and the character panel use, where the verb pill carries the
 * weight and the icon wears its own colour.
 */
export type EntryRowDensity = 'bag' | 'deck'

const DENSITY: Record<EntryRowDensity, {
  frame: string
  body: string
  well: string
  iconSize: number
  name: string
}> = {
  bag: {
    frame: 'gap-1.5 min-h-[48px] pl-2 pr-1.5 py-1',
    body: 'gap-2.5 py-0.5',
    well: 'w-[34px] h-[34px]',
    iconSize: 30,
    name: 'text-[13px] font-semibold text-fg-bright',
  },
  deck: {
    frame: 'gap-2 min-h-[52px] pl-2.5 pr-1.5 py-1.5',
    body: 'gap-2.5 py-0.5',
    well: 'w-[26px] h-[26px]',
    iconSize: 26,
    name: 'text-[13px] font-bold text-fg-primary',
  },
}

export interface EntryRowProps {
  density?: EntryRowDensity
  icon: string
  /** Colour (and any opacity) for the icon; the bag's rows inherit fg-primary. */
  iconClass?: string
  /** Pinned to the icon's corner — the bag's "picked this up just now" dot. */
  iconBadge?: ReactNode
  name: string
  /** Chips right after the name: ×3, Equipped, a level. */
  nameTags?: ReactNode
  /** The second line. */
  subline?: ReactNode
  /** Anything below the subline, inside the body button — the gear compare box. */
  extra?: ReactNode
  /** Facts at the end of the row, before the action: a cost, a price, a duration. */
  meta?: ReactNode
  /** Why the action is refused. Takes `meta`'s place, in the error tone. */
  reason?: string | null
  /** The control that acts, plus any trailing affordance (a disclosure chevron). */
  action?: ReactNode
  /**
   * What tapping the icon and text opens. Omit and the body is inert — no
   * hover, no focus stop, nothing to mis-tap.
   */
  onOpen?: () => void
  /** For a body that opens a drawer in place. */
  ariaExpanded?: boolean
  /** Label for the body button when the name alone does not say what opens. */
  bodyAriaLabel?: string
  /** Pointer or focus arriving on (true) or leaving (false) the whole row. */
  onHoverChange?: (hovering: boolean) => void
  /** Frame classes: border, background, corners. Owned by the caller. */
  className?: string
  title?: string
}

export default function EntryRow({
  density = 'bag',
  icon,
  iconClass,
  iconBadge,
  name,
  nameTags,
  subline,
  extra,
  meta,
  reason = null,
  action,
  onOpen,
  ariaExpanded,
  bodyAriaLabel,
  onHoverChange,
  className = '',
  title,
}: EntryRowProps) {
  const d = DENSITY[density]

  const body = (
    <>
      <span className={`relative flex items-center justify-center flex-shrink-0 ${d.well} ${iconClass ?? 'text-fg-primary'}`}>
        {iconBadge}
        <Icon name={icon} size={d.iconSize} color="current" />
      </span>
      <span className="min-w-0 flex flex-col gap-px">
        <span className="flex items-baseline gap-1.5 min-w-0">
          <span className={`${d.name} truncate`}>{name}</span>
          {nameTags}
        </span>
        {subline && (
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-tight">{subline}</span>
        )}
        {extra}
      </span>
    </>
  )

  return (
    <div
      className={`flex items-center border transition-colors duration-150 ${d.frame} ${className}`}
      title={title}
      // On the frame, not the body: with an inert body the verb button is the
      // only focusable thing on the row, and React's focus events bubble, so
      // reaching it by keyboard previews the same as hovering does.
      onMouseEnter={onHoverChange ? () => onHoverChange(true) : undefined}
      onMouseLeave={onHoverChange ? () => onHoverChange(false) : undefined}
      onFocus={onHoverChange ? () => onHoverChange(true) : undefined}
      onBlur={onHoverChange ? () => onHoverChange(false) : undefined}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={ariaExpanded}
          aria-label={bodyAriaLabel}
          className={`flex items-center min-w-0 flex-1 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${d.body}`}
        >
          {body}
        </button>
      ) : (
        <span className={`flex items-center min-w-0 flex-1 ${d.body}`}>{body}</span>
      )}

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* A refusal is information, not an alarm: the row is already dimmed
            and the verb already dead, so this only has to say which. */}
        {reason ? (
          <span className="text-[10px] font-normal text-fg-muted whitespace-nowrap">{reason}</span>
        ) : meta}
        {action}
      </div>
    </div>
  )
}

/**
 * The row's own verb: Cast, Use, Drink, Buy. Sized to stay a comfortable
 * touch target now that it is the only thing on the row that acts.
 */
export function EntryVerb({
  children,
  onClick,
  disabled = false,
  fillClass,
  title,
  ariaLabel,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  /** The filled role this verb wears when it is live. */
  fillClass: string
  title?: string
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`min-h-[44px] min-w-[56px] px-2.5 text-[10px] font-bold uppercase tracking-wider tabular-nums rounded-md transition-all duration-150 active:scale-[0.97] disabled:active:scale-100 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
        disabled ? 'bg-surface-raised text-fg-muted opacity-70' : fillClass
      }`}
    >
      {children}
    </button>
  )
}
