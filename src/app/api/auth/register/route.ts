import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuthResponse } from '@/lib/auth'
import { COMMON_ERRORS, validateRequiredFields } from '@/lib/error-handling'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { username, password, email } = await request.json()

    // Validate required fields
    const validation = validateRequiredFields({ username, password, email }, ['username', 'password', 'email'])
    if (!validation.isValid) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('Username, password, and email are required'),
        { status: 400 }
      )
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username }
    })

    if (existingUsername) {
      return NextResponse.json(
        COMMON_ERRORS.CONFLICT('Username already exists'),
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email,
        // Create default equipment
        equipment: {
          create: {}
        }
      },
      include: { equipment: true }
    })

    // Return player data with JWT token
    const authResponse = createAuthResponse({
      id: user.id,
      username: user.username,
      level: user.level,
      hp: user.hp,
      hpMax: user.hpMax,
      mp: user.mp,
      mpMax: user.mpMax,
      currentRoom: user.currentRoom,
      isActive: user.isActive
    })

    return NextResponse.json(authResponse)
  } catch (error) {
    console.error('Registration error:', error)
    
    // Handle specific Prisma errors
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        COMMON_ERRORS.CONFLICT('Username or email already exists'),
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Registration failed'),
      { status: 500 }
    )
  }
}
