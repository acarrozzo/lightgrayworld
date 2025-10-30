const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding minimal data...')

  // Ensure required rooms exist for User.currentRoom FK (defaults to '001')
  const rooms = [
    {
      roomId: '001',
      name: 'Grassy Field Crossroads',
      description: 'Starting area',
      dangerLevel: 0,
      isSafe: true
    },
    {
      roomId: '000',
      name: 'Room Zero',
      description: 'Lobby',
      dangerLevel: 0,
      isSafe: true
    }
  ]

  for (const data of rooms) {
    await prisma.room.upsert({
      where: { roomId: data.roomId },
      update: data,
      create: {
        roomId: data.roomId,
        name: data.name,
        description: data.description,
        lookDesc: data.description,
        dangerLevel: data.dangerLevel,
        isSafe: data.isSafe
      }
    })
  }

  console.log('✅ Minimal rooms ensured.')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


