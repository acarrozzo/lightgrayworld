import type { Player } from '@/lib/game-state'
import type { PartyMemberBattlePayload, PartySnapshot, PresencePlayer } from '@/lib/socket'
import type { PlayerPresenceStatus, PlayerRowStats } from '@/components/player/PlayerRow'
import { dangerVerdict } from '@/lib/danger-verdict'

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

export type SquadState = 'down' | 'fighting' | 'hurt' | 'idle' | 'offline' | 'safe' | 'ready'

/** A teammate's fight as the party sees it: the live half of the party:member-battle payload. */
export type BattleGlance = Extract<PartyMemberBattlePayload, { enemyName: string | null }>

/** The room read against one member's level — the same ladder the compass uses. */
export interface RoomDanger {
  dangerLevel?: number | null
  isSafe?: boolean | null
}

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
  /** How the fight is going, when this is a teammate and the server has said. */
  battle: BattleGlance | null
  presence: PlayerPresenceStatus
  lastSeen?: number | null
  isLeader: boolean
  isSelf: boolean
  /** In the viewer's own party. False for the people merely standing here. */
  inParty: boolean
  /** Leads a party of their own — only ever set on someone outside yours. */
  leadsOwnParty: boolean
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
  level: number
  roomDanger?: RoomDanger | null
}): SquadState {
  if (typeof m.hp === 'number' && m.hp <= 0) return 'down'
  // A fight outranks being disconnected: the enemy is still swinging.
  if (m.inBattle) return 'fighting'
  if (m.presence === 'disconnected') return 'offline'
  if (m.hpPct !== null && m.hpPct <= LOW_HP_FRACTION * 100) return 'hurt'
  if (m.presence === 'idle') return 'idle'
  // Nothing wrong, and nothing here can hurt them — read against *their* level,
  // so a room that is a stroll for the leader can still be even odds for the
  // level-3 who followed them in.
  if (m.roomDanger) {
    const tone = dangerVerdict(m.roomDanger.dangerLevel, m.roomDanger.isSafe, m.level).tone
    if (tone === 'safe' || tone === 'easy') return 'safe'
  }
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
    case 'fighting': {
      const name = m.battleEnemyName ?? m.battle?.enemyName ?? 'Fighting'
      return m.battle?.enemyHpPct != null ? `${name} ${m.battle.enemyHpPct}%` : name
    }
    case 'idle': {
      const ago = shortAgo(m.lastSeen)
      return ago ? `Idle ${ago}` : 'Idle'
    }
    case 'safe':
      return typeof m.hp === 'number' && typeof m.hpMax === 'number' ? `${m.hp}/${m.hpMax}` : 'Safe'
    default:
      return typeof m.hp === 'number' && typeof m.hpMax === 'number' ? `${m.hp}/${m.hpMax}` : '—'
  }
}

interface BuildSquadInput {
  party: PartySnapshot | null
  /** The room everyone is standing in, for the per-member safety reading. */
  roomDanger?: RoomDanger | null
  /** Everyone the room snapshot knows about, self included. */
  roomPlayers: Player[]
  /** The global presence roster, keyed by user id. */
  presenceById: Record<string, PresencePlayer>
  currentPlayerId: string
  /** The viewer's own live player, which beats every feed for their own row. */
  self?: Player | null
  /** Each teammate's fight at a glance, keyed by user id. Party members only. */
  glanceById?: Record<string, BattleGlance>
}

/**
 * One person, merged from every feed that knows something about them.
 *
 * Shared by the party tiles and the tiles for people merely standing here, so
 * "who is in this room" and "who am I travelling with" are described in exactly
 * the same terms — which is the point: you should be able to read someone's HP
 * and whether they are mid-fight *before* deciding to follow them.
 */
