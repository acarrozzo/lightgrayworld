export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

export async function GET() {
  const engine = (globalThis as any).gameEngine

  if (!engine || typeof engine.getMetrics !== 'function') {
    return NextResponse.json(
      {
        status: 'starting',
        message: 'Game engine not initialized',
      },
      { status: 503 }
    )
  }

  const metrics = engine.getMetrics()

  return NextResponse.json({
    status: 'ok',
    tick: metrics.tick,
    rooms: metrics.roomCount,
  })
}
