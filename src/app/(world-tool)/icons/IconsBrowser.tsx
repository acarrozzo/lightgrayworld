'use client'

/**
 * The Icons page: every thing that draws a glyph, as a card with its current
 * icon on the left and the proposed replacement on the right, plus the files
 * themselves and the backups passed over for a slot.
 *
 * Every glyph is the raw SVG file painted through a CSS mask in
 * `currentColor`, not the sprite: a proposal or a backup is not in the sprite
 * yet, and drawing all of them the same way is the only honest comparison.
 * The mask also lets the viewer recolour and resize a glyph without touching
 * the file.
 *
 * Approve, reject and propose call /api/world-tool/icons and then refresh the
 * server data; the route refuses in production, and so do the buttons.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Maximize2, ExternalLink, ArrowRightToLine } from 'lucide-react'
import { useUrlEnum, useUrlString, useUrlFlag } from '@/components/world-tool/useUrlState'
import { Tag } from '@/components/world-tool/ui'
import type { IconsData, IconRow, IconFile, ProposedFile, BackupFile, Usage } from '@/lib/world-tool/icons'

type TabKey = 'items' | 'enemies' | 'npcs' | 'rooms' | 'abilities' | 'files' | 'backups'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'items', label: 'Items' },
  { key: 'enemies', label: 'Enemies' },
  { key: 'npcs', label: 'NPCs' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'abilities', label: 'Spells & Skills' },
  { key: 'files', label: 'Files' },
  { key: 'backups', label: 'Backups' },
]
const TAB_KEYS = TABS.map((t) => t.key) as readonly TabKey[]
const ROW_TABS = ['items', 'enemies', 'npcs', 'rooms', 'abilities'] as const
type RowTab = (typeof ROW_TABS)[number]
const isRowTab = (t: TabKey): t is RowTab => (ROW_TABS as readonly string[]).includes(t)

const USAGE_LABEL: Record<Usage['kind'], string> = {
  item: 'Item', enemy: 'Enemy', giver: 'Giver', traveler: 'Traveler', room: 'Room', spell: 'Spell', skill: 'Skill',
}

type Action =
  | { action: 'approve'; rel: string; target: string | null }
  | { action: 'reject'; rel: string }
  | { action: 'propose'; backup: string; slug: string }

/** A single-colour SVG file painted in currentColor at the given size. */
function MaskIcon({ url, size, className = '' }: { url: string; size: number; className?: string }) {
  const style: React.CSSProperties = {
    width: size, height: size,
    WebkitMaskImage: `url("${url}")`, maskImage: `url("${url}")`,
    WebkitMaskSize: 'contain', maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center', maskPosition: 'center',
    backgroundColor: 'currentColor',
  }
  return <span aria-hidden="true" className={`inline-block shrink-0 ${className}`} style={style} />
}

/** The square an icon sits in, dashed when there is nothing to show. */
function Slot({ label, file, version, size = 56, onOpen }: { label: string; file: { url: string } | null; version: number; size?: number; onOpen?: () => void }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className="text-[10px] uppercase tracking-wide text-fg-muted">{label}</span>
      {file ? (
        <button
          type="button"
          onClick={onOpen}
          title="View full size"
          className="grid place-items-center rounded border border-line-subtle bg-surface-canvas text-fg-primary hover:border-line-strong focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
          style={{ width: size + 16, height: size + 16 }}
        >
          <MaskIcon url={`${file.url}?v=${version}`} size={size} />
        </button>
      ) : (
        <div className="grid place-items-center rounded border border-dashed border-line-subtle text-[10px] text-fg-disabled" style={{ width: size + 16, height: size + 16 }}>
          none
        </div>
      )}
    </div>
  )
}

