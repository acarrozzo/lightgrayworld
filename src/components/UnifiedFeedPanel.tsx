'use client'

import React, { useEffect, useMemo, useRef, useState, useCallback, type FormEvent, type RefObject } from 'react'
import { AlertTriangle, Globe, MessageSquare, Sparkles, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight, ChevronDown, ChevronUp, ChevronRight, Settings as SettingsIcon, Zap, Check, type LucideIcon } from 'lucide-react'
import { useWorldFeedStore, type WorldFeedEntry } from '@/store/worldFeedStore'
import Icon from './Icon'

type FilterType = 'all' | 'room' | 'world' | 'action'

export type InputMode = 'action' | 'room' | 'world'

type UnifiedFeedPanelProps = {
  currentRoomId?: string
  isConnected?: boolean
  onClose?: () => void
  onToggle?: () => void
  isOpen?: boolean
  onOpenSettings?: () => void
  customAction: string
  onCustomActionChange: (value: string) => void
  onCustomActionSubmit: (event: FormEvent<HTMLFormElement>, mode: InputMode) => void
  isLoadingRoom?: boolean
  customActionInputRef?: RefObject<HTMLInputElement | null>
  onUnreadCountChange?: (count: number) => void
}

type WorldFeedSettings = {
  showTimestamps: boolean
  compactMode: boolean
  groupRepeats: boolean
}

type RenderEntry = {
  entry: WorldFeedEntry
  count: number
}

type CategoryStyle = {
  label: string
  icon: LucideIcon
  barClass: string
  iconClass: string
}

const WORLD_FEED_TOGGLES: { key: keyof WorldFeedSettings; label: string }[] = [
  { key: 'showTimestamps', label: 'Show timestamps' },
  { key: 'compactMode', label: 'Compact mode' },
  { key: 'groupRepeats', label: 'Group repeats' },
]

const CATEGORY_STYLES: Record<'room' | 'world' | 'action', CategoryStyle> = {
  room: {
    label: 'ROOM',
    icon: MessageSquare,
    barClass: 'bg-indigo-500',
    iconClass: 'text-indigo-300',
  },
  world: {
    label: 'WORLD',
    icon: MessageSquare,
    barClass: 'bg-amber-300',
    iconClass: 'text-amber-300',
  },
  action: {
    label: 'ACT',
    icon: Sparkles,
    barClass: 'bg-amber-500',
    iconClass: 'text-amber-300',
  },
}

const ERROR_STYLE: CategoryStyle = {
  label: 'ERR',
  icon: AlertTriangle,
  barClass: 'bg-red-500',
  iconClass: 'text-red-300',
}

const SUCCESS_STYLE: CategoryStyle = {
  label: 'ACT',
  icon: Check,
  barClass: 'bg-green-500',
  iconClass: 'text-green-300',
}

const INFO_STYLE: CategoryStyle = {
  label: 'ACT',
  icon: Sparkles,
  barClass: 'bg-blue-500',
  iconClass: 'text-blue-300',
}

const ACTIVITY_STYLES: Record<string, CategoryStyle> = {
  login: {
    label: 'LOGIN',
    icon: Globe,
    barClass: 'bg-emerald-500',
    iconClass: 'text-emerald-300',
  },
  register: {
    label: 'NEW',
    icon: Globe,
    barClass: 'bg-emerald-500',
    iconClass: 'text-emerald-300',
  },
  return: {
    label: 'ACTIVE',
    icon: Globe,
    barClass: 'bg-emerald-500',
    iconClass: 'text-emerald-300',
  },
  logout: {
    label: 'LOGOUT',
    icon: Globe,
    barClass: 'bg-red-600',
    iconClass: 'text-red-300',
  },
  disconnect: {
    label: 'DISCONNECT',
    icon: Globe,
    barClass: 'bg-gray-500',
    iconClass: 'text-gray-500',
  },
  idle: {
    label: 'IDLE',
    icon: Globe,
    barClass: 'bg-gray-500',
    iconClass: 'text-gray-400',
  },
  'room-enter': {
    label: 'ENTER',
    icon: Zap,
    barClass: 'bg-purple-500',
    iconClass: 'text-purple-300',
  },
  'room-exit': {
    label: 'EXIT',
    icon: Zap,
    barClass: 'bg-purple-500',
    iconClass: 'text-purple-300',
  },
  'room-travel': {
    label: 'TRAVEL',
    icon: Zap,
    barClass: 'bg-purple-500',
    iconClass: 'text-purple-300',
  },
}

