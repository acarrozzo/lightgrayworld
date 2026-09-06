import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { RoomView, RoomItemView } from '@/lib/types/room'
import { EquipSlot, WeaponCategory } from '@prisma/client'
import { PartySnapshot } from '@/lib/socket'

export interface Player {
  id: string
  username: string
  level: number
  hp: number
  hpMax: number
  mp: number
  mpMax: number
  currentRoom: string
  isActive: boolean
  xp?: number
  cp?: number
  tp?: number
  sp?: number
  currency?: number
  physicalTraining?: number
  mentalTraining?: number
  str?: number
  dex?: number
  mag?: number
  def?: number
  strMod?: number
  dexMod?: number
  magMod?: number
  defMod?: number
  uIcon?: string
  uIconColor?: string
  presenceStatus?: 'active' | 'idle' | 'disconnected'
  /** True while this player is in an active battle (mirrors the server `inFight` flag). */
  inBattle?: boolean
  /** Leader id of the party this player belongs to (self if they lead); null/undefined = solo. */
  partyLeaderId?: string | null
  lastSeen?: number
  clicks?: number
  /**
   * Click-counted buff countdowns, keyed by the User column that stores them
   * (`wings`, `gills`, `buffStrClicks`, ...). Pushed on every counted action by
   * `player:clicks-update`; a value of 0 (or an absent key) means inactive.
   */
  buffs?: Record<string, number>
  /**
   * Spell levels keyed by the User column that stores them (`magicMissile`,
   * `fireball`, `heal`, ...). 0 or absent means unlearned. The registry in
   * game-data/spells.js turns these into costs, caps and previews.
   */
  spells?: Record<string, number>
  /** Spell teachers met, keyed by flag column (`pajamaShamanFlag`, ...). */
  spellTeachers?: Record<string, boolean>
  /**
   * Skill levels keyed by the User column that stores them (`oneHanded`,
   * `slice`, `toughness`, ...). 0 or absent means unlearned. The registry in
   * game-data/skills.js turns these into caps, costs, passives and previews.
   */
  skills?: Record<string, number>
  /** Skill teachers met, keyed by flag column (`youngSoldierFlag`, ...). */
  skillTeachers?: Record<string, boolean>
  deaths?: number
  /**
   * One-time gold chests opened, keyed by the User column that stores them.
   * game-data/gold-chests.js says which room each flag belongs to.
   */
  chest1?: boolean
  chest2?: boolean
  chest3?: boolean
  chest4?: boolean
  chest5?: boolean
  chest6?: boolean
  grassyFieldMap?: boolean
  grassyFieldUndergroundMap?: boolean
  forestUndergroundMap?: boolean
  redTownMap?: boolean
  redTownSewersMap?: boolean
  rockyFlatsMap?: boolean
  rockyFlatsUndergroundMap?: boolean
  neverEndingMineMap?: boolean
  oceanMap?: boolean
  oceanUnderwaterMap?: boolean
  darkForestMap?: boolean
  darkForestUpperMap?: boolean
  roomZeroMap?: boolean
  lobbyMap?: boolean
  solarOfficeMap?: boolean
  forestMap?: boolean
  /** Fast-travel hubs stood in, by world region id (game-data/world-map.js). */
  discoveredTeleports?: string[]
}

export type Room = RoomView

export interface InventoryItem {
  id: string
  quantity: number
  isEquipped: boolean
  slot?: string | null
  template: {
    id: string
    slug: string
    name: string
    type: string
    description: string
    max: number
    value: number
    canSell?: boolean
    canDrop?: boolean
    equipSlot?: EquipSlot | null
    weaponCategory?: WeaponCategory | null
    metadata?: { icon?: string; statMods?: { str?: number; dex?: number; mag?: number; def?: number } } | null
  }
}

export interface BattleActionMeta {
  kind: 'use_item' | 'equip_item' | 'unequip_item' | 'cast_spell'
  itemSlug: string
  itemName: string
  itemMetadata: { icon?: string } | null
  actionVerb: string
  effectText: string | null
}