function fmtBytes(n: number) { return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB` }

export default function IconsBrowser({ data, canWrite }: { data: IconsData; canWrite: boolean }) {
  const router = useRouter()
  const [tab, setTab] = useUrlEnum<TabKey>('tab', TAB_KEYS, 'items')
  const [q, setQ] = useUrlString('q', '')
  const [group, setGroup] = useUrlString('group', 'All')
  const [onlyProposed, setOnlyProposed] = useUrlFlag('proposed')
  const [onlyMissing, setOnlyMissing] = useUrlFlag('missing')
  const [onlyShared, setOnlyShared] = useUrlFlag('shared')
  // Bumped after a write so the raw file URLs bypass the browser cache.
  const [version, setVersion] = useState(0)
  const [open, setOpen] = useState<IconRow | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const rows: IconRow[] = useMemo(() => (isRowTab(tab) ? data.rows[tab] : []), [tab, data.rows])
  const groups = useMemo(() => (tab === 'items' ? ['All', ...Array.from(new Set(data.rows.items.map((r) => r.sub)))] : []), [tab, data.rows.items])

  const needle = q.trim().toLowerCase()
  const visible = useMemo(() => rows.filter((r) => {
    if (group !== 'All' && tab === 'items' && r.sub !== group) return false
    if (onlyProposed && !r.proposed) return false
    if (onlyMissing && r.iconId) return false
    if (onlyShared && r.sharedWith === 0) return false
    if (needle && !(`${r.name} ${r.id} ${r.iconId ?? ''} ${r.current?.rel ?? ''}`.toLowerCase().includes(needle))) return false
    return true
  }), [rows, group, tab, onlyProposed, onlyMissing, onlyShared, needle])

  // Files tab: every live file plus every proposal that adds a brand-new symbol.
  const files = useMemo(() => data.files.filter((f) => !needle || `${f.id} ${f.rel}`.toLowerCase().includes(needle)), [data.files, needle])
  const newProposals = useMemo(() => data.proposed.filter((p) => !p.replaces).filter((p) => !needle || `${p.id} ${p.rel}`.toLowerCase().includes(needle)), [data.proposed, needle])
  const backups = useMemo(() => data.backups.filter((b) => !needle || b.rel.toLowerCase().includes(needle)), [data.backups, needle])
  // Items per slot folder, for the backup picker.
  const itemsBySlot = useMemo(() => {
    const m = new Map<string, { slug: string; name: string }[]>()
    for (const r of data.rows.items) if (r.slotFolder) (m.get(r.slotFolder) ?? m.set(r.slotFolder, []).get(r.slotFolder)!).push({ slug: r.id, name: r.name })
    return m
  }, [data.rows.items])

  const counts = useMemo(() => ({
    proposed: rows.filter((r) => r.proposed).length,
    missing: rows.filter((r) => !r.iconId).length,
    shared: rows.filter((r) => r.sharedWith > 0).length,
  }), [rows])

  async function act(a: Action) {
    if (!canWrite) return
    const key = a.action === 'propose' ? a.backup : a.rel
    setBusy(key)
    setNotice(null)
    try {
      const res = await fetch('/api/world-tool/icons', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a.action === 'approve' ? { ...a, target: a.target ?? a.rel } : a) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || res.statusText)
      setNotice(
        a.action === 'approve' ? `Approved ${a.rel}${json.warning ? ` — ${json.warning}` : '. Sprite rebuilt; reload the game to see it.'}`
        : a.action === 'reject' ? `Rejected ${a.rel}.`
        : `Proposed ${a.backup} for ${a.slug} at ${json.rel}. Find it on the Items tab.`
      )
      setVersion((v) => v + 1)
      setOpen(null)
      router.refresh()
    } catch (err) {
      setNotice(`Failed: ${(err as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const toggle = (on: boolean, cls: string) => `rounded border px-2 py-1 text-xs ${on ? cls : 'border-line-subtle text-fg-muted hover:text-fg-primary'}`

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-fg-bright">Icons</h1>
        <p className="mt-1 max-w-3xl text-sm text-fg-secondary">
          Every icon the game draws, beside the file waiting to replace it. Drop an SVG into <code className="rounded bg-surface-panel px-1 text-xs">public/icons-proposed/</code> at the same path as the live file (or <code className="rounded bg-surface-panel px-1 text-xs">equipment/&lt;slot&gt;/&lt;slug&gt;.svg</code> for an item that has none) and it appears here. Alternates you passed over live in <code className="rounded bg-surface-panel px-1 text-xs">public/icons-backup/&lt;slot&gt;/</code> and can be proposed for any item in that slot.
          {canWrite ? ' Approve copies a proposal live and rebuilds the sprite.' : ' Approving, rejecting and proposing only work on a development build.'}
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const n = t.key === 'files' ? data.files.length : t.key === 'backups' ? data.backups.length : data.rows[t.key].length
            const prop = t.key === 'files' ? newProposals.length : t.key === 'backups' ? 0 : data.rows[t.key].filter((r) => r.proposed).length
            return (
              <button key={t.key} role="tab" aria-selected={tab === t.key} type="button" onClick={() => setTab(t.key)}
                className={`rounded px-3 py-1.5 text-sm ${tab === t.key ? 'bg-surface-panel text-fg-bright' : 'text-fg-muted hover:text-fg-primary'}`}>
                {t.label} <span className="text-fg-disabled">{n}</span>
                {prop > 0 && <span className="ml-1 rounded bg-status-success/20 px-1 text-[10px] text-status-success">{prop}</span>}
              </button>
            )
          })}
        </div>
        <input
          id="icons-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, slug, symbol, file…"
          className="ml-auto w-64 max-w-full rounded border border-line-subtle bg-surface-canvas px-2 py-1 text-sm text-fg-primary placeholder:text-fg-disabled"
        />
      </div>

      {isRowTab(tab) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {groups.length > 0 && (
            <select id="icons-group" value={group} onChange={(e) => setGroup(e.target.value)} className="rounded border border-line-subtle bg-surface-canvas px-2 py-1 text-xs text-fg-primary">
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
          <button type="button" onClick={() => setOnlyProposed(!onlyProposed)} className={toggle(onlyProposed, 'border-status-success text-status-success')}>Has proposal · {counts.proposed}</button>
          <button type="button" onClick={() => setOnlyMissing(!onlyMissing)} className={toggle(onlyMissing, 'border-status-warning text-status-warning')}>No icon · {counts.missing}</button>
          <button type="button" onClick={() => setOnlyShared(!onlyShared)} className={toggle(onlyShared, 'border-status-info text-status-info')}>Shared glyph · {counts.shared}</button>
          <span className="ml-auto text-xs text-fg-muted">{visible.length} shown</span>
        </div>
      )}

      {notice && <p className="mb-4 rounded border border-line-subtle bg-surface-panel px-3 py-2 text-xs text-fg-secondary" role="status">{notice}</p>}

      {isRowTab(tab) && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
          {visible.map((r) => (
            <article key={`${r.kind}-${r.id}`} id={`icon-${r.kind}-${r.id}`} className="flex flex-col gap-2 rounded border border-line-subtle bg-surface-panel p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium text-fg-bright">{r.name}</h3>
                  <p className="truncate text-[11px] text-fg-muted">{r.sub}</p>
                </div>
                <a href={r.href} className="shrink-0 text-fg-disabled hover:text-fg-primary" title="Open its page"><ExternalLink className="h-3.5 w-3.5" /></a>
              </div>
              <div className="flex gap-2">
                <Slot label="Current" file={r.current} version={version} onOpen={() => setOpen(r)} />
                <Slot label="Proposed" file={r.proposed} version={version} onOpen={() => setOpen(r)} />
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {r.iconId ? <Tag>{r.iconId}</Tag> : <Tag className="border-status-warning text-status-warning">bag fallback</Tag>}
                {r.sharedWith > 0 && <Tag className="border-status-info text-status-info">shared ×{r.sharedWith + 1}</Tag>}
                {r.proposed && !r.proposed.replaces && <Tag className="border-status-success text-status-success">new file</Tag>}
              </div>
              <div className="mt-auto flex items-center gap-1">
                <button type="button" onClick={() => setOpen(r)} className="flex items-center gap-1 rounded border border-line-subtle px-2 py-1 text-xs text-fg-secondary hover:text-fg-primary"><Maximize2 className="h-3 w-3" /> View</button>
                {r.proposed && (
                  <>
                    <button type="button" disabled={!canWrite || busy === r.proposed.rel} onClick={() => act({ action: 'approve', rel: r.proposed!.rel, target: r.target })} title={canWrite ? `Write to public/icons/${r.target}` : 'Development only'}
                      className="ml-auto flex items-center gap-1 rounded border border-status-success px-2 py-1 text-xs text-status-success disabled:opacity-40"><Check className="h-3 w-3" /> Approve</button>
                    <button type="button" disabled={!canWrite || busy === r.proposed.rel} onClick={() => act({ action: 'reject', rel: r.proposed!.rel })} title={canWrite ? 'Delete the proposal' : 'Development only'}
                      className="flex items-center gap-1 rounded border border-status-error px-2 py-1 text-xs text-status-error disabled:opacity-40"><X className="h-3 w-3" /> Reject</button>
                  </>
                )}
              </div>
            </article>
          ))}
          {visible.length === 0 && <p className="text-sm text-fg-muted">Nothing matches.</p>}
        </div>
      )}

      {tab === 'files' && (
        <FilesTab files={files} newProposals={newProposals} usage={data.usage} version={version} canWrite={canWrite} busy={busy} onAct={act} onOpen={(f) => setOpen({ kind: 'item', id: f.id, name: f.rel, sub: f.id, href: '#', iconId: f.id, current: f, proposed: data.proposed.find((p) => p.replaces === f.rel) ?? null, target: f.rel, sharedWith: Math.max(0, (data.usage[f.id]?.length ?? 1) - 1), slotFolder: null })} />
      )}

      {tab === 'backups' && (
        <BackupsTab backups={backups} itemsBySlot={itemsBySlot} version={version} canWrite={canWrite} busy={busy} onAct={act} />
      )}

      {open && (
        <Viewer row={open} usage={data.usage[open.iconId ?? ''] ?? []} version={version} canWrite={canWrite} busy={busy} onClose={() => setOpen(null)} onAct={act} />
      )}
    </div>
  )
}

