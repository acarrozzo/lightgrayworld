export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { loadIconsData } from '@/lib/world-tool/icons'
import IconsBrowser from './IconsBrowser'

export const metadata = {
  title: 'Icons — Light Gray World Tool',
  description: 'Every icon in Light Gray RPG beside its proposed replacement, with who draws it, at full size.',
}

/**
 * The icon bench. The live sprite is read from disk and matched to every
 * item, enemy, NPC, room, spell and skill that draws it; anything waiting in
 * `public/icons-proposed/` shows beside the glyph it would replace.
 *
 * Approve and reject write to the working tree, so they are only offered in
 * development: production has no disk to write and no sprite to rebuild.
 */
export default async function IconsPage() {
  const data = await loadIconsData()
  const canWrite = process.env.NODE_ENV !== 'production'
  return <IconsBrowser data={data} canWrite={canWrite} />
}
