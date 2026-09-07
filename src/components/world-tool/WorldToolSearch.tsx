'use client'

/**
 * The rail's search: one box over every enemy, item, room, quest, giver,
 * skill, spell, recipe and shop.
 *
 * Before this each list page had its own search — five boxes, five
 * placeholders — and six pages had none, so "where does X come from" began
 * with guessing the page. The index is fetched once, the first time the box
 * is focused, and filtered here on every keystroke; the rail lives in the
 * layout, so the fetch survives navigation.
 *
 * A hit links to the entity's row. Within the current page the hash is
 * rewritten with `replaceState` and the row revealed directly — the router's
 * own hash handling looks for an `id`, and rows carry `data-anchor` instead.
 */

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type RefObject } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import {
  SEARCH_TYPE_LABEL,
  SEARCH_TYPE_ORDER,
  type SearchEntry,
} from '@/lib/world-tool/search-types'
import { revealAnchor } from './EntityLink'

const MAX_RESULTS = 40
const LISTBOX_ID = 'wt-search-results'

// Module-level so the index is fetched once per page load, not once per rail.
let indexPromise: Promise<SearchEntry[]> | null = null
function loadIndex(): Promise<SearchEntry[]> {
  if (!indexPromise) {
    indexPromise = fetch('/api/world-tool/search-index')
      .then((res) => {
        if (!res.ok) throw new Error(`search index ${res.status}`)
        return res.json() as Promise<{ entries: SearchEntry[] }>
      })
      .then((data) => data.entries)
      .catch((err) => {
        indexPromise = null // let the next focus try again
        throw err
      })
  }
  return indexPromise
}

const typeRank = new Map(SEARCH_TYPE_ORDER.map((t, i) => [t, i]))

/** Lower is better; negative is no match. Whole-name and prefix hits outrank substrings, names outrank ids. */
function score(e: SearchEntry, q: string): number {
  const name = e.name.toLowerCase()
  const id = e.id.toLowerCase()
  if (name === q || id === q) return 0
  if (name.startsWith(q)) return 1
  if (name.split(/\s+/).some((w) => w.startsWith(q))) return 2
  if (name.includes(q)) return 3
  if (id.includes(q)) return 4
  if (e.sub && e.sub.toLowerCase().includes(q)) return 5
  return -1
}

type Status = 'idle' | 'loading' | 'ready' | 'error'

export function useWorldToolSearch(
  query: string,
  { onPicked, onEscape }: { onPicked: () => void; onEscape: () => void }
) {
  const router = useRouter()
  const pathname = usePathname()
  const [index, setIndex] = useState<SearchEntry[] | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [cursor, setCursor] = useState(0)

  // Fetch the index. Called on focus so it is usually here before the first
  // keystroke; harmless to call again.
  const warm = useCallback(() => {
    if (status !== 'idle') return
    setStatus('loading')
    loadIndex()
      .then((entries) => {
        setIndex(entries)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [status])

  const needle = query.trim().toLowerCase()
  useEffect(() => {
    if (needle) warm()
  }, [needle, warm])
  useEffect(() => {
    setCursor(0)
  }, [needle])

  const results = useMemo(() => {
    if (!index || !needle) return []
    const scored: { e: SearchEntry; s: number }[] = []
    for (const e of index) {
      const s = score(e, needle)
      if (s >= 0) scored.push({ e, s })
    }
    scored.sort(
      (a, b) =>
        a.s - b.s ||
        (typeRank.get(a.e.type) ?? 99) - (typeRank.get(b.e.type) ?? 99) ||
        a.e.name.localeCompare(b.e.name)
    )
    return scored.slice(0, MAX_RESULTS).map((x) => x.e)
  }, [index, needle])

  const pick = useCallback(
    (entry: SearchEntry) => {
      const url = new URL(entry.href, window.location.origin)
      if (url.pathname === pathname && url.hash) {
        window.history.replaceState(null, '', entry.href)
        revealAnchor(decodeURIComponent(url.hash.slice(1)))
      } else {
        router.push(entry.href)
      }
      onPicked()
    },
    [pathname, router, onPicked]
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onEscape()
        return
      }
      if (!results.length) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => Math.min(c + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => Math.max(c - 1, 0))
      } else if (e.key === 'Enter') {
        const hit = results[cursor]
        if (hit) {
          e.preventDefault()
          pick(hit)
        }
      }
    },
    [results, cursor, pick, onEscape]
  )

  return { status, results, cursor, setCursor, pick, warm, onKeyDown, searching: needle.length > 0 }
}

type SearchState = ReturnType<typeof useWorldToolSearch>

export function SearchInput({
  value,
  onChange,
  inputRef,
  search,
}: {
  value: string
  onChange: (next: string) => void
  inputRef: RefObject<HTMLInputElement | null>
  search: SearchState
}) {
  const activeId = search.searching && search.results.length ? `${LISTBOX_ID}-${search.cursor}` : undefined
  return (
    <label className="relative block">
      <Search
        size={13}
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-fg-muted"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search the world"
        aria-expanded={search.searching}
        aria-controls={LISTBOX_ID}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder="Search…"
        onChange={(e) => onChange(e.target.value)}
        onFocus={search.warm}
        onKeyDown={search.onKeyDown}
        className="w-full rounded border border-line-subtle fill-surface-panel py-1.5 pl-7 pr-7 text-sm placeholder-fg-disabled focus:outline-none focus:ring-1 focus:ring-line-strong [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-fg-muted hover:text-fg-bright"
        >
          <X size={12} />
        </button>
      )}
    </label>
  )
}

export function SearchResults({ query, search }: { query: string; search: SearchState }) {
  const { status, results, cursor, setCursor, pick } = search
  if (status === 'error') {
    return <p className="px-3 py-4 text-xs text-status-error">The search index failed to load.</p>
  }
  if (status !== 'ready') {
    return <p className="px-3 py-4 text-xs text-fg-muted">Loading the index…</p>
  }
  if (results.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-fg-muted">
        Nothing matches <span className="text-fg-secondary">“{query.trim()}”</span>.
      </p>
    )
  }
  return (
    <ul id={LISTBOX_ID} role="listbox" aria-label="Search results" className="px-2 py-2">
      {results.map((r, i) => {
        const active = i === cursor
        return (
          <li key={`${r.type}:${r.id}`} id={`${LISTBOX_ID}-${i}`} role="option" aria-selected={active}>
            <Link
              href={r.href}
              onClick={(e) => {
                e.preventDefault()
                pick(r)
              }}
              onMouseEnter={() => setCursor(i)}
              tabIndex={-1}
              className={
                'block rounded-md px-2 py-1.5 transition-colors ' +
                (active ? 'bg-surface-hover/80 text-fg-bright' : 'text-fg-secondary hover:text-fg-bright')
              }
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-fg-muted">
                  {SEARCH_TYPE_LABEL[r.type]}
                </span>
              </span>
              {r.sub && <span className="block truncate text-[11px] text-fg-muted">{r.sub}</span>}
            </Link>
          </li>
        )
      })}
      {results.length === MAX_RESULTS && (
        <li className="px-2 pt-2 text-[11px] italic text-fg-disabled">First {MAX_RESULTS} shown — keep typing.</li>
      )}
    </ul>
  )
}
