import { PrismaClient, QuestStatus } from '@prisma/client'

export interface QuestReward {
  xp?: number
  currency?: number
  items?: Array<{ itemId: string; quantity: number }>
}

export interface QuestOutcome {
  success: boolean
  message?: string
  reward?: QuestReward
  status?: QuestStatus
}

export class QuestSystem {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async startQuest(playerId: string, questId: string): Promise<QuestOutcome> {
    const quest = await this.prisma.quest.findUnique({
      where: { id: questId },
    })

    if (!quest) {
      return { success: false, message: 'Quest not found' }
    }

    const existing = await this.prisma.questInstance.findUnique({
      where: {
        questId_userId: {
          questId,
          userId: playerId,
        },
      },
    })

    if (existing) {
      if (existing.status === QuestStatus.COOLING_DOWN && existing.cooldownUntil) {
        if (existing.cooldownUntil.getTime() > Date.now()) {
          return { success: false, message: 'Quest on cooldown' }
        }
      }

      if (existing.status === QuestStatus.IN_PROGRESS) {
        return { success: false, message: 'Quest already in progress' }
      }
    }

    await this.prisma.questInstance.upsert({
      where: {
        questId_userId: {
          questId,
          userId: playerId,
        },
      },
      create: {
        questId,
        userId: playerId,
        status: QuestStatus.IN_PROGRESS,
      },
      update: {
        status: QuestStatus.IN_PROGRESS,
      },
    })

    return { success: true, status: QuestStatus.IN_PROGRESS }
  }

  async handInFetchQuest(playerId: string, questId: string): Promise<QuestOutcome> {
    const quest = await this.prisma.quest.findUnique({
      where: { id: questId },
    })

    if (!quest) {
      return { success: false, message: 'Quest not found' }
    }

    const instance = await this.prisma.questInstance.findUnique({
      where: {
        questId_userId: {
          questId,
          userId: playerId,
        },
      },
    })

    if (!instance || instance.status !== QuestStatus.IN_PROGRESS) {
      return { success: false, message: 'Quest not active' }
    }

    const inventoryItem = await this.prisma.inventoryItem.findUnique({
      where: {
        userId_itemName: {
          userId: playerId,
          itemName: quest.requiredItem,
        },
      },
    })

    if (!inventoryItem || inventoryItem.quantity < quest.requiredQuantity) {
      return { success: false, message: 'Required item missing' }
    }

    const reward = this.computeReward(quest)

    await this.prisma.$transaction(async (tx) => {
      await tx.inventoryItem.update({
        where: {
          userId_itemName: {
            userId: playerId,
            itemName: quest.requiredItem,
          },
        },
        data: {
          quantity: {
            decrement: quest.requiredQuantity,
          },
        },
      })

      if (reward.currency && reward.currency > 0) {
        await tx.user.update({
          where: { id: playerId },
          data: {
            currency: { increment: reward.currency },
          },
        })
      }

      if (reward.xp && reward.xp > 0) {
        await tx.user.update({
          where: { id: playerId },
          data: {
            xp: { increment: reward.xp },
          },
        })
      }

      if (reward.items) {
        for (const item of reward.items) {
          await tx.inventoryItem.upsert({
            where: {
              userId_itemName: {
                userId: playerId,
                itemName: item.itemId,
              },
            },
            create: {
              userId: playerId,
              itemName: item.itemId,
              quantity: item.quantity,
            },
            update: {
              quantity: { increment: item.quantity },
            },
          })
        }
      }

      const nextData: any = {
        status: quest.repeatable ? QuestStatus.COOLING_DOWN : QuestStatus.COMPLETED,
        completedAt: new Date(),
      }

      if (quest.repeatable && quest.cooldownSeconds) {
        nextData.cooldownUntil = new Date(Date.now() + quest.cooldownSeconds * 1000)
      }

      await tx.questInstance.update({
        where: {
          questId_userId: {
            questId,
            userId: playerId,
          },
        },
        data: nextData,
      })
    })

    return { success: true, reward, status: QuestStatus.COMPLETED }
  }

  private computeReward(quest: any): QuestReward {
    const reward: QuestReward = {
      xp: quest.rewardXp ?? 0,
      currency: quest.rewardCurrency ?? 0,
      items: [],
    }

    if (Array.isArray(quest.rewardItems)) {
      reward.items = quest.rewardItems.map((item: any) => ({
        itemId: item.itemId,
        quantity: item.quantity ?? 1,
      }))
    } else if (quest.rewardItems && typeof quest.rewardItems === 'object') {
      const items = quest.rewardItems.items || []
      reward.items = items.map((item: any) => ({
        itemId: item.itemId,
        quantity: item.quantity ?? 1,
      }))
    }

    return reward
  }
}

