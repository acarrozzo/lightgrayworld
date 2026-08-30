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

export interface BattleStartedPayload extends BattleSnapshot {
  enemyIcon: string
  enemyLevel: number
  enemyAtt: number
  enemyDef: number
  enemyDescription: string
  isAdvantageTurn: boolean
  playerHp: number
  playerHpMax: number
  playerStr: number
  playerDef: number
  isAggressive?: boolean
}

export interface BattleSupportActionMeta {
  kind: 'use_item' | 'equip_item' | 'unequip_item'
  itemSlug: string
  itemName: string
  itemMetadata: { icon?: string } | null
  actionVerb: string
  effectText: string | null
}

export interface BattleTurnPayload extends BattleSnapshot {
  playerHp: number
  playerHpMax: number
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
  /**
   * Present only for weapons that spend ammo (bows spend arrows, the crossbow
   * spends bolts). `remaining` is the count left after this turn's shot; it is
   * null on a turn that fired nothing (e.g. an enemy advantage turn).
   */
  ammo?: { slug: string; remaining: number | null } | null
  actionMeta?: BattleSupportActionMeta | null
  message: string
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

// A room-enemy snapshot as sent to the client for the room roster display.
// Structurally matches RoomEnemy in components/RoomBox.tsx.
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
  lastTurnResult?: Record<string, any>
  summary?: BattleSummary
  // Multi-enemy waves: the enemies still present after this kill, and whether the
  // whole wave is cleared. Absent for static (non-probabilistic) rooms.
  remainingEnemies?: RoomEnemySnapshot[]
  clearRoomEnemies?: boolean
}

export interface BattleDefeatPayload {
  enemyName: string
  respawnRoomId: string
  playerHp?: number
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
  leaderId: string
  leader: PartyMemberInfo
  members: PartyMemberInfo[]
  size: number
  maxSize: number
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

  // Server to client events
  'player-joined': (player: PlayerInfo) => void
  'player-left': (player: { id: string; username: string; exitDirection?: string | null; isTeleport?: boolean }) => void
  'chat-message': (message: ChatMessage) => void
  'room-chat-message': (message: ChatMessage) => void
  'action-completed': (actionData: ActionData) => void
  'player-action': (actionData: PlayerAction) => void
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

export interface PlayerAction {
  playerId: string
  username: string
  action: string
  timestamp: Date
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
export const SOCKET_EVENTS = {
  // Client to server
  PLAYER_LOGIN: 'player-login',
  SEND_CHAT_MESSAGE: 'send-chat-message',
  SEND_ROOM_CHAT_MESSAGE: 'send-room-chat-message',
  GAME_ACTION: 'game-action',
  USER_LOGOUT: 'user:logout',
  PARTY_FOLLOW: 'party:follow',
  PARTY_LEAVE: 'party:leave',
  PARTY_REMOVE: 'party:remove',

  // Server to client
  PARTY_UPDATED: 'party:updated',
  PARTY_DISBANDED: 'party:disbanded',
  PARTY_REMOVED: 'party:removed',
  PARTY_ERROR: 'party:error',
  PARTY_PULLED: 'party:pulled',
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
  CHAT_MESSAGE: 'chat-message',
  ROOM_CHAT_MESSAGE: 'room-chat-message',
  ACTION_COMPLETED: 'action-completed',
  PLAYER_ACTION: 'player-action',
  ACTION_CONFIRMED: 'action:confirmed',
  ACTION_FEEDBACK: 'action:feedback',
  WORLD_TICK: 'world:tick',
  ROOM_PLAYER_MOVED: 'room:player-moved',
  WORLD_ACTIVITY: 'world:activity',
  DIRECT_MESSAGE: 'direct-message',
  BATTLE_STARTED: 'battle:started',
  BATTLE_TURN: 'battle:turn',
  BATTLE_VICTORY: 'battle:victory',
  BATTLE_DEFEAT: 'battle:defeat',
  BATTLE_FLED: 'battle:fled',
  PLAYER_LEVEL_UP: 'player:level-up',
  PLAYER_CLICKS_UPDATE: 'player:clicks-update',
  PLAYER_IDLE: 'player-idle',
  PLAYER_RETURNED: 'player-returned',
  PLAYER_BATTLE_STATUS: 'player-battle-status',
  PLAYER_VITALS: 'player-vitals',
  ROOM_PARTY_STATE: 'room:party-state',
  WORLD_PRESENCE_SYNC: 'world:presence-sync',
  WORLD_PRESENCE_UPDATE: 'world:presence-update',
} as const

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
