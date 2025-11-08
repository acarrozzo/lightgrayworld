import { PrismaClient, QuestStatus } from '@prisma/client'
import type {
  DialogueTree,
  DialogueNode,
  DialogueResponse,
  DialogueAction,
} from './npc-definitions'
import { QuestSystem } from './quest-system'

export interface PlayerDialogueState {
  id: string
  level: number
  inventory: Record<string, number>
  quests: Record<string, QuestStatus>
}

export interface DialogueEvaluationResult {
  node: DialogueNode
  responses: DialogueResponse[]
}

export interface DialogueActionResult {
  type: 'NONE' | 'START_QUEST' | 'COMPLETE_QUEST' | 'OPEN_VENDOR' | 'REWARD_GIVEN'
  questId?: string
  reward?: {
    currency?: number
    xp?: number
    items?: Array<{ itemId: string; quantity: number }>
  }
}

export class NPCDialogueEngine {
  private prisma: PrismaClient
  private questSystem: QuestSystem

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.questSystem = new QuestSystem(prisma)
  }

  async loadPlayerState(playerId: string): Promise<PlayerDialogueState> {
    const [inventoryItems, questInstances, player] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: { userId: playerId },
      }),
      this.prisma.questInstance.findMany({
        where: { userId: playerId },
      }),
      this.prisma.user.findUnique({
        where: { id: playerId },
        select: {
          id: true,
          level: true,
        },
      }),
    ])

    const inventory: Record<string, number> = {}
    inventoryItems.forEach((item) => {
      inventory[item.itemName] = item.quantity
    })

    const quests: Record<string, QuestStatus> = {}
    questInstances.forEach((instance) => {
      quests[instance.questId] = instance.status
    })

    return {
      id: player?.id || playerId,
      level: player?.level ?? 1,
      inventory,
      quests,
    }
  }

  evaluate(tree: DialogueTree, nodeId: string, player: PlayerDialogueState): DialogueEvaluationResult {
    const node = this.getNode(tree, nodeId)
    if (!node) {
      throw new Error(`Dialogue node ${nodeId} not found`)
    }

    const responses = node.responses.filter((response) => this.isResponseAvailable(response, player))
    return { node, responses }
  }

  isResponseAvailable(response: DialogueResponse, player: PlayerDialogueState): boolean {
    if (!response.conditions || response.conditions.length === 0) {
      return true
    }

    return response.conditions.every((condition) => {
      switch (condition.type) {
        case 'HAS_ITEM': {
          const quantity = player.inventory[condition.itemId ?? ''] || 0
          return quantity >= (condition.quantity ?? 1)
        }
        case 'MIN_LEVEL': {
          return player.level >= (condition.minLevel ?? 1)
        }
        case 'QUEST_STATE': {
          const status = player.quests[condition.questId ?? '']
          if (!condition.questState) return false
          return status === (condition.questState as QuestStatus)
        }
        default:
          return true
      }
    })
  }

  getNode(tree: DialogueTree, nodeId: string): DialogueNode | null {
    return tree.nodes[nodeId] ?? null
  }

  async applyAction(
    action: DialogueAction | undefined,
    npcId: string,
    playerId: string
  ): Promise<DialogueActionResult> {
    if (!action) {
      return { type: 'NONE' }
    }

    switch (action.type) {
      case 'START_QUEST': {
        if (!action.questId) return { type: 'NONE' }
        const outcome = await this.questSystem.startQuest(playerId, action.questId)
        return {
          type: outcome.success ? 'START_QUEST' : 'NONE',
          questId: action.questId,
        }
      }
      case 'HAND_IN_ITEM': {
        if (!action.questId) return { type: 'NONE' }
        const outcome = await this.questSystem.handInFetchQuest(playerId, action.questId)
        return {
          type: outcome.success ? 'COMPLETE_QUEST' : 'NONE',
          questId: action.questId,
          reward: outcome.reward,
        }
      }
      case 'GIVE_REWARD':
        return { type: 'REWARD_GIVEN' }
      case 'OPEN_VENDOR':
        return { type: 'OPEN_VENDOR' }
      case 'CLOSE':
      default:
        return { type: 'NONE' }
    }
  }
}

