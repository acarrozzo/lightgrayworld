export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

// A turn-in happens standing with the giver, and the engine's `complete_quest`
// action is what checks that (RoomState.executeCompleteQuest). This route called
// the quest service directly — no room check, outside the per-player action
// queue — so any quest could be turned in from anywhere. Nothing in the client
// has called it since turn-ins moved to the socket.
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: 'Quests are turned in with their giver, through the real-time game engine.',
    },
    { status: 410 }
  )
}
