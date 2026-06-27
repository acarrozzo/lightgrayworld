export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { getPlayerInventory } from '@/lib/game-engine/services/inventory-service'
import { getSellValue } from '@/lib/shop-pricing'

async function handleSell(request: AuthenticatedRequest) {
  try {
    const { playerItemId, quantity } = await request.json()

    if (!playerItemId) {
      return NextResponse.json(
        { success: false, message: 'Player item ID is required' },
        { status: 400 }
      )
    }

    if (!quantity || quantity < 1) {
      return NextResponse.json(
        { success: false, message: 'Quantity must be at least 1' },
        { status: 400 }
      )
    }

    // Get player item with template
    const playerItem = await prisma.playerItem.findUnique({
      where: { id: playerItemId },
      include: {
        ItemTemplate: true,
      },
    })

    if (!playerItem || playerItem.playerId !== request.user.id) {
      return NextResponse.json(
        { success: false, message: 'Item not found in your inventory' },
        { status: 404 }
      )
    }

    if (playerItem.quantity < quantity) {
      return NextResponse.json(
        { success: false, message: 'You do not have that many items' },
        { status: 400 }
      )
    }

    // Check if item can be sold
    if (playerItem.ItemTemplate.canSell === false) {
      return NextResponse.json(
        { success: false, message: 'This item cannot be sold' },
        { status: 400 }
      )
    }

    // Calculate sell value
    const sellValuePerItem = getSellValue(playerItem.ItemTemplate.value)
    const totalSellValue = sellValuePerItem * quantity

    // Perform transaction: remove item and add gold
    await prisma.$transaction(async (tx) => {
      // Remove item from inventory
      if (playerItem.quantity === quantity) {
        await tx.playerItem.delete({
          where: { id: playerItemId },
        })
      } else {
        await tx.playerItem.update({
          where: { id: playerItemId },
          data: {
            quantity: playerItem.quantity - quantity,
          },
        })
      }

      // Add gold to player
      await tx.user.update({
        where: { id: request.user.id },
        data: {
          currency: {
            increment: totalSellValue,
          },
        },
      })
    })

    // Get updated inventory and currency
    const inventory = await getPlayerInventory(request.user.id)
    const updatedPlayer = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { currency: true },
    })

    return NextResponse.json({
      success: true,
      message: `Sold ${quantity} ${playerItem.ItemTemplate.name} for ${totalSellValue}g`,
      inventory,
      currency: updatedPlayer?.currency ?? 0,
    })
  } catch (error) {
    console.error('Sell item error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to sell item' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleSell)

