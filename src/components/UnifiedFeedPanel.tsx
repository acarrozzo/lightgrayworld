'use client'

import { useEffect, useMemo, useRef, useState, useCallback, type FormEvent, type RefObject } from 'react'
import { AlertTriangle, Globe, MessageSquare, Sparkles, type LucideIcon } from 'lucide-react'
import { useTimelineStore, type TimelineEntry } from '@/store/timelineStore'

type FilterType = 'all' | 'room' | 'world' | 'action'

type UnifiedFeedPanelProps = {
  currentRoomId?: string
  isConnected?: boolean
  onClose?: () => void
  customAction: string
  onCustomActionChange: (value: string) => void
  onCustomActionSubmit: (event: FormEvent<HTMLFormElement>) => void
  isLoadingRoom?: boolean
  customActionInputRef?: RefObject<HTMLInputElement | null>
}

type TimelineSettings = {
  showTimestamps: boolean
  compactMode: boolean
  groupRepeats: boolean
}

type RenderEntry = {
  entry: TimelineEntry
  count: number
}

type CategoryStyle = {
  label: string
  icon: LucideIcon
  badgeClass: string
  barClass: string
}

const TIMELINE_TOGGLES: { key: keyof TimelineSettings; label: string }[] = [
  { key: 'showTimestamps', label: 'Show timestamps' },
  { key: 'compactMode', label: 'Compact mode' },
  { key: 'groupRepeats', label: 'Group repeats' },
]

const CATEGORY_STYLES: Record<'room' | 'world' | 'action', CategoryStyle> = {
  room: {
    label: 'ROOM',
    icon: MessageSquare,
    badgeClass: 'border-indigo-400/70 bg-indigo-600/30 text-indigo-100',
    barClass: 'bg-indigo-500',
  },
  world: {
    label: 'WORLD',
    icon: Globe,
    badgeClass: 'border-emerald-400/70 bg-emerald-600/25 text-emerald-100',
    barClass: 'bg-emerald-500',
  },
  action: {
    label: 'ACT',
    icon: Sparkles,
    badgeClass: 'border-amber-400/70 bg-amber-600/25 text-amber-100',
    barClass: 'bg-amber-400',
  },
}

const ERROR_STYLE: CategoryStyle = {
  label: 'ERR',
  icon: AlertTriangle,
  badgeClass: 'border-red-500/70 bg-red-700/25 text-red-200',
  barClass: 'bg-red-500',
}

const createDefaultSettings = (): TimelineSettings => ({
  showTimestamps: true,
  compactMode: false,
  groupRepeats: false,
})

const getSettingsKey = (userId?: string | null) => (userId ? `timeline-settings:${userId}` : null)

const canGroupEntries = (a: TimelineEntry, b: TimelineEntry) => {
  return (
    a.type === b.type &&
    (a.level ?? 'info') === (b.level ?? 'info') &&
    (a.roomId ?? null) === (b.roomId ?? null) &&
    (a.actor ?? null) === (b.actor ?? null) &&
    Boolean(a.isSelf) === Boolean(b.isSelf) &&
    (a.message ?? a.text ?? '') === (b.message ?? b.text ?? '')
  )
}

const getEntryStyle = (entry: TimelineEntry): CategoryStyle => {
  if (entry.level === 'error') {
    return ERROR_STYLE
  }
  return CATEGORY_STYLES[entry.type]
}

const DEFAULT_VISIBLE = 200
const LOAD_MORE_STEP = 50

