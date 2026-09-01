'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, MessageSquare, RefreshCw, Search } from 'lucide-react'
import { useGameStore } from '@/lib/game-state'
import { usePresenceStore } from '@/store/presenceStore'
import PlayerRow, { type PlayerRowAction } from '@/components/player/PlayerRow'
import {
  mergeRoster,
  sortRoster,
  type DirectoryPlayer,
  type RosterEntry,
  type RosterSortOption,
} from '@/lib/roster/merge-roster'
import { MAP_CONFIG } from '../constants'
import { getMapIdForRoom } from '../utils'

/**
 * The live global roster.
 *
 * Two sources, merged: the durable directory from /api/users/list (everyone who has
 * an account, with their last known room and lastActive), and the live presence feed
 * (whoever holds a socket right now). Presence wins wherever they disagree, because
 * the DB row lags behind a player who is walking around. Anyone absent from presence
 * is offline — which is how the roster avoids the old `isActive` bug where a server
 * restart left the whole world permanently "online".
 */

type PresenceFilter = 'here' | 'online' | 'all'

const SORT_OPTIONS: { value: RosterSortOption; label: string }[] = [
  { value: 'presence', label: 'Online first' },
  { value: 'level-high', label: 'Level (highest)' },
  { value: 'level-low', label: 'Level (lowest)' },
  { value: 'alphabetical', label: 'Name (A–Z)' },
  { value: 'last-active', label: 'Recently active' },
  { value: 'newest', label: 'Newest accounts' },
]

const REGION_TITLES: Record<string, string> = Object.fromEntries(
  MAP_CONFIG.map((map) => [map.id, map.title])
)

interface RosterPanelProps {
  onOpenProfile: (player: { id: string; username: string; level: number; uIcon?: string | null; uIconColor?: string | null }) => void
  onMessage: (player: { id: string; username: string }) => void
  onFollow: (targetId: string) => void
  onOpenWorldChat: () => void
}

