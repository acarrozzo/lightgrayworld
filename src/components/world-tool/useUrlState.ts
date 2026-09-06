'use client'

/**
 * Keep a piece of view state in the query string.
 *
 * The World Tool is a reference: the thing people want to do with a view is
 * send it to someone. Before this, none of it was addressable — a selected
 * Atlas room, a filtered item list and a Room Desc search all lived in
 * component state and died with the tab.
 *
 * Reads come from `useSearchParams`, writes go through `history.replaceState`
 * rather than the router. `router.replace` re-runs the server component on
 * every keystroke of a search box, which on a page like `/items` means
 * re-querying the database to render the same rows the client already has;
 * `replaceState` updates the address bar and nothing else. The trade is that
 * Back does not step through filter changes, which is the behaviour you want
 * for a filter anyway.
 *
 * A value equal to its default is removed from the URL, so the default view
 * stays a clean link.
 */

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function writeParam(key: string, value: string | null) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (value == null || value === '') url.searchParams.delete(key)
  else url.searchParams.set(key, value)
  window.history.replaceState(null, '', url)
}

/**
 * A string value mirrored into `?key=`.
 *
 * `defaultValue` is what the absence of the param means, and writing it back
 * removes the param again.
 */
export function useUrlString(
  key: string,
  defaultValue: string
): [string, (next: string) => void] {
  const params = useSearchParams()
  const fromUrl = params.get(key)
  const [value, setValue] = useState(fromUrl ?? defaultValue)

  // The URL is the source of truth on first paint and on any navigation that
  // replaces the params (a pasted link, a cross-page link into this view).
  useEffect(() => {
    setValue(fromUrl ?? defaultValue)
  }, [fromUrl, defaultValue])

  const set = useCallback(
    (next: string) => {
      setValue(next)
      writeParam(key, next === defaultValue ? null : next)
    },
    [key, defaultValue]
  )

  return [value, set]
}

/** A value constrained to a known set; anything else in the URL is ignored. */
export function useUrlEnum<T extends string>(
  key: string,
  allowed: readonly T[],
  defaultValue: T
): [T, (next: T) => void] {
  const params = useSearchParams()
  const raw = params.get(key)
  const fromUrl = raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : null
  const [value, setValue] = useState<T>(fromUrl ?? defaultValue)

  useEffect(() => {
    setValue(fromUrl ?? defaultValue)
  }, [fromUrl, defaultValue])

  const set = useCallback(
    (next: T) => {
      setValue(next)
      writeParam(key, next === defaultValue ? null : next)
    },
    [key, defaultValue]
  )

  return [value, set]
}

/** A boolean mirrored as `?key=1`; absent means false. */
export function useUrlFlag(key: string, defaultValue = false): [boolean, (next: boolean) => void] {
  const params = useSearchParams()
  const raw = params.get(key)
  const fromUrl = raw == null ? null : raw === '1' || raw === 'true'
  const [value, setValue] = useState(fromUrl ?? defaultValue)

  useEffect(() => {
    setValue(fromUrl ?? defaultValue)
  }, [fromUrl, defaultValue])

  const set = useCallback(
    (next: boolean) => {
      setValue(next)
      writeParam(key, next === defaultValue ? null : next ? '1' : '0')
    },
    [key, defaultValue]
  )

  return [value, set]
}
