'use client'

import { useAnchorTarget } from './EntityLink'

/**
 * Lets a server-rendered reference page answer `#anchor` links.
 *
 * Skills, Spells, Crafting and Shops have no client list component to host
 * `useAnchorTarget`, so this renders nothing and only runs the hook. Drop it
 * anywhere inside the page.
 */
export default function AnchorTarget() {
  useAnchorTarget()
  return null
}
