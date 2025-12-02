import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create initial rooms - 9-room grassy field area
  const rooms = [
    {
      roomId: '000',
      name: 'Room Zero',
      subtitle: 'Awaken beneath the sapphire pillar.',
      subtitlePosition: 'above',
      icon: 'roomzero',
      iconColor: 'yellow-400',
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
      subtitle: 'This is it. The world is yours.',
      subtitlePosition: 'above',
      nameColor: 'green-400',
      subtitleColor: 'blue-400',
      icon: 'sun',
      iconColor: 'yellow-400',
      description: 'You find yourself standing in the middle of a large, grassy field. The air is warm, and the sky above is bright blue. A sign stands nearby with a golden chest at its base. To the southwest, you see a small, cozy cabin. The peaceful atmosphere is filled with birdsong and the rustling of grass.',
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
      subtitle: 'Redberry Patch',
      subtitlePosition: 'below',
      nameColor: 'green-400',
      subtitleColor: 'red-400',
      icon: 'redberry',
      iconColor: 'red-400',
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
      subtitleColor: 'yellow-700',
      icon: 'cabin2',
      iconColor: 'yellow-700',
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
      name: 'Flower Patch',
      subtitle: 'Every bloom hums a lullaby of peace.',
      subtitlePosition: 'below',
      nameColor: 'green-400',
      subtitleColor: 'blue-400',
      icon: 'flower',
      iconColor: 'pink-400',
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
      subtitle: 'Blue horizons meet pajama skies.',
      subtitlePosition: 'below',
      nameColor: 'green-400',
      subtitleColor: 'blue-400',
      icon: 'blueberry',
      iconColor: 'blue-400',
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
      subtitle: 'Trade stories, leave armed with resolve.',
      subtitlePosition: 'below',
      nameColor: 'green-400',
      subtitleColor: 'blue-400',
      icon: 'basicshop',
      iconColor: 'orange-400',
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
      subtitle: 'Shadows breathe just beyond the lantern glow.',
      subtitlePosition: 'below',
      nameColor: 'green-400',
      subtitleColor: 'blue-400',
      icon: 'cave1',
      iconColor: 'gray-600',
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
      subtitle: 'Let the waters knit bone, spirit, and resolve.',
      subtitlePosition: 'below',
      nameColor: 'green-400',
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
      subtitle: 'Dreamcraft is strongest after a good stretch.',
      subtitlePosition: 'below',
      nameColor: 'green-400',
      subtitleColor: 'blue-400',
      icon: 'tent',
      iconColor: 'purple-400',
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
