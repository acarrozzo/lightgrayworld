export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'

async function handleGetUsers(request: AuthenticatedRequest) {
  try {
    // Fetch all users with required fields, including room information and equipment
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        level: true,
        currentRoom: true,
        isActive: true,
        lastActive: true,
        hp: true,
        hpMax: true,
        mp: true,
        mpMax: true,
        str: true,
        dex: true,
        mag: true,
        def: true,
        currency: true,
        uIcon: true,
        uIconColor: true,
        createdAt: true,
        room: {
          select: {
            roomId: true,
            name: true,
          },
        },
        equipment: {
          select: {
            rightHand: true,
            leftHand: true,
            head: true,
            body: true,
            hands: true,
            feet: true,
            ring1: true,
            ring2: true,
            neck: true,
            artifact: true,
            tech: true,
            companion: true,
            pet: true,
            mount: true,
            robot: true,
            aura: true,
          },
        },
        PlayerItem: {
          where: {
            isEquipped: true,
          },
          select: {
            slot: true,
            ItemTemplate: {
              select: {
                slug: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Default: newest first
      },
    })

    // Transform the data to include room name and equipment
    const usersWithRoomInfo = users.map((user) => {
      // Build equipment from PlayerItem (source of truth) or fallback to Equipment model
      const equippedItems = user.PlayerItem || []
      const equipmentFromItems: Record<string, string> = {}
      
      // Map PlayerItem slots to Equipment model keys
      const slotMap: Record<string, string> = {
        'MAIN_HAND': 'rightHand',
        'OFF_HAND': 'leftHand',
        'HEAD': 'head',
        'BODY': 'body',
        'HANDS': 'hands',
        'FEET': 'feet',
      }
      
      // Use PlayerItem data (preferred) or fallback to Equipment model
      equippedItems.forEach((item) => {
        if (item.slot && item.ItemTemplate && slotMap[item.slot]) {
          equipmentFromItems[slotMap[item.slot]] = item.ItemTemplate.name
        }
      })
      
      // Fallback to Equipment model for slots not in PlayerItem
      const equipmentData = user.equipment ? {
        rightHand: equipmentFromItems.rightHand || user.equipment.rightHand,
        leftHand: equipmentFromItems.leftHand || user.equipment.leftHand,
        head: equipmentFromItems.head || user.equipment.head,
        body: equipmentFromItems.body || user.equipment.body,
        hands: equipmentFromItems.hands || user.equipment.hands,
        feet: equipmentFromItems.feet || user.equipment.feet,
        ring1: user.equipment.ring1,
        ring2: user.equipment.ring2,
        neck: user.equipment.neck,
        artifact: user.equipment.artifact,
        tech: user.equipment.tech,
        companion: user.equipment.companion,
        pet: user.equipment.pet,
        mount: user.equipment.mount,
        robot: user.equipment.robot,
        aura: user.equipment.aura,
      } : {
        rightHand: equipmentFromItems.rightHand || 'fists',
        leftHand: equipmentFromItems.leftHand || '- - -',
        head: equipmentFromItems.head || '- - -',
        body: equipmentFromItems.body || '- - -',
        hands: equipmentFromItems.hands || '- - -',
        feet: equipmentFromItems.feet || '- - -',
        ring1: '- - -',
        ring2: '- - -',
        neck: '- - -',
        artifact: '- - -',
        tech: '- - -',
        companion: '- - -',
        pet: '- - -',
        mount: '- - -',
        robot: '- - -',
        aura: '- - -',
      }
      
      return {
        id: user.id,
        username: user.username,
        level: user.level,
        currentRoom: user.currentRoom,
        roomName: user.room?.name || null,
        isActive: user.isActive,
        lastActive: user.lastActive.toISOString(),
        hp: user.hp,
        hpMax: user.hpMax,
        mp: user.mp,
        mpMax: user.mpMax,
        str: user.str,
        dex: user.dex,
        mag: user.mag,
        def: user.def,
        currency: user.currency,
        uIcon: user.uIcon,
        uIconColor: user.uIconColor,
        createdAt: user.createdAt.toISOString(),
        equipment: equipmentData,
      }
    })

    return NextResponse.json({
      success: true,
      users: usersWithRoomInfo,
    })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to get users list'),
      { status: 500 }
    )
  }
}

export const GET = withAuth(handleGetUsers)

