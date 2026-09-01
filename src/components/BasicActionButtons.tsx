'use client'

import ActionFlyout from './ActionFlyout'
import { useActionFlyout } from '@/hooks/useActionFlyout'

/**
 * Which surface currently owns the basic-action result flyout. The same four
 * buttons are rendered in two places (inside the room's More Actions section and
 * alongside the compass D-pad), so exactly one of them shows the popover: the one
 * whose button was actually pressed. Results that did not come from a button —
 * a typed command, for example — fall back to the always-visible D-pad copy.
 */
export type BasicActionSurface = 'room' | 'explore'

export const BASIC_ACTIONS = [
  {
    action: 'attack',
    label: 'Attack',
    className:
      'bg-gradient-to-b from-status-error to-status-error hover:from-status-error hover:to-status-error shadow-sm shadow-status-error/30',
  },
  {
    action: 'search',
    label: 'Search',
    className:
      'bg-gradient-to-b from-resource-gold to-resource-gold hover:from-resource-gold hover:to-resource-gold shadow-sm shadow-resource-gold/30',
  },
  {
    action: 'rest',
    label: 'Rest',
    className:
      'bg-gradient-to-b from-status-success to-status-success hover:from-status-success hover:to-status-success shadow-sm shadow-status-success/30',
  },
  {
    action: 'look',
    label: 'Look',
    className:
      'bg-gradient-to-b from-resource-mp to-resource-mp hover:from-resource-mp hover:to-resource-mp shadow-sm shadow-resource-mp/30',
  },
] as const

/** Action names owned by these buttons — other surfaces skip their flyouts. */
export const BASIC_ACTION_NAMES: readonly string[] = BASIC_ACTIONS.map((a) => a.action)

interface BasicActionButtonsProps {
  onAction: (action: string) => void | Promise<void>
  actionResult?: any
  isLoadingRoom?: boolean
  currentAction?: string
  /** Identity of this copy, compared against `activeSurface` to own the flyout. */
  surface: BasicActionSurface
  activeSurface?: BasicActionSurface
  onActionSurfaceChange?: (surface: BasicActionSurface) => void
  /** Layout of the button group — row/wrap on desktop, column beside the D-pad. */
  containerClassName?: string
  /** Padding/typography, so the compact mobile column can shrink the buttons. */
  sizeClassName?: string
}

/**
 * The four persistent room actions (Attack / Search / Rest / Look) plus the
 * result flyout anchored to whichever button was pressed.
 */
export default function BasicActionButtons({
  onAction,
  actionResult,
  isLoadingRoom = false,
  currentAction = '',
  surface,
  activeSurface = 'explore',
  onActionSurfaceChange,
  containerClassName = 'flex flex-wrap gap-2',
  sizeClassName = 'px-4 py-1.5 text-sm',
}: BasicActionButtonsProps) {
  const { activeFlyoutAction, flyoutRootRef, dismissFlyout } = useActionFlyout(actionResult)
  const ownsFlyout = activeSurface === surface

  return (
    <div className={containerClassName}>
      {BASIC_ACTIONS.map(({ action, label, className }) => {
        const showFlyout = ownsFlyout && activeFlyoutAction === action
        return (
          <div key={action} ref={showFlyout ? flyoutRootRef : undefined} className="relative">
            {showFlyout && actionResult && (
              <ActionFlyout result={actionResult} anchorRef={flyoutRootRef} onDismiss={dismissFlyout} />
            )}
            <button
              data-action-button
              onClick={() => {
                console.log(`[ActionButton] ${label} button clicked (${surface})`)
                onActionSurfaceChange?.(surface)
                onAction(action)
              }}
              disabled={isLoadingRoom}
              className={`${sizeClassName} ${className} disabled:opacity-40 disabled:cursor-not-allowed text-fg-bright rounded-lg font-medium whitespace-nowrap transition-all duration-200 hover:shadow-md active:scale-[0.97]`}
            >
              {isLoadingRoom && currentAction === action ? '...' : label}
            </button>
          </div>
        )
      })}
    </div>
  )
}