export default function RosterPanel({
  onOpenProfile,
  onMessage,
  onFollow,
  onOpenWorldChat,
}: RosterPanelProps) {
  const getAuthHeaders = useGameStore((s) => s.getAuthHeaders)
  const player = useGameStore((s) => s.player)
  const party = useGameStore((s) => s.party)
  const presenceById = usePresenceStore((s) => s.byUserId)

  const [directory, setDirectory] = useState<DirectoryPlayer[]>([])
  const [roomNames, setRoomNames] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>('online')
  const [sortBy, setSortBy] = useState<RosterSortOption>('presence')
  const [searchQuery, setSearchQuery] = useState('')
  const [groupByRegion, setGroupByRegion] = useState(false)
  const [collapsedRegions, setCollapsedRegions] = useState<Set<string>>(new Set())

  const currentPlayerId = player?.id
  const currentRoomId = player?.currentRoom

  const fetchDirectory = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/users/list?limit=500', { headers: getAuthHeaders() })
      if (!response.ok) throw new Error('Failed to load players')
      const data = await response.json()
      if (!data.success) throw new Error(data.message || 'Failed to load players')
      setDirectory(data.users ?? [])
      setRoomNames(data.rooms ?? {})
    } catch (err) {
      console.error('Roster fetch failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to load players')
    } finally {
      setIsLoading(false)
    }
  }, [getAuthHeaders])

  useEffect(() => {
    fetchDirectory()
  }, [fetchDirectory])

  const entries = useMemo(
    () => mergeRoster({ directory, presenceById, roomNames, currentPlayerId }),
    [directory, presenceById, roomNames, currentPlayerId]
  )

  const counts = useMemo(() => {
    let online = 0
    let idle = 0
    let here = 0
    for (const entry of entries) {
      if (entry.presence === 'active') online += 1
      else if (entry.presence === 'idle') idle += 1
      if (entry.presence !== 'disconnected' && entry.roomId === currentRoomId) here += 1
    }
    return { online, idle, here, total: entries.length }
  }, [entries, currentRoomId])

  const visibleEntries = useMemo(() => {
    let filtered = entries

    if (presenceFilter === 'here') {
      filtered = filtered.filter(
        (entry) => entry.presence !== 'disconnected' && entry.roomId === currentRoomId
      )
    } else if (presenceFilter === 'online') {
      filtered = filtered.filter((entry) => entry.presence !== 'disconnected')
    }

    const query = searchQuery.trim().toLowerCase()
    if (query) {
      filtered = filtered.filter((entry) => entry.username.toLowerCase().includes(query))
    }

    return sortRoster(filtered, sortBy)
  }, [entries, presenceFilter, currentRoomId, searchQuery, sortBy])

  const groupedEntries = useMemo(() => {
    if (!groupByRegion) return null
    const groups = new Map<string, RosterEntry[]>()
    for (const entry of visibleEntries) {
      const regionId = entry.roomId ? getMapIdForRoom(entry.roomId) : 'unknown'
      if (!groups.has(regionId)) groups.set(regionId, [])
      groups.get(regionId)!.push(entry)
    }
    return Array.from(groups.entries()).map(([regionId, rows]) => ({
      regionId,
      title: REGION_TITLES[regionId] ?? 'Unknown region',
      rows,
    }))
  }, [groupByRegion, visibleEntries])

  const toggleRegion = (regionId: string) => {
    setCollapsedRegions((prev) => {
      const next = new Set(prev)
      if (next.has(regionId)) next.delete(regionId)
      else next.add(regionId)
      return next
    })
  }

  // Following is co-location-based and refused server-side otherwise; the button
  // stays visible with the reason rather than silently disappearing.
  const buildActions = useCallback(
    (entry: RosterEntry): PlayerRowAction[] => {
      const actions: PlayerRowAction[] = [
        {
          label: 'View',
          onClick: () =>
            onOpenProfile({
              id: entry.id,
              username: entry.username,
              level: entry.level,
              uIcon: entry.uIcon,
              uIconColor: entry.uIconColor,
            }),
        },
      ]

      if (!entry.isSelf) {
        actions.push({ label: 'Msg', onClick: () => onMessage({ id: entry.id, username: entry.username }) })
      }

      if (!entry.isSelf) {
        const alreadyPartied = !!party && (party.leaderId === entry.id || party.members.some((m) => m.id === entry.id))
        const isNonLeaderMember = !!entry.stats?.partyLeaderId && entry.stats.partyLeaderId !== entry.id
        const offline = entry.presence === 'disconnected'
        const elsewhere = entry.roomId !== currentRoomId

        let reason: string | null = null
        if (alreadyPartied) reason = 'Already in your party'
        else if (offline) reason = `${entry.username} is offline`
        else if (elsewhere) reason = 'You must be in the same room to follow'
        else if (isNonLeaderMember) reason = 'Follow their party leader instead'

        actions.push({
          label: 'Follow',
          variant: 'follow',
          disabled: reason !== null,
          title: reason ?? `Follow ${entry.username}`,
          onClick: () => {
            if (reason) return
            onFollow(entry.id)
          },
        })
      }

      return actions
    },
    [onOpenProfile, onMessage, onFollow, party, currentRoomId]
  )

  const filterChips: { id: PresenceFilter; label: string; count: number }[] = [
    { id: 'here', label: 'Here', count: counts.here },
    { id: 'online', label: 'Online', count: counts.online + counts.idle },
    { id: 'all', label: 'All', count: counts.total },
  ]

  const renderRows = (rows: RosterEntry[]) => (
    <div className="divide-y divide-line-subtle/40">
      {rows.map((entry) => (
        <PlayerRow key={entry.id} row={entry} actions={buildActions(entry)} showLocation />
      ))}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-subtle/60 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-fg-bright">Players</h3>
          <span className="text-xs">
            <span className="font-semibold text-status-success">{counts.online} online</span>
            {counts.idle > 0 && (
              <>
                <span className="mx-1 text-fg-disabled">·</span>
                <span className="text-resource-gold">{counts.idle} idle</span>
              </>
            )}
            <span className="mx-1 text-fg-disabled">·</span>
            <span className="text-fg-secondary">{counts.total} total</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onOpenWorldChat}
            className="flex items-center gap-1.5 rounded-lg border border-stat-mag/40 bg-stat-mag/20 px-2.5 py-1.5 text-xs text-stat-mag transition-colors hover:bg-stat-mag/30"
          >
            <MessageSquare size={13} />
            <span>World Chat</span>
          </button>
          <button
            onClick={fetchDirectory}
            disabled={isLoading}
            title="Reload the player directory (online status is always live)"
            className="flex items-center gap-1.5 rounded-lg border border-line-subtle/60 bg-surface-panel/60 px-2.5 py-1.5 text-xs text-fg-primary transition-colors hover:bg-surface-raised/60 disabled:opacity-50"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle/60 px-4 py-2">
        <div className="flex rounded-lg border border-line-subtle/60 bg-surface-panel/60 p-0.5">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setPresenceFilter(chip.id)}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                presenceFilter === chip.id
                  ? 'bg-hue-pink/25 text-hue-pink'
                  : 'text-fg-secondary hover:text-fg-bright'
              }`}
            >
              {chip.label}
              <span className="ml-1 text-[10px] text-fg-muted">{chip.count}</span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[140px] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            type="text"
            placeholder="Search players…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-line-subtle/60 bg-surface-panel/60 py-1.5 pl-8 pr-3 text-xs text-fg-bright placeholder-fg-muted focus:border-hue-pink/60 focus:outline-none focus:ring-1 focus:ring-hue-pink/60"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as RosterSortOption)}
          className="rounded-lg border border-line-subtle/60 bg-surface-panel/60 px-2 py-1.5 text-xs text-fg-primary focus:border-hue-pink/60 focus:outline-none"
          aria-label="Sort players"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-fg-secondary hover:text-fg-bright">
          <input
            type="checkbox"
            checked={groupByRegion}
            onChange={(e) => setGroupByRegion(e.target.checked)}
            className="h-3.5 w-3.5 accent-hue-pink"
          />
          <span>By region</span>
        </label>
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {error ? (
          <div className="m-2 rounded-lg border border-status-error/50 bg-status-error/20 p-3">
            <div className="text-xs text-status-error">{error}</div>
            <button
              onClick={fetchDirectory}
              className="mt-2 rounded-lg bg-status-error/90 px-3 py-1 text-xs text-fg-bright hover:bg-status-error"
            >
              Retry
            </button>
          </div>
        ) : isLoading && directory.length === 0 ? (
          <div className="p-6 text-center text-xs text-fg-muted">Loading players…</div>
        ) : visibleEntries.length === 0 ? (
          <div className="p-6 text-center text-xs text-fg-muted">
            {presenceFilter === 'here'
              ? 'Nobody else is in this room.'
              : searchQuery
                ? 'No players match your search.'
                : 'No players online.'}
          </div>
        ) : groupedEntries ? (
          <div className="space-y-2">
            {groupedEntries.map(({ regionId, title, rows }) => {
              const collapsed = collapsedRegions.has(regionId)
              return (
                <div key={regionId} className="overflow-hidden rounded-lg border border-line-subtle/60">
                  <button
                    onClick={() => toggleRegion(regionId)}
                    className="flex w-full items-center gap-2 border-b border-line-subtle/60 bg-surface-panel/70 px-2.5 py-1.5 transition-colors hover:bg-surface-panel/90"
                  >
                    {collapsed ? (
                      <ChevronRight size={14} className="text-fg-muted" />
                    ) : (
                      <ChevronDown size={14} className="text-fg-muted" />
                    )}
                    <span className="text-xs font-semibold text-fg-bright">{title}</span>
                    <span className="text-[10px] text-fg-muted">
                      {rows.length} player{rows.length === 1 ? '' : 's'}
                    </span>
                  </button>
                  {!collapsed && renderRows(rows)}
                </div>
              )
            })}
          </div>
        ) : (
          renderRows(visibleEntries)
        )}
      </div>
    </div>
  )
}

