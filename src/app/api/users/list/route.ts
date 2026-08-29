export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { resolveEquipmentNames } from '@/lib/items/equipment-resolution'

/**
 * The player directory backing the Players tab roster.
 *
 * This is the *durable* half of the roster: every account that exists, with its last
 * known room and `lastActive` timestamp. Who is online right now comes from the live
 * presence feed (world:presence-sync / world:presence-update) instead — the client
 * merges the two. `isActive` is still returned for compatibility, but it is a
 * last-write flag, not presence, and the roster does not treat it as such.
 */

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

async function handleGetUsers(request: AuthenticatedRequest) {
  try {
    const url = new URL(request.url)

    // Cursor pagination: `cursor` is the id of the last row from the previous page.
    const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT
    const cursor = url.searchParams.get('cursor') || undefined

    const users = await prisma.user.findMany({
      // Fetch one extra row to learn whether another page exists without a count query.
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        username: true,
        level: true,
        currentRoom: true,
        isActive: true,
        inFight: true,
        lastActive: true,
        hp: true,
        hpMax: true,
        mp: true,
        mpMax: true,
        str: true,
        dex: true,
        mag: true,
        def: true,
        strMod: true,
        dexMod: true,
        magMod: true,
        defMod: true,
        currency: true,
        uIcon: true,
        uIconColor: true,
        characterClass: true,
        characterRace: true,
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
          where: { isEquipped: true },
          select: {
            slot: true,
            ItemTemplate: {
              select: { slug: true, name: true, metadata: true },
            },
          },
        },
      },
      // Stable ordering for the cursor; the client re-sorts for display anyway.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })

    const hasMore = users.length > limit
    const page = hasMore ? users.slice(0, limit) : users

    // Presence reports a live room id, which may be somewhere the player's persisted
    // row hasn't caught up to yet. Ship the whole id -> name map so the roster can
    // name any room a player walks into without another round trip.
    const rooms = await prisma.room.findMany({ select: { roomId: true, name: true } })
    const roomNames = Object.fromEntries(rooms.map((room) => [room.roomId, room.name]))

    const players = page.map((user) => ({
      id: user.id,
      username: user.username,
      level: user.level,
      currentRoom: user.currentRoom,
      roomName: user.room?.name ?? roomNames[user.currentRoom] ?? null,
      // Durable flag only — presence comes from the socket feed.
      isActive: user.isActive,
      inFight: user.inFight,
      lastActive: user.lastActive.toISOString(),
      hp: user.hp,
      hpMax: user.hpMax,
      mp: user.mp,
      mpMax: user.mpMax,
      str: user.str,
      dex: user.dex,
      mag: user.mag,
      def: user.def,
      strMod: user.strMod,
      dexMod: user.dexMod,
      magMod: user.magMod,
      defMod: user.defMod,
      currency: user.currency,
      uIcon: user.uIcon,
      uIconColor: user.uIconColor,
      characterClass: user.characterClass,
      characterRace: user.characterRace,
      createdAt: user.createdAt.toISOString(),
      equipment: resolveEquipmentNames(user),
    }))

    return NextResponse.json({
      success: true,
      users: players,
      rooms: roomNames,
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      hasMore,
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
