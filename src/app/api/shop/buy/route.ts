export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { getPlayerInventory } from '@/lib/game-engine/services/inventory-service'

async function handleBuy(request: AuthenticatedRequest) {
  try {
    const { itemSlug, quantity = 1 } = await request.json()

    if (!itemSlug) {
      return NextResponse.json(
        { success: false, message: 'Item slug is required' },
        { status: 400 }
      )
    }

    if (quantity < 1) {
      return NextResponse.json(
        { success: false, message: 'Quantity must be at least 1' },
        { status: 400 }
      )
    }

    // Get item template
    const template = await prisma.itemTemplate.findUnique({
      where: { slug: itemSlug },
    })

    if (!template) {
      return NextResponse.json(
        { success: false, message: 'Item not found' },
        { status: 404 }
      )
    }

    // Get current player data
    const player = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { currency: true },
    })

    if (!player) {
      return NextResponse.json(
        { success: false, message: 'Player not found' },
        { status: 404 }
      )
    }

    // Calculate total cost
    const totalCost = template.value * quantity

    // Check if player has enough gold
    if (player.currency < totalCost) {
      return NextResponse.json(
        {
          success: false,
          message: `Not enough gold. You need ${totalCost}g but only have ${player.currency}g`,
        },
        { status: 400 }
      )
    }

    // Check if player can carry the item
    const existing = await prisma.playerItem.findFirst({
      where: {
        playerId: request.user.id,
        templateId: template.id,
      },
    })

    const currentQty = existing?.quantity ?? 0
    const limit = template.maxPerPlayer ?? template.maxStack ?? quantity

    if (currentQty + quantity > limit) {
      return NextResponse.json(
        {
          success: false,
          message: `You can only carry ${limit} of this item. You currently have ${currentQty}.`,
        },
        { status: 400 }
      )
    }

    // Perform transaction: deduct gold and add item
    await prisma.$transaction(async (tx) => {
      // Deduct gold
      await tx.user.update({
        where: { id: request.user.id },
        data: {
          currency: {
            decrement: totalCost,
          },
        },
      })

      // Add item to inventory
      if (existing) {
        await tx.playerItem.update({
          where: { id: existing.id },
          data: {
            quantity: currentQty + quantity,
            updatedAt: new Date(),
          },
        })
      } else {
        const { randomUUID } = require('crypto')
        await tx.playerItem.create({
          data: {
            id: randomUUID(),
            playerId: request.user.id,
            templateId: template.id,
            quantity: Math.min(quantity, limit),
          },
        })
      }
    })

    // Get updated inventory and currency
    const inventory = await getPlayerInventory(request.user.id)
    const updatedPlayer = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { currency: true },
    })

    return NextResponse.json({
      success: true,
      message: `Purchased ${quantity} ${template.name} for ${totalCost}g`,
      inventory,
      currency: updatedPlayer?.currency ?? 0,
    })
  } catch (error) {
    console.error('Buy item error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to purchase item' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleBuy)

