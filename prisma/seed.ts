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
      description: 'You find yourself in a small, dimly lit chamber. A soft blue light emanates from a pillar in the center of the room. A sign is attached to the pillar, and you can see a map on the ground.',
      lookDesc: 'This is the starting room for new adventurers. The blue light from the pillar provides a gentle illumination. You can see exits leading in all directions.',
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
      lookDesc: 'This peaceful meadow stretches as far as the eye can see. Tall grass sways in the wind, and colorful wildflowers dot the landscape. You feel safe here.',
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
      lookDesc: 'The southern field is rich with redberry bushes. The grass here is lush and green, perfect for foraging. You can see paths leading in multiple directions.',
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
      lookDesc: 'The cabin is warm and inviting. The old man smiles as he rocks in his chair, and you notice a fireplace inside with a cooking pot. A wooden dummy stands ready for practice.',
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
      lookDesc: 'This peaceful garden is filled with vibrant flowers of every color. The ground is soft and fertile, perfect for growing. You feel completely at peace here.',
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
      lookDesc: 'The northern field is dotted with blueberry bushes. The grass is soft and comfortable here. To the east, you notice an unusual tent that appears to be made entirely of pajamas.',
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
      lookDesc: 'The shop is well-organized with weapons hanging on racks and armor displayed on mannequins. The merchant greets you warmly and invites you to browse his wares.',
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
      lookDesc: 'The cave mouth yawns darkly before you. The air grows cooler here, and you can sense danger lurking within. A wooden sign warns travelers to be prepared.',
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
      lookDesc: 'The healing springs are magical and peaceful. The waterfall creates a gentle mist, and the pool below shimmers with healing energy. You feel completely refreshed here.',
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
      lookDesc: 'The Pajama Shaman\'s tent is filled with magical energy. Strange symbols float in the air, and the shaman offers to teach you the ways of magic. The atmosphere is both mystical and oddly comfortable.',
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
