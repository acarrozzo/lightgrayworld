'use client'

import React, { useEffect, useMemo, useRef, useState, useCallback, type FormEvent, type RefObject } from 'react'
import { AlertTriangle, Globe, MessageSquare, MessageSquareText, Mail, Sparkles, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight, ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react'
import { useWorldFeedStore, type WorldFeedEntry } from '@/store/worldFeedStore'
import { MESSAGE_MAX_LENGTH } from '@/lib/sanitization'

type FilterType = 'all' | 'chat' | 'events' | 'actions'
type ChatSubFilter = 'room-chat' | 'world-chat' | 'all-chat'
type EventsSubFilter = 'world-activity' | 'all-events'
type ActionsSubFilter = 'action-feedback' | 'movement' | 'all-actions'

export type InputMode = 'action' | 'room' | 'world'

interface FeedPanelProps {
  currentRoomId?: string
  currentRoomName?: string
  isConnected?: boolean
  onClose?: () => void
  onOpenSettings?: () => void
  customAction: string
  onCustomActionChange: (value: string) => void
  onCustomActionSubmit: (event: FormEvent<HTMLFormElement>, mode: InputMode) => void
  isLoadingRoom?: boolean
  customActionInputRef?: RefObject<HTMLInputElement | null>
  onUnreadCountChange?: (count: number) => void
  forceInputMode?: InputMode
  forceFilter?: FilterType
  forceChatSubFilter?: ChatSubFilter
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

const CATEGORY_STYLES: Record<'room' | 'world' | 'action' | 'dm', CategoryStyle> = {
  room: {
    label: 'ROOM',
    icon: MessageSquare,
    barClass: 'bg-accent',
    iconClass: 'text-accent-hover',
  },
  world: {
    label: 'WORLD',
    icon: MessageSquare,
    barClass: 'bg-channel-room',
    iconClass: 'text-channel-room',
  },
  action: {
    label: 'ACT',
    icon: Sparkles,
    barClass: 'bg-channel-action',
    iconClass: 'text-channel-action',
  },
  dm: {
    label: 'DM',
    icon: Mail,
    barClass: 'bg-stat-mag',
    iconClass: 'text-channel-dm',
  },
}

const ERROR_STYLE: CategoryStyle = {
  label: 'ERR',
  icon: AlertTriangle,
  barClass: 'bg-status-error',
  iconClass: 'text-status-error',
}

const SUCCESS_STYLE: CategoryStyle = {
  label: 'ACT',
  icon: Sparkles,
  barClass: 'bg-status-success',
  iconClass: 'text-status-success',
}

const INFO_STYLE: CategoryStyle = {
  label: 'ACT',
  icon: Sparkles,
  barClass: 'bg-resource-mp',
  iconClass: 'text-channel-world',
}

const ACTIVITY_STYLES: Record<string, CategoryStyle> = {
  login: {
    label: 'LOGIN',
    icon: Globe,
    barClass: 'bg-channel-room',
    iconClass: 'text-channel-room',
  },
  register: {
    label: 'NEW',
    icon: Globe,
    barClass: 'bg-channel-room',
    iconClass: 'text-channel-room',
  },
  return: {
    label: 'ACTIVE',
    icon: Globe,
    barClass: 'bg-channel-room',
    iconClass: 'text-channel-room',
  },
  logout: {
    label: 'LOGOUT',
    icon: Globe,
    barClass: 'bg-status-error',
    iconClass: 'text-status-error',
  },
  disconnect: {
    label: 'DISCONNECT',
    icon: Globe,
    barClass: 'bg-surface-selected',
    iconClass: 'text-fg-muted',
  },
  idle: {
    label: 'IDLE',
    icon: Globe,
    barClass: 'bg-surface-selected',
    iconClass: 'text-fg-secondary',
  },
  'room-enter': {
    label: 'ENTER',
    icon: Sparkles,
    barClass: 'bg-channel-dm',
    iconClass: 'text-channel-dm',
  },
  'room-exit': {
    label: 'EXIT',
    icon: Sparkles,
    barClass: 'bg-channel-dm',
    iconClass: 'text-channel-dm',
  },
  'room-travel': {
    label: 'TRAVEL',
    icon: Sparkles,
    barClass: 'bg-channel-dm',
    iconClass: 'text-channel-dm',
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
  login: 'text-fg-secondary',
  register: 'text-channel-room',
  return: 'text-channel-room',
  logout: 'text-status-error',
  disconnect: 'text-fg-secondary',
  idle: 'text-fg-primary',
  'room-enter': 'text-channel-dm',
  'room-exit': 'text-channel-dm',
  'room-travel': 'text-channel-dm',
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
    return ACTIVITY_TEXT_CLASSES[entry.eventType] ?? 'text-fg-bright'
  }
  
  // For action entries, check outcome first
  if (entry.type === 'action' && entry.outcome) {
    if (entry.outcome === 'success') {
      return 'text-status-success'
    }
    if (entry.outcome === 'failure') {
      return 'text-status-error'
    }
    if (entry.outcome === 'info') {
      return 'text-resource-mp'
    }
  }
  
  return entry.level === 'error' ? 'text-status-error' : 'text-fg-bright'
}

const getEntryCategory = (entry: WorldFeedEntry): 'chat' | 'event' | 'action' => {
  const isRoomTravel = entry.eventType === 'room-enter' || entry.eventType === 'room-exit' || entry.eventType === 'room-travel'
  const isActivity = Boolean(entry.eventType) && !isRoomTravel
  const isChat = !isActivity && !isRoomTravel && (entry.type === 'room' || entry.type === 'world')
  
  if (isChat) return 'chat'
  if (isActivity) return 'event'
  return 'action' // includes action feedback and movement
}

const formatTimestamp = (timestamp: number): string => {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  
  // Show relative time if less than 1 hour ago
  if (diffMinutes < 60) {
    if (diffMinutes < 1) {
      return 'just now'
    }
    return `${diffMinutes}m ago`
  }
  
  // Show absolute time for older messages
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const DEFAULT_VISIBLE = 200
const LOAD_MORE_STEP = 50

export default function FeedPanel({
  currentRoomId,
  currentRoomName,
  isConnected,
  onClose,
  onOpenSettings,
  customAction,
  onCustomActionChange,
  onCustomActionSubmit,
  isLoadingRoom,
  customActionInputRef,
  onUnreadCountChange,
  forceInputMode,
  forceFilter,
  forceChatSubFilter,
}: FeedPanelProps) {
  const entries = useWorldFeedStore((state) => state.entries)
  const userId = useWorldFeedStore((state) => state.userId)
  const [filter, setFilter] = useState<FilterType>('all')
  const [chatSubFilter, setChatSubFilter] = useState<ChatSubFilter>('all-chat')
  const [eventsSubFilter, setEventsSubFilter] = useState<EventsSubFilter>('all-events')
  const [actionsSubFilter, setActionsSubFilter] = useState<ActionsSubFilter>('all-actions')
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [isScrollable, setIsScrollable] = useState(false)
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

  // Handle forceInputMode prop - override stored value when provided
  useEffect(() => {
    if (forceInputMode && (forceInputMode === 'action' || forceInputMode === 'room' || forceInputMode === 'world')) {
      setInputMode(forceInputMode)
      if (inputModeKey) {
        localStorage.setItem(inputModeKey, forceInputMode)
      }
    }
  }, [forceInputMode, inputModeKey])

  // Handle forceFilter prop - override stored value when provided
  useEffect(() => {
    if (forceFilter && (forceFilter === 'all' || forceFilter === 'chat' || forceFilter === 'events' || forceFilter === 'actions')) {
      setFilter(forceFilter)
      if (forceFilter === 'chat' && forceChatSubFilter) {
        setChatSubFilter(forceChatSubFilter)
      }
    }
  }, [forceFilter, forceChatSubFilter])

  const handleToggleSetting = (key: keyof WorldFeedSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const filteredEntries = useMemo(() => {
    const filtered = entries.filter((entry) => {
      if (filter === 'all') return true
      
      if (filter === 'chat') {
        // Chat messages: type === 'room'|'world' AND no eventType
        const isChat = !entry.eventType && (entry.type === 'room' || entry.type === 'world')
        if (!isChat) return false
        
        if (chatSubFilter === 'all-chat') return true
        if (chatSubFilter === 'room-chat') {
          // Show all room chat messages (from all rooms), not just current room
          return entry.type === 'room'
        }
        if (chatSubFilter === 'world-chat') {
          return entry.type === 'world'
        }
        return false
      }
      
      if (filter === 'events') {
        // Events: type === 'world' AND eventType exists (world activity)
        const isEvent = entry.type === 'world' && Boolean(entry.eventType)
        if (!isEvent) return false
        
        if (eventsSubFilter === 'all-events' || eventsSubFilter === 'world-activity') {
          return true
        }
        return false
      }
      
      if (filter === 'actions') {
        // Actions: type === 'action' OR (type === 'room' AND eventType === room movement)
        const isActionFeedback = entry.type === 'action'
        const isMovement = (entry.type === 'room' && (entry.eventType === 'room-enter' || entry.eventType === 'room-exit' || entry.eventType === 'room-travel')) ||
                          (entry.type === 'action' && entry.eventType === 'room-travel')
        const isAction = isActionFeedback || isMovement
        
        if (!isAction) return false
        
        if (actionsSubFilter === 'all-actions') return true
        if (actionsSubFilter === 'action-feedback') {
          return isActionFeedback && entry.eventType !== 'room-travel'
        }
        if (actionsSubFilter === 'movement') {
          return isMovement
        }
        return false
      }
      
      return true
    })

    return filtered.sort((a, b) => a.ts - b.ts)
  }, [entries, filter, currentRoomId, chatSubFilter, eventsSubFilter, actionsSubFilter])

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
  const showUnreadNotice = !isNearBottom && unreadCount > 0 && isScrollable
  
  // Character count validation for chat modes
  const isChatMode = inputMode === 'world' || inputMode === 'room'
  const charCount = customAction.length
  const isOverLimit = isChatMode && charCount > MESSAGE_MAX_LENGTH
  const isSubmitDisabled = Boolean(isLoadingRoom) || trimmedCustomAction.length === 0 || isOverLimit

  const handleScroll = useCallback(() => {
    const container = listRef.current
    if (!container) return

    const hasOverflow = container.scrollHeight > container.clientHeight
    setIsScrollable(hasOverflow)

    const distanceFromBottom = container.scrollHeight - (container.scrollTop + container.clientHeight)
    const nearBottom = distanceFromBottom < 120
    setIsNearBottom(nearBottom)
    if (nearBottom) {
      setUnreadCount(0)
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    const container = listRef.current
    if (container) {
      // Immediately reset unread count when jumping to bottom
      setUnreadCount(0)
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
      // Ensure scroll handler runs after smooth scroll completes
      setTimeout(() => {
        handleScroll()
      }, 300)
    }
  }, [handleScroll])

  const scrollToTop = useCallback(() => {
    const container = listRef.current
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    const container = listRef.current
    if (!container) return
    container.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Scroll to bottom on initial mount
  useEffect(() => {
    requestAnimationFrame(() => {
      const container = listRef.current
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    })
  }, [])

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
        // Get new entries
        const newEntries = entries.slice(prevLength)
        // Filter to only chat messages (world/room without eventType)
        const chatMessages = newEntries.filter(
          (entry) => (entry.type === 'world' || entry.type === 'room') && !entry.eventType
        )
        // Only increment badge for chat messages
        setUnreadCount((count) => count + chatMessages.length)
      }
    }
  }, [entries.length, isNearBottom, scrollToBottom])

  // Notify parent of unread count changes
  useEffect(() => {
    onUnreadCountChange?.(unreadCount)
  }, [unreadCount, onUnreadCountChange])

  // Update scrollability when visible content changes
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      handleScroll()
    })
  }, [visibleEntries, handleScroll])

  const handleFilterChange = (next: FilterType) => {
    setFilter(next)
    // Reset sub-filters to defaults when top-level filter changes
    if (next === 'chat') {
      setChatSubFilter('all-chat')
    } else if (next === 'events') {
      setEventsSubFilter('all-events')
    } else if (next === 'actions') {
      setActionsSubFilter('all-actions')
    }
    setVisibleCount(DEFAULT_VISIBLE)
    requestAnimationFrame(scrollToBottom)
  }

  const handleLoadMore = () => {
    if (!canLoadMore) return
    setVisibleCount((prev) => prev + LOAD_MORE_STEP)
  }

  return (
    <div className="relative w-full h-full flex flex-col">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-fg-secondary hover:text-fg-bright transition-colors duration-200 rounded-lg hover:bg-surface-raised/50"
          title="Close"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}

      <div className="worldFeedControls px-4 py-2 border-b border-line-subtle/60 bg-surface-panel/70 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'chat', 'events', 'actions'] as FilterType[]).map((key) => {
            const isActive = filter === key
            const labelMap: Record<FilterType, string> = {
              all: 'All',
              chat: 'Chat',
              events: 'Events',
              actions: 'Actions',
            }
            const iconMap: Record<FilterType, LucideIcon | null> = {
              all: Globe,
              chat: MessageSquare,
              events: Globe,
              actions: Sparkles,
            }
            const IconComponent = iconMap[key]
            return (
              <button
                key={key}
                onClick={() => handleFilterChange(key)}
                className={`px-2 py-1 text-xs font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow ${
                  isActive
                    ? 'border-1 border-resource-mp/80 hover:border-resource-mp bg-resource-mp/10 hover:bg-resource-mp/20 text-channel-world'
                    : 'border-1 border-line-strong/80 hover:border-line-strong bg-transparent hover:bg-surface-raised/30 text-fg-secondary hover:text-fg-primary'
                }`}
              >
                {IconComponent && (
                  <IconComponent 
                    size={12} 
                    className="mr-1 shrink-0" 
                    aria-hidden="true"
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
                ? 'fill-accent border-accent hover:bg-accent-hover'
                : 'fill-surface-panel text-fg-secondary border-line-subtle hover: hover:bg-surface-raised/60'
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

        {/* Sub-filters */}
        {filter === 'chat' && (
          <div className="flex flex-wrap items-center gap-2 pl-2 border-l-2 border-accent/25">
            {(['all-chat', 'world-chat', 'room-chat'] as ChatSubFilter[]).map((subKey) => {
              const isActive = chatSubFilter === subKey
              const labelMap: Record<ChatSubFilter, string> = {
                'all-chat': 'All Chat',
                'room-chat': 'Room',
                'world-chat': 'World',
              }
              return (
                <button
                  key={subKey}
                  onClick={() => {
                    setChatSubFilter(subKey)
                    setVisibleCount(DEFAULT_VISIBLE)
                    requestAnimationFrame(scrollToBottom)
                  }}
                  className={`px-2 py-1 text-[10px] font-medium transition-all duration-200 flex items-center justify-center relative rounded-md ${
                    isActive
                      ? 'border-1 border-accent hover:border-accent-hover bg-accent/10 hover:bg-accent/20 text-accent-hover'
                      : 'border-1 border-line-subtle hover:border-line-strong bg-transparent hover:bg-surface-raised/30 text-fg-muted hover:text-fg-secondary'
                  }`}
                >
                  {labelMap[subKey]}
                </button>
              )
            })}
          </div>
        )}

        {filter === 'events' && (
          <div className="flex flex-wrap items-center gap-2 pl-2 border-l-2 border-channel-action/30">
            {(['all-events', 'world-activity'] as EventsSubFilter[]).map((subKey) => {
              const isActive = eventsSubFilter === subKey
              const labelMap: Record<EventsSubFilter, string> = {
                'all-events': 'All Events',
                'world-activity': 'World Activity',
              }
              return (
                <button
                  key={subKey}
                  onClick={() => {
                    setEventsSubFilter(subKey)
                    setVisibleCount(DEFAULT_VISIBLE)
                    requestAnimationFrame(scrollToBottom)
                  }}
                  className={`px-2 py-1 text-[10px] font-medium transition-all duration-200 flex items-center justify-center relative rounded-md ${
                    isActive
                      ? 'border-1 border-channel-action/80 hover:border-channel-action bg-channel-action/10 hover:bg-channel-action/20 text-channel-action'
                      : 'border-1 border-line-subtle hover:border-line-strong bg-transparent hover:bg-surface-raised/30 text-fg-muted hover:text-fg-secondary'
                  }`}
                >
                  {labelMap[subKey]}
                </button>
              )
            })}
          </div>
        )}

        {filter === 'actions' && (
          <div className="flex flex-wrap items-center gap-2 pl-2 border-l-2 border-channel-action/30">
            {(['all-actions', 'action-feedback', 'movement'] as ActionsSubFilter[]).map((subKey) => {
              const isActive = actionsSubFilter === subKey
              const labelMap: Record<ActionsSubFilter, string> = {
                'all-actions': 'All Actions',
                'action-feedback': 'Feedback',
                'movement': 'Movement',
              }
              return (
                <button
                  key={subKey}
                  onClick={() => {
                    setActionsSubFilter(subKey)
                    setVisibleCount(DEFAULT_VISIBLE)
                    requestAnimationFrame(scrollToBottom)
                  }}
                  className={`px-2 py-1 text-[10px] font-medium transition-all duration-200 flex items-center justify-center relative rounded-md ${
                    isActive
                      ? 'border-1 border-channel-action/80 hover:border-channel-action bg-channel-action/10 hover:bg-channel-action/20 text-channel-action'
                      : 'border-1 border-line-subtle hover:border-line-strong bg-transparent hover:bg-surface-raised/30 text-fg-muted hover:text-fg-secondary'
                  }`}
                >
                  {labelMap[subKey]}
                </button>
              )
            })}
          </div>
        )}

        {!isDisplayOptionsCollapsed && (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] text-fg-muted font-medium">Feed display options</div>
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
                          ? 'fill-surface-raised border-accent-hover/70'
                          : 'fill-surface-panel text-fg-secondary border-line-subtle hover:'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] text-fg-muted font-medium">Feed actions</div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const { clear } = useWorldFeedStore.getState()
                    clear()
                  }}
                  className="text-[10px] px-2 py-1 rounded-md border transition-colors fill-surface-panel text-fg-secondary border-line-subtle hover: hover:bg-surface-raised"
                >
                  Clear Feed
                </button>
                <button
                  type="button"
                  onClick={scrollToTop}
                  className="text-[10px] px-2 py-1 rounded-md border transition-colors fill-surface-panel text-fg-secondary border-line-subtle hover: hover:bg-surface-raised"
                >
                  Jump to Top
                </button>
                <button
                  type="button"
                  onClick={scrollToBottom}
                  className="text-[10px] px-2 py-1 rounded-md border transition-colors fill-surface-panel text-fg-secondary border-line-subtle hover: hover:bg-surface-raised"
                >
                  Jump to Bottom
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="relative flex flex-col flex-1 min-h-0">
      <div ref={listRef} className={`worldFeedEntries flex-1 overflow-y-auto pb-6 bg-surface-canvas/80 ${
        filter === 'chat' && chatSubFilter === 'room-chat' ? 'px-3 pt-2' : 'px-2 pt-1'
      }`}>
        {canLoadMore && (
          <div className="flex justify-center items-center gap-2 py-3">
            <button
              onClick={handleLoadMore}
              className="px-4 py-2 text-sm rounded-md border fill-surface-raised border-line-subtle hover:bg-surface-hover transition-colors"
            >
              Load previous 50
            </button>
            <button
              onClick={scrollToBottom}
              className="px-4 py-2 text-sm rounded-md transition-colors fill-accent hover:bg-accent-hover border-transparent shadow-sm hover:shadow"
            >
              Jump to bottom
            </button>
          </div>
        )}
        {renderEntries.length === 0 ? (
          <div className="text-center text-sm text-fg-muted py-8">No entries yet.</div>
        ) : (
          renderEntries.map((item, index) => {
            const { entry, count } = item
            const style = getEntryStyle(entry)
            const messageText = entry.message ?? entry.text ?? ''
            const isRoomTravel = entry.eventType === 'room-enter' || entry.eventType === 'room-exit' || entry.eventType === 'room-travel'
            const isActivity = Boolean(entry.eventType) && !isRoomTravel
            const isChat = !isActivity && !isRoomTravel && (entry.type === 'room' || entry.type === 'world')
            const actorLabel = entry.actor || 'Unknown'
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
            const displayIcon = directionIcon || (isRoomTravel ? Sparkles : style.icon)

            // Get entry category for visual styling
            const entryCategory = getEntryCategory(entry)
            
            // Flat single-line chat rendering — matches ActivityTicker format
            if (isChat) {
              const isWorldChat = entry.type === 'world'
              const isCurrentRoom = !isWorldChat && entry.roomId === currentRoomId
              const isOtherRoom = !isWorldChat && !isCurrentRoom
              const speaker = entry.isSelf ? `${actorLabel} (you)` : actorLabel
              const verb = isWorldChat ? 'shouts' : 'says'
              const roomTag = !isWorldChat && entry.roomId ? ` (${entry.roomId})` : ''
              const dotColor = isWorldChat ? 'bg-status-success' : 'bg-stat-mag'
              const messageColor = isWorldChat ? 'text-status-success' : 'text-channel-dm'
              const opacityClass = isOtherRoom ? 'opacity-70' : ''

              return (
                <div
                  key={`${entry.id}-${index}`}
                  className={`flex items-start gap-2 ${rowPadding} ${opacityClass} group`}
                >
                  <span
                    className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${dotColor}`}
                    aria-hidden
                  />
                  <span
                    className={`flex-1 min-w-0 ${contentSize} font-mono text-fg-bright break-words leading-tight`}
                  >
                    {speaker} {verb}
                    {roomTag}: <span className={messageColor}>{messageText}</span>
                  </span>
                  {settings.showTimestamps && (
                    <span className="shrink-0 mt-0.5 text-[10px] text-fg-muted tabular-nums font-mono whitespace-nowrap">
                      {formatTimestamp(entry.ts)}
                    </span>
                  )}
                  {count > 1 && (
                    <span className="shrink-0 mt-0.5 text-[10px] text-fg-muted font-mono font-semibold whitespace-nowrap">
                      ×{count}
                    </span>
                  )}
                </div>
              )
            }
            
            // Non-chat entries (events, actions) - terminal-style with modern influence
            const isEvent = entryCategory === 'event'
            const isAction = entryCategory === 'action'
            const terminalPadding = settings.compactMode ? 'py-0.5 pr-2 pl-3' : 'py-1 pr-3 pl-4'
            const categoryBgClass = isEvent
              ? 'bg-surface-raised/30' 
              : isAction
              ? 'bg-surface-panel/40'
              : 'bg-transparent'

            return (
              <div key={`${entry.id}-${index}`} className={`relative ${terminalPadding} ${categoryBgClass} group mb-1`}>
                <span className={`absolute left-0 top-0 bottom-0 w-0.5 ${style.barClass}`} aria-hidden />
                <div className="flex flex-wrap items-baseline gap-1.5 text-[11px]">
                  <span className={`flex items-center ${style.iconClass} shrink-0`}>
                    {React.createElement(displayIcon, { size: iconSize, className: 'shrink-0', 'aria-hidden': 'true' })}
                    <span className="sr-only">{style.label}</span>
                  </span>

                  <div className={`flex flex-wrap items-baseline gap-1 flex-1 break-words leading-tight font-mono ${contentSize}`}>
                    {isRoomTravel ? (
                      <span className={`${messageColorClass} font-mono`}>{messageText}</span>
                    ) : isActivity ? (
                      <>
                        {activityLabel && (
                          <span className={`text-[10px] font-mono font-semibold tracking-wide uppercase ${messageColorClass} opacity-80`}>
                            [{activityLabel}]
                          </span>
                        )}
                        <span className={`${messageColorClass} font-mono`}>{messageText}</span>
                      </>
                    ) : (
                      <span className={`${messageColorClass} font-mono`}>{messageText}</span>
                    )}
                  </div>
                  {count > 1 && (
                    <span className="text-fg-muted/70 font-mono font-semibold whitespace-nowrap text-[10px]">×{count}</span>
                  )}
                  {settings.showTimestamps && (
                    <span className="text-fg-muted/60 whitespace-nowrap tabular-nums font-mono text-[10px]">
                      {formatTimestamp(entry.ts)}
                    </span>
                  )}

                </div>
              </div>
            )
          })
        )}
      </div>

        {!isNearBottom && isScrollable && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Jump to bottom"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full fill-accent hover:bg-accent-hover text-xs font-medium shadow-lg shadow-black/40 border border-accent-hover/60 transition-colors"
          >
            <ChevronDown size={14} className="shrink-0" />
            <span>Jump to bottom</span>
            {unreadCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-fg-bright text-accent text-[10px] font-bold tabular-nums">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="worldFeedFooter p-4 border-t border-line-subtle/60 bg-surface-canvas/95 space-y-3">
        {showUnreadNotice && (
          <div className="flex items-center justify-between text-xs fill-surface-panel px-3 py-2 rounded-md border border-line-subtle/80">
            <button
              onClick={scrollToBottom}
              className="px-3 py-2 w-full text-xs rounded-md fill-accent hover:bg-accent-hover transition-colors"
            >
              <span>{unreadCount === 1 ? '1 new message' : `${unreadCount} new messages`} </span>
              - Jump to latest
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {(['world', 'room', 'action'] as InputMode[]).map((mode) => {
            const isActive = inputMode === mode
            // Highlight input mode when corresponding filter is active
            const isFilterActive = (filter === 'chat' && (mode === 'room' || mode === 'world')) || 
                                  (filter === 'actions' && mode === 'action')
            const labelMap: Record<InputMode, string> = {
              action: 'Action',
              room: 'Room Chat',
              world: 'World Chat',
            }
            const iconMap: Record<InputMode, LucideIcon> = {
              action: Sparkles,
              room: MessageSquare,
              world: Globe,
            }
            const IconComponent = iconMap[mode]
            const colorMap: Record<InputMode, { active: string; inactive: string }> = {
              action: {
                active: 'border-channel-action/80 hover:border-channel-action bg-channel-action/10 hover:bg-channel-action/20 text-channel-action',
                inactive: 'border-line-strong/80 hover:border-line-strong bg-transparent hover:bg-surface-raised/30 text-fg-secondary hover:text-fg-primary',
              },
              room: {
                active: 'border-accent/80 hover:border-accent bg-accent/10 hover:bg-accent/20 text-accent-hover',
                inactive: 'border-line-strong/80 hover:border-line-strong bg-transparent hover:bg-surface-raised/30 text-fg-secondary hover:text-fg-primary',
              },
              world: {
                active: 'border-status-success/80 hover:border-status-success bg-channel-room/10 hover:bg-channel-room/20 text-channel-room',
                inactive: 'border-line-strong/80 hover:border-line-strong bg-transparent hover:bg-surface-raised/30 text-fg-secondary hover:text-fg-primary',
              },
            }
            const colors = colorMap[mode]
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setInputMode(mode)}
                className={`px-2 py-1 text-xs font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow border-1 ${
                  isActive ? colors.active : isFilterActive ? 'border-line-strong fill-surface-raised' : colors.inactive
                }`}
              >
                <IconComponent 
                  size={12} 
                  className="mr-1 shrink-0" 
                  aria-hidden="true"
                />
                {labelMap[mode]}
              </button>
            )
          })}
        </div>

        <form onSubmit={(e) => onCustomActionSubmit(e, inputMode)} className="flex flex-col gap-2 w-full">
          <div className="flex gap-2 w-full">
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
              className={`flex-1 min-w-0 px-3 py-2 fill-surface-panel font-mono text-sm border rounded focus:outline-none focus:ring-1 transition-all duration-200 disabled:bg-surface-panel/40 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-fg-muted ${
                isOverLimit
                  ? 'border-status-error/60 focus:border-status-error/80 focus:ring-status-error/40'
                  : 'border-line-subtle/60 focus:border-accent/60 focus:ring-line-focus/40'
              }`}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="px-4 py-2 fill-accent disabled:bg-surface-hover/50 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-sm border border-accent/60 rounded whitespace-nowrap transition-all duration-200 hover:border-accent-hover/80"
            >
              Submit
            </button>
          </div>
          {isOverLimit && (
            <p className="text-xs text-status-error font-mono px-1">
              Message cannot exceed {MESSAGE_MAX_LENGTH} characters. Current: {charCount} characters
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
