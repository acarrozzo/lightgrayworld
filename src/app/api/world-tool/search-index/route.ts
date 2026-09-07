export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { buildSearchIndex } from '@/lib/world-tool/search-index'

/**
 * The rail's search index, fetched once per browser session the first time
 * the search box is focused and filtered on the client from then on. Read-only
 * reference data, so a short cache is fine: it only moves on deploy or reseed.
 */
export async function GET() {
  const entries = await buildSearchIndex()
  return NextResponse.json(
    { entries },
    { headers: { 'Cache-Control': 'private, max-age=300' } }
  )
}
