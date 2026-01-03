'use client'

import React, { useEffect, useMemo, useRef, useState, useCallback, type FormEvent, type RefObject } from 'react'
import { AlertTriangle, Globe, MessageSquare, Sparkles, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight, ChevronDown, ChevronUp, ChevronRight, Settings as SettingsIcon, Zap, Check, type LucideIcon } from 'lucide-react'
import { useWorldFeedStore, type WorldFeedEntry } from '@/store/worldFeedStore'
import { MESSAGE_MAX_LENGTH } from '@/lib/sanitization'
import Icon from './Icon'

type FilterType = 'all' | 'chat' | 'events' | 'actions'
type ChatSubFilter = 'room-chat' | 'world-chat' | 'all-chat'
type EventsSubFilter = 'world-activity' | 'all-events'
type ActionsSubFilter = 'action-feedback' | 'movement' | 'all-actions'

export type InputMode = 'action' | 'room' | 'world'

type UnifiedFeedPanelProps = {
  currentRoomId?: string
  currentRoomName?: string
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
    barClass: 'bg-blue-400',
    iconClass: 'text-blue-400',
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
  login: 'text-gray-400',
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

export default function UnifiedFeedPanel({
  currentRoomId,
  currentRoomName,
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
  forceInputMode,
  forceFilter,
  forceChatSubFilter,
}: UnifiedFeedPanelProps) {
  const entries = useWorldFeedStore((state) => state.entries)
  const userId = useWorldFeedStore((state) => state.userId)
  const [filter, setFilter] = useState<FilterType>('all')
  const [chatSubFilter, setChatSubFilter] = useState<ChatSubFilter>('all-chat')
  const [eventsSubFilter, setEventsSubFilter] = useState<EventsSubFilter>('all-events')
  const [actionsSubFilter, setActionsSubFilter] = useState<ActionsSubFilter>('all-actions')
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const prevIsOpenRef = useRef(isOpen)
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
          if (!currentRoomId) return false
          return entry.type === 'room' && entry.roomId === currentRoomId
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
  const showUnreadNotice = !isNearBottom && unreadCount > 0
  
  // Character count validation for chat modes
  const isChatMode = inputMode === 'world' || inputMode === 'room'
  const charCount = customAction.length
  const isOverLimit = isChatMode && charCount > MESSAGE_MAX_LENGTH
  const isSubmitDisabled = Boolean(isLoadingRoom) || trimmedCustomAction.length === 0 || isOverLimit

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

  // Auto-scroll to bottom when panel opens
  useEffect(() => {
    // Only scroll when transitioning from closed to open
    if (!prevIsOpenRef.current && isOpen) {
      // Wait for panel animation to complete (250ms transition + buffer)
      const timeoutId = setTimeout(() => {
        scrollToBottom()
      }, 300)
      
      return () => clearTimeout(timeoutId)
    }
    
    prevIsOpenRef.current = isOpen
  }, [isOpen, scrollToBottom])

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
    <div className="rightColumnInner flex flex-col h-full">
      <div className="worldFeedHeader flex items-center justify-between px-4 py-4 border-b border-gray-800/60 bg-gray-900/80">
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
              className="px-2.5 py-1.5 h-8 text-sm font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow flex-shrink-0 border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300"
              title={isOpen ? 'Close' : 'Open'}
              aria-label={isOpen ? 'Close world panel' : 'Open world panel'}
            >
              <Icon name="world" size={14} color="blue" />
              <ChevronRight size={14} className="ml-0.5" />
            </button>
          )}
        </div>
      </div>

      <div className="worldFeedControls px-4 py-2 border-b border-gray-800/60 bg-gray-900/70 flex flex-col gap-2">
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
                    ? 'border-1 border-blue-500 hover:border-blue-400 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300'
                    : 'border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300'
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

        {/* Sub-filters */}
        {filter === 'chat' && (
          <div className="flex flex-wrap items-center gap-2 pl-2 border-l-2 border-indigo-500/30">
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
                      ? 'border-1 border-indigo-400 hover:border-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300'
                      : 'border-1 border-gray-700 hover:border-gray-600 bg-transparent hover:bg-gray-800/30 text-gray-500 hover:text-gray-400'
                  }`}
                >
                  {labelMap[subKey]}
                </button>
              )
            })}
          </div>
        )}

        {filter === 'events' && (
          <div className="flex flex-wrap items-center gap-2 pl-2 border-l-2 border-amber-500/30">
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
                      ? 'border-1 border-amber-400 hover:border-amber-300 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300'
                      : 'border-1 border-gray-700 hover:border-gray-600 bg-transparent hover:bg-gray-800/30 text-gray-500 hover:text-gray-400'
                  }`}
                >
                  {labelMap[subKey]}
                </button>
              )
            })}
          </div>
        )}

        {filter === 'actions' && (
          <div className="flex flex-wrap items-center gap-2 pl-2 border-l-2 border-amber-500/30">
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
                      ? 'border-1 border-amber-400 hover:border-amber-300 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300'
                      : 'border-1 border-gray-700 hover:border-gray-600 bg-transparent hover:bg-gray-800/30 text-gray-500 hover:text-gray-400'
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

      <div ref={listRef} className={`worldFeedEntries flex-1 overflow-y-auto pb-6 bg-gray-950/80 ${
        filter === 'chat' && chatSubFilter === 'room-chat' ? 'px-3 pt-2' : 'px-2 pt-1'
      }`}>
        {/* Room header for room chat */}
        {filter === 'chat' && chatSubFilter === 'room-chat' && currentRoomId && currentRoomName && (
          <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-sm border-b border-indigo-500/30 mb-3 -mx-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-indigo-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-100 truncate">{currentRoomName}</div>
                <div className="text-xs text-gray-400">Room {currentRoomId}</div>
              </div>
            </div>
          </div>
        )}
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
              className="px-4 py-2 text-sm rounded-md transition-colors bg-indigo-600 hover:bg-indigo-500 text-white border-transparent shadow-sm hover:shadow"
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
            const displayIcon = directionIcon || (isRoomTravel ? Zap : style.icon)

            // Get entry category for visual styling
            const entryCategory = getEntryCategory(entry)
            
            // Special styling for chat messages (terminal-style with modern influence)
            if (isChat) {
              const isSelf = entry.isSelf
              const isWorldChat = entry.type === 'world'
              const isRoomChat = entry.type === 'room'
              const isCurrentRoom = isRoomChat && entry.roomId === currentRoomId
              
              // World chat gets blue, room chat gets indigo for self, gray for others
              // Current room messages are lighter/more vibrant, other rooms are darker/muted
              const chatBubbleClass = isWorldChat
                ? isSelf
                  ? 'bg-blue-500/85 text-blue-50 border border-blue-400/60'
                  : 'bg-blue-500/50 text-blue-100 border border-blue-500/40'
                : isCurrentRoom
                ? isSelf
                  ? 'bg-indigo-500/85 text-indigo-50 border border-indigo-400/60'
                  : 'bg-indigo-500/50 text-indigo-100 border border-indigo-500/40'
                : isSelf
                ? 'bg-indigo-600/60 text-indigo-50 border border-indigo-500/40'
                : 'bg-indigo-700/40 text-indigo-200 border border-indigo-600/30'
              
              const borderColorClass = isWorldChat
                ? isSelf ? 'bg-blue-500' : 'bg-blue-500'
                : isCurrentRoom
                ? isSelf ? 'bg-indigo-500' : 'bg-indigo-500'
                : isSelf ? 'bg-indigo-600' : 'bg-indigo-700'
              
              const avatarBgClass = isWorldChat
                ? isSelf ? 'bg-blue-500/80' : 'bg-blue-500/80'
                : isCurrentRoom
                ? isSelf ? 'bg-indigo-500/80' : 'bg-indigo-500/80'
                : isSelf ? 'bg-indigo-600/80' : 'bg-indigo-700/80'
              
              const avatarBorderClass = isWorldChat
                ? isSelf ? 'border-blue-400/50' : 'border-blue-500/50'
                : isCurrentRoom
                ? isSelf ? 'border-indigo-400/50' : 'border-indigo-500/50'
                : isSelf ? 'border-indigo-500/50' : 'border-indigo-600/50'
              
              const chatContainerClass = isSelf ? 'flex justify-end' : 'flex justify-start'
              const avatarInitial = (actorLabel.charAt(0) || '?').toUpperCase()
              
              // Apply opacity dimming for other room messages
              const containerOpacityClass = isRoomChat && !isCurrentRoom ? 'opacity-70' : ''
              
              return (
                <div key={`${entry.id}-${index}`} className={`${chatContainerClass} mb-1 group relative ${containerOpacityClass}`}>
                  <span className={`absolute left-0 top-0 bottom-0 w-0.5 ${borderColorClass}`} aria-hidden />
                  <div className="flex items-start gap-1.5 max-w-[90%] pl-1.5">
                    {!isSelf && (
                      <div className={`${avatarBgClass} w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-semibold text-white shrink-0 border ${avatarBorderClass}`}>
                        {avatarInitial}
                      </div>
                    )}
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className={`text-[10px] text-gray-400 font-mono font-medium ${isSelf ? 'text-right' : ''}`}>
                        {actorLabel}
                        {isRoomChat && entry.roomId && (
                          <span className="text-gray-500 ml-1">({entry.roomId})</span>
                        )}
                      </span>
                      <div className={`${chatBubbleClass} rounded px-2.5 py-1.5 ${contentSize} font-mono break-words leading-tight`}>
                        {messageText}
                      </div>
                      <div className={`flex items-center gap-1.5 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                        {settings.showTimestamps && (
                          <span className="text-[9px] text-gray-500/70 whitespace-nowrap tabular-nums font-mono">
                            {formatTimestamp(entry.ts)}
                          </span>
                        )}
                        {count > 1 && (
                          <span className="text-[9px] text-gray-500/70 font-mono font-semibold whitespace-nowrap">
                            ×{count}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelf && (
                      <div className={`${avatarBgClass} w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-semibold text-white shrink-0 border ${avatarBorderClass}`}>
                        {avatarInitial}
                      </div>
                    )}
                  </div>
                </div>
              )
            }
            
            // Non-chat entries (events, actions) - terminal-style with modern influence
            const isEvent = entryCategory === 'event'
            const isAction = entryCategory === 'action'
            const terminalPadding = settings.compactMode ? 'py-0.5 pr-2 pl-3' : 'py-1 pr-3 pl-4'
            const categoryBgClass = isEvent
              ? 'bg-gray-800/30' 
              : isAction
              ? 'bg-gray-900/40'
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
                    <span className="text-gray-500/70 font-mono font-semibold whitespace-nowrap text-[10px]">×{count}</span>
                  )}
                  {settings.showTimestamps && (
                    <span className="text-gray-500/60 whitespace-nowrap tabular-nums font-mono text-[10px]">
                      {formatTimestamp(entry.ts)}
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
                  isActive ? colors.active : isFilterActive ? 'border-gray-500 bg-gray-800/20 text-gray-300' : colors.inactive
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
              className={`flex-1 min-w-0 px-3 py-2 bg-gray-900/80 text-gray-100 font-mono text-sm border rounded focus:outline-none focus:ring-1 transition-all duration-200 disabled:bg-gray-900/40 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-gray-500 ${
                isOverLimit
                  ? 'border-red-500/60 focus:border-red-500/80 focus:ring-red-500/40'
                  : 'border-gray-700/60 focus:border-indigo-500/60 focus:ring-indigo-500/40'
              }`}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="px-4 py-2 bg-indigo-600/90 hover:bg-indigo-600 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50 text-indigo-50 font-mono text-sm border border-indigo-500/60 rounded whitespace-nowrap transition-all duration-200 hover:border-indigo-400/80"
            >
              Submit
            </button>
          </div>
          {isOverLimit && (
            <p className="text-xs text-red-400 font-mono px-1">
              Message cannot exceed {MESSAGE_MAX_LENGTH} characters. Current: {charCount} characters
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

