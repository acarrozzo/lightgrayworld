'use client'

import type { ReactNode } from 'react'
import ActionFlyout from './ActionFlyout'
import { useActionFlyout } from '@/hooks/useActionFlyout'

/**
 * The three persistent actions, each on the role that names it.
 *
 * These had drifted onto borrowed roles — Attack wore `status.error`, Search
 * wore `resource.gold`, Rest wore `status.success` — which is exactly the
 * coupling the semantic vocabulary exists to prevent: the Attack button was
 * painted with the colour that means "something failed", and a theme
 * separating those two would have broken it. `action.attack` and its siblings
 * exist for precisely these buttons.
 *
 * Look used to be the fourth. In the original it re-printed the room into the
 * feed, which mattered because the feed was the screen; the room description
 * is now always on screen, so the button only echoed the room's name. Typing
 * `look` (or `l`) in the command box still works for people who like to.
 *
 * `fill-*` carries the background and its label colour together.
 */
export const BASIC_ACTIONS = [
  { action: 'attack', label: 'Attack', className: 'fill-action-attack shadow-sm shadow-shadow' },
  { action: 'search', label: 'Search', className: 'fill-action-search shadow-sm shadow-shadow' },
  { action: 'rest', label: 'Rest', className: 'fill-action-rest shadow-sm shadow-shadow' },
] as const

/** Action names owned by these buttons — other surfaces skip their flyouts. */
export const BASIC_ACTION_NAMES: readonly string[] = BASIC_ACTIONS.map((a) => a.action)

interface BasicActionButtonsProps {
  onAction: (action: string) => void | Promise<void>
  actionResult?: any
  isLoadingRoom?: boolean
  currentAction?: string
  /** Layout of the button group — row/wrap on desktop, column beside the D-pad. */
  containerClassName?: string
  /** Padding/typography, so the compact mobile column can shrink the buttons. */
  sizeClassName?: string
  /**
   * Extra controls laid out as part of the same group — the Teleport button
   * sits here so it lines up with the three actions on both breakpoints.
   */
  children?: ReactNode
}

/**
 * The three persistent room actions (Attack / Search / Rest) plus the result
 * flyout anchored to whichever button was pressed.
 */
export default function BasicActionButtons({
  onAction,
  actionResult,
  isLoadingRoom = false,
  currentAction = '',
  containerClassName = 'flex flex-wrap gap-2',
  sizeClassName = 'px-4 py-1.5 text-sm',
  children,
}: BasicActionButtonsProps) {
  const { activeFlyoutAction, flyoutRootRef, dismissFlyout } = useActionFlyout(actionResult)

  return (
    <div className={containerClassName}>
      {BASIC_ACTIONS.map(({ action, label, className }) => {
        const showFlyout = activeFlyoutAction === action
        return (
          <div key={action} ref={showFlyout ? flyoutRootRef : undefined} className="relative">
            {showFlyout && actionResult && (
              <ActionFlyout result={actionResult} anchorRef={flyoutRootRef} onDismiss={dismissFlyout} />
            )}
            <button
              data-action-button
              onClick={() => {
                console.log(`[ActionButton] ${label} button clicked`)
                onAction(action)
              }}
              disabled={isLoadingRoom}
              className={`${sizeClassName} ${className} disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium whitespace-nowrap transition-all duration-200 hover:shadow-md active:scale-[0.97]`}
            >
              {isLoadingRoom && currentAction === action ? '...' : label}
            </button>
          </div>
        )
      })}
      {children}
    </div>
  )
}