/**
 * Client mirror of the server's spell-cast record (see lib/socket.ts). Present
 * on a turn the player spent casting an attack spell; `text` is the roll
 * breakdown ("2 + (9 × 1.10) = 12"), null when the cast fizzled on a
 * magic-immune enemy.
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
 * Client mirror of the server's skill-strike record (see lib/socket.ts).
 * Present on a turn the player struck with a skill; `weaponRaw` and `bonus`
 * are the split behind `playerRaw`, `text` is "weapon + bonus" (null when a
 * Magic Strike fizzled on a magic-immune enemy).
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

export interface BattleState {
  isInBattle: boolean
  isAdvantageTurn: boolean
  enemySlug: string | null
  enemyName: string | null
  enemyIcon: string | null
  enemyLevel: number | null
  enemyAtt: number | null
  enemyDef: number | null
  enemyCurrentHp: number
  enemyMaxHp: number
  turnCount: number
  canFlee: boolean
  playerHp: number
  playerHpMax: number
  playerStrMax: number | null
  playerDefMax: number | null
  lastPlayerDamage: number | null
  lastEnemyDamage: number | null
  playerRaw: number | null
  enemyRaw: number | null
  enemyStrMax: number | null
  playerBlocked: number | null
  enemyBlocked: number | null
  multiplayerBonus: boolean
  bonusPercent: number
  missedFlyingMelee: boolean
  weaponCategory: 'MELEE' | 'RANGED' | null
  enemyDamageType: 'MELEE' | 'RANGED' | 'MAGIC' | null
  /** The special the enemy used on the last attack, or null for a normal attack. */
  enemyAction: BattleEnemyAction | null
  /** Ammo left after the last shot, for weapons that spend it (bows, crossbow). */
  ammo: { slug: string; remaining: number | null } | null
  actionMeta: BattleActionMeta | null
  /** The spell the player struck with on the last turn, or null for a weapon swing. */
  spell: BattleSpellCast | null
  /** True when the last cast did nothing because the enemy is immune to magic. */
  immuneToMagic: boolean
  /** Set when the last swing did nothing because the enemy shrugs that weapon off. */
  immuneToWeapon: 'MELEE' | 'RANGED' | null
  /** The companion's swing on the last turn, or null with nothing in the slot. */
  companion: BattleCompanionStrike | null
  /** The skill the player struck with on the last turn, or null for a plain swing or a spell. */
  skill: BattleSkillUse | null
  /** True when the Dodge skill turned the enemy's last swing into nothing. */
  playerDodged: boolean
}

/** Client mirror of the server's companion strike (see lib/socket.ts). */
export interface BattleCompanionStrike {
  name: string
  roll: number
  block: number
  damage: number
}

const INITIAL_BATTLE_STATE: BattleState = {
  isInBattle: false,
  isAdvantageTurn: false,
  enemySlug: null,
  enemyName: null,
  enemyIcon: null,
  enemyLevel: null,
  enemyAtt: null,
  enemyDef: null,
  enemyCurrentHp: 0,
  enemyMaxHp: 0,
  turnCount: 0,
  canFlee: false,
  playerHp: 0,
  playerHpMax: 0,
  playerStrMax: null,
  playerDefMax: null,
  lastPlayerDamage: null,
  lastEnemyDamage: null,
  playerRaw: null,
  enemyRaw: null,
  enemyStrMax: null,
  playerBlocked: null,
  enemyBlocked: null,
  multiplayerBonus: false,
  bonusPercent: 0,
  missedFlyingMelee: false,
  ammo: null,
  weaponCategory: null,
  enemyDamageType: null,
  enemyAction: null,
  actionMeta: null,
  spell: null,
  immuneToMagic: false,
  immuneToWeapon: null,
  companion: null,
  skill: null,
  playerDodged: false,
}