function mergeMember({
  info,
  live,
  room,
  isSelf,
  self,
  isLeader,
  inParty,
  leadsOwnParty,
  partyLeaderId,
  roomDanger,
  glance,
}: {
  info: { id: string; username: string; level: number; uIcon?: string | null; uIconColor?: string | null }
  live?: PresencePlayer
  room?: Player
  isSelf: boolean
  self?: Player | null
  isLeader: boolean
  inParty: boolean
  leadsOwnParty: boolean
  partyLeaderId: string | null
  roomDanger?: RoomDanger | null
  glance?: BattleGlance | null
}): SquadMember {
  const own = isSelf ? self ?? room : null

  const hp = own?.hp ?? live?.hp ?? room?.hp
  const hpMax = own?.hpMax ?? live?.hpMax ?? room?.hpMax
  const mp = own?.mp ?? live?.mp ?? room?.mp
  const mpMax = own?.mpMax ?? live?.mpMax ?? room?.mpMax

  // Presence never carries 'disconnected' — a player without a socket is
  // simply absent from it — so an entry missing there while the room still
  // remembers them is exactly the ghost case.
  const presence: PlayerPresenceStatus = live ? live.status : room?.presenceStatus ?? 'disconnected'

  const inBattle = Boolean(live?.inBattle ?? room?.inBattle ?? false)
  const battleEnemyName = inBattle ? live?.battleEnemyName ?? room?.battleEnemyName ?? null : null

  const hpPct = pct(hp, hpMax)
  const level = own?.level ?? live?.level ?? room?.level ?? info.level
  const member: SquadMember = {
    id: info.id,
    username: info.username,
    level,
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
    // A glance outlives its fight by at most one packet; the presence flag is
    // the authority on whether there is a fight at all.
    battle: inBattle ? glance ?? null : null,
    presence,
    lastSeen: live?.lastSeen ?? room?.lastSeen ?? null,
    isLeader,
    isSelf,
    inParty,
    leadsOwnParty,
    state: deriveState({ hp, hpPct, inBattle, presence, level, roomDanger }),
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
      partyLeaderId,
    },
  }
  member.statusLabel = deriveLabel(member)
  return member
}

/**
 * The party as a list, leader first, then members in join order.
 *
 * Returns [] when the viewer is not in a party — a party of one is not a party
 * anywhere else in this system either.
 */
export function buildSquad({
  party,
  roomDanger,
  roomPlayers,
  presenceById,
  currentPlayerId,
  self,
  glanceById,
}: BuildSquadInput): SquadMember[] {
  if (!party) return []

  const roomById = new Map(roomPlayers.map((p) => [p.id, p]))

  return [party.leader, ...party.members].map((info) =>
    mergeMember({
      info,
      live: presenceById[info.id],
      room: roomById.get(info.id),
      isSelf: info.id === currentPlayerId,
      self,
      isLeader: info.id === party.leaderId,
      inParty: true,
      leadsOwnParty: false,
      partyLeaderId: party.leaderId,
      roomDanger,
      glance: glanceById?.[info.id] ?? null,
    })
  )
}

/**
 * The people standing here who are not in your party, described the same way
 * your party is.
 *
 * The bar used to show these as bare "+ follow Tam" chips, which asked the
 * player to commit to travelling with someone before it would tell them
 * anything about them. A tile carries their level, their HP, and whether they
 * are mid-fight, so following is a decision rather than a guess.
 */
export function buildOutsiders({
  party,
  roomDanger,
  roomPlayers,
  presenceById,
  currentPlayerId,
}: BuildSquadInput): SquadMember[] {
  return followableHere(roomPlayers, party, currentPlayerId).map((p) =>
    mergeMember({
      info: p,
      live: presenceById[p.id],
      room: p,
      isSelf: false,
      self: null,
      // Never "Leader" — that badge means the leader of *your* party. Somebody
      // heading a group of their own is called out separately.
      isLeader: false,
      inParty: false,
      leadsOwnParty: p.partyLeaderId === p.id,
      partyLeaderId: p.partyLeaderId ?? null,
      roomDanger,
    })
  )
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
