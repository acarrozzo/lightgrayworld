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

/**
 * A per-device choice among a few strings — which tab a switch was left on.
 * `null` until the player has chosen, so the caller can apply its own first
 * default. Same storage and sharing rules as the boolean setting.
 */
export function createChoiceDeviceSetting<T extends string>(storageKey: string, allowed: readonly T[]) {
  const listeners = new Set<() => void>()

  const read = (): T | null => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : null
    } catch {
      return null
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

  return function useChoice(): [T | null, (next: T) => void] {
    const value = useSyncExternalStore(subscribe, read, () => null)
    const setValue = useCallback((next: T) => {
      try {
        window.localStorage.setItem(storageKey, next)
      } catch {
        // Storage unavailable: the choice still holds for this page load.
      }
      listeners.forEach((listener) => listener())
    }, [])
    return [value, setValue]
  }
}