const ACTIVITY_LABELS: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  disconnect: 'Disconnect',
  register: 'New Player',
  idle: 'Idle',
  return: 'Active',
  'room-enter': 'Enter',
  'room-exit': 'Exit',
  'room-travel': 'Travel',
}

const ACTIVITY_TEXT_CLASSES: Record<string, string> = {
  login: 'text-emerald-200',
  register: 'text-emerald-200',
  return: 'text-emerald-200',
  logout: 'text-red-200',
  disconnect: 'text-gray-400',
  idle: 'text-gray-300',
  'room-enter': 'text-purple-200',
  'room-exit': 'text-purple-200',
  'room-travel': 'text-purple-200',
}

const DIRECTION_ICONS: Record<string, LucideIcon> = {
  north: ArrowUp,
  south: ArrowDown,
  east: ArrowRight,
  west: ArrowLeft,
  northeast: ArrowUpRight,
  northwest: ArrowUpLeft,
  southeast: ArrowDownRight,
  southwest: ArrowDownLeft,
  up: ArrowUp,
  down: ArrowDown,
}

const REVERSE_DIRECTION: Record<string, string> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
  northeast: 'southwest',
  northwest: 'southeast',
  southeast: 'northwest',
  southwest: 'northeast',
  up: 'down',
  down: 'up',
}

const createDefaultSettings = (): WorldFeedSettings => ({
  showTimestamps: true,
  compactMode: false,
  groupRepeats: false,
})

const getSettingsKey = (userId?: string | null) => (userId ? `worldFeed-settings:${userId}` : null)
const getDisplayOptionsCollapsedKey = (userId?: string | null) => (userId ? `worldFeed-displayOptionsCollapsed:${userId}` : null)
const getInputModeKey = (userId?: string | null) => (userId ? `inputMode:${userId}` : null)

const canGroupEntries = (a: WorldFeedEntry, b: WorldFeedEntry) => {
  return (
    a.type === b.type &&
    (a.level ?? 'info') === (b.level ?? 'info') &&
    (a.roomId ?? null) === (b.roomId ?? null) &&
    (a.actor ?? null) === (b.actor ?? null) &&
    Boolean(a.isSelf) === Boolean(b.isSelf) &&
    (a.message ?? a.text ?? '') === (b.message ?? b.text ?? '')
  )
}

const getEntryStyle = (entry: WorldFeedEntry): CategoryStyle => {
  if (entry.eventType) {
    const activityStyle = ACTIVITY_STYLES[entry.eventType]
    if (activityStyle) {
      return activityStyle
    }
  }

  // For action entries, check outcome first
  if (entry.type === 'action' && entry.outcome) {
    if (entry.outcome === 'success') {
      return SUCCESS_STYLE
    }
    if (entry.outcome === 'failure') {
      return ERROR_STYLE
    }
    if (entry.outcome === 'info') {
      return INFO_STYLE
    }
  }

  // Fallback to level-based styling
  if (entry.level === 'error') {
    return ERROR_STYLE
  }
  return CATEGORY_STYLES[entry.type]
}

const getMessageColorClass = (entry: WorldFeedEntry) => {
  if (entry.eventType) {
    return ACTIVITY_TEXT_CLASSES[entry.eventType] ?? 'text-gray-200'
  }
  
  // For action entries, check outcome first
  if (entry.type === 'action' && entry.outcome) {
    if (entry.outcome === 'success') {
      return 'text-green-200'
    }
    if (entry.outcome === 'failure') {
      return 'text-red-200'
    }
    if (entry.outcome === 'info') {
      return 'text-blue-200'
    }
  }
  
  return entry.level === 'error' ? 'text-red-200' : 'text-gray-200'
}

const DEFAULT_VISIBLE = 200
const LOAD_MORE_STEP = 50

