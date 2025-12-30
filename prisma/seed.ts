import { PrismaClient, ItemType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')
  // Run locally with `npm run db:seed` (uses DATABASE_URL)

  // Create initial rooms - 9-room grassy field area
  const rooms = [
    {
      roomId: '000',
      name: 'Room Zero',
      subtitle: '000',
      subtitlePosition: 'above',
      nameColor: 'white',
      subtitleColor: 'gray-500',
      icon: 'roomzero2',
      iconColor: 'gray-700',
      description: 'You are in an empty room. The walls are all gray and there are no windows or doors. The only light you see comes from a pillar in the center of the room. There is a small sign on the side of the pillar and a small piece of paper on the floor.',
      dangerLevel: 0,
      isSafe: true,
      north: null,
      south: null,
      east: null,
      west: null,
      up: null,
      down: null,
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
      subtitle: 'This is it. The world is yours.',
      subtitlePosition: 'above',
      nameColor: 'grass',
      subtitleColor: 'blue-400',
      icon: 'sun',
      iconColor: 'yellow-400',
      description: 'You find yourself standing in the middle of a large, grassy field. The air is warm, and the sky above is bright blue. A sign stands nearby with a golden chest at its base. To the southwest, you see a small, cozy cabin.',
      dangerLevel: 0,
      isSafe: true,
      north: '005',
      south: '002',
      east: '006',
      west: '004',
      up: null,
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
      subtitle: 'Redberry Patch',
      subtitlePosition: 'below',
      nameColor: 'grass',
      subtitleColor: 'red-500',
      icon: 'redberry',
      iconColor: 'red-500',
      description: 'The grass starts to get rocky in this area. A redberry bush is here, and consuming its fruit will restore lost health points. An entrance to a cave can be seen to the east, and a cabin is visible to the west.',
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
      name: 'Old Man',
      subtitle: 'Wood Cabin',
      subtitlePosition: 'below',
      nameColor: 'neutral-200',
      subtitleColor: 'dirt',
      icon: 'cabin2',
      iconColor: 'dirt',
      description: 'The cabin is warm and cozy. A cooking fire burns here, and the Old Man is rocking in his chair. He insists that you make yourself at home and stay as long as you like, and encourages you to start and complete your first quests here.',
      dangerLevel: 0,
      isSafe: true,
      north: '004',
      south: null,
      east: '002',
      west: '003c',
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
      roomId: '003c',
      name: 'Young Soldier',
      subtitle: 'Weapons Training',
      subtitlePosition: 'below',
      nameColor: 'blue-400',
      subtitleColor: 'gray-200',
      icon: 'trainingarea',
      iconColor: 'blue-400',
      description: 'The training grounds are located on a cliff overlooking the ocean. Racks of weapons and armor stand ready for use, and a young soldier is here to guide you through your training. The breeze carries the fresh, salty sea air throughout the area.',
      dangerLevel: 0,
      isSafe: true,
      north: null,
      south: null,
      east: '003',
      west: null,
      up: null,
      down: null,
      northeast: null,
      northwest: null,
      southeast: null,
      southwest: null,
      hasFire: false,
      hasCraftingTable: false
    },
    {
      roomId: '004',
      name: 'Grassy Field West',
      subtitle: 'Flower Patch',
      subtitlePosition: 'below',
      nameColor: 'grass',
      subtitleColor: 'yellow-400',
      icon: 'flower',
      iconColor: 'yellow-400',
      description: 'A bright flower patch grows here. You see a cabin to the south and a beach to the west.',
      dangerLevel: 0,
      isSafe: true,
      north: '020',
      south: '003',
      east: '001',
      west: '014',
      up: null,
      down: null,
      northeast: '005',
      northwest: null,
      southeast: '002',
      southwest: null,
      hasFire: false,
      hasCraftingTable: false,
      directionColors: { west: 'dirt' }
    },
    {
      roomId: '014',
      name: 'Dirt Road West',
      subtitle: 'Path to the beach',
      subtitlePosition: 'below',
      nameColor: 'dirt',
      subtitleColor: 'sand',
      icon: 'sign2',
      iconColor: 'dirt',
      description: 'You are on a dirt path heading down to the beach.',
      dangerLevel: 0,
      isSafe: true,
      north: null,
      south: null,
      east: '004',
      west: '017',
      up: null,
      down: null,
      northeast: null,
      northwest: null,
      southeast: null,
      southwest: null,
      hasFire: false,
      hasCraftingTable: false,
      directionColors: { west: 'sand' }
    },
    {
      roomId: '017',
      name: 'On the Beach',
      subtitle: '',
      subtitlePosition: 'below',
      nameColor: 'blue-300',
      subtitleColor: 'sand',
      icon: 'beach-umbrella',
      iconColor: 'sand',
      description: 'The Sun is directly overhead and there is a cool breeze. The waves slowly roll in.',
      dangerLevel: 0,
      isSafe: true,
      north: '016',
      south: null,
      east: '014',
      west: null,
      up: null,
      down: null,
      northeast: null,
      northwest: null,
      southeast: null,
      southwest: null,
      hasFire: false,
      hasCraftingTable: false,
      directionColors: { north: 'sand', south: 'sand',east: 'dirt'},
    },
    {
      roomId: '016',
      name: 'Abandoned Docks',
      subtitle: 'On the Beach',
      subtitlePosition: 'below',
      nameColor: 'blue-400',
      subtitleColor: 'sand',
      icon: 'beach-dock',
      iconColor: 'sand',
      description: 'You stand on a worn wooden dock. A vast blue ocean is to your west.',
      dangerLevel: 0,
      isSafe: true,
      north: '015',
      south: '017',
      east: null,
      west: null,
      up: null,
      down: null,
      northeast: null,
      northwest: null,
      southeast: null,
      southwest: null,
      hasFire: false,
      hasCraftingTable: false,
      directionColors: { north: 'sand', south: 'sand'}
    },
    {
      roomId: '015',
      name: 'On the Beach',
      subtitle: 'by a Giant Rock',
      subtitlePosition: 'below',
      nameColor: 'blue-300',
      subtitleColor: 'gray-300',
      icon: 'beach-rock',
      iconColor: 'sand',
      description: 'The Sun is directly overhead and there is a cool breeze. You can mine stone from the giant rocks here.',
      dangerLevel: 0,
      isSafe: true,
      north: null,
      south: '016',
      east: null,
      west: null,
      up: null,
      down: null,
      northeast: null,
      northwest: null,
      southeast: null,
      southwest: null,
      hasFire: false,
      hasCraftingTable: false,
      directionColors: {south: 'sand'},
    },
    {
      roomId: '005',
      name: 'Grassy Field North',
      subtitle: 'Blueberry patch',
      subtitlePosition: 'below',
      nameColor: 'grass',
      subtitleColor: 'blue-500',
      icon: 'blueberry',
      iconColor: 'blue-500',
      description: 'Blueberry bushes grow in this part of the field. To the west you see a waterfall and to the east an odd tent. To the south you see the main crossroads.',
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
      name: 'Grassy Field East',
      subtitle: 'Basic Shop',
      subtitlePosition: 'below',
      nameColor: 'grass',
      subtitleColor: 'dirt',
      icon: 'basicshop',
      iconColor: 'dirt',
      description: 'A Basic Shop is set up here where you can buy weapons, armor and other useful items. To the south is a cave and north is a strange tent. To the far east you see a forest.',
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
      name: 'Grassy Field Cave Entrance',
      subtitle: 'Scorpions to the south',
      subtitlePosition: 'below',
      nameColor: 'grass',
      subtitleColor: 'gray-600',
      icon: 'cave1',
      iconColor: 'gray-600',
      description: 'In the Grassy Field at an entrance to a dark cave. There is a sign here.',
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
      subtitle: 'Mountain Waterfall',
      subtitlePosition: 'below',
      nameColor: 'grass',
      subtitleColor: 'blue-400',
      icon: 'waterfall',
      iconColor: 'blue-400',
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
      subtitle: 'Shop & Skills',
      subtitlePosition: 'below',
      nameColor: 'purple-400',
      subtitleColor: 'gray-100',
      icon: 'tent',
      iconColor: 'purple-400',
      description: 'A hooded man has set up a strange tent here with a makeshift shop. He is selling some basic items and also teaching some important skills.',
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
    },
    {
      roomId: '999',
      name: 'The Lobby',
      subtitle: '',
      subtitlePosition: 'above',
      nameColor: 'gray-100',
      subtitleColor: 'blue-300',
      icon: 'environment-lobby',
      iconColor: 'gray-400',
      description: 'You find yourself in the center of a floating platform high in the sky bathed in sunlight. You are surrounded by a massive ring of pillars. The ground is a smooth, polished surface of white marble.',
      dangerLevel: 0,
      isSafe: true,
      north: null,
      south: null,
      east: null,
      west: null,
      up: null,
      down: null,
      northeast: null,
      northwest: null,
      southeast: null,
      southwest: null,
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

  // Seed item templates (idempotent by slug)
  const itemTemplates = [
    {
      id: 'flower_001',
      slug: 'flower',
      name: 'Flower',
      description: 'A beautiful wildflower from the flower patch.',
      type: ItemType.MISC,
      maxStack: 1,
      maxPerPlayer: 1,
    },
    {
      id: 'redberry_001',
      slug: 'redberry',
      name: 'Redberry',
      description: 'A juicy redberry that restores health.',
      type: ItemType.CONSUMABLE,
      maxStack: 99999,
      maxPerPlayer: null,
    },
    {
      id: 'blueberry_001',
      slug: 'blueberry',
      name: 'Blueberry',
      description: 'A juicy blueberry that restores mana.',
      type: ItemType.CONSUMABLE,
      maxStack: 99999,
      maxPerPlayer: null,
    },
    {
      id: 'welcome-book',
      slug: 'welcome-book',
      name: 'Welcome Book',
      description: 'A leather-bound book welcoming adventurers to the world.',
      type: ItemType.MISC,
      maxStack: 99999,
      maxPerPlayer: null,
    },
    {
      id: 'shovel_001',
      slug: 'shovel',
      name: 'Shovel',
      description: 'A sturdy shovel for digging.',
      type: ItemType.MISC,
      maxStack: 1,
      maxPerPlayer: 1,
    },
  ]

  for (const item of itemTemplates) {
    const { id, ...updateData } = item
    await prisma.itemTemplate.upsert({
      where: { slug: item.slug },
      update: updateData,
      create: item,
    })
  }

  // Seed room items (idempotent)
  await prisma.roomItem.deleteMany({
    where: { roomId: '001', templateId: 'welcome-book' },
  })

  await prisma.roomItem.create({
    data: {
      roomId: '001',
      templateId: 'welcome-book',
      quantity: 1,
      autoRespawn: true,
    },
  })

  // Seed shovel in room 006 (idempotent)
  await prisma.roomItem.deleteMany({
    where: { roomId: '006', templateId: 'shovel_001' },
  })

  await prisma.roomItem.create({
    data: {
      roomId: '006',
      templateId: 'shovel_001',
      quantity: 1,
      autoRespawn: true,
    },
  })

  // Seed flower in room 004 (idempotent)
  await prisma.roomItem.deleteMany({
    where: { roomId: '004', templateId: 'flower_001' },
  })

  await prisma.roomItem.create({
    data: {
      roomId: '004',
      templateId: 'flower_001',
      quantity: 1,
      autoRespawn: true,
    },
  })

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
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
