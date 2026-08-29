import type { PresencePlayer } from '@/lib/socket'
import type { PlayerPresenceStatus, PlayerRowData } from '@/components/player/PlayerRow'

/**
 * Merging the two halves of the roster.
 *
 * The Players tab draws on two sources that disagree by design:
 *
 *  - the **directory** (/api/users/list) — durable, complete, and always slightly
 *    stale. It knows every account that exists, plus `lastActive` and the last room
 *    persisted for them.
 *  - **presence** (world:presence-sync / world:presence-update) — live, socket-derived,
 *    and covers only players connected right now.
 *
 * Presence wins on anything it knows, because a walking player outruns their database
 * row. Absence from presence means offline — which is the whole point: the old roster
 * trusted the durable `isActive` column, so a crash left every player "online" forever.
 *
 * Kept pure and separate from the panel so the precedence rules are readable and
 * checkable on their own.
 */

export interface DirectoryPlayer {
  id: string
  username: string
  level: number
  currentRoom: string
  roomName: string | null
  isActive: boolean
  inFight: boolean
  lastActive: string
  hp: number
  hpMax: number
  mp: number
  mpMax: number
  str: number
  dex: number
  mag: number
  def: number
  strMod: number
  dexMod: number
  magMod: number
  defMod: number
  currency: number
  uIcon: string | null
  uIconColor: string | null
  characterClass: string
  characterRace: string
  createdAt: string
}

export type RosterEntry = PlayerRowData & {
  presence: PlayerPresenceStatus
  currency?: number
  createdAt?: string
}

export interface MergeRosterInput {
  directory: DirectoryPlayer[]
  presenceById: Record<string, PresencePlayer>
  roomNames: Record<string, string>
  currentPlayerId?: string
}

export function mergeRoster({
  directory,
  presenceById,
  roomNames,
  currentPlayerId,
}: MergeRosterInput): RosterEntry[] {
  const seen = new Set<string>()
  const rows: RosterEntry[] = []

  for (const user of directory) {
    seen.add(user.id)
    const live = presenceById[user.id]
    const presence: PlayerPresenceStatus = live ? live.status : 'disconnected'
    const roomId = live?.currentRoom ?? user.currentRoom

    rows.push({
      id: user.id,
      username: user.username,
      level: live?.level ?? user.level,
      uIcon: user.uIcon,
      uIconColor: user.uIconColor,
      role: 'roster',
      isSelf: user.id === currentPlayerId,
      roomId,
      // The live room may be one the directory row hasn't caught up to, so resolve
      // its name from the world map first and fall back to the joined row.
      roomName: roomNames[roomId] ?? user.roomName ?? null,
      lastSeen: live ? live.lastSeen : new Date(user.lastActive).getTime(),
      presence,
      currency: user.currency,
      createdAt: user.createdAt,
      stats: {
        hp: live?.hp ?? user.hp,
        hpMax: live?.hpMax ?? user.hpMax,
        mp: live?.mp ?? user.mp,
        mpMax: live?.mpMax ?? user.mpMax,
        str: user.str,
        dex: user.dex,
        mag: user.mag,
        def: user.def,
        strMod: user.strMod,
        dexMod: user.dexMod,
        magMod: user.magMod,
        defMod: user.defMod,
        presenceStatus: presence,
        // A stale `inFight` row would tag an offline player as fighting forever, so
        // only trust the battle flag while they are actually connected.
        inBattle: live ? live.inBattle : false,
        partyLeaderId: live?.partyLeaderId ?? null,
      },
    })
  }

  // Someone can be online but beyond the directory page, or have registered since the
  // last fetch. Presence still knows them, so they belong in the list.
  for (const live of Object.values(presenceById)) {
    if (seen.has(live.id)) continue
    const roomId = live.currentRoom ?? ''
    rows.push({
      id: live.id,
      username: live.username,
      level: live.level,
      uIcon: live.uIcon,
      uIconColor: live.uIconColor,
      role: 'roster',
      isSelf: live.id === currentPlayerId,
      roomId,
      roomName: roomNames[roomId] ?? null,
      lastSeen: live.lastSeen,
      presence: live.status,
      stats: {
        hp: live.hp,
        hpMax: live.hpMax,
        mp: live.mp,
        mpMax: live.mpMax,
        presenceStatus: live.status,
        inBattle: live.inBattle,
        partyLeaderId: live.partyLeaderId ?? null,
      },
    })
  }

  return rows
}

export const PRESENCE_RANK: Record<PlayerPresenceStatus, number> = {
  active: 0,
  idle: 1,
  disconnected: 2,
}

export type RosterSortOption =
  | 'presence'
  | 'level-high'
  | 'level-low'
  | 'alphabetical'
  | 'last-active'
  | 'newest'

/**
 * Offline players always sort last regardless of the chosen key — a roster that opens
 * on a wall of offline accounts is exactly what this replaces. The key then orders
 * within each presence band.
 */
export function sortRoster(entries: RosterEntry[], sortBy: RosterSortOption): RosterEntry[] {
  return [...entries].sort((a, b) => {
    const presenceDelta = PRESENCE_RANK[a.presence] - PRESENCE_RANK[b.presence]
    if (presenceDelta !== 0) return presenceDelta

    switch (sortBy) {
      case 'level-high':
        return b.level - a.level || a.username.localeCompare(b.username)
      case 'level-low':
        return a.level - b.level || a.username.localeCompare(b.username)
      case 'alphabetical':
        return a.username.localeCompare(b.username)
      case 'last-active':
        return (b.lastSeen ?? 0) - (a.lastSeen ?? 0)
      case 'newest':
        return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      case 'presence':
      default:
        return b.level - a.level || a.username.localeCompare(b.username)
    }
  })
}
