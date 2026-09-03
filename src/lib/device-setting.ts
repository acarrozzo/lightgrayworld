'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * A per-device on/off preference kept in localStorage — the gear compare box,
 * the crafting sheet's "Can make" filter. Never anything the server cares
 * about. Returns a hook; every component using it sees the same value and
 * re-renders when any of them (or another tab) flips it.
 */
export function createBooleanDeviceSetting(storageKey: string) {
  const listeners = new Set<() => void>()

  const read = (): boolean => {
    try {
      return window.localStorage.getItem(storageKey) === '1'
    } catch {
      return false
    }
  }

  const subscribe = (callback: () => void): (() => void) => {
    listeners.add(callback)
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) callback()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(callback)
      window.removeEventListener('storage', onStorage)
    }
  }

  return function useSetting(): [boolean, (enabled: boolean) => void] {
    const enabled = useSyncExternalStore(subscribe, read, () => false)
    const setEnabled = useCallback((next: boolean) => {
      try {
        window.localStorage.setItem(storageKey, next ? '1' : '0')
      } catch {
        // Storage unavailable (private mode, blocked): the toggle still works for this page load.
      }
      listeners.forEach((listener) => listener())
    }, [])
    return [enabled, setEnabled]
  }
}
