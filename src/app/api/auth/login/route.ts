export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuthResponse } from '@/lib/auth'
import { COMMON_ERRORS, validateRequiredFields } from '@/lib/error-handling'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    // Validate required fields
    const validation = validateRequiredFields({ username, password }, ['username', 'password'])
    if (!validation.isValid) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('Username and password are required'),
        { status: 400 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
      include: { equipment: true }
    })

    if (!user) {
      return NextResponse.json(
        COMMON_ERRORS.AUTHENTICATION_ERROR('Invalid credentials'),
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json(
        COMMON_ERRORS.AUTHENTICATION_ERROR('Invalid credentials'),
        { status: 401 }
      )
    }

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        lastActive: new Date(),
        isActive: true 
      }
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
    console.error('Login error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Login failed'),
      { status: 500 }
    )
  }
}
