import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS, validateRequiredFields } from '@/lib/error-handling'

async function handleGameAction(request: AuthenticatedRequest) {
  try {
    const { action } = await request.json()

    // Validate required fields
    const validation = validateRequiredFields({ action }, ['action'])
    if (!validation.isValid) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('Action is required'),
        { status: 400 }
      )
    }

    // Handle different game actions
    switch (action.toLowerCase()) {
      case 'look':
        return await handleLookAction(request)
      case 'attack':
        return await handleAttackAction(request)
      case 'search':
        return await handleSearchAction(request)
      case 'rest':
        return await handleRestAction(request)
      // Handle all travel directions
      case 'north':
      case 'northeast':
      case 'east':
      case 'southeast':
      case 'south':
      case 'southwest':
      case 'west':
      case 'northwest':
      case 'up':
      case 'down':
        return await handleTravelAction(request, action.toLowerCase())
      // Room-specific actions
      case 'read sign':
      case 'pick up map':
      case 'press button':
      case 'ex chest':
      case 'open chest':
      case 'pick redberry':
      case 'ex cabin':
      case 'attack dummy':
      case 'cook meat':
      case 'pick flower':
      case 'pick blueberry':
      case 'ex tent':
      case 'buy dagger':
      case 'buy potion':
      case 'buy staff':
        return await handleRoomSpecificAction(request, action.toLowerCase())
      default:
        return NextResponse.json(
          { 
            success: false,
            message: `Unknown action: ${action}`,
            action,
            player: request.user.username,
            timestamp: new Date().toISOString()
          },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Game action error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to process action'),
      { status: 500 }
    )
  }
}

