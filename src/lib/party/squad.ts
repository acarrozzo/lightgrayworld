import type { Player } from '@/lib/game-state'
import type { PartySnapshot, PresencePlayer } from '@/lib/socket'
import type { PlayerPresenceStatus, PlayerRowStats } from '@/components/player/PlayerRow'

/**
 * One party member as every party surface needs them.
 *
 * The party snapshot is identity only — who is in the party, in what order, who
 * leads — and it is frozen at the moment each person joined. Everything that
 * moves (HP, MP, level, what they are fighting, whether they have gone idle)
 * lives in the live feeds, and this module is the one place the two are put
 * together, so the squad bar, the member sheet and the Players tab cannot
 * disagree about what a teammate is doing.
 *
 * Precedence is deliberate: the viewer's own store beats everything for their
 * own row, then global presence, then the room snapshot, then the frozen party
 * row. Presence outranks the room list because a member pulled into a new room
 * has a live presence entry before the room's player list has been refetched.
 */

/** Below this fraction of max HP a member is in trouble and the UI says so. */
export const LOW_HP_FRACTION = 0.25

export type SquadState = 'down' | 'fighting' | 'hurt' | 'idle' | 'offline' | 'ready'

export interface SquadMember {
  id: string
  username: string
  level: number
  uIcon?: string | null
  uIconColor?: string | null
  hp?: number
  hpMax?: number
  mp?: number
  mpMax?: number
  /** 0–100, or null when we have no vitals for them at all. */
  hpPct: number | null
  mpPct: number | null
  inBattle: boolean
  battleEnemyName: string | null
  presence: PlayerPresenceStatus
  lastSeen?: number | null
  isLeader: boolean
  isSelf: boolean
  state: SquadState
  /** The one line under the name: what they are fighting, or their HP, or why they are quiet. */
  statusLabel: string
  /** Everything PlayerRow needs, so the member sheet reuses the shared row. */
  stats: PlayerRowStats
}

function pct(cur?: number, max?: number): number | null {
  if (typeof cur !== 'number' || !max || max <= 0) return null
  return Math.max(0, Math.min(100, Math.round((cur / max) * 100)))
}

/**
 * The worst true thing about a member, which is what the tile shows.
 *
 * Order matters and is not severity for its own sake: it is what the viewer
 * would act on first. Dead outranks fighting because there is nothing left to
 * help with; fighting outranks hurt because a fight is still being lost.
 */
function deriveState(m: {
  hp?: number
  hpPct: number | null
  inBattle: boolean
  presence: PlayerPresenceStatus
}): SquadState {
  if (typeof m.hp === 'number' && m.hp <= 0) return 'down'
  if (m.presence === 'disconnected') return 'offline'
  if (m.inBattle) return 'fighting'
  if (m.hpPct !== null && m.hpPct <= LOW_HP_FRACTION * 100) return 'hurt'
  if (m.presence === 'idle') return 'idle'
  return 'ready'
}

