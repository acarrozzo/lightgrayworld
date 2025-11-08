export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'

async function handleGet(
  request: AuthenticatedRequest,
  { params }: { params: { npcId: string } }
) {
  try {
    const npcId = params.npcId
    if (!npcId) {
      return NextResponse.json({ message: 'npcId required' }, { status: 400 })
    }

    const [npc, player] = await Promise.all([
      prisma.nPC.findUnique({
        where: { id: npcId },
        include: {
          vendorInventory: true,
          definition: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: request.user.id },
        select: { currency: true },
      }),
    ])

    if (!npc) {
      return NextResponse.json({ message: 'Vendor not found' }, { status: 404 })
    }

    const dbCatalog = npc.vendorInventory.map((item) => ({
      itemId: item.itemName,
      itemName: item.itemName,
      price: item.price,
      stockQuantity: item.stockQuantity,
      metadata: item.metadata,
    }))

    const definitionCatalog =
      (npc.vendorCatalog as any) || (npc.definition?.vendorCatalog as any) || []

    const mergedMap = new Map<string, any>()
    definitionCatalog.forEach((item: any) => {
      mergedMap.set(item.itemId || item.itemName, {
        itemId: item.itemId || item.itemName,
        itemName: item.itemName,
        price: item.price,
        stockQuantity: item.stockQuantity ?? null,
      })
    })

    dbCatalog.forEach((item) => {
      mergedMap.set(item.itemId, {
        itemId: item.itemId,
        itemName: item.itemName,
        price: item.price,
        stockQuantity: item.stockQuantity,
        metadata: item.metadata,
      })
    })

    return NextResponse.json({
      vendorId: npcId,
      vendorName: npc.name,
      description: npc.description,
      playerCurrency: player?.currency ?? 0,
      items: Array.from(mergedMap.values()),
    })
  } catch (error) {
    console.error('[Vendor] Failed to load catalog', error)
    return NextResponse.json({ message: 'Failed to load vendor' }, { status: 500 })
  }
}

export const GET = withAuth(handleGet)

