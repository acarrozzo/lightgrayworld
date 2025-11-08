export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'

interface VendorPurchaseBody {
  itemId: string
  quantity?: number
}

async function handlePost(
  request: AuthenticatedRequest,
  { params }: { params: { npcId: string } }
) {
  try {
    const body = (await request.json()) as VendorPurchaseBody
    if (!body?.itemId) {
      return NextResponse.json({ message: 'itemId is required' }, { status: 400 })
    }

    const quantity = Math.max(1, body.quantity ?? 1)
    const npcId = params.npcId

    const vendor = await prisma.nPC.findUnique({
      where: { id: npcId },
      include: {
        vendorInventory: true,
        definition: true,
      },
    })

    if (!vendor) {
      return NextResponse.json({ message: 'Vendor not found' }, { status: 404 })
    }

    const catalogItem =
      vendor.vendorInventory.find((item) => item.itemName === body.itemId) ?? null

    let price = catalogItem?.price ?? null
    let stock = catalogItem?.stockQuantity ?? null

    if (price === null) {
      const definitionCatalog =
        (vendor.vendorCatalog as any) || (vendor.definition?.vendorCatalog as any) || []
      const defItem = definitionCatalog.find(
        (item: any) => item.itemId === body.itemId || item.itemName === body.itemId
      )
      if (!defItem) {
        return NextResponse.json({ message: 'Item not available' }, { status: 400 })
      }
      price = defItem.price
      stock = defItem.stockQuantity ?? null
    }

    if (price === null || price < 0) {
      return NextResponse.json({ message: 'Invalid item price' }, { status: 400 })
    }

    if (stock !== null && stock < quantity) {
      return NextResponse.json({ message: 'Item out of stock' }, { status: 400 })
    }

    const totalCost = price * quantity

    const player = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { currency: true },
    })

    if (!player || player.currency < totalCost) {
      return NextResponse.json({ message: 'Insufficient currency' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: request.user.id },
        data: {
          currency: { decrement: totalCost },
        },
      })

      await tx.inventoryItem.upsert({
        where: {
          userId_itemName: {
            userId: request.user.id,
            itemName: body.itemId,
          },
        },
        create: {
          userId: request.user.id,
          itemName: body.itemId,
          quantity,
        },
        update: {
          quantity: { increment: quantity },
        },
      })

      if (catalogItem && catalogItem.stockQuantity !== null) {
        await tx.vendorInventory.update({
          where: { id: catalogItem.id },
          data: {
            stockQuantity: { decrement: quantity },
          },
        })
      }
    })

    const updatedPlayer = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { currency: true },
    })

    return NextResponse.json({
      success: true,
      itemId: body.itemId,
      quantity,
      cost: totalCost,
      currency: updatedPlayer?.currency ?? null,
    })
  } catch (error) {
    console.error('[Vendor] Purchase failed', error)
    return NextResponse.json({ message: 'Purchase failed' }, { status: 500 })
  }
}

export const POST = withAuth(handlePost)

