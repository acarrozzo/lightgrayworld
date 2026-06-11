import { useEffect, useRef, useState } from 'react'

const FLYOUT_DURATION_MS = 5000

/**
 * Drives the in-room ActionFlyout: shows the latest socket-sourced action result
 * anchored to the button that triggered it, auto-dismisses after ~5s, and closes
 * on click-outside / Escape. Shared by RoomBox and RoomDisplay so both surfaces
 * behave identically.
 *
 * Usage: attach `flyoutRootRef` to the wrapper of whichever button currently
 * matches `activeFlyoutAction`, and render <ActionFlyout> inside it.
 */
export function useActionFlyout(actionResult?: {
  action?: string
  source?: string
  timestamp?: string
  data?: { showModal?: boolean } | null
}) {
  const [activeFlyoutAction, setActiveFlyoutAction] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flyoutRootRef = useRef<HTMLDivElement>(null)

  const dismissFlyout = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setActiveFlyoutAction(null)
  }

  // Show the flyout whenever a fresh socket-sourced action result arrives.
  // Skip actions that open a modal — the modal already surfaces the result.
  useEffect(() => {
    if (actionResult?.source !== 'socket' || !actionResult?.action) return
    if (actionResult?.data?.showModal === true) return
    setActiveFlyoutAction(actionResult.action)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setActiveFlyoutAction(null)
      timerRef.current = null
    }, FLYOUT_DURATION_MS)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionResult?.timestamp, actionResult?.action, actionResult?.source])

  // Dismiss on click-outside / Escape (matches ActivityTicker behavior).
  useEffect(() => {
    if (!activeFlyoutAction) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Ignore clicks on the anchor button or inside the (portaled) flyout itself.
      if (flyoutRootRef.current && flyoutRootRef.current.contains(target)) return
      if (target.closest?.('[data-action-flyout]')) return
      dismissFlyout()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissFlyout()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [activeFlyoutAction])

  return { activeFlyoutAction, flyoutRootRef, dismissFlyout }
}
