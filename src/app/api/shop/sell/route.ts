export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { getPlayerInventory } from '@/lib/game-engine/services/inventory-service'
import { getSellValue } from '@/lib/shop-pricing'

// Raised inside the sell transaction when the guarded decrement matches no row,
// i.e. the stack was spent by a concurrent request. Distinguishes "someone beat
// you to it" from a genuine fault so the player sees 409, not 500.
const STOCK_CONFLICT = 'STOCK_CONFLICT'

async function handleSell(request: AuthenticatedRequest) {
  try {
    const { playerItemId, quantity } = await request.json()

    if (!playerItemId) {
      return NextResponse.json(
        { success: false, message: 'Player item ID is required' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json(
        { success: false, message: 'Quantity must be a whole number of at least 1' },
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

    // Equipped gear contributes to the cached strMod/dexMod/magMod/defMod columns
    // that combat reads. Selling the row out from under them leaves the bonus
    // applied until the next equip or login, so the stack has to come off first.
    if (playerItem.isEquipped) {
      return NextResponse.json(
        { success: false, message: 'Unequip this item before selling it.' },
        { status: 400 }
      )
    }

    // Calculate sell value
    const sellValuePerItem = getSellValue(playerItem.ItemTemplate.value)
    const totalSellValue = sellValuePerItem * quantity

    // Perform transaction: remove item and add gold
    try {
      await prisma.$transaction(async (tx) => {
        // Decrement behind a quantity guard rather than writing an absolute value
        // computed from the read above. Two concurrent partial sells previously
        // both read the same starting quantity and both wrote the same result,
        // removing the items once but paying for them twice.
        const sold = await tx.playerItem.updateMany({
          where: {
            id: playerItemId,
            playerId: request.user.id,
            quantity: { gte: quantity },
          },
          data: { quantity: { decrement: quantity } },
        })

        if (sold.count === 0) {
          throw new Error(STOCK_CONFLICT)
        }

        // A fully sold stack leaves no empty row behind.
        await tx.playerItem.deleteMany({
          where: { id: playerItemId, quantity: { lte: 0 } },
        })

        await tx.user.update({
          where: { id: request.user.id },
          data: {
            currency: {
              increment: totalSellValue,
            },
          },
        })
      })
    } catch (error) {
      if (error instanceof Error && error.message === STOCK_CONFLICT) {
        return NextResponse.json(
          { success: false, message: 'You no longer have that many to sell.' },
          { status: 409 }
        )
      }
      throw error
    }

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