/**
 * Client mirror of the server's enemy-special descriptor (see lib/socket.ts).
 * The server states which special fired; the UI never infers one from damage.
 */
export interface BattleEnemyAction {
  id: string
  name: string
  rolls: number[]
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
  immuneToMagic?: boolean
  immuneToWeapon?: 'MELEE' | 'RANGED' | null
  companion?: BattleCompanionStrike | null
  skill?: BattleSkillUse | null
  playerDodged?: boolean
}

export interface BattleResult {
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

export interface KillEntry {
  monster: string
  kills: number
}

export interface GameState {
  // Player state
  player: Player | null
  isLoggedIn: boolean
  token: string | null
  inventory: InventoryItem[]
  killList: KillEntry[]

  // Room state
  currentRoom: Room | null
  roomPlayers: Player[]
  roomCache: Record<string, Room>

  // Battle state
  battle: BattleState

  // Party state (ephemeral; null when not in a party)
  party: PartySnapshot | null

  // Post-battle result (shown after battle ends, null when dismissed)
  battleResult: BattleResult | null

  // UI state
  isLoading: boolean
  error: string | null

  // Actions
  setPlayer: (player: Player | null) => void
  setInventory: (inventory: InventoryItem[]) => void
  setKillList: (kills: KillEntry[]) => void
  incrementKill: (monster: string) => void
  setCurrentRoom: (room: Room | null) => void
  setRoomPlayers: (players: Player[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  login: (player: Player, token: string) => void
  logout: () => void
  getAuthHeaders: () => Record<string, string>
  cacheRoom: (room: Room) => void
  getCachedRoom: (roomId: string) => Room | null
  updateRoomItems: (roomId: string, items: RoomItemView[]) => void
  setBattleStarted: (payload: { isAdvantageTurn: boolean; enemySlug: string; enemyName: string; enemyIcon: string; enemyLevel: number; enemyAtt: number; enemyDef: number; enemyCurrentHp: number; enemyMaxHp: number; turnCount: number; canFlee: boolean; playerHp: number; playerHpMax: number; playerStr: number; playerDef: number }) => void
  updateBattleTurn: (payload: { enemyCurrentHp: number; enemyMaxHp: number; turnCount: number; canFlee: boolean; playerHp: number; playerHpMax: number; playerDealtDamage: number; enemyDealtDamage: number; playerRaw: number | null; enemyRaw: number; playerStrMax: number | null; playerDefMax: number; enemyStrMax: number; playerBlocked: number; enemyBlocked: number; multiplayerBonus: boolean; bonusPercent: number; missedFlyingMelee?: boolean; weaponCategory?: 'MELEE' | 'RANGED' | null; enemyDamageType?: 'MELEE' | 'RANGED' | 'MAGIC' | null; enemyAction?: BattleEnemyAction | null; ammo?: { slug: string; remaining: number | null } | null; actionMeta?: BattleActionMeta | null; spell?: BattleSpellCast | null; immuneToMagic?: boolean; immuneToWeapon?: 'MELEE' | 'RANGED' | null; companion?: BattleCompanionStrike | null; skill?: BattleSkillUse | null; playerDodged?: boolean; playerMp?: number; playerMpMax?: number }) => void
  clearBattle: () => void
  setBattleResult: (result: BattleResult) => void
  clearBattleResult: () => void
  setParty: (party: PartySnapshot | null) => void
  clearParty: () => void
  hydrateSession: (payload: {
    player?: Partial<Player> | null
    inventory?: InventoryItem[]
    party?: PartySnapshot | null
    battle?: Parameters<GameState['setBattleStarted']>[0] | null
  }) => void
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // Initial state
      player: null,
      isLoggedIn: false,
      token: null,
      inventory: [],
      killList: [],
      currentRoom: null,
      roomPlayers: [],
      roomCache: {},
      battle: { ...INITIAL_BATTLE_STATE },
      party: null,
      battleResult: null,
      isLoading: false,
      error: null,
      
      // Actions
      setPlayer: (player) => set({ player }),
      setInventory: (inventory) => set({ inventory }),
      setKillList: (killList) => set({ killList }),
      incrementKill: (monster) =>
        set((state) => {
          const existing = state.killList.find((k) => k.monster === monster)
          if (existing) {
            return { killList: state.killList.map((k) => k.monster === monster ? { ...k, kills: k.kills + 1 } : k) }
          }
          return { killList: [...state.killList, { monster, kills: 1 }] }
        }),
      setCurrentRoom: (currentRoom) => set({ currentRoom }),
      setRoomPlayers: (roomPlayers) => set({ roomPlayers }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      updateRoomItems: (roomId, items) =>
        set((state) => {
          const cachedRoom = state.roomCache[roomId]
          const nextCache = cachedRoom
            ? {
                ...state.roomCache,
                [roomId]: { ...cachedRoom, items },
              }
            : state.roomCache

          const isCurrent = state.currentRoom?.roomId === roomId

          return {
            ...state,
            roomCache: nextCache,
            currentRoom: isCurrent && state.currentRoom
              ? { ...state.currentRoom, items }
              : state.currentRoom,
          }
        }),
      
      login: (player, token) => set({ 
        player, 
        token,
        isLoggedIn: true,
        error: null 
      }),
      
      logout: () => set({
        player: null,
        token: null,
        isLoggedIn: false,
        inventory: [],
        currentRoom: null,
        roomPlayers: [],
        roomCache: {},
        battle: { ...INITIAL_BATTLE_STATE },
        party: null,
        battleResult: null,
        error: null
      }),

      getAuthHeaders: () => {
        const { token } = get()
        return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)
      },
      
      cacheRoom: (room) => {
        const { roomCache } = get()
        console.log('Caching room:', room.name, 'ID:', room.roomId)
        set({ 
          roomCache: { 
            ...roomCache, 
            [room.roomId]: room 
          } 
        })
      },
      
      getCachedRoom: (roomId) => {
        const { roomCache } = get()
        const cached = roomCache[roomId]
        console.log('Getting cached room for ID:', roomId, 'Found:', cached ? cached.name : 'None')
        return cached || null
      },

      setBattleStarted: (payload) =>
        set((state) => ({
          battle: {
            ...INITIAL_BATTLE_STATE,
            isInBattle: true,
            isAdvantageTurn: payload.isAdvantageTurn,
            enemySlug: payload.enemySlug,
            enemyName: payload.enemyName,
            enemyIcon: payload.enemyIcon,
            enemyLevel: payload.enemyLevel,
            enemyAtt: payload.enemyAtt,
            enemyDef: payload.enemyDef,
            enemyCurrentHp: payload.enemyCurrentHp,
            enemyMaxHp: payload.enemyMaxHp,
            turnCount: payload.turnCount,
            canFlee: payload.canFlee,
            playerHp: payload.playerHp,
            playerHpMax: payload.playerHpMax,
            playerStrMax: payload.playerStr,
            playerDefMax: payload.playerDef,
          },
          player: state.player ? { ...state.player, hp: payload.playerHp, hpMax: payload.playerHpMax } : state.player,
        })),

      updateBattleTurn: (payload) =>
        set((state) => ({
          battle: {
            ...state.battle,
            enemyCurrentHp: payload.enemyCurrentHp,
            enemyMaxHp: payload.enemyMaxHp,
            turnCount: payload.turnCount,
            canFlee: payload.canFlee,
            playerHp: payload.playerHp,
            playerHpMax: payload.playerHpMax,
            playerStrMax: payload.playerStrMax,
            playerDefMax: payload.playerDefMax,
            lastPlayerDamage: payload.playerDealtDamage,
            lastEnemyDamage: payload.enemyDealtDamage,
            playerRaw: payload.playerRaw,
            enemyRaw: payload.enemyRaw,
            enemyStrMax: payload.enemyStrMax,
            playerBlocked: payload.playerBlocked,
            enemyBlocked: payload.enemyBlocked,
            multiplayerBonus: payload.multiplayerBonus,
            bonusPercent: payload.bonusPercent,
            missedFlyingMelee: payload.missedFlyingMelee ?? false,
            weaponCategory: payload.weaponCategory ?? null,
            enemyDamageType: payload.enemyDamageType ?? null,
            enemyAction: payload.enemyAction ?? null,
            ammo: payload.ammo ?? null,
            actionMeta: payload.actionMeta ?? null,
            spell: payload.spell ?? null,
            immuneToMagic: payload.immuneToMagic ?? false,
            immuneToWeapon: payload.immuneToWeapon ?? null,
            companion: payload.companion ?? null,
            skill: payload.skill ?? null,
            playerDodged: payload.playerDodged ?? false,
          },
          // A spell turn also reports the MP it spent; a weapon turn leaves MP alone.
          player: state.player
            ? {
                ...state.player,
                hp: payload.playerHp,
                ...(typeof payload.playerMp === 'number' ? { mp: payload.playerMp } : {}),
                ...(typeof payload.playerMpMax === 'number' ? { mpMax: payload.playerMpMax } : {}),
              }
            : state.player,
        })),

      clearBattle: () =>
        set({ battle: { ...INITIAL_BATTLE_STATE } }),

      setBattleResult: (result) => set({ battleResult: result }),

      clearBattleResult: () => set({ battleResult: null }),

      setParty: (party) => set({ party }),

      clearParty: () => set({ party: null }),

      /**
       * Adopt the server's account-level state in one atomic update.
       *
       * Called on every login, including the automatic re-login after a
       * reconnect. Party and battle are applied *including their absence*: the
       * events that would normally clear them (`party:disbanded`, `battle:*`)
       * fire while the client is disconnected and are simply missed, so without
       * this a reconnect left a party strip for a group that no longer exists
       * and a battle panel that blocks movement with no way out but a refresh.
       */
      hydrateSession: (payload) =>
        set((state) => {
          const next: Partial<GameState> = {}

          if (payload.player) {
            // Merge rather than replace: the server's fields win, while any
            // client-only field already on the object survives.
            next.player = { ...(state.player ?? {}), ...payload.player } as Player
          }

          if (Array.isArray(payload.inventory)) {
            next.inventory = payload.inventory
          }

          if (payload.party !== undefined) {
            next.party = payload.party
          }

          if (payload.battle !== undefined) {
            next.battle = payload.battle
              ? {
                  ...INITIAL_BATTLE_STATE,
                  isInBattle: true,
                  isAdvantageTurn: payload.battle.isAdvantageTurn,
                  enemySlug: payload.battle.enemySlug,
                  enemyName: payload.battle.enemyName,
                  enemyIcon: payload.battle.enemyIcon,
                  enemyLevel: payload.battle.enemyLevel,
                  enemyAtt: payload.battle.enemyAtt,
                  enemyDef: payload.battle.enemyDef,
                  enemyCurrentHp: payload.battle.enemyCurrentHp,
                  enemyMaxHp: payload.battle.enemyMaxHp,
                  turnCount: payload.battle.turnCount,
                  canFlee: payload.battle.canFlee,
                  playerHp: payload.battle.playerHp,
                  playerHpMax: payload.battle.playerHpMax,
                  playerStrMax: payload.battle.playerStr,
                  playerDefMax: payload.battle.playerDef,
                }
              : { ...INITIAL_BATTLE_STATE }
          }

          return next
        }),
    }),
    {
      name: 'game-storage', // unique name for localStorage key
      // Only persist essential data, not UI state
      partialize: (state) => ({
        player: state.player,
        isLoggedIn: state.isLoggedIn,
        token: state.token,
        // Don't persist currentRoom - always load fresh from API
      }),
    }
  )
)