function shortAgo(ts?: number | null): string {
  if (!ts) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function deriveLabel(m: SquadMember): string {
  switch (m.state) {
    case 'down':
      return 'Fallen'
    case 'offline':
      return 'Offline'
    case 'fighting':
      return m.battleEnemyName ?? 'Fighting'
    case 'idle': {
      const ago = shortAgo(m.lastSeen)
      return ago ? `Idle ${ago}` : 'Idle'
    }
    default:
      return typeof m.hp === 'number' && typeof m.hpMax === 'number' ? `${m.hp}/${m.hpMax}` : '—'
  }
}

interface BuildSquadInput {
  party: PartySnapshot | null
  /** Everyone the room snapshot knows about, self included. */
  roomPlayers: Player[]
  /** The global presence roster, keyed by user id. */
  presenceById: Record<string, PresencePlayer>
  currentPlayerId: string
  /** The viewer's own live player, which beats every feed for their own row. */
  self?: Player | null
}

/**
 * The party as a list, leader first, then members in join order.
 *
 * Returns [] when the viewer is not in a party — a party of one is not a party
 * anywhere else in this system either.
 */
export function buildSquad({
  party,
  roomPlayers,
  presenceById,
  currentPlayerId,
  self,
}: BuildSquadInput): SquadMember[] {
  if (!party) return []

  const roomById = new Map(roomPlayers.map((p) => [p.id, p]))

  return [party.leader, ...party.members].map((info) => {
    const live = presenceById[info.id]
    const room = roomById.get(info.id)
    const isSelf = info.id === currentPlayerId
    const own = isSelf ? self ?? room : null

    const hp = own?.hp ?? live?.hp ?? room?.hp
    const hpMax = own?.hpMax ?? live?.hpMax ?? room?.hpMax
    const mp = own?.mp ?? live?.mp ?? room?.mp
    const mpMax = own?.mpMax ?? live?.mpMax ?? room?.mpMax

    // Presence never carries 'disconnected' — a player without a socket is
    // simply absent from it — so an entry missing there while the room still
    // remembers them is exactly the ghost case.
    const presence: PlayerPresenceStatus = live
      ? live.status
      : room?.presenceStatus ?? 'disconnected'

    const inBattle = Boolean(live?.inBattle ?? room?.inBattle ?? false)
    const battleEnemyName = inBattle
      ? live?.battleEnemyName ?? room?.battleEnemyName ?? null
      : null

    const hpPct = pct(hp, hpMax)
    const member: SquadMember = {
      id: info.id,
      username: info.username,
      level: own?.level ?? live?.level ?? room?.level ?? info.level,
      uIcon: info.uIcon ?? room?.uIcon ?? live?.uIcon ?? null,
      uIconColor: info.uIconColor ?? room?.uIconColor ?? live?.uIconColor ?? null,
      hp,
      hpMax,
      mp,
      mpMax,
      hpPct,
      mpPct: pct(mp, mpMax),
      inBattle,
      battleEnemyName,
      presence,
      lastSeen: live?.lastSeen ?? room?.lastSeen ?? null,
      isLeader: info.id === party.leaderId,
      isSelf,
      state: deriveState({ hp, hpPct, inBattle, presence }),
      statusLabel: '',
      stats: {
        hp,
        hpMax,
        mp,
        mpMax,
        str: room?.str ?? null,
        dex: room?.dex ?? null,
        mag: room?.mag ?? null,
        def: room?.def ?? null,
        strMod: room?.strMod ?? null,
        dexMod: room?.dexMod ?? null,
        magMod: room?.magMod ?? null,
        defMod: room?.defMod ?? null,
        presenceStatus: presence,
        inBattle,
        battleEnemyName,
        partyLeaderId: party.leaderId,
      },
    }
    member.statusLabel = deriveLabel(member)
    return member
  })
}

/**
 * The players standing here that the viewer could follow.
 *
 * Same rule the party panel has always used: online, not you, not already in
 * your party, and not somebody else's rank-and-file member — you can only
 * follow a leader, because following joins the party they lead.
 */
export function followableHere(
  roomPlayers: Player[],
  party: PartySnapshot | null,
  currentPlayerId: string
): Player[] {
  const partyIds = new Set<string>(party ? [party.leaderId, ...party.members.map((m) => m.id)] : [])
  return roomPlayers.filter(
    (p) =>
      p.id !== currentPlayerId &&
      p.presenceStatus !== 'disconnected' &&
      !partyIds.has(p.id) &&
      !(p.partyLeaderId && p.partyLeaderId !== p.id)
  )
}

/**
 * The group bonus the viewer is fighting under, as a percentage.
 *
 * Mirrors `getOtherCombatantCount` in the engine's battle calculator: every
 * other player in this room who is in a battle of their own, plus every member
 * of the viewer's party who is standing here, counted once each at 10%. It is
 * shown before the fight because the reason to travel together should be
 * legible at the moment you decide to.
 */
export function groupBonusPercent(
  roomPlayers: Player[],
  party: PartySnapshot | null,
  currentPlayerId: string
): number {
  const counted = new Set<string>()
  for (const p of roomPlayers) {
    if (p.id !== currentPlayerId && p.inBattle && p.presenceStatus !== 'disconnected') counted.add(p.id)
  }
  if (party) {
    const here = new Set(roomPlayers.map((p) => p.id))
    for (const info of [party.leader, ...party.members]) {
      if (info.id !== currentPlayerId && here.has(info.id)) counted.add(info.id)
    }
  }
  return counted.size * 10
}