async function handleLookAction(request: AuthenticatedRequest) {
  try {
    // Get the current room data
    const room = await prisma.room.findUnique({
      where: { roomId: request.user.currentRoom },
      include: {
        players: {
          select: {
            id: true,
            username: true,
            level: true,
            hp: true,
            hpMax: true,
            mp: true,
            mpMax: true,
            currentRoom: true,
            isActive: true
          }
        },
        items: true,
        npcs: true
      }
    })

    if (!room) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Room not found',
          action: 'look',
          player: request.user.username,
          timestamp: new Date().toISOString()
        },
        { status: 404 }
      )
    }

    // Filter active players
    const activePlayers = room.players.filter(player => player.isActive)

    const result = {
      success: true,
      message: `You look around: ${room.name}`,
      action: 'look',
      player: request.user.username,
      timestamp: new Date().toISOString(),
      roomData: {
        id: room.id,
        roomId: room.roomId,
        name: room.name,
        description: room.description,
        lookDesc: room.lookDesc,
        dangerLevel: room.dangerLevel,
        isSafe: room.isSafe,
        players: activePlayers,
        items: room.items,
        npcs: room.npcs
      }
    }

    // Record action in history
    try {
      const actionRecord = await prisma.actionHistory.create({
        data: {
          userId: request.user.id,
          action: 'look',
          message: result.message,
          roomId: request.user.currentRoom,
          metadata: JSON.stringify({
            roomName: room.name,
            playersCount: activePlayers.length,
            itemsCount: room.items.length,
            npcsCount: room.npcs.length
          })
        }
      })

      // Emit real-time action event
      const { emitActionCompleted } = await import('../../../lib/socket')
      emitActionCompleted(request.user.currentRoom, {
        id: actionRecord.id,
        action: actionRecord.action,
        message: actionRecord.message,
        timestamp: actionRecord.timestamp,
        roomId: actionRecord.roomId,
        metadata: actionRecord.metadata,
        playerId: request.user.id,
        playerName: request.user.username
      })
    } catch (error) {
      console.error('Failed to record action history:', error)
      // Don't fail the action if history recording fails
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Look action error:', error)
    return NextResponse.json(
      { 
        success: false,
        message: 'Failed to look around',
        action: 'look',
        player: request.user.username,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

async function handleAttackAction(request: AuthenticatedRequest) {
  // TODO: Implement attack logic
  const result = {
    success: true,
    message: 'Attack action not yet implemented',
    action: 'attack',
    player: request.user.username,
    timestamp: new Date().toISOString()
  }

  // Record action in history
  try {
    const actionRecord = await prisma.actionHistory.create({
      data: {
        userId: request.user.id,
        action: 'attack',
        message: result.message,
        roomId: request.user.currentRoom
      }
    })

    // Emit real-time action event
    const { emitActionCompleted } = await import('../../../lib/socket')
    emitActionCompleted(request.user.currentRoom, {
      id: actionRecord.id,
      action: actionRecord.action,
      message: actionRecord.message,
      timestamp: actionRecord.timestamp,
      roomId: actionRecord.roomId,
      metadata: actionRecord.metadata,
      playerId: request.user.id,
      playerName: request.user.username
    })
  } catch (error) {
    console.error('Failed to record action history:', error)
  }

  return NextResponse.json(result)
}

async function handleSearchAction(request: AuthenticatedRequest) {
  // TODO: Implement search logic
  const result = {
    success: true,
    message: 'Search action not yet implemented',
    action: 'search',
    player: request.user.username,
    timestamp: new Date().toISOString()
  }

  // Record action in history
  try {
    const actionRecord = await prisma.actionHistory.create({
      data: {
        userId: request.user.id,
        action: 'search',
        message: result.message,
        roomId: request.user.currentRoom
      }
    })

    // Emit real-time action event
    const { emitActionCompleted } = await import('../../../lib/socket')
    emitActionCompleted(request.user.currentRoom, {
      id: actionRecord.id,
      action: actionRecord.action,
      message: actionRecord.message,
      timestamp: actionRecord.timestamp,
      roomId: actionRecord.roomId,
      metadata: actionRecord.metadata,
      playerId: request.user.id,
      playerName: request.user.username
    })
  } catch (error) {
    console.error('Failed to record action history:', error)
  }

  return NextResponse.json(result)
}

async function handleRestAction(request: AuthenticatedRequest) {
  // TODO: Implement rest logic
  const result = {
    success: true,
    message: 'Rest action not yet implemented',
    action: 'rest',
    player: request.user.username,
    timestamp: new Date().toISOString()
  }

  // Record action in history
  try {
    const actionRecord = await prisma.actionHistory.create({
      data: {
        userId: request.user.id,
        action: 'rest',
        message: result.message,
        roomId: request.user.currentRoom
      }
    })

    // Emit real-time action event
    const { emitActionCompleted } = await import('../../../lib/socket')
    emitActionCompleted(request.user.currentRoom, {
      id: actionRecord.id,
      action: actionRecord.action,
      message: actionRecord.message,
      timestamp: actionRecord.timestamp,
      roomId: actionRecord.roomId,
      metadata: actionRecord.metadata,
      playerId: request.user.id,
      playerName: request.user.username
    })
  } catch (error) {
    console.error('Failed to record action history:', error)
  }

  return NextResponse.json(result)
}

async function handleTravelAction(request: AuthenticatedRequest, direction: string) {
  try {
    // Get current room data
    const currentRoom = await prisma.room.findUnique({
      where: { roomId: request.user.currentRoom },
      include: {
        players: {
          select: {
            id: true,
            username: true,
            level: true,
            hp: true,
            hpMax: true,
            mp: true,
            mpMax: true,
            currentRoom: true,
            isActive: true
          }
        },
        items: true,
        npcs: true
      }
    })

    if (!currentRoom) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Current room not found',
          action: direction,
          player: request.user.username,
          timestamp: new Date().toISOString()
        },
        { status: 404 }
      )
    }

    // Check if direction is available
    const directionKey = direction as keyof typeof currentRoom
    const targetRoomId = currentRoom[directionKey] as string | null

    if (!targetRoomId) {
      return NextResponse.json(
        { 
          success: false,
          message: `You cannot go ${direction} from here`,
          action: direction,
          player: request.user.username,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      )
    }

    // Get target room data
    const targetRoom = await prisma.room.findUnique({
      where: { roomId: targetRoomId },
      include: {
        players: {
          select: {
            id: true,
            username: true,
            level: true,
            hp: true,
            hpMax: true,
            mp: true,
            mpMax: true,
            currentRoom: true,
            isActive: true
          }
        },
        items: true,
        npcs: true
      }
    })

    if (!targetRoom) {
      return NextResponse.json(
        { 
          success: false,
          message: `Target room ${targetRoomId} not found`,
          action: direction,
          player: request.user.username,
          timestamp: new Date().toISOString()
        },
        { status: 404 }
      )
    }

    // Update player's current room
    await prisma.user.update({
      where: { id: request.user.id },
      data: { currentRoom: targetRoomId }
    })

    // Filter active players for both rooms
    const currentRoomActivePlayers = currentRoom.players?.filter((player: any) => player.isActive) || []
    const targetRoomActivePlayers = targetRoom.players?.filter((player: any) => player.isActive) || []

    const result = {
      success: true,
      message: `You travel ${direction} to ${targetRoom.name}`,
      action: direction,
      player: request.user.username,
      timestamp: new Date().toISOString(),
      roomData: {
        id: targetRoom.id,
        roomId: targetRoom.roomId,
        name: targetRoom.name,
        description: targetRoom.description,
        lookDesc: targetRoom.lookDesc,
        dangerLevel: targetRoom.dangerLevel,
        isSafe: targetRoom.isSafe,
        players: targetRoomActivePlayers,
        items: targetRoom.items || [],
        npcs: targetRoom.npcs || [],
        // Include navigation directions for the new room
        north: targetRoom.north,
        northeast: targetRoom.northeast,
        east: targetRoom.east,
        southeast: targetRoom.southeast,
        south: targetRoom.south,
        southwest: targetRoom.southwest,
        west: targetRoom.west,
        northwest: targetRoom.northwest,
        up: targetRoom.up,
        down: targetRoom.down
      }
    }

    // Record action in history
    try {
      const actionRecord = await prisma.actionHistory.create({
        data: {
          userId: request.user.id,
          action: direction,
          message: `Traveled ${direction} from ${currentRoom.name} to ${targetRoom.name}`,
          roomId: targetRoomId,
          metadata: JSON.stringify({
            fromRoom: currentRoom.roomId,
            toRoom: targetRoomId,
            direction
          })
        }
      })

      // Emit real-time action event
      const { emitActionCompleted } = await import('../../../lib/socket')
      emitActionCompleted(targetRoomId, {
        id: actionRecord.id,
        action: actionRecord.action,
        message: actionRecord.message,
        timestamp: actionRecord.timestamp,
        roomId: actionRecord.roomId,
        metadata: actionRecord.metadata,
        playerId: request.user.id,
        playerName: request.user.username,
        success: result.success,
        roomData: result.roomData
      })
    } catch (historyError) {
      console.error('Failed to record travel action:', historyError)
      // Don't fail the request if history recording fails
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Travel action error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to travel'),
      { status: 500 }
    )
  }
}

async function handleRoomSpecificAction(request: AuthenticatedRequest, action: string) {
  try {
    const currentRoom = request.user.currentRoom
    let result: any

    // Handle room-specific actions based on current room and action
    switch (currentRoom) {
      case '000': // Room Zero
        switch (action) {
          case 'read sign':
            result = {
              success: true,
              message: `You read the Room Zero Sign:

---------------------------------------------------
Welcome to Room Zero.
To look around the room you are in click LOOK.
---------------------------------------------------`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          case 'pick up map':
            result = {
              success: true,
              message: `You pick up the map!

Maps are very useful. Get a bird's eye view of the rooms around you. To view your current map click the MAP tab above.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          case 'press button':
            result = {
              success: true,
              message: `You press the button and magically teleport to the Grassy Field!`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          default:
            result = {
              success: false,
              message: `You cannot ${action} here.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
        }
        break

      case '001': // Grassy Field Crossroads
        switch (action) {
          case 'read sign':
            result = {
              success: true,
              message: `You read the Grassy Field Directory:

Grassy Field Directory
Healing Waterfall - Northwest
Shaman Tent - Northeast  
Beach - West
Wood Cabin - Southwest
--------------------------
Visit the OLD MAN at the cabin to start your first quest.
--------------------------`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          case 'ex chest':
            result = {
              success: true,
              message: `You examine the chest:

The chest is made of solid gold and is shut tight. Looks like you need a key.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          case 'open chest':
            result = {
              success: true,
              message: `You need a Gold Key to open this chest. You can get one by completing the Young Soldier's quest. You can find him by going southwest and then west.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          default:
            result = {
              success: false,
              message: `You cannot ${action} here.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
        }
        break

      case '002': // Grassy Field South
        switch (action) {
          case 'pick redberry':
            result = {
              success: true,
              message: `You pick up 5 redberries!`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          default:
            result = {
              success: false,
              message: `You cannot ${action} here.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
        }
        break

      case '003': // Wood Cabin
        switch (action) {
          case 'ex cabin':
            result = {
              success: true,
              message: `You examine the cabin:

The cabin is warm and cozy. A cooking fire burns here and the old man is rocking in his chair. A wooden dummy is set up in the corner of the cabin for you to practice attacking.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          case 'attack dummy':
            result = {
              success: true,
              message: `You attack the wooden dummy! It doesn't fight back, but you get some practice.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          case 'cook meat':
            result = {
              success: true,
              message: `You cook your raw meat at the cabin fireplace. Tasty!`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          default:
            result = {
              success: false,
              message: `You cannot ${action} here.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
        }
        break

      case '004': // Flower Patch
        switch (action) {
          case 'pick flower':
            result = {
              success: true,
              message: `You pick up a beautiful flower.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          default:
            result = {
              success: false,
              message: `You cannot ${action} here.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
        }
        break

      case '005': // Grassy Field North
        switch (action) {
          case 'pick blueberry':
            result = {
              success: true,
              message: `You pick up 5 blueberries!`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          case 'ex tent':
            result = {
              success: true,
              message: `You examine the tent to the east. It appears to be made out of pajamas.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          default:
            result = {
              success: false,
              message: `You cannot ${action} here.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
        }
        break

      case '006': // Basic Shop
        switch (action) {
          case 'buy dagger':
            result = {
              success: true,
              message: `You buy a dagger for 50 gold!`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          case 'buy potion':
            result = {
              success: true,
              message: `You buy a red potion for 100 gold!`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          default:
            result = {
              success: false,
              message: `You cannot ${action} here.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
        }
        break

      case '007': // Cave Entrance
        switch (action) {
          case 'read sign':
            result = {
              success: true,
              message: `You read the Spider Cave Entrance Sign:

Spider Cave Entrance
Beware the spiders and scorpions that live in the cave to the south. You will need a weapon if you want to survive.
If you don't have a weapon, go west of here and pick one up near the Young Soldier.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          case 'search':
            result = {
              success: true,
              message: `You search the Cave Entrance and find a Wooden Necklace!`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          default:
            result = {
              success: false,
              message: `You cannot ${action} here.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
        }
        break

      case '020': // Healing Springs
        switch (action) {
          case 'rest':
            result = {
              success: true,
              message: `You rest at the waterfall and supercharge your HP and MP! (Overheal +10 HP, +10 MP)`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          default:
            result = {
              success: false,
              message: `You cannot ${action} here.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
        }
        break

      case '021': // Pajama Shaman
        switch (action) {
          case 'read sign':
            result = {
              success: true,
              message: `You read the Pajama Shaman Sign:

SKILLS
You gain SP every time you level.
Use SP to learn skills and spells.
---------------------------------------------------
Physical Training and Mental Training are important.
Physical Training increases the amount of Hit Points you gain when you level. The same goes for Mental Training and Mana Points. For this reason it is advised to learn as early as possible.
---------------------------------------------------
Rest up ${request.user.username}!
When you rest you will restore lost HP and MP. The amount you restore is determined by your Physical Training and Mental Training skill.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          case 'buy staff':
            result = {
              success: true,
              message: `You buy a basic staff for 200 gold!`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
            break
          default:
            result = {
              success: false,
              message: `You cannot ${action} here.`,
              action,
              player: request.user.username,
              timestamp: new Date().toISOString()
            }
        }
        break

      default:
        result = {
          success: false,
          message: `Unknown room: ${currentRoom}`,
          action,
          player: request.user.username,
          timestamp: new Date().toISOString()
        }
    }

    // Record action in history
    try {
      const actionRecord = await prisma.actionHistory.create({
        data: {
          userId: request.user.id,
          action: action,
          message: result.message,
          roomId: currentRoom
        }
      })

      // Emit real-time action event
      const { emitActionCompleted } = await import('../../../lib/socket')
      emitActionCompleted(currentRoom, {
        id: actionRecord.id,
        action: actionRecord.action,
        message: actionRecord.message,
        timestamp: actionRecord.timestamp,
        roomId: actionRecord.roomId,
        metadata: actionRecord.metadata,
        playerId: request.user.id,
        playerName: request.user.username,
        success: result.success
      })
    } catch (error) {
      console.error('Failed to record room action history:', error)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Room specific action error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to process room action'),
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleGameAction)
