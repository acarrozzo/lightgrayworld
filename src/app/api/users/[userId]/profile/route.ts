export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'

const EQUIPMENT_SLOT_DEFAULTS: Record<string, string> = {
  rightHand: 'fists',
  leftHand: '- - -',
  head: '- - -',
  body: '- - -',
  hands: '- - -',
  feet: '- - -',
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

const PLAYER_ITEM_SLOT_MAP: Record<string, string> = {
  MAIN_HAND: 'rightHand',
  OFF_HAND: 'leftHand',
  HEAD: 'head',
  BODY: 'body',
  HANDS: 'hands',
  FEET: 'feet',
}

async function handleGetPublicProfile(request: AuthenticatedRequest) {
  try {
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const userId = pathSegments[pathSegments.length - 2]

    if (!userId) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('User id is required'),
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        level: true,
        characterClass: true,
        characterRace: true,
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
          where: { isEquipped: true },
          select: {
            slot: true,
            ItemTemplate: {
              select: {
                slug: true,
                name: true,
                metadata: true,
              },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(COMMON_ERRORS.NOT_FOUND('User'), { status: 404 })
    }

    const equipment: Record<string, { name: string; slug?: string; icon?: string }> = {}
    for (const [slot, fallbackValue] of Object.entries(EQUIPMENT_SLOT_DEFAULTS)) {
      const equipmentValue = user.equipment?.[slot as keyof typeof user.equipment]
      equipment[slot] = {
        name: equipmentValue || fallbackValue,
      }
    }

    for (const equippedItem of user.PlayerItem) {
      if (!equippedItem.slot || !equippedItem.ItemTemplate) continue
      const mappedSlot = PLAYER_ITEM_SLOT_MAP[equippedItem.slot]
      if (!mappedSlot) continue
      const metadata = equippedItem.ItemTemplate.metadata as { icon?: string } | null
      equipment[mappedSlot] = {
        name: equippedItem.ItemTemplate.name,
        slug: equippedItem.ItemTemplate.slug,
        icon: metadata?.icon,
      }
    }

    return NextResponse.json({
      success: true,
      profile: {
        avatar: {
          uIcon: user.uIcon,
          uIconColor: user.uIconColor,
        },
        username: user.username,
        level: user.level,
        characterClass: user.characterClass,
        characterRace: user.characterRace,
        hp: user.hp,
        hpMax: user.hpMax,
        mp: user.mp,
        mpMax: user.mpMax,
        str: user.str,
        dex: user.dex,
        mag: user.mag,
        def: user.def,
        currency: user.currency,
        equippedItems: equipment,
      },
    })
  } catch (error) {
    console.error('Public profile fetch error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to load public profile'),
      { status: 500 }
    )
  }
}

export const GET = withAuth(handleGetPublicProfile)
