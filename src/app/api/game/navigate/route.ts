export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: 'Navigation via HTTP is deprecated. Use the real-time engine to move between rooms.',
    },
    { status: 410 }
  )
}
