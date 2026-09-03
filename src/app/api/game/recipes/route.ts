export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware'

const { getRecipeSlugs } = require('@/lib/game-data/crafting-recipes') as {
  getRecipeSlugs: () => string[]
}

/**
 * Item templates for everything the recipe file refers to — inputs, outputs
 * and tools — keyed by slug. The crafting sheet fetches this once so a recipe's
 * output renders the way the same item renders in the bag or the shop (icon,
 * stat mods, description, stack cap) without any of it being copied into the
 * recipe. Same projection as the inventory payload, so the rows share types.
 */
export const GET = withAuth(async () => {
  const templates = await prisma.itemTemplate.findMany({
    where: { slug: { in: getRecipeSlugs() } },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      type: true,
      max: true,
      value: true,
      canSell: true,
      canDrop: true,
      equipSlot: true,
      weaponCategory: true,
      metadata: true,
    },
  })
  const bySlug: Record<string, (typeof templates)[number]> = {}
  for (const template of templates) bySlug[template.slug] = template
  return NextResponse.json(
    { templates: bySlug },
    { headers: { 'Cache-Control': 'private, max-age=300' } }
  )
})
