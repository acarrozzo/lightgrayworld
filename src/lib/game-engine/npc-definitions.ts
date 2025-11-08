import { NPCDisposition, NPCMobility } from '@prisma/client'

export type NPCService = 'vendor' | 'quest_giver' | 'persistent'

export interface NPCStats {
  hp: number
  hpMax?: number
  damage: {
    min: number
    max: number
  }
  defense: number
  attackSpeedTicks: number
  resistances?: Record<string, number>
}

export interface MobilityConfig {
  type: NPCMobility
  patrolPath?: string[]
  wanderRooms?: string[]
  dwellTicks?: number
}

export interface DialogueAction {
  type: 'START_QUEST' | 'HAND_IN_ITEM' | 'GIVE_REWARD' | 'OPEN_VENDOR' | 'CLOSE'
  questId?: string
  requiredItem?: string
  handInItem?: string
  handInQuantity?: number
  rewardId?: string
}

export interface DialogueResponse {
  text: string
  next?: string
  action?: DialogueAction
  conditions?: DialogueCondition[]
}

export interface DialogueCondition {
  type: 'HAS_ITEM' | 'QUEST_STATE' | 'MIN_LEVEL'
  itemId?: string
  quantity?: number
  questId?: string
  questState?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  minLevel?: number
}

export interface DialogueNode {
  id: string
  speaker: string
  text: string
  responses: DialogueResponse[]
}

export interface DialogueTree {
  id: string
  root: string
  nodes: Record<string, DialogueNode>
}

export interface LootEntry {
  itemId: string
  chance: number
  quantity: number | { min: number; max: number }
}

export interface LootTable {
  xp?: number
  currency?: {
    min: number
    max: number
  }
  drops: LootEntry[]
}

export interface FetchQuestReward {
  xp?: number
  currency?: number
  items?: Array<{ itemId: string; quantity: number }>
  completionFlag?: string
}

export interface FetchQuestHook {
  questId: string
  requiredItem: string
  requiredQuantity: number
  minLevel?: number
  repeatable?: boolean
  cooldownSeconds?: number
  reward: FetchQuestReward
}

export interface VendorCatalogEntry {
  itemId: string
  itemName: string
  price: number
  stockQuantity?: number
}

export interface NPCDefinitionTemplate {
  key: string
  name: string
  description: string
  icon?: string
  disposition: NPCDisposition
  canBeAttacked: boolean
  mobility: MobilityConfig
  stats: NPCStats
  homeRoom: string
  leash: {
    distance: number
    timeMs: number
  }
  respawn: {
    seconds: number
    jitterPct: number
  }
  barks?: string[]
  services?: NPCService[]
  dialogue?: DialogueTree
  questHooks?: FetchQuestHook[]
  vendorCatalog?: VendorCatalogEntry[]
  lootTable?: LootTable
  persistent?: boolean
}

