'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { ChevronDown, Search, Users as UsersIcon, RefreshCw, ChevronRight } from 'lucide-react'
import { useGameStore } from '@/lib/game-state'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import { DEFAULT_PLAYER_AVATAR, DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'

type Equipment = {
  rightHand: string
  leftHand: string
  head: string
  body: string
  hands: string
  feet: string
  ring1: string
  ring2: string
  neck: string
  artifact: string
  tech: string
  companion: string
  pet: string
  mount: string
  robot: string
  aura: string
}

type User = {
  id: string
  username: string
  level: number
  currentRoom: string
  roomName: string | null
  isActive: boolean
  lastActive: string
  hp: number
  hpMax: number
  mp: number
  mpMax: number
  str: number
  dex: number
  mag: number
  def: number
  currency: number
  uIcon: string
  uIconColor: string
  createdAt: string
  equipment: Equipment | null
}

type SortOption = 
  | 'newest'
  | 'oldest'
  | 'level-high'
  | 'level-low'
  | 'alphabetical'
  | 'last-active'
  | 'active-first'

const formatRelativeTime = (timestamp: string): string => {
  const now = Date.now()
  const timestampMs = new Date(timestamp).getTime()
  const diffMs = now - timestampMs
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffMinutes < 1) {
    return 'just now'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`
  }
  
  // For older dates, show formatted date
  return new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: new Date(timestamp).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}

const formatDate = (timestamp: string): string => {
  return new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const getNonEmptyEquipment = (equipment: Equipment | null): Array<{ slot: string; item: string }> => {
  if (!equipment) return []
  
  const slots: Array<{ key: keyof Equipment; label: string }> = [
    { key: 'rightHand', label: 'Weapon' },
    { key: 'leftHand', label: 'Off-hand' },
    { key: 'head', label: 'Head' },
    { key: 'body', label: 'Body' },
    { key: 'hands', label: 'Hands' },
    { key: 'feet', label: 'Feet' },
    { key: 'ring1', label: 'Ring 1' },
    { key: 'ring2', label: 'Ring 2' },
    { key: 'neck', label: 'Neck' },
    { key: 'artifact', label: 'Artifact' },
    { key: 'tech', label: 'Tech' },
    { key: 'companion', label: 'Companion' },
    { key: 'pet', label: 'Pet' },
    { key: 'mount', label: 'Mount' },
    { key: 'robot', label: 'Robot' },
    { key: 'aura', label: 'Aura' },
  ]
  
  return slots
    .filter(({ key }) => {
      const value = equipment[key]
      // Show all non-empty values except the default empty marker
      // Note: "fists" is the default for rightHand, but if it's actually equipped, we'll show it
      return value && value.trim() !== '' && value !== '- - -'
    })
    .map(({ key, label }) => ({
      slot: label,
      item: equipment[key],
    }))
}

function UserCard({ 
  user, 
  isCompact, 
  showEquipment 
}: { 
  user: User
  isCompact: boolean
  showEquipment: boolean
}) {
  const avatarKey = user.uIcon || DEFAULT_PLAYER_AVATAR
  const avatarColor = user.uIconColor || DEFAULT_AVATAR_COLOR
  const coloredAvatar = useColoredAvatar(avatarKey, avatarColor)
  const nonEmptyEquipment = useMemo(() => getNonEmptyEquipment(user.equipment), [user.equipment])

  if (isCompact) {
    return (
      <div className={`p-2 bg-gray-900/60 border border-gray-800/60 rounded-lg hover:bg-gray-900/80 hover:border-gray-700/60 transition-colors ${!user.isActive ? 'opacity-60' : ''}`}>
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div
              className="w-8 h-8 rounded border-2 flex items-center justify-center overflow-hidden"
              style={{
                borderColor: avatarColor,
                backgroundColor: `${avatarColor}20`,
              }}
            >
              {coloredAvatar ? (
                <div
                  className="w-full h-full"
                  dangerouslySetInnerHTML={{ __html: coloredAvatar }}
                />
              ) : (
                <div className="w-full h-full bg-gray-700" />
              )}
            </div>
          </div>

          {/* Compact Info */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-semibold text-white truncate">{user.username}</span>
            <span className="text-xs text-gray-400">Lv.{user.level}</span>
            {user.isActive ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-gray-500" title="Offline" />
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-3 bg-gray-900/60 border border-gray-800/60 rounded-lg hover:bg-gray-900/80 hover:border-gray-700/60 transition-colors ${!user.isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div
            className="w-10 h-10 rounded border-2 flex items-center justify-center overflow-hidden"
            style={{
              borderColor: avatarColor,
              backgroundColor: `${avatarColor}20`,
            }}
          >
            {coloredAvatar ? (
              <div
                className="w-full h-full"
                dangerouslySetInnerHTML={{ __html: coloredAvatar }}
              />
            ) : (
              <div className="w-full h-full bg-gray-700" />
            )}
          </div>
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-white">{user.username}</span>
            <span className="text-xs text-gray-400">Lv.{user.level}</span>
            {user.isActive && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active" />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-gray-300">
            {/* Room */}
            <div>
              <span className="text-gray-500">Room: </span>
              <span className="font-mono">
                {user.currentRoom}
                {user.roomName && ` (${user.roomName})`}
              </span>
            </div>

            {/* Status */}
            <div>
              <span className="text-gray-500">Status: </span>
              <span className={user.isActive ? 'text-emerald-400' : 'text-gray-400'}>
                {user.isActive ? 'Online' : 'Offline'}
              </span>
              {!user.isActive && (
                <span className="text-gray-500 ml-1">
                  ({formatRelativeTime(user.lastActive)})
                </span>
              )}
            </div>

            {/* HP/MP */}
            <div>
              <span className="text-gray-500">HP: </span>
              <span className="font-mono text-red-300">
                {user.hp}/{user.hpMax}
              </span>
              <span className="text-gray-500 ml-2">MP: </span>
              <span className="font-mono text-blue-300">
                {user.mp}/{user.mpMax}
              </span>
            </div>

            {/* Stats */}
            <div>
              <span className="text-gray-500">Stats: </span>
              <span className="font-mono">
                STR: {user.str} DEX: {user.dex} MAG: {user.mag} DEF: {user.def}
              </span>
            </div>

            {/* Currency */}
            <div>
              <span className="text-gray-500">Currency: </span>
              <span className="font-mono text-yellow-300">{user.currency}</span>
            </div>

            {/* Created */}
            <div>
              <span className="text-gray-500">Created: </span>
              <span className="font-mono">{formatDate(user.createdAt)}</span>
            </div>
          </div>

          {/* Equipment Section */}
          {showEquipment && (
            <div className="mt-2 pt-2 border-t border-gray-700/50">
              <div className="text-xs text-gray-400 mb-1">Equipment:</div>
              {nonEmptyEquipment.length > 0 ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  {nonEmptyEquipment.map(({ slot, item }) => (
                    <span key={slot} className="text-gray-300">
                      <span className="text-gray-500">{slot}:</span>{' '}
                      <span className="font-mono text-purple-300">{item}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500 italic">No equipment equipped</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function UsersDisplay() {
  const { getAuthHeaders, player } = useGameStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [showActiveOnly, setShowActiveOnly] = useState(false)
  const [sameRoomOnly, setSameRoomOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const [isCompact, setIsCompact] = useState(false)
  const [showEquipment, setShowEquipment] = useState(false)
  const [groupByRoom, setGroupByRoom] = useState(false)
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchUsers()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isSortDropdownOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.sort-dropdown-container')) {
        setIsSortDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSortDropdownOpen])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/users/list', {
        headers: {
          ...getAuthHeaders(),
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const data = await response.json()
      if (data.success) {
        setUsers(data.users)
      } else {
        throw new Error(data.message || 'Failed to fetch users')
      }
    } catch (err) {
      console.error('Error fetching users:', err)
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const filteredAndSortedUsers = useMemo(() => {
    let filtered = [...users]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((user) =>
        user.username.toLowerCase().includes(query)
      )
    }

    // Apply active filter
    if (showActiveOnly) {
      filtered = filtered.filter((user) => user.isActive)
    }

    // Apply same room filter
    if (sameRoomOnly && player?.currentRoom) {
      filtered = filtered.filter((user) => user.currentRoom === player.currentRoom)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'level-high':
          return b.level - a.level
        case 'level-low':
          return a.level - b.level
        case 'alphabetical':
          return a.username.localeCompare(b.username)
        case 'last-active':
          return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
        case 'active-first':
          if (a.isActive && !b.isActive) return -1
          if (!a.isActive && b.isActive) return 1
          return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
        default:
          return 0
      }
    })

    return filtered
  }, [users, sortBy, showActiveOnly, sameRoomOnly, searchQuery, player?.currentRoom])

  // Group users by room
  const groupedUsers = useMemo(() => {
    if (!groupByRoom) return null

    const groups = new Map<string, User[]>()
    filteredAndSortedUsers.forEach((user) => {
      const roomKey = user.currentRoom
      if (!groups.has(roomKey)) {
        groups.set(roomKey, [])
      }
      groups.get(roomKey)!.push(user)
    })

    return Array.from(groups.entries()).map(([roomId, roomUsers]) => {
      const firstUser = roomUsers[0]
      return {
        roomId,
        roomName: firstUser.roomName || null,
        users: roomUsers,
      }
    })
  }, [filteredAndSortedUsers, groupByRoom])

  // Calculate stats
  const stats = useMemo(() => {
    const online = filteredAndSortedUsers.filter((u) => u.isActive).length
    const offline = filteredAndSortedUsers.filter((u) => !u.isActive).length
    const total = filteredAndSortedUsers.length
    return { online, offline, total }
  }, [filteredAndSortedUsers])

  const toggleRoomCollapse = (roomId: string) => {
    setCollapsedRooms((prev) => {
      const next = new Set(prev)
      if (next.has(roomId)) {
        next.delete(roomId)
      } else {
        next.add(roomId)
      }
      return next
    })
  }

  const sortOptions: Array<{ value: SortOption; label: string }> = [
    { value: 'newest', label: 'Newest accounts first' },
    { value: 'oldest', label: 'Oldest accounts first' },
    { value: 'level-high', label: 'Level (highest first)' },
    { value: 'level-low', label: 'Level (lowest first)' },
    { value: 'alphabetical', label: 'Alphabetical by username' },
    { value: 'last-active', label: 'Most recently active' },
    { value: 'active-first', label: 'Active users first' },
  ]

  if (loading) {
    return (
      <div className="mt-6 p-4 text-center text-gray-400">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
        <div className="mt-2 text-sm">Loading users...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-6 p-4 bg-red-900/20 border border-red-800/50 rounded-lg">
        <div className="text-red-400 text-sm">Error: {error}</div>
        <button
          onClick={fetchUsers}
          className="mt-2 px-3 py-1.5 text-sm bg-red-600/90 hover:bg-red-500/90 text-white rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UsersIcon size={18} className="text-purple-400" />
          <h4 className="text-base font-semibold text-white">Users</h4>
          {/* Stats Summary */}
          <div className="text-xs">
            <span className="text-emerald-400 font-semibold">{stats.online} online</span>
            <span className="text-gray-500 mx-1.5">•</span>
            <span className="text-gray-400">{stats.offline} offline</span>
            <span className="text-gray-500 mx-1.5">•</span>
            <span className="text-gray-300">{stats.total} total</span>
          </div>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm bg-gray-900/60 border border-gray-700/60 rounded-lg text-gray-300 hover:bg-gray-800/60 hover:border-gray-600/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh user list"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Controls */}
      <div className="space-y-3">
        {/* First Row: Search and Sort */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-900/60 border border-gray-700/60 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500/60 focus:border-purple-500/60"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative sort-dropdown-container flex-shrink-0">
            <button
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-900/60 border border-gray-700/60 rounded-lg text-gray-300 hover:bg-gray-800/60 hover:border-gray-600/60 transition-colors whitespace-nowrap"
            >
              <span>Sort: {sortOptions.find((opt) => opt.value === sortBy)?.label}</span>
              <ChevronDown
                size={14}
                className={`transition-transform ${isSortDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isSortDropdownOpen && (
              <div className="absolute right-0 mt-1 z-20 bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-lg shadow-xl min-w-[200px] py-1">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortBy(option.value)
                        setIsSortDropdownOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        sortBy === option.value
                          ? 'bg-purple-600/20 text-purple-300'
                          : 'text-gray-300 hover:bg-gray-800/60'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Second Row: All Checkboxes */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Active Only Toggle */}
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded border-2 border-gray-600 bg-gray-800 peer-checked:bg-purple-600 peer-checked:border-purple-500 peer-focus:ring-2 peer-focus:ring-purple-500/50 peer-focus:ring-offset-1 peer-focus:ring-offset-gray-900 transition-all duration-200 flex items-center justify-center group-hover:border-gray-500 peer-checked:group-hover:border-purple-400">
                {showActiveOnly && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-gray-300 group-hover:text-gray-200 transition-colors">Active only</span>
          </label>

          {/* Same Room Toggle */}
          {player?.currentRoom && (
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={sameRoomOnly}
                  onChange={(e) => setSameRoomOnly(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 rounded border-2 border-gray-600 bg-gray-800 peer-checked:bg-purple-600 peer-checked:border-purple-500 peer-focus:ring-2 peer-focus:ring-purple-500/50 peer-focus:ring-offset-1 peer-focus:ring-offset-gray-900 transition-all duration-200 flex items-center justify-center group-hover:border-gray-500 peer-checked:group-hover:border-purple-400">
                  {sameRoomOnly && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-gray-300 group-hover:text-gray-200 transition-colors">Same room as me</span>
            </label>
          )}

          {/* Show Equipment Toggle */}
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={showEquipment}
                onChange={(e) => setShowEquipment(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded border-2 border-gray-600 bg-gray-800 peer-checked:bg-purple-600 peer-checked:border-purple-500 peer-focus:ring-2 peer-focus:ring-purple-500/50 peer-focus:ring-offset-1 peer-focus:ring-offset-gray-900 transition-all duration-200 flex items-center justify-center group-hover:border-gray-500 peer-checked:group-hover:border-purple-400">
                {showEquipment && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-gray-300 group-hover:text-gray-200 transition-colors">Show equipment</span>
          </label>

          {/* Compact/Expanded Toggle */}
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={!isCompact}
                onChange={(e) => setIsCompact(!e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded border-2 border-gray-600 bg-gray-800 peer-checked:bg-purple-600 peer-checked:border-purple-500 peer-focus:ring-2 peer-focus:ring-purple-500/50 peer-focus:ring-offset-1 peer-focus:ring-offset-gray-900 transition-all duration-200 flex items-center justify-center group-hover:border-gray-500 peer-checked:group-hover:border-purple-400">
                {!isCompact && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-gray-300 group-hover:text-gray-200 transition-colors">Expanded</span>
          </label>

          {/* Group by Room Toggle */}
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={groupByRoom}
                onChange={(e) => setGroupByRoom(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded border-2 border-gray-600 bg-gray-800 peer-checked:bg-purple-600 peer-checked:border-purple-500 peer-focus:ring-2 peer-focus:ring-purple-500/50 peer-focus:ring-offset-1 peer-focus:ring-offset-gray-900 transition-all duration-200 flex items-center justify-center group-hover:border-gray-500 peer-checked:group-hover:border-purple-400">
                {groupByRoom && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-gray-300 group-hover:text-gray-200 transition-colors">Group by room</span>
          </label>
        </div>
      </div>

      {/* User Cards */}
      {filteredAndSortedUsers.length === 0 ? (
        <div className="p-6 text-center text-gray-400 text-sm">
          {searchQuery || showActiveOnly || sameRoomOnly
            ? 'No users match your filters.'
            : 'No users found.'}
        </div>
      ) : groupByRoom && groupedUsers ? (
        <div className="space-y-3">
          {groupedUsers.map(({ roomId, roomName, users: roomUsers }) => {
            const isCollapsed = collapsedRooms.has(roomId)
            return (
              <div key={roomId} className="border border-gray-800/60 rounded-lg overflow-hidden">
                {/* Room Header */}
                <button
                  onClick={() => toggleRoomCollapse(roomId)}
                  className="w-full px-3 py-2 bg-gray-900/80 hover:bg-gray-900/90 border-b border-gray-800/60 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight size={16} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-400" />
                    )}
                    <span className="text-sm font-semibold text-white">
                      Room {roomId}
                      {roomName && <span className="text-gray-400"> ({roomName})</span>}
                    </span>
                    <span className="text-xs text-gray-500">- {roomUsers.length} player{roomUsers.length !== 1 ? 's' : ''}</span>
                  </div>
                </button>

                {/* Room Users */}
                {!isCollapsed && (
                  <div className="p-2 space-y-2">
                    {roomUsers.map((user) => (
                      <UserCard 
                        key={user.id} 
                        user={user} 
                        isCompact={isCompact}
                        showEquipment={showEquipment}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAndSortedUsers.map((user) => (
            <UserCard 
              key={user.id} 
              user={user} 
              isCompact={isCompact}
              showEquipment={showEquipment}
            />
          ))}
        </div>
      )}
    </div>
  )
}

