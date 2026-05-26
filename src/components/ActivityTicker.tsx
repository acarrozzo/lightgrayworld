'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useWorldFeedStore, type WorldFeedEntry } from '@/store/worldFeedStore'
import { useTickerStore } from '@/store/tickerStore'

const IDLE_MS = 6000
const MAX_HISTORY = 20

const entryAccent = (entry: WorldFeedEntry) => {
  if (entry.outcome === 'success') return 'bg-emerald-400'
  if (entry.outcome === 'failure' || entry.level === 'error') return 'bg-red-400'
  return 'bg-blue-400'
}

const formatRelative = (ts: number, now: number) => {
  const diff = Math.max(0, now - ts)
  if (diff < 5_000) return 'now'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  return `${Math.floor(diff / 3_600_000)}h`
}

export default function ActivityTicker() {
  const enabled = useTickerStore((state) => state.enabled)
  const entries = useWorldFeedStore((state) => state.entries)

  const [expanded, setExpanded] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [displayedId, setDisplayedId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const latest = entries.length > 0 ? entries[entries.length - 1] : null
  const latestId = latest?.id ?? null
  const latestTs = latest?.ts ?? 0

  useEffect(() => {
    if (!latestId) return
    setDisplayedId(latestId)
  }, [latestId])

  useEffect(() => {
    if (!latest) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [latest])

  useEffect(() => {
    if (!expanded) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [expanded])

  useEffect(() => {
    if (!expanded) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [expanded])

  const hasHistory = entries.length > 0
  const isIdle = !latest || now - latestTs > IDLE_MS

  const history = useMemo(() => {
    return [...entries].slice(-MAX_HISTORY).reverse()
  }, [entries])

  if (!enabled) return null

  const toggleExpanded = () => {
    if (!hasHistory) return
    setExpanded((prev) => !prev)
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full flex-shrink-0 z-30"
      aria-live="polite"
      aria-atomic="false"
    >
      <button
        type="button"
        onClick={toggleExpanded}
        disabled={!hasHistory}
        className={`
          w-full h-7
          flex items-center justify-center overflow-hidden
          border-b border-gray-800/50 bg-gray-900/85 backdrop-blur-sm
          px-3
          ${hasHistory ? 'cursor-pointer hover:bg-gray-800/85' : 'cursor-default'}
          focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/30
          transition-colors
        `}
        aria-label={expanded ? 'Collapse activity history' : 'Expand activity history'}
        aria-expanded={expanded}
      >
        {latest ? (
          <div className="flex items-center gap-2 max-w-full min-w-0">
            <span
              className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${entryAccent(latest)} ${isIdle ? 'opacity-40' : ''}`}
              aria-hidden="true"
            />
            <span
              key={displayedId ?? 'empty'}
              className={`min-w-0 truncate text-xs animate-[tickerFadeIn_0.25s_ease-out] ${isIdle ? 'text-gray-500' : 'text-gray-200'}`}
            >
              {latest.message}
            </span>
            <span className="flex-shrink-0 text-[10px] text-gray-500 tabular-nums">
              {formatRelative(latest.ts, now)}
            </span>
            {hasHistory && (
              <span className="flex-shrink-0 text-gray-500" aria-hidden="true">
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </span>
            )}
          </div>
        ) : (
          <span className="text-center text-[10px] text-gray-600 tracking-wide uppercase">
            Activity
          </span>
        )}
      </button>

      {expanded && hasHistory && (
        <div className="absolute top-full left-0 right-0 z-40 px-2 pt-1">
          <div className="mx-auto max-w-3xl rounded-b-md border border-t-0 border-gray-700/60 bg-gray-900/95 backdrop-blur-sm shadow-lg">
            <div className="max-h-64 overflow-y-auto py-1">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-2 px-3 py-1.5 text-xs text-gray-200"
                >
                  <span
                    className={`flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${entryAccent(entry)}`}
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0 whitespace-normal break-words">{entry.message}</span>
                  <span className="flex-shrink-0 mt-0.5 text-[10px] text-gray-500 tabular-nums">
                    {formatRelative(entry.ts, now)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes tickerFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
