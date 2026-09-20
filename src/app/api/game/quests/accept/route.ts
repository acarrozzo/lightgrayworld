export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

// Accepting a quest happens standing with its giver, which the engine's
// `accept_quest` action checks (RoomState.executeAcceptQuest). This route skipped
// that — and a quest with no requirements completes on acceptance, rewards and
// all. Nothing in the client has called it since quests moved to the socket.
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: 'Quests are accepted from their giver, through the real-time game engine.',
    },
    { status: 410 }
  )
}
