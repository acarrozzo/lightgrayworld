import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: 'The game action API has been deprecated. Actions are now processed via the real-time game engine.',
    },
    { status: 410 }
  )
}
