import { Server } from 'socket.io'

// Socket event types
export type ActionFeedbackOutcome = 'success' | 'failure' | 'info'

export interface ActionFeedbackPayload {
  action: string
  message: string
  ts: number
  outcome: ActionFeedbackOutcome
  timestamp?: string
  success?: boolean
  data?: Record<string, any>
  eventType?: string
  roomId?: string
  actorId?: string
  actorName?: string
  actionId?: string
  meta?: Record<string, any>
}

export interface BattleSnapshot {
  enemySlug: string
  enemyName: string
  enemyCurrentHp: number
  enemyMaxHp: number
  turnCount: number
  canFlee: boolean
}

/**
 * One tag in the enemy's trait row — a perk (power, bite…), Flying, its attack
 * type, or an immunity. Derived server-side from the enemy definition by
 * game-data/enemy-traits.js; `tone` is a semantic colour role the UI maps.
 */
export interface EnemyTrait {
  id: string
  label: string
  title: string
  tone: 'crit' | 'poison' | 'sky' | 'str' | 'dex' | 'mag'
}

export interface BattleStartedPayload extends BattleSnapshot {
  enemyIcon: string
  enemyLevel: number
  enemyAtt: number
  enemyDef: number
  enemyDescription: string
  enemyTraits: EnemyTrait[]
  isAdvantageTurn: boolean
  playerHp: number
  playerHpMax: number
  playerStr: number
  playerDef: number
  isAggressive?: boolean
}

/**
 * The special (perk) an enemy used on this attack — Power Attack today, with
 * Bite/Rage/Crit/Heal to follow. `null` on a normal attack. Server-declared:
 * the client must never infer a special from the damage numbers or the message.
 * `rolls` holds the individual attack rolls the special produced, so the UI can
 * show the real breakdown (3 + 2 + 1) instead of a single opaque total.
 */
export interface BattleEnemyAction {
  id: string
  name: string
  rolls: number[]
}

export interface BattleSupportActionMeta {
  kind:
    | 'use_item'
    | 'equip_item'
    | 'unequip_item'
    | 'cast_spell'
    | 'auto_equip'
    | 'search'
    | 'pickup_item'
    | 'drop_item'
    | 'take_supply'
    | 'rest'
    | 'room_action'
  /** Null on a turn that was not about an item (a search, a swing of a pickaxe). */
  itemSlug: string | null
  itemName: string | null
  itemMetadata: { icon?: string } | null
  actionVerb: string | null
  effectText: string | null
  /** Eyebrow for a non-item turn ("Searched", "Mine here"); the kind names it otherwise. */
  label?: string | null
  /** The whole line for a non-item turn — the action's own feed message. */
  text?: string | null
}

/**
 * A spell the player struck with this turn. Server-declared, like enemy
 * specials: the client never infers a cast from the numbers. `text` is the
 * roll breakdown behind `amount`; both are empty when the enemy is immune to
 * magic and nothing was rolled (or charged).
 */
export interface BattleSpellCast {
  id: string
  name: string
  level: number
  cost: number
  icon: string
  attackIcon: string
  hue: string
  amount: number
  rolls: number[]
  text: string | null
}

/**
 * A skill the player struck with this turn — a weapon swing plus the skill's
 * bonus. Server-declared like a cast. `weaponRaw` and `bonus` are the split
 * behind the turn's `playerRaw`; `text` is "weapon + bonus", null when a
 * Magic Strike fizzled on a magic-immune enemy (no bonus rolled or charged).
 */
export interface BattleSkillUse {
  id: string
  name: string
  level: number
  cost: number
  icon: string
  attackIcon: string
  hue: string
  magic: boolean
  weaponRaw: number
  bonus: number
  bonusMax: number
  rolls: number[]
  text: string | null
}

export interface BattleTurnPayload extends BattleSnapshot {
  playerHp: number
  playerHpMax: number
  /** Present on a spell turn: the MP left after paying for the cast. */
  playerMp?: number
  playerMpMax?: number
  playerDealtDamage: number
  enemyDealtDamage: number
  playerRaw: number | null
  enemyRaw: number
  playerBlocked: number
  enemyBlocked: number
  playerStrMax: number | null
  playerDefMax: number
  enemyStrMax: number
  multiplayerBonus: boolean
  bonusPercent: number
  missedFlyingMelee?: boolean
  weaponCategory?: 'MELEE' | 'RANGED' | null
  enemyDamageType?: 'MELEE' | 'RANGED' | 'MAGIC' | null
  enemyAction?: BattleEnemyAction | null
  /**
   * Present only for weapons that spend ammo (bows spend arrows, the crossbow
   * spends bolts). `remaining` is the count left after this turn's shot; it is
   * null on a turn that fired nothing (e.g. an enemy advantage turn).
   */
  ammo?: { slug: string; remaining: number | null } | null
  actionMeta?: BattleSupportActionMeta | null
  spell?: BattleSpellCast | null
  /** The skill the player struck with this turn, or null for a plain swing or a spell. */
  skill?: BattleSkillUse | null
  immuneToMagic?: boolean
  /** 'MELEE' | 'RANGED' when the enemy shrugged the weapon off; null otherwise. */
  immuneToWeapon?: 'MELEE' | 'RANGED' | null
  /** The companion's swing this turn, or null with nothing in the slot. */
  companion?: BattleCompanionStrike | null
  /** True when the Dodge skill turned the enemy's swing into nothing. */
  playerDodged?: boolean
  /** What Magic Armor absorbed of this hit, and what it has left. */
  absorbed?: number
  magicArmorLeft?: number
  /** Set when this hit left poison on the player. */
  poisonApplied?: { clicks: number } | null
  message: string
}