export default function UnifiedFeedPanel({
  currentRoomId,
  isConnected,
  onClose,
  customAction,
  onCustomActionChange,
  onCustomActionSubmit,
  isLoadingRoom,
  customActionInputRef,
}: UnifiedFeedPanelProps) {
  const entries = useTimelineStore((state) => state.entries)
  const userId = useTimelineStore((state) => state.userId)
  const [filter, setFilter] = useState<FilterType>('all')
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [settings, setSettings] = useState<TimelineSettings>(() => createDefaultSettings())
  const [settingsHydrated, setSettingsHydrated] = useState(false)
  const settingsKey = useMemo(() => getSettingsKey(userId), [userId])
  const iconSize = settings.compactMode ? 12 : 14

  useEffect(() => {
    if (!settingsKey) {
      setSettings(createDefaultSettings())
      setSettingsHydrated(false)
      return
    }

    try {
      const stored = localStorage.getItem(settingsKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (typeof parsed === 'object' && parsed !== null) {
          setSettings({ ...createDefaultSettings(), ...parsed })
          setSettingsHydrated(true)
          return
        }
      }
    } catch {
      // ignore parse errors and fall back to defaults
    }

    setSettings(createDefaultSettings())
    setSettingsHydrated(true)
  }, [settingsKey])

  useEffect(() => {
    if (!settingsKey || !settingsHydrated) return
    localStorage.setItem(settingsKey, JSON.stringify(settings))
  }, [settings, settingsKey, settingsHydrated])

  const handleToggleSetting = (key: keyof TimelineSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const filteredEntries = useMemo(() => {
    const filtered = entries.filter((entry) => {
      if (filter === 'all') return true
      if (filter === 'world') return entry.type === 'world'
      if (filter === 'action') return entry.type === 'action'
      if (filter === 'room') {
        if (!currentRoomId) return false
        return entry.type === 'room' && entry.roomId === currentRoomId
      }
      return true
    })

    return filtered.sort((a, b) => a.ts - b.ts)
  }, [entries, filter, currentRoomId])

  const visibleEntries = useMemo(() => {
    const start = Math.max(filteredEntries.length - visibleCount, 0)
    return filteredEntries.slice(start)
  }, [filteredEntries, visibleCount])

  const renderEntries = useMemo<RenderEntry[]>(() => {
    if (!visibleEntries.length) return []
    if (!settings.groupRepeats) {
      return visibleEntries.map((entry) => ({ entry, count: 1 }))
    }

    const grouped: RenderEntry[] = []
    for (const entry of visibleEntries) {
      const normalizedEntry = entry.message ? entry : { ...entry, message: entry.message ?? entry.text ?? '' }
      const lastGroup = grouped[grouped.length - 1]
      if (lastGroup && canGroupEntries(lastGroup.entry, normalizedEntry)) {
        lastGroup.count += 1
        lastGroup.entry = normalizedEntry
      } else {
        grouped.push({ entry: normalizedEntry, count: 1 })
      }
    }
    return grouped
  }, [visibleEntries, settings.groupRepeats])

  const canLoadMore = visibleCount < filteredEntries.length
  const trimmedCustomAction = customAction.trim()
  const showUnreadNotice = !isNearBottom && unreadCount > 0
  const isSubmitDisabled = Boolean(isLoadingRoom) || trimmedCustomAction.length === 0

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

      <div className="px-4 py-2 border-b border-gray-800/60 bg-gray-900/70 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'room', 'world', 'action'] as FilterType[]).map((key) => (
            <button
              key={key}
              onClick={() => handleFilterChange(key)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
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

        <div className="flex flex-wrap items-center gap-2">
          {TIMELINE_TOGGLES.map(({ key, label }) => {
            const active = settings[key]
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => handleToggleSetting(key)}
                className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                  active
                    ? 'bg-gray-800 text-white border-indigo-400/70'
                    : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-gray-200'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 pb-8 space-y-2 bg-gray-950/80">
        {renderEntries.length === 0 ? (
          <div className="text-center text-sm text-gray-500 py-8">No entries yet.</div>
        ) : (
          renderEntries.map(({ entry, count }, index) => {
            const style = getEntryStyle(entry)
            const messageText = entry.message ?? entry.text ?? ''
            const isChat = entry.type === 'room' || entry.type === 'world'
            const actorLabel = entry.isSelf ? 'You' : entry.actor || 'Unknown'
            const contentSize = settings.compactMode ? 'text-[13px]' : 'text-sm'
            const rowPadding = settings.compactMode ? 'py-1.5 pr-3 pl-5' : 'py-2.5 pr-4 pl-6'

            return (
              <div
                key={`${entry.id}-${index}`}
                className={`relative border border-gray-800/70 rounded-lg bg-gray-900/60 ${rowPadding}`}
              >
                <span className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${style.barClass}`} aria-hidden />
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400">
                    <span
                      className={`flex items-center gap-1 font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${style.badgeClass} ${
                        entry.isSelf ? 'ring-1 ring-white/60' : ''
                      }`}
                    >
                      <style.icon size={iconSize} className="shrink-0" />
                      {style.label}
                    </span>
                    {settings.showTimestamps && (
                      <span className="text-gray-500 whitespace-nowrap">
                        {new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    )}
                    {count > 1 && (
                      <span className="text-gray-400 font-medium whitespace-nowrap">×{count}</span>
                    )}
                  </div>
                  <div className={`flex flex-wrap items-center gap-1 leading-relaxed break-words ${contentSize}`}>
                    {isChat ? (
                      <>
                        <span className="font-semibold text-gray-50">{actorLabel}</span>
                        <span className="text-gray-200">: {messageText}</span>
                      </>
                    ) : (
                      <span className={entry.level === 'error' ? 'text-red-200' : 'text-gray-200'}>{messageText}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="p-4 border-t border-gray-800/60 bg-gray-950/95 space-y-3">
        {showUnreadNotice && (
          <div className="flex items-center justify-between text-xs text-gray-300 bg-gray-900/80 px-3 py-2 rounded-md border border-gray-800/80">
            <span>{unreadCount === 1 ? '1 new message' : `${unreadCount} new messages`}</span>
            <button
              onClick={scrollToBottom}
              className="px-3 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
            >
              Jump to latest
            </button>
          </div>
        )}

        <form onSubmit={onCustomActionSubmit} className="flex gap-0 w-full">
          <input
            ref={customActionInputRef ?? undefined}
            type="text"
            value={customAction}
            onChange={(e) => onCustomActionChange(e.target.value)}
            placeholder="Enter action..."
            disabled={Boolean(isLoadingRoom)}
            className="flex-1 px-4 py-2 bg-gray-900/70 text-white border border-gray-700/60 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm transition-all duration-200 disabled:bg-gray-800/50 disabled:cursor-not-allowed disabled:opacity-50 min-w-0"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-r-lg whitespace-nowrap text-sm font-medium transition-all duration-200 shadow-sm hover:shadow"
          >
            Submit
          </button>
        </form>
      </div>
    </div>
  )
}

