import { notFound } from 'next/navigation'
import ColorLab from './ColorLab'

/**
 * Development-only theme review screen.
 *
 * Not a player-facing page: it exists so a palette can be judged whole before
 * it ships. 404s in production rather than being merely unlinked, so it cannot
 * be found by guessing the URL on the live game.
 */
export default function ColorLabPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }
  return <ColorLab />
}
