export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { ICONS_DIR, PROPOSED_DIR, BACKUP_DIR, isSafeIconRel, isSafeBackupRel, isSlug, symbolIdFor } from '@/lib/world-tool/icons'

/**
 * Approve, reject, or propose an icon.
 *
 * `approve` copies `public/icons-proposed/<rel>` over `public/icons/<target>`
 * (the same path unless the page asked otherwise), removes the proposal, and
 * rebuilds the sprite sheet and icon mappings so the game picks it up on the
 * next reload. `reject` deletes the proposal. `propose` copies a backup from
 * `public/icons-backup/<slot>/<file>` into the proposed folder under an item's
 * slug, at `equipment/<slot>/<slug>.svg`; the backup stays where it is.
 *
 * All three write to the working tree, so the route refuses in production:
 * the deploy has no writable disk, and the sprite there is built at deploy time.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Icon changes only work in development.' }, { status: 403 })
  }
  let body: { action?: string; rel?: string; target?: string; backup?: string; slug?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }
  const { action } = body

  if (action === 'propose') {
    const { backup, slug } = body
    if (!backup || !isSafeBackupRel(backup) || !slug || !isSlug(slug)) return NextResponse.json({ error: 'Bad path' }, { status: 400 })
    const src = path.join(BACKUP_DIR, backup)
    if (!fs.existsSync(src)) return NextResponse.json({ error: 'No such backup' }, { status: 404 })
    const rel = `equipment/${backup.split('/')[0]}/${slug}.svg`
    const dest = path.join(PROPOSED_DIR, rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
    return NextResponse.json({ ok: true, rel })
  }

  const { rel } = body
  const target = body.target || rel
  if (!rel || !isSafeIconRel(rel) || !target || !isSafeIconRel(target)) {
    return NextResponse.json({ error: 'Bad path' }, { status: 400 })
  }
  const src = path.join(PROPOSED_DIR, rel)
  if (!fs.existsSync(src)) return NextResponse.json({ error: 'No such proposal' }, { status: 404 })

  if (action === 'reject') {
    fs.unlinkSync(src)
    return NextResponse.json({ ok: true, rel })
  }
  if (action !== 'approve') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  const dest = path.join(ICONS_DIR, target)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  fs.unlinkSync(src)
  try {
    execFileSync(process.execPath, [path.join(process.cwd(), 'scripts', 'generate-sprite-sheet.js')], { stdio: 'ignore', timeout: 60_000 })
  } catch (err) {
    return NextResponse.json({ ok: true, rel, target, id: symbolIdFor(target, 'icons'), warning: `Copied, but the sprite rebuild failed: ${(err as Error).message}` })
  }
  return NextResponse.json({ ok: true, rel, target, id: symbolIdFor(target, 'icons') })
}
