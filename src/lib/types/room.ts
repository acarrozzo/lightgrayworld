import { EquipSlot } from '@prisma/client'

export interface RoomItemTemplate {
  id: string
  slug: string
  name: string
  description: string
  type: string
  value: number
  canSell?: boolean
  canDrop?: boolean
  equipSlot?: EquipSlot | null
  metadata?: { icon?: string } | null
}

export interface RoomItemView {
  id: string
  quantity: number
  /** Who left the pile (latest dropper), for the "left by" rail. */
  droppedBy?: string | null
  /** When the pile was last added to, ISO. */
  droppedAt?: string | null
  template: RoomItemTemplate
}

/**
 * A harvest node's status for this player: the rolling cooldown, what a
 * click yields, and the tool tiers so the client can label the button with
 * the hatchet the player will actually swing.
 */
export interface GatherCooldownView {
  action: string
  cooldownSeconds: number
  secondsRemaining: number
  quantity?: number | null
  itemSlug?: string | null
  itemNamePlural?: string | null
  readyLabel?: string | null
  toolRequired?: string | null
  toolTiers?: Array<{ slug: string; quantity?: number; label: string }> | null
  /** A rolled batch, [min, max]; when set, the tiers do not change the yield. */
  quantityRange?: [number, number] | null
  /** The room stops this gather once the player holds this many. */
  heldCap?: number | null
}

/**
 * One line of a room's supply shelf: something the room hands this player for
 * free, per player (config/room-supplies.js). `held` and `available` are this
 * player's; the next visitor gets their own.
 */
export interface SupplyView {
  id: string
  roomId: string
  slug: string
  name: string
  description: string | null
  type: string
  equipSlot: string | null
  metadata: unknown
  /** 'take' — one each while held; 'topUp' — refill to `cap`. */
  mode: 'take' | 'topUp'
  cap: number
  held: number
  /** How many a take would hand over right now (0 when at the line or the bag is full). */
  available: number
  /** The bag's own limit for this item, shown only when it is what stops the take. */
  bagMax: number | null
  takeLabel: string
  plural: string
  /** A guild id when this is a guild pack's item: members only. */
  requiresMembership: string | null
  /** True for a non-member of `requiresMembership`; a take is refused with `lockedMessage`. */
  locked: boolean
  lockedMessage: string | null
}

export interface RoomViewNavigation {
  north?: string
  northeast?: string
  east?: string
  southeast?: string
  south?: string
  southwest?: string
  west?: string
  northwest?: string
  up?: string
  down?: string
}

/** One action a traveler offers while standing here ("talk to sherman"). */
export interface TravelerActionView {
  action: string
  label: string
  icon?: string
  className?: string
}

/**
 * A traveler standing in a room, as the server describes it: shared by everyone
 * there, gone when it moves on. `enemy` is present for one that can be fought.
 */
export interface TravelerView {
  id: string
  kind: 'creature' | 'npc' | string
  name: string
  title?: string | null
  description: string
  icon: string
  iconFile: string
  actions: TravelerActionView[]
  enemy: {
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
  } | null
  /** For a scheduled traveler, when it moves on; null for a wanderer. */
  leavesAt?: number | null
}

/**
 * The lair's boss, resting for this player (server: services/boss-rest-service;
 * the rule: game-data/boss-rest.js). Per player: your Gator is down for you.
 * `secondsRemaining` is the server's count at the moment the payload was
 * built; the client turns it into a deadline on receipt rather than trusting
 * its own clock against `restingUntil`.
 */
export interface BossRestView {
  slug: string
  name: string
  level: number
  rank: 'boss' | 'miniboss'
  /** Its lair; the victory's note carries it so the client knows which room the strip belongs to. */
  lair?: string
  restMinutes: number
  /** Server epoch ms when the rest ends. */
  restingUntil: number
  secondsRemaining: number
  totalSeconds: number
  /** The lair's Boss Chest, once per kill, or null when the boss has none yet. */
  chest: { action: string; label: string; opened: boolean } | null
  /** The temporary tester is on for this server (BOSS_REST_TEST=1). */
  testReset: boolean
}

/** A lair's boss as the room card draws it before it stands there: the registry's numbers. */
export interface LairBossView {
  slug: string
  name: string
  description?: string
  icon?: string
  level: number
  hp: number
  att: number
  def: number
  isAggressive: boolean
  isFriendly?: boolean
  isFlying?: boolean
  rank: 'boss' | 'miniboss'
  damageType?: 'MELEE' | 'RANGED' | 'MAGIC'
  specials?: string[]
  isMeleeImmune?: boolean
  isRangedImmune?: boolean
  isMagicImmune?: boolean
}

export interface RoomView extends RoomViewNavigation {
  id: string
  roomId: string
  name: string
  subtitle: string
  subtitlePosition?: 'above' | 'below' | string
  /**
   * The world region this room belongs to. Drives its themed colours; the
   * four *Color fields below are per-room overrides on top of it and hold
   * semantic tokens, never CSS classes. See src/lib/theme/room-colors.ts.
   */
  region?: string | null
  nameColor?: string | null
  subtitleColor?: string | null
  icon?: string | null
  iconColor?: string | null
  iconSize?: string | null
  directionColors?: Record<string, string> | null
  description: string
  dangerLevel: number
  /** The seeded flag, or true for you while this lair's boss rests. */
  isSafe: boolean
  /** Set while this lair's boss rests for you; null or absent otherwise. */
  bossRest?: BossRestView | null
  /**
   * The ranked enemy whose lair this room is, whatever its state, so the
   * card can draw its box all the time. Null for a room that is no lair.
   */
  lairBoss?: LairBossView | null
  hasSearch?: boolean
  stateNote?: string | null
  actionOverrides?: Record<string, { className?: string; icon?: string }> | null
  /**
   * Directions out of this room that carry a gate, derived server-side from
   * ROOM_GATES. Only *whether* an exit is gated — never the condition.
   */
  gatedExits?: string[]
  players: any[]
  items: RoomItemView[]
  npcs: any[]
  /** Who is passing through right now. Live: updated by `room:travelers`. */
  travelers?: TravelerView[]
  /**
   * Client-only: the last departure from this room, shown in the room panel
   * for a short while so a player without the feed open still sees which way
   * the traveler went. Replaced by the next room.
   */
  travelerNote?: { message: string; ts: number } | null
  /**
   * Client-only: the last spoken line in this room (a keeper's talk button,
   * "listen in"), pinned in the room panel until the next line or the next
   * room. Set from `action:feedback` payloads that carry `roomLine`.
   */
  roomLine?: { message: string; ts: number } | null
}


