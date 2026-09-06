export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuthResponse } from '@/lib/auth'
import { PLAYER_AVATARS, DEFAULT_PLAYER_AVATAR, getRandomAvatarColor, DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'
import { COMMON_ERRORS, validateRequiredFields } from '@/lib/error-handling'
import { FEATURE_FLAGS } from '@/lib/config'
import { createWorldFeedEvent } from '@/lib/services/world-feed-event-service'
import { validateUsername } from '@/lib/sanitization'
import { DEFAULT_THEME_ID, isThemeId } from '@/lib/theme/themes'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { username, password, email, theme } = await request.json()

    // Validate required fields
    const requiredFields: Array<'username' | 'password' | 'email'> = ['username', 'password']
    if (FEATURE_FLAGS.REQUIRE_EMAIL_ON_REGISTRATION) {
      requiredFields.push('email')
    }

    const validation = validateRequiredFields({ username, password, email }, requiredFields)
    if (!validation.isValid) {
      const message = FEATURE_FLAGS.REQUIRE_EMAIL_ON_REGISTRATION
        ? 'Username, password, and email are required'
        : 'Username and password are required'

      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR(message),
        { status: 400 }
      )
    }

    // Validate username format (no spaces)
    const usernameValidation = validateUsername(username)
    if (!usernameValidation.isValid) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR(usernameValidation.error || 'Invalid username'),
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

    const randomAvatar =
      PLAYER_AVATARS[Math.floor(Math.random() * PLAYER_AVATARS.length)] ||
      DEFAULT_PLAYER_AVATAR
    const randomColor = getRandomAvatarColor()

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        uIcon: randomAvatar,
        ...(email ? { email } : {}),
        // Create default equipment
        equipment: {
          create: {}
        },
        uIconColor: randomColor,
        // A new account keeps whatever theme was being previewed on the login
        // screen. Validated rather than trusted: this is client-supplied.
        theme: isThemeId(theme) ? theme : DEFAULT_THEME_ID,
        cp: 1, // Give new users 1 Core Point (total CP earned aligns with level)
      },
      include: { equipment: true }
    })

    // No quest row is seeded: the Old Man is revealed to everyone from the
    // start (quest-givers.json `revealedBy: always`), and meeting him is the
    // first talk in his cabin.

    try {
      await createWorldFeedEvent({
        userId: user.id,
        username: user.username,
        eventType: 'register',
      })
    } catch (error) {
      console.error('Failed to record world feed registration event', error)
    }

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
      isActive: user.isActive,
      xp: user.xp,
      cp: user.cp,
      tp: user.tp,
      sp: user.sp,
      currency: user.currency,
      physicalTraining: user.physicalTraining,
      mentalTraining: user.mentalTraining,
      str: user.str,
      dex: user.dex,
      mag: user.mag,
      def: user.def,
      uIcon: user.uIcon,
      uIconColor: user.uIconColor ?? DEFAULT_AVATAR_COLOR,
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