const npcDefinitions: Record<string, NPCDefinitionTemplate> = {
  general_vendor: {
    key: 'general_vendor',
    name: 'Mira the Merchant',
    description: 'A friendly vendor who keeps the adventurers supplied.',
    disposition: NPCDisposition.FRIENDLY,
    canBeAttacked: false,
    mobility: {
      type: NPCMobility.STATIONARY,
    },
    stats: {
      hp: 40,
      hpMax: 40,
      damage: { min: 0, max: 0 },
      defense: 5,
      attackSpeedTicks: 99999,
    },
    homeRoom: '1001',
    leash: {
      distance: 0,
      timeMs: 0,
    },
    respawn: {
      seconds: 5,
      jitterPct: 0,
    },
    barks: [
      'Looking for supplies? I have just what you need.',
      'Everything is fairly priced, I promise!',
      'Adventurer, stock up before you head out again.',
    ],
    services: ['vendor', 'persistent'],
    vendorCatalog: [
      { itemId: 'health_potion_t1', itemName: 'Minor Health Potion', price: 15, stockQuantity: 10 },
      { itemId: 'mana_potion_t1', itemName: 'Minor Mana Potion', price: 15, stockQuantity: 10 },
      { itemId: 'rope', itemName: 'Sturdy Rope', price: 5 },
      { itemId: 'torch', itemName: 'Everbright Torch', price: 8 },
    ],
  },
  forest_wolf: {
    key: 'forest_wolf',
    name: 'Ravenous Wolf',
    description: 'A hostile predator prowling the forest paths.',
    disposition: NPCDisposition.HOSTILE,
    canBeAttacked: true,
    mobility: {
      type: NPCMobility.WANDER,
      wanderRooms: ['2001', '2002', '2003', '2004'],
      dwellTicks: 5,
    },
    stats: {
      hp: 30,
      hpMax: 30,
      damage: { min: 3, max: 7 },
      defense: 2,
      attackSpeedTicks: 10,
      resistances: {
        cold: 0.1,
      },
    },
    homeRoom: '2001',
    leash: {
      distance: 6,
      timeMs: 20000,
    },
    respawn: {
      seconds: 45,
      jitterPct: 0.1,
    },
    barks: ['*growls*', '*snarls and lunges*'],
    lootTable: {
      xp: 25,
      currency: { min: 2, max: 6 },
      drops: [
        { itemId: 'wolf_pelt', chance: 0.45, quantity: 1 },
        { itemId: 'wolf_fang', chance: 0.15, quantity: { min: 1, max: 2 } },
      ],
    },
  },
  village_quest_giver: {
    key: 'village_quest_giver',
    name: 'Seren the Elder',
    description: 'A wise elder who guides newcomers through their first tasks.',
    disposition: NPCDisposition.FRIENDLY,
    canBeAttacked: false,
    mobility: {
      type: NPCMobility.STATIONARY,
    },
    stats: {
      hp: 35,
      hpMax: 35,
      damage: { min: 0, max: 0 },
      defense: 2,
      attackSpeedTicks: 99999,
    },
    homeRoom: '1101',
    leash: {
      distance: 0,
      timeMs: 0,
    },
    respawn: {
      seconds: 10,
      jitterPct: 0,
    },
    services: ['quest_giver', 'persistent'],
    dialogue: {
      id: 'seren_intro',
      root: 'welcome',
      nodes: {
        welcome: {
          id: 'welcome',
          speaker: 'Seren',
          text: 'Welcome back, traveler. Do you bring the herbs I asked for?',
          responses: [
            {
              text: 'I have the herbs right here.',
              next: 'handin',
              conditions: [{ type: 'HAS_ITEM', itemId: 'healing_herb', quantity: 3 }],
            },
            {
              text: 'Remind me what you needed again?',
              next: 'reminder',
            },
            {
              text: 'Not right now.',
              action: { type: 'CLOSE' },
            },
          ],
        },
        reminder: {
          id: 'reminder',
          speaker: 'Seren',
          text: 'Please gather three healing herbs from the forest. They grow near the old well.',
          responses: [
            {
              text: 'I will return soon.',
              action: { type: 'CLOSE' },
            },
          ],
        },
        handin: {
          id: 'handin',
          speaker: 'Seren',
          text: 'Thank you, these will help many in the village. Here is the reward I promised.',
          responses: [
            {
              text: 'Glad to help.',
              action: {
                type: 'HAND_IN_ITEM',
                handInItem: 'healing_herb',
                handInQuantity: 3,
              },
            },
            {
              text: 'What is the next step?',
              action: {
                type: 'GIVE_REWARD',
                rewardId: 'seren_healing_reward',
              },
            },
            {
              text: 'I will be going now.',
              action: { type: 'CLOSE' },
            },
          ],
        },
      },
    },
    questHooks: [
      {
        questId: 'seren_fetch_herbs',
        requiredItem: 'healing_herb',
        requiredQuantity: 3,
        minLevel: 1,
        repeatable: false,
        reward: {
          xp: 50,
          currency: 25,
          items: [{ itemId: 'minor_bandage', quantity: 2 }],
          completionFlag: 'seren_healing_complete',
        },
      },
    ],
  },
  town_guard: {
    key: 'town_guard',
    name: 'Captain Avel',
    description: 'A seasoned guard who keeps watch over the town gates.',
    disposition: NPCDisposition.FRIENDLY,
    canBeAttacked: true,
    mobility: {
      type: NPCMobility.PATROL,
      patrolPath: ['1200', '1201', '1202', '1201'],
      dwellTicks: 6,
    },
    stats: {
      hp: 120,
      hpMax: 120,
      damage: { min: 8, max: 14 },
      defense: 12,
      attackSpeedTicks: 8,
      resistances: {
        slash: 0.15,
      },
    },
    homeRoom: '1200',
    leash: {
      distance: 6,
      timeMs: 20000,
    },
    respawn: {
      seconds: 90,
      jitterPct: 0.1,
    },
    barks: [
      'All is calm for now.',
      'Stay vigilant; trouble can strike at any moment.',
      'If you see anything suspicious, report it.',
    ],
    lootTable: {
      xp: 80,
      currency: { min: 10, max: 30 },
      drops: [
        { itemId: 'guard_token', chance: 0.25, quantity: 1 },
        { itemId: 'iron_ingot', chance: 0.15, quantity: { min: 1, max: 2 } },
      ],
    },
  },
}

export function getNPCDefinition(key: string): NPCDefinitionTemplate | null {
  return npcDefinitions[key] ?? null
}

export function listNPCDefinitions(): NPCDefinitionTemplate[] {
  return Object.values(npcDefinitions)
}

export function hasVendorService(def: NPCDefinitionTemplate): boolean {
  return def.services?.includes('vendor') ?? false
}

export function isPersistentNPC(def: NPCDefinitionTemplate): boolean {
  return def.services?.includes('persistent') || def.persistent || false
}