/** The equipped companion's own roll, reported beside the player's hit. */
export interface BattleCompanionStrike {
  name: string
  roll: number
  block: number
  damage: number
}

export interface BattleLastTurn {
  playerDealtDamage: number
  enemyDealtDamage: number
  playerRaw: number | null
  enemyRaw: number
  playerBlocked: number
  enemyBlocked: number
  playerStrMax: number
  playerDefMax: number
  enemyStrMax: number
  multiplayerBonus: boolean
  bonusPercent: number
  missedFlyingMelee?: boolean
  weaponCategory?: 'MELEE' | 'RANGED' | null
  enemyDamageType?: 'MELEE' | 'RANGED' | 'MAGIC' | null
  enemyAction?: BattleEnemyAction | null
  spell?: BattleSpellCast | null
  skill?: BattleSkillUse | null
  immuneToMagic?: boolean
  immuneToWeapon?: 'MELEE' | 'RANGED' | null
  companion?: BattleCompanionStrike | null
  playerDodged?: boolean
}

export interface BattleSummary {
  outcome: 'WIN' | 'LOSS'
  enemyName: string
  enemyIcon: string
  enemySlug: string
  turnsCount: number
  totalDamageDealt: number
  totalDamageReceived: number
  maxSingleHit: number
  xpEarned: number
  goldEarned: number
  itemsDropped: string[]
  dropDetails?: BattleDropDetail[]
  multiplayerBonus: boolean
  lastTurn: BattleLastTurn | null
}

export interface BattleDropDetail {
  slug: string
  qty: number
  firstKill: boolean
}

// The enemy present in a room, as sent to the client for the room display.
// Structurally matches RoomEnemy in components/RoomBox.tsx.
/**
 * A room's travelers changed — one arrived, left, was killed or came back.
 * Carries the room's whole current list (replace, don't merge) and the one feed
 * line that explains the change. Sent to everyone in the room.
 */
export interface RoomTravelersPayload {
  roomId: string
  travelers: import('./types/room').TravelerView[]
  line: { message: string; outcome: ActionFeedbackOutcome } | null
  /** What happened here: someone arrived, left, was killed, or came back. */
  change?: 'arrive' | 'leave' | 'gone' | 'respawn' | null
  ts: number
}

export interface RoomEnemySnapshot {
  slug: string
  name: string
  description: string
  icon: string
  level: number
  hp: number
  att: number
  def: number
  isAggressive: boolean
  isFriendly: boolean
}

export interface BattleVictoryPayload {
  enemyName: string
  xpAwarded: number
  goldAwarded: number
  droppedItems: string[]
  message: string
  /** Present when the finishing blow was a spell: the MP left after paying for it. */
  playerMp?: number
  playerMpMax?: number
  lastTurnResult?: Record<string, any>
  summary?: BattleSummary
  // True when the room is empty again after this kill (a probabilistic room's
  // one enemy is gone). False for static rooms, whose enemy is always there.
  clearRoomEnemies?: boolean
}

export interface BattleDefeatPayload {
  enemyName: string
  respawnRoomId: string
  /** 0: the player is dead until they rise. */
  playerHp?: number
  /** Every buff countdown after death zeroed them. */
  buffs?: Record<string, number> | null
  message: string
  summary?: BattleSummary
}

export interface BattleFledPayload {
  message: string
  // The room the player retreats to on flee (the room they came from), or null
  // when there's no prior room to fall back to.
  returnRoomId?: string | null
}

export interface LevelUpPayload {
  newLevel: number
  cpGained: number
  tpGained: number
  spGained: number
  hpGained: number
  mpGained: number
}

export interface PartyMemberInfo {
  id: string
  username: string
  level: number
  uIcon?: string | null
  uIconColor?: string | null
}

