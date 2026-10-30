'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, EllipsisVertical } from 'lucide-react'
import ActionFlyout from './ActionFlyout'
import { useActionFlyout } from '@/hooks/useActionFlyout'
import { useGameStore } from '@/lib/game-state'
import { restLook } from '@/lib/rest-look'
import { SETTLED_TONE } from './SupplyShelf'

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
  /** Share the row's width equally: the phone strip, where each button is a thumb target. */
  fill?: boolean
  /**
   * The menu Attack's dots open (Explore's AttackMenu). Left out, Attack
   * is one button. `fired` names the action a row sent, so its result opens
   * over Attack the way a plain swing's does; `close` puts the menu away.
   */
  attackMenu?: (controls: { close: () => void; fired: (action: string) => void }) => ReactNode
  /** The split's size — height, width, type — shared by its face and its dots. */
  splitClassName?: string
  /** The face's padding inside the split. */
  splitFaceClassName?: string
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
  fill = false,
  attackMenu,
  splitClassName = 'h-10 text-sm',
  splitFaceClassName = 'pl-4 pr-3',
}: BasicActionButtonsProps) {
  const { activeFlyoutAction, flyoutRootRef, dismissFlyout } = useActionFlyout(actionResult)

  // The Attack menu: open or not, and the action its last row sent, so that
  // result lands over Attack too (a Fireball's "nothing turns up" belongs to
  // the button it came from). The plain swing clears it.
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuAction, setMenuAction] = useState<string | null>(null)
  const splitRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (splitRef.current && !splitRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      moreRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])
  useEffect(() => {
    if (!attackMenu) setMenuOpen(false)
  }, [attackMenu])
  const closeMenu = () => setMenuOpen(false)
  const firedFromMenu = (sent: string) => setMenuAction(sent)
  // Rest at full HP and MP raises nothing, so it settles grey with a check like
  // a special rest does. Still clickable: the server answers why, free.
  const player = useGameStore((state) => state.player)
  const rest = restLook(player, null, null)
  const restSettled = rest.kind === 'settled' ? rest : null

  return (
    <div className={containerClassName}>
      {BASIC_ACTIONS.map(({ action, label, className }) => {
        const fromMenu = action === 'attack' && menuAction !== null && activeFlyoutAction === menuAction
        const showFlyout = activeFlyoutAction === action || fromMenu
        const settled = action === 'rest' ? restSettled : null
        const working = isLoadingRoom && (currentAction === action || (action === 'attack' && menuAction !== null && currentAction === menuAction))
        if (action === 'attack' && attackMenu) {
          // A split: the face is the plain swing, the dots open everything
          // else that hits. One colour; the dots' side a shade darker.
          return (
            <div key={action} ref={showFlyout ? flyoutRootRef : undefined} className={fill ? 'relative flex-1' : 'relative'}>
              {showFlyout && actionResult && (
                <ActionFlyout result={actionResult} anchorRef={flyoutRootRef} onDismiss={dismissFlyout} />
              )}
              <div
                ref={splitRef}
                className={`${splitClassName} ${className} ${fill ? 'w-full' : ''} relative inline-flex items-stretch rounded-lg font-medium whitespace-nowrap transition-shadow duration-200 hover:shadow-md`}
              >
                <button
                  data-action-button
                  onClick={() => {
                    setMenuAction(null)
                    setMenuOpen(false)
                    onAction(action)
                  }}
                  disabled={isLoadingRoom}
                  className={`${splitFaceClassName} inline-flex min-w-0 flex-1 items-center justify-center rounded-l-lg transition-transform duration-200 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus`}
                >
                  {working ? '...' : label}
                </button>
                <button
                  ref={moreRef}
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Every attack: strikes and spells"
                  title="Strikes and spells"
                  // No hairline: the dots' side is the same red a shade darker,
                  // deeper on hover and while the menu is open.
                  className={`flex w-6 flex-shrink-0 items-center justify-center rounded-r-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus ${
                    menuOpen ? 'bg-surface-canvas/35' : 'bg-surface-canvas/15 hover:bg-surface-canvas/25'
                  }`}
                >
                  {/* "More", not a direction: the menu rises over the ring, so an arrow either way would mislead. */}
                  <EllipsisVertical size={14} aria-hidden="true" />
                </button>
                {menuOpen && attackMenu({ close: closeMenu, fired: firedFromMenu })}
              </div>
            </div>
          )
        }
        return (
          <div key={action} ref={showFlyout ? flyoutRootRef : undefined} className={fill ? 'relative flex-1' : 'relative'}>
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
              title={settled?.title}
              aria-label={settled ? `${label}, nothing to gain` : undefined}
              className={`${sizeClassName} ${settled ? SETTLED_TONE : className} ${fill ? 'w-full' : ''} inline-flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium whitespace-nowrap transition-all duration-200 hover:shadow-md active:scale-[0.97]`}
            >
              {settled && !(isLoadingRoom && currentAction === action) && <Check size={14} className="shrink-0" />}
              {working ? '...' : label}
            </button>
          </div>
        )
      })}
    </div>
  )
}
