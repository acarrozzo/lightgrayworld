import { PrismaClient, NPCDisposition, NPCMobility } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create initial rooms - 9-room grassy field area
  const rooms = [
    {
      roomId: '000',
      name: 'Room Zero',
      description: 'You find yourself in a small, dimly lit chamber. A soft blue light emanates from a pillar in the center of the room. A sign is attached to the pillar, and you can see a map on the ground.',
      dangerLevel: 0,
      isSafe: true,
      north: null,
      south: null,
      east: null,
      west: null,
      up: null,
      down: '001',
      northeast: null,
      northwest: null,
      southeast: null,
      southwest: null,
      hasFire: false,
      hasCraftingTable: false
    },
    {
      roomId: '001',
      name: 'Grassy Field Crossroads',
      description: 'You find yourself standing in the middle of a large, grassy field. The air is warm, and the sky above is bright blue. A sign stands nearby with a golden chest at its base. To the southwest, you see a small, cozy cabin.',
      dangerLevel: 0,
      isSafe: true,
      north: '005',
      south: '002',
      east: '006',
      west: '004',
      up: '000',
      down: null,
      northeast: '021',
      northwest: '020',
      southeast: '007',
      southwest: '003',
      hasFire: false,
      hasCraftingTable: false
    },
    {
      roomId: '002',
      name: 'Grassy Field South',
      description: 'You find yourself in the southern part of the grassy field. Red berries grow in patches here, and the grass is slightly taller. You can see the crossroads to the north.',
      dangerLevel: 0,
      isSafe: true,
      north: '001',
      south: null,
      east: '007',
      west: '003',
      up: null,
      down: null,
      northeast: '006',
      northwest: '004',
      southeast: null,
      southwest: null,
      hasFire: false,
      hasCraftingTable: false
    },
    {
      roomId: '003',
      name: 'Wood Cabin',
      description: 'You approach a cozy wooden cabin with smoke rising from its chimney. An old man sits in a rocking chair on the porch, and you can see a wooden training dummy in the corner.',
      dangerLevel: 0,
      isSafe: true,
      north: '004',
      south: null,
      east: '002',
      west: null,
      up: null,
      down: null,
      northeast: '001',
      northwest: null,
      southeast: null,
      southwest: null,
      hasFire: true,
      hasCraftingTable: true
    },
    {
      roomId: '004',
      name: 'Flower Patch',
      description: 'You enter a beautiful flower patch where colorful wildflowers bloom in abundance. The air is filled with sweet floral scents, and butterflies dance among the petals.',
      dangerLevel: 0,
      isSafe: true,
      north: '020',
      south: '003',
      east: '001',
      west: null,
      up: null,
      down: null,
      northeast: '005',
      northwest: null,
      southeast: '002',
      southwest: null,
      hasFire: false,
      hasCraftingTable: false
    },
    {
      roomId: '005',
      name: 'Grassy Field North',
      description: 'You reach the northern part of the grassy field. Blueberry bushes grow here in abundance, and you can see a strange tent made of pajamas to the east.',
      dangerLevel: 0,
      isSafe: true,
      north: null,
      south: '001',
      east: '021',
      west: '020',
      up: null,
      down: null,
      northeast: null,
      northwest: null,
      southeast: '006',
      southwest: '004',
      hasFire: false,
      hasCraftingTable: false
    },
    {
      roomId: '006',
      name: 'Basic Shop',
      description: 'You find yourself at a small trading post. A friendly merchant has set up shop here, displaying various weapons, armor, and supplies on wooden tables.',
      dangerLevel: 0,
      isSafe: true,
      north: '021',
      south: '007',
      east: null,
      west: '001',
      up: null,
      down: null,
      northeast: null,
      northwest: '005',
      southeast: null,
      southwest: '002',
      hasFire: false,
      hasCraftingTable: false
    },
    {
      roomId: '007',
      name: 'Cave Entrance',
      description: 'You stand before the dark entrance to a mysterious cave. A weathered sign warns of dangers within, and you can hear strange sounds echoing from the depths.',
      dangerLevel: 1,
      isSafe: false,
      north: '006',
      south: null,
      east: null,
      west: '002',
      up: null,
      down: null,
      northeast: null,
      northwest: '001',
      southeast: null,
      southwest: null,
      hasFire: false,
      hasCraftingTable: false
    },
    {
      roomId: '020',
      name: 'Healing Springs',
      description: 'You discover a beautiful waterfall cascading into a crystal-clear pool. The water glows with a soft blue light, and you feel rejuvenated just being near it.',
      dangerLevel: 0,
      isSafe: true,
      north: null,
      south: '004',
      east: '005',
      west: null,
      up: null,
      down: null,
      northeast: null,
      northwest: null,
      southeast: '001',
      southwest: null,
      hasFire: false,
      hasCraftingTable: false
    },
    {
      roomId: '021',
      name: 'Pajama Shaman',
      description: 'You encounter a mystical figure wearing colorful pajamas and slippers. The Pajama Shaman sits cross-legged on a rug, surrounded by magical items and spell components.',
      dangerLevel: 0,
      isSafe: true,
      north: null,
      south: '006',
      east: null,
      west: '005',
      up: null,
      down: null,
      northeast: null,
      northwest: null,
      southeast: null,
      southwest: '001',
      hasFire: false,
      hasCraftingTable: false
    }
  ]

  // Create rooms
  for (const roomData of rooms) {
    await prisma.room.upsert({
      where: { roomId: roomData.roomId },
      update: roomData,
      create: roomData
    })
  }

  const roomRecords = await prisma.room.findMany({
    select: {
      id: true,
      roomId: true,
    },
  })
  const roomIdMap = new Map(roomRecords.map((room) => [room.roomId, room.id]))

  const npcDefinitions = [
    {
      key: 'general_vendor',
      name: 'Mira the Merchant',
      description: 'A friendly vendor who keeps the adventurers supplied.',
      disposition: NPCDisposition.FRIENDLY,
      canBeAttacked: false,
      mobility: NPCMobility.STATIONARY,
      mobilityConfig: {},
      stats: {
        hp: 40,
        hpMax: 40,
        damage: { min: 0, max: 0 },
        defense: 5,
        attackSpeedTicks: 99999,
      },
      attackSpeedTicks: 99999,
      resistances: null,
      leashDistance: 0,
      leashTimeMs: 0,
      dialogueTree: null,
      questHooks: null,
      vendorCatalog: [
        { itemId: 'health_potion_t1', itemName: 'Minor Health Potion', price: 15, stockQuantity: 10 },
        { itemId: 'mana_potion_t1', itemName: 'Minor Mana Potion', price: 15, stockQuantity: 10 },
        { itemId: 'rope', itemName: 'Sturdy Rope', price: 5 },
        { itemId: 'torch', itemName: 'Everbright Torch', price: 8 },
      ],
      lootTable: null,
      respawnSeconds: 5,
      services: ['vendor', 'persistent'],
    },
    {
      key: 'forest_wolf',
      name: 'Ravenous Wolf',
      description: 'A hostile predator prowling the forest paths.',
      disposition: NPCDisposition.HOSTILE,
      canBeAttacked: true,
      mobility: NPCMobility.WANDER,
      mobilityConfig: {
        wanderRooms: ['002', '003', '007'],
        dwellTicks: 5,
      },
      stats: {
        hp: 30,
        hpMax: 30,
        damage: { min: 3, max: 7 },
        defense: 2,
        attackSpeedTicks: 10,
        resistances: {
          cold: 0.1,
        },
      },
      attackSpeedTicks: 10,
      resistances: {
        cold: 0.1,
      },
      leashDistance: 6,
      leashTimeMs: 20000,
      dialogueTree: null,
      questHooks: null,
      vendorCatalog: null,
      lootTable: {
        xp: 25,
        currency: { min: 2, max: 6 },
        drops: [
          { itemId: 'wolf_pelt', chance: 0.45, quantity: 1 },
          { itemId: 'wolf_fang', chance: 0.15, quantity: { min: 1, max: 2 } },
        ],
      },
      respawnSeconds: 45,
      services: [],
    },
    {
      key: 'village_quest_giver',
      name: 'Seren the Elder',
      description: 'A wise elder who guides newcomers through their first tasks.',
      disposition: NPCDisposition.FRIENDLY,
      canBeAttacked: false,
      mobility: NPCMobility.STATIONARY,
      mobilityConfig: {},
      stats: {
        hp: 35,
        hpMax: 35,
        damage: { min: 0, max: 0 },
        defense: 2,
        attackSpeedTicks: 99999,
      },
      attackSpeedTicks: 99999,
      resistances: null,
      leashDistance: 0,
      leashTimeMs: 0,
      dialogueTree: {
        id: 'seren_intro',
        root: 'welcome',
        nodes: {
          welcome: {
            id: 'welcome',
            speaker: 'Seren',
            text: 'Welcome back, traveler. Do you bring the herbs I asked for?',
            responses: [
              {
                text: 'I have the herbs right here.',
                next: 'handin',
                conditions: [{ type: 'HAS_ITEM', itemId: 'healing_herb', quantity: 3 }],
              },
              {
                text: 'Remind me what you needed again?',
                next: 'reminder',
              },
              {
                text: 'Not right now.',
                action: { type: 'CLOSE' },
              },
            ],
          },
          reminder: {
            id: 'reminder',
            speaker: 'Seren',
            text: 'Please gather three healing herbs from the forest. They grow near the old well.',
            responses: [
              {
                text: 'I will return soon.',
                action: { type: 'CLOSE' },
              },
            ],
          },
          handin: {
            id: 'handin',
            speaker: 'Seren',
            text: 'Thank you, these will help many in the village. Here is the reward I promised.',
            responses: [
              {
                text: 'Glad to help.',
                action: {
                  type: 'HAND_IN_ITEM',
                  questId: 'seren_fetch_herbs',
                  handInItem: 'healing_herb',
                  handInQuantity: 3,
                },
              },
              {
                text: 'What is the next step?',
                action: {
                  type: 'GIVE_REWARD',
                  rewardId: 'seren_healing_reward',
                },
              },
              {
                text: 'I will be going now.',
                action: { type: 'CLOSE' },
              },
            ],
          },
        },
      },
      questHooks: [
        {
          questId: 'seren_fetch_herbs',
          requiredItem: 'healing_herb',
          requiredQuantity: 3,
          minLevel: 1,
          repeatable: false,
          reward: {
            xp: 50,
            currency: 25,
            items: [{ itemId: 'minor_bandage', quantity: 2 }],
            completionFlag: 'seren_healing_complete',
          },
        },
      ],
      vendorCatalog: null,
      lootTable: null,
      respawnSeconds: 10,
      services: ['quest_giver', 'persistent'],
    },
    {
      key: 'town_guard',
      name: 'Captain Avel',
      description: 'A seasoned guard who keeps watch over the town gates.',
      disposition: NPCDisposition.FRIENDLY,
      canBeAttacked: true,
      mobility: NPCMobility.PATROL,
      mobilityConfig: {
        patrolPath: ['001', '002', '001'],
        dwellTicks: 6,
      },
      stats: {
        hp: 120,
        hpMax: 120,
        damage: { min: 8, max: 14 },
        defense: 12,
        attackSpeedTicks: 8,
        resistances: {
          slash: 0.15,
        },
      },
      attackSpeedTicks: 8,
      resistances: {
        slash: 0.15,
      },
      leashDistance: 6,
      leashTimeMs: 20000,
      dialogueTree: null,
      questHooks: null,
      vendorCatalog: null,
      lootTable: {
        xp: 80,
        currency: { min: 10, max: 30 },
        drops: [
          { itemId: 'guard_token', chance: 0.25, quantity: 1 },
          { itemId: 'iron_ingot', chance: 0.15, quantity: { min: 1, max: 2 } },
        ],
      },
      respawnSeconds: 90,
      services: [],
    },
  ]

  const definitionIdMap: Record<string, string> = {}
  for (const definition of npcDefinitions) {
    const normalizedDefinition = {
      ...definition,
      mobilityConfig: definition.mobilityConfig ?? undefined,
      stats: definition.stats ?? undefined,
      resistances: definition.resistances ?? undefined,
      dialogueTree: definition.dialogueTree ?? undefined,
      questHooks: definition.questHooks ?? undefined,
      vendorCatalog: definition.vendorCatalog ?? undefined,
      lootTable: definition.lootTable ?? undefined,
      services: definition.services ?? undefined,
    }

    const record = await prisma.nPCDefinition.upsert({
      where: { key: definition.key },
      update: {
        name: normalizedDefinition.name,
        description: normalizedDefinition.description,
        disposition: normalizedDefinition.disposition,
        canBeAttacked: normalizedDefinition.canBeAttacked,
        mobility: normalizedDefinition.mobility,
        mobilityConfig: normalizedDefinition.mobilityConfig,
        stats: normalizedDefinition.stats,
        attackSpeedTicks: normalizedDefinition.attackSpeedTicks,
        resistances: normalizedDefinition.resistances,
        leashDistance: normalizedDefinition.leashDistance,
        leashTimeMs: normalizedDefinition.leashTimeMs,
        dialogueTree: normalizedDefinition.dialogueTree,
        questHooks: normalizedDefinition.questHooks,
        vendorCatalog: normalizedDefinition.vendorCatalog,
        lootTable: normalizedDefinition.lootTable,
        respawnSeconds: normalizedDefinition.respawnSeconds,
        services: normalizedDefinition.services,
      },
      create: normalizedDefinition,
    })
    definitionIdMap[definition.key] = record.id
  }

  const npcSeedEntries = [
    {
      id: 'npc-mira',
      definitionKey: 'general_vendor',
      roomCode: '006',
      data: {
        name: 'Mira the Merchant',
        description: 'Mira greets every traveler with a smile and a curated selection of wares.',
        type: 'vendor',
        disposition: NPCDisposition.FRIENDLY,
        canBeAttacked: false,
        mobility: NPCMobility.STATIONARY,
        mobilityPath: null,
        stats: {
          hp: 40,
          hpMax: 40,
          damage: { min: 0, max: 0 },
          defense: 5,
          attackSpeedTicks: 99999,
        },
        attackSpeedTicks: 99999,
        resistances: null,
        homeRoom: '006',
        leashDistance: 0,
        leashTimeMs: 0,
        dialogueTree: null,
        questHooks: null,
        vendorCatalog: npcDefinitions.find((def) => def.key === 'general_vendor')?.vendorCatalog || [],
        lootTable: null,
        respawnSeconds: 5,
        maxAlive: 1,
        spawnWeight: 1,
        persistent: true,
      },
    },
    {
      id: 'npc-wolf-001',
      definitionKey: 'forest_wolf',
      roomCode: '002',
      data: {
        name: 'Ravenous Wolf',
        description: 'A hungry wolf prowls the tall grass, eyes locked on its next meal.',
        type: 'beast',
        disposition: NPCDisposition.HOSTILE,
        canBeAttacked: true,
        mobility: NPCMobility.WANDER,
        mobilityPath: { wanderRooms: ['002', '003', '007'], dwellTicks: 5 },
        stats: {
          hp: 30,
          hpMax: 30,
          damage: { min: 3, max: 7 },
          defense: 2,
          attackSpeedTicks: 10,
        },
        attackSpeedTicks: 10,
        resistances: { cold: 0.1 },
        homeRoom: '002',
        leashDistance: 6,
        leashTimeMs: 20000,
        dialogueTree: null,
        questHooks: null,
        vendorCatalog: null,
        lootTable: npcDefinitions.find((def) => def.key === 'forest_wolf')?.lootTable || null,
        respawnSeconds: 45,
        maxAlive: 2,
        spawnWeight: 2,
        persistent: false,
      },
    },
    {
      id: 'npc-seren',
      definitionKey: 'village_quest_giver',
      roomCode: '003',
      data: {
        name: 'Seren the Elder',
        description: 'Seren tends to the needs of the village and guides new adventurers.',
        type: 'quest_giver',
        disposition: NPCDisposition.FRIENDLY,
        canBeAttacked: false,
        mobility: NPCMobility.STATIONARY,
        mobilityPath: null,
        stats: {
          hp: 35,
          hpMax: 35,
          damage: { min: 0, max: 0 },
          defense: 2,
          attackSpeedTicks: 99999,
        },
        attackSpeedTicks: 99999,
        resistances: null,
        homeRoom: '003',
        leashDistance: 0,
        leashTimeMs: 0,
        dialogueTree: npcDefinitions.find((def) => def.key === 'village_quest_giver')?.dialogueTree || null,
        questHooks: npcDefinitions.find((def) => def.key === 'village_quest_giver')?.questHooks || [],
        vendorCatalog: null,
        lootTable: null,
        respawnSeconds: 10,
        maxAlive: 1,
        spawnWeight: 1,
        persistent: true,
      },
    },
    {
      id: 'npc-avel',
      definitionKey: 'town_guard',
      roomCode: '001',
      data: {
        name: 'Captain Avel',
        description: 'Captain Avel keeps a watchful eye on the crossroads.',
        type: 'guard',
        disposition: NPCDisposition.FRIENDLY,
        canBeAttacked: true,
        mobility: NPCMobility.PATROL,
        mobilityPath: { patrolPath: ['001', '002', '001'], dwellTicks: 6 },
        stats: {
          hp: 120,
          hpMax: 120,
          damage: { min: 8, max: 14 },
          defense: 12,
          attackSpeedTicks: 8,
        },
        attackSpeedTicks: 8,
        resistances: { slash: 0.15 },
        homeRoom: '001',
        leashDistance: 6,
        leashTimeMs: 20000,
        dialogueTree: null,
        questHooks: null,
        vendorCatalog: null,
        lootTable: npcDefinitions.find((def) => def.key === 'town_guard')?.lootTable || null,
        respawnSeconds: 90,
        maxAlive: 1,
        spawnWeight: 1,
        persistent: false,
      },
    },
  ]

  const npcIdMap: Record<string, string> = {}
  for (const npc of npcSeedEntries) {
    const roomId = roomIdMap.get(npc.roomCode)
    if (!roomId) {
      console.warn(`⚠️ Skipping NPC ${npc.id} - room ${npc.roomCode} not found.`)
      continue
    }
    const definitionId = definitionIdMap[npc.definitionKey]
    if (!definitionId) {
      console.warn(`⚠️ Skipping NPC ${npc.id} - definition ${npc.definitionKey} missing.`)
      continue
    }

    const normalizedNpcData = {
      ...npc.data,
      mobilityPath: npc.data.mobilityPath ?? undefined,
      stats: npc.data.stats ?? undefined,
      resistances: npc.data.resistances ?? undefined,
      dialogueTree: npc.data.dialogueTree ?? undefined,
      questHooks: npc.data.questHooks ?? undefined,
      vendorCatalog: npc.data.vendorCatalog ?? undefined,
      lootTable: npc.data.lootTable ?? undefined,
    }

    const record = await prisma.nPC.upsert({
      where: { id: npc.id },
      update: {
        ...normalizedNpcData,
        roomId,
        definitionId,
      },
      create: {
        id: npc.id,
        roomId,
        definitionId,
        ...normalizedNpcData,
      },
    })
    npcIdMap[npc.id] = record.id
  }

  if (npcIdMap['npc-seren']) {
    await prisma.quest.upsert({
      where: { slug: 'seren-fetch-herbs' },
      update: {
        name: 'Seren\'s Healing Herbs',
        description: 'Gather healing herbs for Seren the Elder.',
        giverNpcId: npcIdMap['npc-seren'],
        targetNpcId: npcIdMap['npc-seren'],
        requiredItem: 'healing_herb',
        requiredQuantity: 3,
        minLevel: 1,
        rewardItems: { items: [{ itemId: 'minor_bandage', quantity: 2 }] },
        rewardCurrency: 25,
        rewardXp: 50,
        isRepeatable: false,
        cooldownSeconds: null,
        completionFlag: 'seren_healing_complete',
      },
      create: {
        slug: 'seren-fetch-herbs',
        name: 'Seren\'s Healing Herbs',
        description: 'Gather healing herbs for Seren the Elder.',
        giverNpcId: npcIdMap['npc-seren'],
        targetNpcId: npcIdMap['npc-seren'],
        requiredItem: 'healing_herb',
        requiredQuantity: 3,
        minLevel: 1,
        rewardItems: { items: [{ itemId: 'minor_bandage', quantity: 2 }] },
        rewardCurrency: 25,
        rewardXp: 50,
        isRepeatable: false,
        cooldownSeconds: null,
        completionFlag: 'seren_healing_complete',
      },
    })
  }

  // Create a test user
  const hashedPassword = await bcrypt.hash('password123', 12)
  
  const testUser = await prisma.user.upsert({
    where: { username: 'testuser' },
    update: {},
    create: {
      username: 'testuser',
      password: hashedPassword,
      email: 'test@example.com',
      currentRoom: '000',
      level: 1,
      hp: 10,
      hpMax: 10,
      mp: 2,
      mpMax: 2,
      str: 10,
      dex: 10,
      mag: 10,
      def: 10,
      equipment: {
        create: {}
      }
    }
  })

  console.log('✅ Database seeded successfully!')
  console.log(`👤 Test user created: ${testUser.username} (password: password123)`)
  console.log(`🏠 Created ${rooms.length} rooms`)
  console.log(`🧍 Seeded ${Object.keys(npcIdMap).length} NPCs`)
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