function FilesTab({ files, newProposals, usage, version, canWrite, busy, onAct, onOpen }: {
  files: IconFile[]; newProposals: ProposedFile[]; usage: Record<string, Usage[]>; version: number; canWrite: boolean; busy: string | null
  onAct: (a: Action) => void; onOpen: (f: IconFile) => void
}) {
  const unused = files.filter((f) => !f.shadowed && !(usage[f.id]?.length)).length
  return (
    <div className="flex flex-col gap-6">
      {newProposals.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-fg-muted">Proposed new files · {newProposals.length}</h2>
          <p className="mb-2 text-xs text-fg-secondary">No live file at this path yet. Approving adds the symbol; an item picks it up by slug once its seed icon name no longer resolves.</p>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {newProposals.map((p) => (
              <div key={p.rel} className="flex items-center gap-2 rounded border border-line-subtle bg-surface-panel p-2">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded border border-line-subtle bg-surface-canvas text-fg-primary"><MaskIcon url={`${p.url}?v=${version}`} size={36} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-fg-bright">{p.rel}</p>
                  <p className="truncate text-[10px] text-fg-muted">{p.id} · {fmtBytes(p.bytes)}</p>
                </div>
                <button type="button" disabled={!canWrite || busy === p.rel} onClick={() => onAct({ action: 'approve', rel: p.rel, target: null })} className="rounded border border-status-success p-1 text-status-success disabled:opacity-40" title="Approve"><Check className="h-3 w-3" /></button>
                <button type="button" disabled={!canWrite || busy === p.rel} onClick={() => onAct({ action: 'reject', rel: p.rel })} className="rounded border border-status-error p-1 text-status-error disabled:opacity-40" title="Reject"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </section>
      )}
      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wide text-fg-muted">Live files · {files.length} <span className="normal-case tracking-normal text-fg-disabled">({unused} unused)</span></h2>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {files.map((f) => {
            const n = usage[f.id]?.length ?? 0
            return (
              <button key={`${f.folder}/${f.rel}`} type="button" onClick={() => onOpen(f)} className="flex items-center gap-2 rounded border border-line-subtle bg-surface-panel p-2 text-left hover:border-line-strong">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded border border-line-subtle bg-surface-canvas text-fg-primary"><MaskIcon url={`${f.url}?v=${version}`} size={36} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-fg-bright">{f.rel}</p>
                  <p className="truncate text-[10px] text-fg-muted">{f.id} · {fmtBytes(f.bytes)}</p>
                  <p className="text-[10px]">
                    {f.shadowed ? <span className="text-status-warning">shadowed by another file</span> : n === 0 ? <span className="text-fg-disabled">unused</span> : <span className="text-fg-secondary">{n} use{n === 1 ? '' : 's'}</span>}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

/**
 * Alternates kept per slot. Each can be proposed for any item in its slot:
 * the file is copied into the proposed folder under that item's slug, and the
 * backup stays where it is for the next time.
 */
function BackupsTab({ backups, itemsBySlot, version, canWrite, busy, onAct }: {
  backups: BackupFile[]; itemsBySlot: Map<string, { slug: string; name: string }[]>; version: number; canWrite: boolean; busy: string | null
  onAct: (a: Action) => void
}) {
  const [picks, setPicks] = useState<Record<string, string>>({})
  const slots = Array.from(new Set(backups.map((b) => b.slot)))
  if (backups.length === 0) return <p className="text-sm text-fg-muted">No backups. Put alternates in <code className="rounded bg-surface-panel px-1 text-xs">public/icons-backup/&lt;slot&gt;/</code>.</p>
  return (
    <div className="flex flex-col gap-6">
      {slots.map((slot) => {
        const items = itemsBySlot.get(slot) ?? []
        return (
          <section key={slot}>
            <h2 className="mb-2 text-xs uppercase tracking-wide text-fg-muted">{slot} · {backups.filter((b) => b.slot === slot).length}</h2>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {backups.filter((b) => b.slot === slot).map((b) => {
                const pick = picks[b.rel] ?? ''
                return (
                  <div key={b.rel} className="flex items-center gap-2 rounded border border-line-subtle bg-surface-panel p-2">
                    <a href={b.url} target="_blank" rel="noreferrer" title="Open the raw file" className="grid h-14 w-14 shrink-0 place-items-center rounded border border-line-subtle bg-surface-canvas text-fg-primary hover:border-line-strong"><MaskIcon url={`${b.url}?v=${version}`} size={44} /></a>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="truncate text-xs text-fg-bright" title={b.rel}>{b.rel.slice(slot.length + 1)}</p>
                      <p className="truncate text-[10px] text-fg-muted">{fmtBytes(b.bytes)}</p>
                      <div className="flex items-center gap-1">
                        <select
                          id={`pick-${b.rel}`}
                          value={pick}
                          onChange={(e) => setPicks((p) => ({ ...p, [b.rel]: e.target.value }))}
                          disabled={!canWrite || items.length === 0}
                          className="min-w-0 flex-1 rounded border border-line-subtle bg-surface-canvas px-1 py-0.5 text-[11px] text-fg-primary disabled:opacity-50"
                        >
                          <option value="">Propose for…</option>
                          {items.map((it) => <option key={it.slug} value={it.slug}>{it.name}</option>)}
                        </select>
                        <button type="button" disabled={!canWrite || !pick || busy === b.rel} onClick={() => onAct({ action: 'propose', backup: b.rel, slug: pick })} title={canWrite ? 'Copy into the proposed folder under this item' : 'Development only'}
                          className="flex shrink-0 items-center gap-1 rounded border border-status-info px-2 py-0.5 text-[11px] text-status-info disabled:opacity-40"><ArrowRightToLine className="h-3 w-3" /> Propose</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

const BACKDROPS = [
  { key: 'panel', label: 'Panel', cls: 'bg-surface-canvas text-fg-primary' },
  { key: 'dark', label: 'Dark', cls: 'bg-black text-white' },
  { key: 'light', label: 'Light', cls: 'bg-white text-black' },
] as const
const LADDER = [18, 22, 32, 48] as const

function Viewer({ row, usage, version, canWrite, busy, onClose, onAct }: {
  row: IconRow; usage: Usage[]; version: number; canWrite: boolean; busy: string | null
  onClose: () => void; onAct: (a: Action) => void
}) {
  const [bg, setBg] = useState<(typeof BACKDROPS)[number]['key']>('panel')
  const back = BACKDROPS.find((b) => b.key === bg)!
  const big = ({ label, file, note }: { label: string; file: { url: string; rel: string; bytes: number } | null; note?: string }) => (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-fg-muted">{label}</span>
      <div className={`grid h-56 w-56 max-w-full place-items-center rounded border border-line-subtle ${back.cls}`}>
        {file ? <MaskIcon url={`${file.url}?v=${version}`} size={200} /> : <span className="text-xs text-fg-disabled">none</span>}
      </div>
      <div className={`flex items-end gap-3 rounded border border-line-subtle px-3 py-2 ${back.cls}`}>
        {LADDER.map((s) => file ? <MaskIcon key={s} url={`${file.url}?v=${version}`} size={s} /> : <span key={s} className="inline-block" style={{ width: s, height: s }} />)}
      </div>
      {file && <p className="max-w-full truncate text-[11px] text-fg-muted" title={file.rel}>{file.rel} · {fmtBytes(file.bytes)} · <a className="underline hover:text-fg-primary" href={file.url} target="_blank" rel="noreferrer">raw</a></p>}
      {note && <p className="text-[11px] text-fg-disabled">{note}</p>}
    </div>
  )
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${row.name} icon`}>
      <div className="max-h-full w-full max-w-3xl overflow-auto rounded border border-line-strong bg-surface-panel p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-fg-bright">{row.name}</h2>
            <p className="text-xs text-fg-muted">{row.sub}{row.iconId ? ` · ${row.iconId}` : ' · no icon, draws the bag'}</p>
          </div>
          <div className="flex items-center gap-1">
            {BACKDROPS.map((b) => (
              <button key={b.key} type="button" onClick={() => setBg(b.key)} className={`rounded border px-2 py-0.5 text-[11px] ${bg === b.key ? 'border-line-strong text-fg-bright' : 'border-line-subtle text-fg-muted'}`}>{b.label}</button>
            ))}
            <button type="button" onClick={onClose} className="ml-2 rounded border border-line-subtle p-1 text-fg-muted hover:text-fg-primary" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex flex-col gap-6 sm:flex-row">
          {big({ label: 'Current', file: row.current })}
          {big({ label: 'Proposed', file: row.proposed, note: row.proposed && row.target && row.target !== row.proposed.rel ? `Approving writes it to ${row.target}` : undefined })}
        </div>
        {usage.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-1 text-[11px] uppercase tracking-wide text-fg-muted">Drawn by · {usage.length}</h3>
            <ul className="flex flex-wrap gap-1">
              {usage.slice(0, 60).map((u) => (
                <li key={`${u.kind}-${u.id}`}><a href={u.href} className="rounded border border-line-subtle px-1.5 py-0.5 text-[11px] text-fg-secondary hover:text-fg-primary">{USAGE_LABEL[u.kind]} · {u.name}</a></li>
              ))}
              {usage.length > 60 && <li className="px-1.5 py-0.5 text-[11px] text-fg-disabled">and {usage.length - 60} more</li>}
            </ul>
          </div>
        )}
        {row.proposed && (
          <div className="mt-5 flex items-center justify-end gap-2 border-t border-line-subtle pt-4">
            {!canWrite && <span className="mr-auto text-xs text-fg-muted">Approve and reject work on a development build only.</span>}
            {row.sharedWith > 0 && canWrite && <span className="mr-auto text-xs text-status-warning">This glyph is shared by {row.sharedWith + 1} things; approving changes all of them.</span>}
            <button type="button" disabled={!canWrite || busy === row.proposed.rel} onClick={() => onAct({ action: 'reject', rel: row.proposed!.rel })} className="flex items-center gap-1 rounded border border-status-error px-3 py-1.5 text-sm text-status-error disabled:opacity-40"><X className="h-4 w-4" /> Reject</button>
            <button type="button" disabled={!canWrite || busy === row.proposed.rel} onClick={() => onAct({ action: 'approve', rel: row.proposed!.rel, target: row.target })} className="flex items-center gap-1 rounded border border-status-success px-3 py-1.5 text-sm text-status-success disabled:opacity-40"><Check className="h-4 w-4" /> Approve</button>
          </div>
        )}
      </div>
    </div>
  )
}