export default function UnifiedFeedPanel({
  currentRoomId,
  isConnected,
  onClose,
  onToggle,
  isOpen,
  onOpenSettings,
  customAction,
  onCustomActionChange,
  onCustomActionSubmit,
  isLoadingRoom,
  customActionInputRef,
  onUnreadCountChange,
}: UnifiedFeedPanelProps) {
  const entries = useWorldFeedStore((state) => state.entries)
  const userId = useWorldFeedStore((state) => state.userId)
  const [filter, setFilter] = useState<FilterType>('all')
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const [settings, setSettings] = useState<WorldFeedSettings>(() => createDefaultSettings())
  const [settingsHydrated, setSettingsHydrated] = useState(false)
  const settingsKey = useMemo(() => getSettingsKey(userId), [userId])
  const [isDisplayOptionsCollapsed, setIsDisplayOptionsCollapsed] = useState(true)
  const [displayOptionsHydrated, setDisplayOptionsHydrated] = useState(false)
  const displayOptionsCollapsedKey = useMemo(() => getDisplayOptionsCollapsedKey(userId), [userId])
  const [inputMode, setInputMode] = useState<InputMode>('world')
  const [inputModeHydrated, setInputModeHydrated] = useState(false)
  const inputModeKey = useMemo(() => getInputModeKey(userId), [userId])
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

  useEffect(() => {
    if (!displayOptionsCollapsedKey) {
      setIsDisplayOptionsCollapsed(true)
      setDisplayOptionsHydrated(false)
      return
    }

    try {
      const stored = localStorage.getItem(displayOptionsCollapsedKey)
      if (stored !== null) {
        const parsed = JSON.parse(stored)
        if (typeof parsed === 'boolean') {
          setIsDisplayOptionsCollapsed(parsed)
          setDisplayOptionsHydrated(true)
          return
        }
      }
    } catch {
      // ignore parse errors and fall back to defaults
    }

    setIsDisplayOptionsCollapsed(true)
    setDisplayOptionsHydrated(true)
  }, [displayOptionsCollapsedKey])

  useEffect(() => {
    if (!displayOptionsCollapsedKey || !displayOptionsHydrated) return
    localStorage.setItem(displayOptionsCollapsedKey, JSON.stringify(isDisplayOptionsCollapsed))
  }, [isDisplayOptionsCollapsed, displayOptionsCollapsedKey, displayOptionsHydrated])

  useEffect(() => {
    if (!inputModeKey) {
      setInputMode('world')
      setInputModeHydrated(false)
      return
    }

    try {
      const stored = localStorage.getItem(inputModeKey)
      if (stored !== null) {
        const parsed = stored as InputMode
        if (parsed === 'action' || parsed === 'room' || parsed === 'world') {
          setInputMode(parsed)
          setInputModeHydrated(true)
          return
        }
      }
    } catch {
      // ignore parse errors and fall back to defaults
    }

    setInputMode('world')
    setInputModeHydrated(true)
  }, [inputModeKey])

  useEffect(() => {
    if (!inputModeKey || !inputModeHydrated) return
    localStorage.setItem(inputModeKey, inputMode)
  }, [inputMode, inputModeKey, inputModeHydrated])

  const handleToggleSetting = (key: keyof WorldFeedSettings) => {
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

  const scrollToTop = useCallback(() => {
    const container = listRef.current
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' })
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

  // Notify parent of unread count changes
  useEffect(() => {
    onUnreadCountChange?.(unreadCount)
  }, [unreadCount, onUnreadCountChange])

  const handleFilterChange = (next: FilterType) => {
    setFilter(next)
    setVisibleCount(DEFAULT_VISIBLE)
    requestAnimationFrame(scrollToBottom)
  }

  const handleLoadMore = () => {
    if (!canLoadMore) return
    setVisibleCount((prev) => prev + LOAD_MORE_STEP)
  }


  return (
    <div className="rightColumnInner flex flex-col h-full">
      <div className="worldFeedHeader flex items-center justify-between px-4 py-3 border-b border-gray-800/60 bg-gray-900/80">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-100">World</span>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          {!isConnected && (
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all duration-200 shadow-sm hover:shadow"
              aria-label="Refresh page"
              title="Refresh page"
            >
              Refresh
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(onToggle || onClose) && (
            <button
              onClick={onToggle || onClose}
              className="px-3 py-2 bg-transparent hover:bg-blue-500/10 border border-blue-500/40 hover:border-blue-500/60 text-blue-300 rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 flex items-center gap-2"
              title={isOpen ? 'Close' : 'Open'}
              aria-label={isOpen ? 'Close world panel' : 'Open world panel'}
            >
              {isOpen && <ChevronRight size={20} />}
            </button>
          )}
        </div>
      </div>

      <div className="worldFeedControls px-4 py-2 border-b border-gray-800/60 bg-gray-900/70 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'world', 'room', 'action'] as FilterType[]).map((key) => {
            const isActive = filter === key
            const labelMap: Record<FilterType, string> = {
              all: 'All',
              room: 'Room',
              world: 'World',
              action: 'Actions',
            }
            return (
              <button
                key={key}
                onClick={() => handleFilterChange(key)}
                className={`px-2 py-1 text-xs font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow ${
                  isActive
                    ? 'border-1 border-blue-500 hover:border-blue-400 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300'
                    : 'border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300'
                }`}
              >
                {key === 'all' && (
                  <Icon 
                    name="world" 
                    size={12} 
                    className="mr-1" 
                  />
                )}
                {labelMap[key]}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setIsDisplayOptionsCollapsed((prev) => !prev)}
            className={`ml-auto px-2 py-1.5 rounded-md border transition-colors ${
              !isDisplayOptionsCollapsed
                ? 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500'
                : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-gray-200 hover:bg-gray-800/60'
            }`}
            aria-expanded={!isDisplayOptionsCollapsed}
            aria-label="Toggle display options"
          >
            {isDisplayOptionsCollapsed ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronUp size={14} />
            )}
          </button>
        </div>

        {!isDisplayOptionsCollapsed && (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] text-gray-500 font-medium">Feed display options</div>
              <div className="flex flex-wrap items-center gap-2">
                {WORLD_FEED_TOGGLES.map(({ key, label }) => {
                  const active = settings[key]
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleToggleSetting(key)}
                      className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
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
            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] text-gray-500 font-medium">Feed actions</div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const { clear } = useWorldFeedStore.getState()
                    clear()
                  }}
                  className="text-[10px] px-2 py-1 rounded-md border transition-colors bg-gray-900/60 text-gray-400 border-gray-800 hover:text-gray-200 hover:bg-gray-800"
                >
                  Clear Feed
                </button>
                <button
                  type="button"
                  onClick={scrollToTop}
                  className="text-[10px] px-2 py-1 rounded-md border transition-colors bg-gray-900/60 text-gray-400 border-gray-800 hover:text-gray-200 hover:bg-gray-800"
                >
                  Jump to Top
                </button>
                <button
                  type="button"
                  onClick={scrollToBottom}
                  className="text-[10px] px-2 py-1 rounded-md border transition-colors bg-gray-900/60 text-gray-400 border-gray-800 hover:text-gray-200 hover:bg-gray-800"
                >
                  Jump to Bottom
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div ref={listRef} className="worldFeedEntries flex-1 overflow-y-auto p-3 pb-6 space-y-1 bg-gray-950/80">
        {canLoadMore && (
          <div className="flex justify-center items-center gap-2 py-3">
            <button
              onClick={handleLoadMore}
              className="px-4 py-2 text-sm rounded-md border bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700 transition-colors"
            >
              Load previous 50
            </button>
            <button
              onClick={scrollToBottom}
              className="px-4 py-2 text-sm rounded-md border bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700 transition-colors"
            >
              Jump to bottom
            </button>
          </div>
        )}
        {renderEntries.length === 0 ? (
          <div className="text-center text-sm text-gray-500 py-8">No entries yet.</div>
        ) : (
          renderEntries.map(({ entry, count }, index) => {
            const style = getEntryStyle(entry)
            const messageText = entry.message ?? entry.text ?? ''
            const isRoomTravel = entry.eventType === 'room-enter' || entry.eventType === 'room-exit' || entry.eventType === 'room-travel'
            const isActivity = Boolean(entry.eventType) && !isRoomTravel
            const isChat = !isActivity && !isRoomTravel && (entry.type === 'room' || entry.type === 'world')
            const actorLabel = entry.isSelf ? 'You' : entry.actor || 'Unknown'
            const contentSize = settings.compactMode ? 'text-[13px]' : 'text-sm'
            const rowPadding = settings.compactMode ? 'py-1 pr-3 pl-4' : 'py-1.5 pr-4 pl-5'
            const activityLabel = entry.eventType ? (ACTIVITY_LABELS[entry.eventType] ?? entry.eventType).toUpperCase() : null
            const messageColorClass = getMessageColorClass(entry)
            
            // Get direction icon for travel messages
            // Reverse direction for room-enter events (entered from = opposite direction)
            let directionForIcon = entry.direction
            if (isRoomTravel && entry.direction && entry.eventType === 'room-enter') {
              directionForIcon = REVERSE_DIRECTION[entry.direction] || entry.direction
            }
            const directionIcon = isRoomTravel && directionForIcon ? DIRECTION_ICONS[directionForIcon] : null
            const displayIcon = directionIcon || (isRoomTravel ? Zap : style.icon)

            return (
              <div key={`${entry.id}-${index}`} className={`relative ${rowPadding}`}>
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${style.barClass}`} aria-hidden />
                <div className="flex flex-wrap items-baseline gap-2 text-[11px] text-gray-400">
                  <span className={`flex items-center ${style.iconClass}`}>
                    {React.createElement(displayIcon, { size: iconSize, className: 'shrink-0', 'aria-hidden': 'true' })}
                    <span className="sr-only">{style.label}</span>
                  </span>

                  <div className={`flex flex-wrap items-baseline gap-1 flex-1 break-words leading-snug ${contentSize}`}>
                    {isRoomTravel ? (
                      <span className={messageColorClass}>{messageText}</span>
                    ) : isActivity ? (
                      <>
                        {activityLabel && (
                          <span className={`text-[10px] font-semibold tracking-wide uppercase ${messageColorClass}`}>
                            {activityLabel}
                          </span>
                        )}
                        <span className={messageColorClass}>{messageText}</span>
                      </>
                    ) : isChat ? (
                      <>
                        <span className="font-semibold text-gray-50">{actorLabel}</span>
                        <span className="text-gray-400">
                          {entry.type === 'room'
                            ? entry.isSelf
                              ? ' say, '
                              : ' says, '
                            : entry.isSelf
                              ? ' shout, '
                              : ' shouts, '}
                        </span>
                        <span className="text-gray-200">"{messageText}"</span>
                      </>
                    ) : (
                      <span className={messageColorClass}>{messageText}</span>
                    )}
                  </div>
                  {count > 1 && (
                    <span className="text-gray-500 font-semibold whitespace-nowrap">×{count}</span>
                  )}
                  {settings.showTimestamps && (
                    <span className="text-gray-500 whitespace-nowrap tabular-nums">
                      {new Date(entry.ts).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  )}

                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="worldFeedFooter p-4 border-t border-gray-800/60 bg-gray-950/95 space-y-3">
        {showUnreadNotice && (
          <div className="flex items-center justify-between text-xs text-gray-300 bg-gray-900/80 px-3 py-2 rounded-md border border-gray-800/80">

            <button
              onClick={scrollToBottom}
              className="px-3 py-2 w-full text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
            >
                            <span>{unreadCount === 1 ? '1 new message' : `${unreadCount} new messages`} </span>

               - Jump to latest
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {(['world', 'room', 'action'] as InputMode[]).map((mode) => {
            const isActive = inputMode === mode
            const labelMap: Record<InputMode, string> = {
              action: 'Action',
              room: 'Room Chat',
              world: 'World Chat',
            }
            const colorMap: Record<InputMode, { active: string; inactive: string }> = {
              action: {
                active: 'border-amber-500 hover:border-amber-400 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300',
                inactive: 'border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300',
              },
              room: {
                active: 'border-indigo-500 hover:border-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300',
                inactive: 'border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300',
              },
              world: {
                active: 'border-emerald-500 hover:border-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300',
                inactive: 'border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300',
              },
            }
            const colors = colorMap[mode]
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setInputMode(mode)}
                className={`px-2 py-1 text-xs font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow border-1 ${
                  isActive ? colors.active : colors.inactive
                }`}
              >
                {labelMap[mode]}
              </button>
            )
          })}
        </div>

        <form onSubmit={(e) => onCustomActionSubmit(e, inputMode)} className="flex gap-2 w-full">
          <input
            ref={customActionInputRef ?? undefined}
            type="text"
            value={customAction}
            onChange={(e) => onCustomActionChange(e.target.value)}
            placeholder={
              inputMode === 'action' 
                ? 'Enter action...' 
                : inputMode === 'room' 
                ? 'Say something...' 
                : 'Shout something...'
            }
            disabled={Boolean(isLoadingRoom)}
            className="flex-1 min-w-0 px-4 py-2.5 bg-gray-800 text-white border-2 border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 shadow-md transition-all duration-200 disabled:bg-gray-800/50 disabled:cursor-not-allowed disabled:opacity-50"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-lg whitespace-nowrap text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg hover:bg-indigo-500"
          >
            Submit
          </button>
        </form>
      </div>
    </div>
  )
}