export interface PartySnapshot {
  /** Stable for the life of the party, including across a change of leader. */
  id: string
  leaderId: string
  leader: PartyMemberInfo
  members: PartyMemberInfo[]
  size: number
  maxSize: number
  /** A closed party refuses new followers. Only the leader can set it. */
  closed: boolean
  /** What the leader calls this lot; null means plain "Party". */
  name: string | null
}

/**
 * One line about the party, addressed to the people still in it.
 *
 * `kind` says what happened, not how to draw it — the feed picks its wording and
 * colour from it. Sent by the server only; there is no client-authored notice.
 */
export type PartyNoticeKind =
  | 'join'
  | 'leave'
  | 'fallen'
  | 'left-behind'
  | 'kill'
  | 'level'
  | 'closed'
  | 'named'
  | 'asked'
  | 'declined'

/** Somebody wants to travel behind you, and is waiting on your answer. */
export interface PartyFollowRequestPayload {
  requesterId: string
  requesterName: string
  requesterLevel: number
  /** True when saying yes makes the viewer a party leader for the first time. */
  wouldBecomeLeader: boolean
  /** Epoch ms; the ask lapses on its own after this. */
  expiresAt: number
}

/** Your own ask is on the table; the Follow control reads Pending until it resolves. */
export interface PartyFollowPendingPayload {
  targetId: string
  targetName: string
  expiresAt: number
}

/** The ask is over. Sent to both ends so neither is left showing a stale state. */
export interface PartyFollowResolvedPayload {
  requesterId: string
  targetId: string
  outcome: 'accepted' | 'declined' | 'cancelled' | 'expired'
  /** Why, when there is a why worth showing. */
  reason?: string | null
}

export interface PartyNoticePayload {
  id: string
  ts: number
  kind: PartyNoticeKind
  message: string
  /** Who the line is about, when it is about somebody. */
  actor?: string
}

/** One party chat message. Persisted under the party's id, so it survives a refresh. */
export interface PartyChatMessagePayload {
  id: string
  partyId: string
  userId: string
  username: string
  level: number
  message: string
  timestamp: Date
}

/** The tail of the party's conversation, sent on login and on joining a party. */
export interface PartyChatHistoryPayload {
  partyId: string
  messages: PartyChatMessagePayload[]
}

export interface PartyErrorPayload {
  message: string
}

export interface PartyPulledPayload {
  fromRoom?: string
  toRoom: string
  toRoomName?: string
  roomData?: Record<string, any>
}

export interface SocketEvents {
  // Client to server events
  'player-login': (data: Record<string, never>) => void
  'send-chat-message': (data: { message: string }) => void
  'send-room-chat-message': (data: { message: string; roomId: string }) => void
  'game-action': (data: { action: string }) => void
  'user:logout': () => void
  'party:follow': (data: { targetId: string }) => void
  'party:leave': () => void
  'party:remove': (data: { memberId: string }) => void
  'party:set-closed': (data: { closed: boolean }) => void
  'party:set-name': (data: { name: string }) => void
  'party:follow-answer': (data: { requesterId: string; accept: boolean }) => void
  'send-party-chat-message': (data: { message: string }) => void

  // Server to client events
  'player-joined': (player: PlayerInfo) => void
  'player-left': (player: { id: string; username: string; exitDirection?: string | null; isTeleport?: boolean }) => void
  'chat-message': (message: ChatMessage) => void
  'room-chat-message': (message: ChatMessage) => void
  'action-completed': (actionData: ActionData) => void
  'action:confirmed': (payload: ActionConfirmation) => void
  'action:feedback': (payload: ActionFeedbackPayload) => void
  'world:tick': (payload: WorldTickPayload) => void
  'room:player-moved': (payload: RoomPlayerMovedPayload) => void
  'world:activity': (payload: WorldActivityPayload) => void
  'direct-message': (payload: DirectMessagePayload) => void
  'battle:started': (payload: BattleStartedPayload) => void
  'battle:turn': (payload: BattleTurnPayload) => void
  'battle:victory': (payload: BattleVictoryPayload) => void
  'battle:defeat': (payload: BattleDefeatPayload) => void
  'battle:fled': (payload: BattleFledPayload) => void
  'player:level-up': (payload: LevelUpPayload) => void
  'party:updated': (payload: PartySnapshot) => void
  'party:disbanded': (payload: Record<string, never>) => void
  'party:removed': (payload: Record<string, never>) => void
  'party:error': (payload: PartyErrorPayload) => void
  'party:pulled': (payload: PartyPulledPayload) => void
  'party:notice': (payload: PartyNoticePayload) => void
  'party:follow-request': (payload: PartyFollowRequestPayload) => void
  'party:follow-pending': (payload: PartyFollowPendingPayload) => void
  'party:follow-resolved': (payload: PartyFollowResolvedPayload) => void
  'party-chat-message': (payload: PartyChatMessagePayload) => void
  'party:chat-history': (payload: PartyChatHistoryPayload) => void
  'room:party-state': (payload: RoomPartyStatePayload) => void
  'world:presence-sync': (payload: WorldPresenceSyncPayload) => void
  'world:presence-update': (payload: WorldPresenceUpdatePayload) => void
}

