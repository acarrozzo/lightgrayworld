'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether inventory and shop rows show the "what changes if I equip this"
 * box. Off by default; toggled from the sort flyout. A per-device
 * convenience kept in localStorage, never anything the server cares about.
 */
const STORAGE_KEY = 'lg:gear-compare'
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', onStorage)
  }
}

export function useGearCompareSetting(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, read, () => false)
  const setEnabled = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      // Storage unavailable (private mode, blocked): the toggle still works for this page load.
    }
    listeners.forEach((listener) => listener())
  }, [])
  return [enabled, setEnabled]
}
