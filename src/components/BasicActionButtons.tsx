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

/**
 * The four persistent actions, each on the role that names it.
 *
 * These had drifted onto borrowed roles — Attack wore `status.error`, Search
 * wore `resource.gold`, Rest wore `status.success`, Look wore `resource.mp` —
 * which is exactly the coupling the semantic vocabulary exists to prevent: the
 * Attack button was painted with the colour that means "something failed", and
 * a theme separating those two would have broken it. `action.attack` and its
 * siblings exist for precisely these buttons.
 *
 * `fill-*` carries the background and its label colour together. They were
 * previously `bg-gradient-to-b from-X to-X` — a gradient between one colour and
 * itself, left over from an earlier migration — with a white label hard-coded
 * on the button element, which put Search at 1.55:1.
 */
export const BASIC_ACTIONS = [
  { action: 'attack', label: 'Attack', className: 'fill-action-attack shadow-sm shadow-shadow' },
  { action: 'search', label: 'Search', className: 'fill-action-search shadow-sm shadow-shadow' },
  { action: 'rest', label: 'Rest', className: 'fill-action-rest shadow-sm shadow-shadow' },
  { action: 'look', label: 'Look', className: 'fill-action-look shadow-sm shadow-shadow' },
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
              className={`${sizeClassName} ${className} disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium whitespace-nowrap transition-all duration-200 hover:shadow-md active:scale-[0.97]`}
            >
              {isLoadingRoom && currentAction === action ? '...' : label}
            </button>
          </div>
        )
      })}
    </div>
  )
}