export interface PlayerInfo {
  id: string
  username: string
  level: number
  hp: number
  hpMax: number
  mp: number
  mpMax: number
  currentRoom: string
  isActive: boolean
  uIcon?: string | null
  uIconColor?: string | null
  str?: number | null
  dex?: number | null
  mag?: number | null
  def?: number | null
  strMod?: number | null
  dexMod?: number | null
  magMod?: number | null
  defMod?: number | null
  inBattle?: boolean
  battleEnemyName?: string | null
  partyLeaderId?: string | null
  entryDirection?: string | null
  isTeleport?: boolean
}

/**
 * One currently-connected player, as carried by the global presence feed.
 *
 * Presence is ephemeral and socket-derived: only players with a live socket
 * appear here. The durable `User.isActive` column is deliberately NOT presence —
 * it survives a crash and would strand players as permanently "online". Offline
 * players are backfilled by the client from /api/users/list instead.
 */
export interface PresencePlayer {
  id: string
  username: string
  level: number
  hp: number
  hpMax: number
  mp: number
  mpMax: number
  currentRoom: string | null
  uIcon?: string | null
  uIconColor?: string | null
  /** 'idle' mirrors the room-scoped idle detection; 'disconnected' never appears here. */
  status: 'active' | 'idle'
  inBattle: boolean
  /** What they are fighting, while they are fighting. Null otherwise. */
  battleEnemyName?: string | null
  partyLeaderId?: string | null
  lastSeen: number
}

/** Full roster snapshot, sent to a single socket on login. */
export interface WorldPresenceSyncPayload {
  players: PresencePlayer[]
  serverTime: number
}

/** Incremental roster change, broadcast to every connected client. */
export type WorldPresenceUpdatePayload =
  | { type: 'upsert'; player: PresencePlayer; serverTime: number }
  | { type: 'remove'; id: string; serverTime: number }

export interface RoomPartyStatePayload {
  roomId: string
  members: { id: string; partyLeaderId: string | null }[]
}

export interface ChatMessage {
  id: string
  userId: string
  username: string
  message: string
  timestamp: Date
  level: number
  roomId: string
}

export interface ActionData {
  id: string
  action: string
  message: string
  timestamp: Date
  roomId: string
  metadata?: string
  playerId: string
  playerName: string
}

export interface ActionConfirmation {
  action: string
  success: boolean
  data?: Record<string, any>
}

export interface RoomPlayerMovedPayload {
  playerId: string
  username: string
  fromRoom: string
  toRoom: string
}

export interface WorldActivityPayload {
  id: string
  ts: number
  type: 'world'
  level?: 'info' | 'error'
  actor?: string
  message: string
  eventType?: string
}

export interface DirectMessagePayload {
  id: string
  senderId: string
  senderUsername: string
  senderAvatar?: {
    uIcon?: string | null
    uIconColor?: string | null
  } | null
  recipientId: string
  recipientUsername: string
  message: string
  createdAt: string
  readAt?: string | null
}

export interface AmbientTickData {
  type: string
  message: string
  timestamp: number
}

export interface RoomTickUpdate {
  playerCount: number
  ambientData: AmbientTickData | null
}

export interface WorldTickPayload {
  tickId: number
  tickNumber: number
  timestamp: number
  nextTickAt: number
  tickIntervalMs: number
  roomId?: string
  update?: RoomTickUpdate
}

// Socket event constants
/**
 * Re-exported from the server's own list rather than copied.
 *
 * These were two hand-maintained tables that drifted in both directions, so the
 * client could not name an event the server emitted (every battle event, among
 * others) and listed one nothing emitted. `lib/socket-utils.js` is now the
 * single source; this keeps the familiar import path for client code.
 */
const { SOCKET_EVENTS: CANONICAL_SOCKET_EVENTS } = require('@/lib/socket-utils')

export const SOCKET_EVENTS: Readonly<Record<string, string>> = CANONICAL_SOCKET_EVENTS

let io: Server<SocketEvents> | null = null

export function setSocketIO(ioInstance: Server<SocketEvents>) {
  io = ioInstance
}

export function getSocketIO(): Server<SocketEvents> | null {
  return io
}

// Helper function to emit socket events with error handling
export function emitToRoom(roomId: string, event: keyof SocketEvents, data: any) {
  if (!io) {
    console.warn('Socket.io not initialized, cannot emit event:', event)
    return false
  }
  
  try {
    io.to(`room-${roomId}`).emit(event, data)
    return true
  } catch (error) {
    console.error('Failed to emit socket event:', error)
    return false
  }
}
