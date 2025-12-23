'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useTimelineStore } from '@/store/timelineStore'

type FilterType = 'all' | 'room' | 'world' | 'action'

type UnifiedFeedPanelProps = {
  currentRoomId?: string
  isConnected?: boolean
  onClose?: () => void
}

const DEFAULT_VISIBLE = 200
const LOAD_MORE_STEP = 50

export default function UnifiedFeedPanel({ currentRoomId, isConnected, onClose }: UnifiedFeedPanelProps) {
  const entries = useTimelineStore((state) => state.entries)
  const [filter, setFilter] = useState<FilterType>('all')
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const filteredEntries = useMemo(() => {
    const filtered = entries.filter((entry) => {
      if (filter === 'all') return true
      if (filter === 'world') return entry.type === 'world'
      if (filter === 'action') return entry.type === 'action'
      if (filter === 'room') {
        return entry.type === 'room' && (!currentRoomId || entry.roomId === currentRoomId)
      }
      return true
    })

    return filtered.sort((a, b) => a.ts - b.ts)
  }, [entries, filter, currentRoomId])

  const visibleEntries = useMemo(() => {
    const start = Math.max(filteredEntries.length - visibleCount, 0)
    return filteredEntries.slice(start)
  }, [filteredEntries, visibleCount])

  const canLoadMore = visibleCount < filteredEntries.length

  const scrollToBottom = useCallback(() => {
    const container = listRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }
  }, [])

  const handleScroll = useCallback(() => {
    const container = listRef.current
    if (!container) return

    const distanceFromBottom = container.scrollHeight - (container.scrollTop + container.clientHeight)
    const nearBottom = distanceFromBottom < 120
    setIsNearBottom(nearBottom)
    if (nearBottom) {
      setUnreadCount(0)
    }
  }, [])

  useEffect(() => {
    const container = listRef.current
    if (!container) return
    container.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Auto-scroll when new entries arrive if user is near bottom
  const prevLengthRef = useRef(entries.length)
  useEffect(() => {
    const container = listRef.current
    const prevLength = prevLengthRef.current
    prevLengthRef.current = entries.length
    if (!container) return

    if (entries.length > prevLength) {
      if (isNearBottom) {
        scrollToBottom()
      } else {
        setUnreadCount((count) => count + (entries.length - prevLength))
      }
    }
  }, [entries.length, isNearBottom, scrollToBottom])

  const handleFilterChange = (next: FilterType) => {
    setFilter(next)
    setVisibleCount(DEFAULT_VISIBLE)
    requestAnimationFrame(scrollToBottom)
  }

  const handleLoadMore = () => {
    if (!canLoadMore) return
    setVisibleCount((prev) => prev + LOAD_MORE_STEP)
    setIsMenuOpen(false)
  }

  useEffect(() => {
    if (!isMenuOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isMenuOpen])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60 bg-gray-900/80">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-100">Timeline</span>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              className="lg:hidden px-2 py-1 text-gray-400 hover:text-white rounded-md hover:bg-gray-800/60 transition-colors"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-2 flex flex-wrap items-center gap-2 border-b border-gray-800/60 bg-gray-900/70">
        {(['all', 'room', 'world', 'action'] as FilterType[]).map((key) => (
          <button
            key={key}
            onClick={() => handleFilterChange(key)}
            className={`px-3 py-1.5 text-xs rounded-md border ${
              filter === key
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'
            }`}
          >
            {key === 'action' ? 'Actions' : key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}

        <div ref={menuRef} className="ml-auto relative">
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="px-2 py-1.5 text-lg leading-none rounded-md border bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-label="More timeline actions"
          >
            ⋮
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-md border border-gray-800 bg-gray-900/95 shadow-lg shadow-black/40 p-2 z-10">
              <button
                onClick={handleLoadMore}
                disabled={!canLoadMore}
                className={`w-full px-3 py-1.5 text-xs rounded-md border ${
                  canLoadMore
                    ? 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'
                    : 'bg-gray-800/60 text-gray-500 border-gray-800 cursor-not-allowed'
                }`}
              >
                Load previous 50
              </button>
            </div>
          )}
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 pb-8 space-y-3 bg-gray-950/80">
        {visibleEntries.length === 0 ? (
          <div className="text-center text-sm text-gray-500 py-8">No entries yet.</div>
        ) : (
          visibleEntries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3">
              <span className="text-[11px] text-gray-500 whitespace-nowrap">
                {new Date(entry.ts).toLocaleTimeString()}
              </span>
              <span className="text-sm text-gray-200 leading-relaxed break-words">{entry.text}</span>
            </div>
          ))
        )}
      </div>

      {!isNearBottom && unreadCount > 0 && (
        <div className="p-3 border-t border-gray-800/60 bg-gray-900/80 flex items-center justify-between">
          <span className="text-xs text-gray-300">
            {unreadCount === 1 ? '1 new message' : `${unreadCount} new messages`}
          </span>
          <button
            onClick={scrollToBottom}
            className="px-3 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
          >
            Jump to latest
          </button>
        </div>
      )}
    </div>
  )
}

