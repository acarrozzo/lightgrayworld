'use client'

import { useMemo } from 'react'
import { Search } from 'lucide-react'
import { EntityLink } from '@/components/world-tool/EntityLink'
import { questGiverHref, questHref, roomHref, shopHref } from '@/components/world-tool/hrefs'
import { Tag } from '@/components/world-tool/ui'
import { useUrlEnum, useUrlString } from '@/components/world-tool/useUrlState'

export type LineSetRow = {
  roomId: string
  roomName: string
  speaker: string
  speakerId: string
  set: 'keeper' | 'listen' | 'idle' | 'aside'
  action: string | null
  lines: string[]
  gate: string | null
  gateTitle: string | null
  shop: string | null
}

const SET_FILTERS = ['all', 'keeper', 'listen', 'idle', 'aside'] as const
type SetFilter = (typeof SET_FILTERS)[number]

const SET_LABEL: Record<LineSetRow['set'], string> = { keeper: 'keeper', listen: 'listen in', idle: 'idle', aside: 'aside' }
const SET_HOW: Record<LineSetRow['set'], string> = {
  keeper: "the talk button in the shop's room, and under the shop window's title",
  listen: 'the Listen In button',
  idle: 'Talk with no quest active, and Chat',
  aside: 'under every Talk, and Chat',
}

const CHIP = 'rounded border px-2 py-0.5 text-[11px] uppercase tracking-wide transition-colors'
const CHIP_ON = 'border-line-strong bg-surface-selected text-fg-bright'
const CHIP_OFF = 'border-line-subtle text-fg-muted hover:text-fg-bright'

/**
 * Every line set, searchable by any word in a line, a speaker or a room, and
 * filtered by kind, room and speaker. Filters live in the URL so a view can be
 * sent as a link. Line numbers match the feed's source tag.
 */
export default function LinesBrowser({ sets }: { sets: LineSetRow[] }) {
  const [search, setSearch] = useUrlString('q', '')
  const [set, setSet] = useUrlEnum<SetFilter>('set', SET_FILTERS, 'all')
  const [room, setRoom] = useUrlString('room', '')
  const [speaker, setSpeaker] = useUrlString('who', '')

  const rooms = useMemo(() => {
    const seen = new Map<string, string>()
    for (const s of sets) if (!seen.has(s.roomId)) seen.set(s.roomId, s.roomName)
    return Array.from(seen.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [sets])
  const speakers = useMemo(() => {
    const seen = new Map<string, string>()
    for (const s of sets) if (!seen.has(s.speakerId)) seen.set(s.speakerId, s.speaker)
    return Array.from(seen.entries()).sort(([, a], [, b]) => a.localeCompare(b))
  }, [sets])

  const q = search.trim().toLowerCase()
  const visible = useMemo(() => {
    return sets
      .map((s) => {
        if (set !== 'all' && s.set !== set) return null
        if (room && s.roomId !== room) return null
        if (speaker && s.speakerId !== speaker) return null
        if (!q) return s
        const inMeta = `${s.roomId} ${s.roomName} ${s.speaker} ${s.speakerId} ${s.shop ?? ''} ${s.gateTitle ?? ''}`.toLowerCase().includes(q)
        if (inMeta) return s
        const lines = s.lines.filter((l) => l.toLowerCase().includes(q))
        if (lines.length === 0) return null
        // Keep the original numbering: the tag names the row in the full set.
        return { ...s, lines: s.lines.map((l) => (l.toLowerCase().includes(q) ? l : '')) }
      })
      .filter((s): s is LineSetRow => s !== null)
  }, [sets, set, room, speaker, q])

  const totalAll = sets.reduce((n, s) => n + s.lines.length, 0)
  const totalShown = visible.reduce((n, s) => n + s.lines.filter(Boolean).length, 0)
  const filtering = Boolean(q) || set !== 'all' || Boolean(room) || Boolean(speaker)

  // Group by room, then speaker, in room order.
  const byRoom = new Map<string, Map<string, LineSetRow[]>>()
  for (const s of visible) {
    if (!byRoom.has(s.roomId)) byRoom.set(s.roomId, new Map())
    const sp = byRoom.get(s.roomId)!
    if (!sp.has(s.speakerId)) sp.set(s.speakerId, [])
    sp.get(s.speakerId)!.push(s)
  }
  const roomIds = Array.from(byRoom.keys()).sort()

  const SELECT =
    'rounded border border-line-subtle fill-surface-raised px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <input
            id="lines-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lines, speakers, rooms"
            aria-label="Search lines"
            className="w-full rounded border border-line-subtle fill-surface-raised pl-7 pr-2 py-1 text-xs placeholder:text-fg-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          />
        </label>
        <div className="flex items-center gap-1" role="group" aria-label="Kind of set">
          {SET_FILTERS.map((k) => (
            <button key={k} type="button" aria-pressed={set === k} onClick={() => setSet(k)} className={`${CHIP} ${set === k ? CHIP_ON : CHIP_OFF}`}>
              {k === 'all' ? 'All' : SET_LABEL[k]}
            </button>
          ))}
        </div>
        <select id="lines-room" value={room} onChange={(e) => setRoom(e.target.value)} aria-label="Room" className={SELECT}>
          <option value="">Every room</option>
          {rooms.map(([id, name]) => (
            <option key={id} value={id}>#{id} {name}</option>
          ))}
        </select>
        <select id="lines-speaker" value={speaker} onChange={(e) => setSpeaker(e.target.value)} aria-label="Speaker" className={SELECT}>
          <option value="">Every speaker</option>
          {speakers.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <span className="text-xs text-fg-muted">{filtering ? `${totalShown} of ${totalAll} lines` : `${totalAll} lines`}</span>
        {filtering && (
          <button
            type="button"
            onClick={() => { setSearch(''); setSet('all'); setRoom(''); setSpeaker('') }}
            className={`${CHIP} ${CHIP_OFF}`}
          >
            Clear
          </button>
        )}
      </div>

      {roomIds.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-muted">No lines match.</p>
      ) : (
        <div className="space-y-8">
          {roomIds.map((roomId) => {
            const sp = byRoom.get(roomId)!
            const roomName = sp.values().next().value?.[0]?.roomName ?? ''
            return (
              <section key={roomId} id={`room-${roomId}`} data-anchor={`room-${roomId}`} className="rounded-lg border border-line-subtle bg-surface-panel p-4">
                <h2 className="text-lg font-semibold text-fg-bright">
                  <EntityLink href={roomHref(roomId)}>
                    <span>#{roomId} {roomName}</span>
                  </EntityLink>
                </h2>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  {Array.from(sp.entries()).map(([speakerId, speakerSets]) => {
                    const first = speakerSets[0]
                    const isGiver = first.set === 'idle' || first.set === 'aside'
                    return (
                      <div key={speakerId} id={`line-${roomId}-${speakerId}`} data-anchor={`line-${roomId}-${speakerId}`} className="rounded border border-line-subtle/60 bg-surface-raised/40 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-fg-bright">{first.speaker}</span>
                          {isGiver && <EntityLink href={questGiverHref(speakerId)}><span className="text-xs">giver</span></EntityLink>}
                          {first.shop && <EntityLink href={shopHref(roomId)}><span className="text-xs">{first.shop}</span></EntityLink>}
                          {first.action && <Tag>{first.action}</Tag>}
                        </div>
                        {speakerSets.map((s, i) => (
                          <div key={`${s.set}-${i}`} className="mt-3">
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-fg-muted">
                              <Tag className="border-resource-gold/40 text-resource-gold">{SET_LABEL[s.set]}</Tag>
                              <span>{SET_HOW[s.set]}</span>
                              {s.gate ? (
                                <span>
                                  · after <EntityLink href={questHref(s.gate)}><span>{s.gateTitle ?? s.gate}</span></EntityLink>
                                </span>
                              ) : s.set === 'idle' || s.set === 'aside' ? (
                                <span>· always</span>
                              ) : null}
                            </div>
                            <ol className="mt-1 space-y-1 text-sm italic text-fg-secondary">
                              {s.lines.map((line, n) =>
                                line ? (
                                  <li key={n} className="flex gap-2">
                                    <span className="shrink-0 font-mono not-italic text-[10px] text-fg-muted/70 tabular-nums">#{n + 1}</span>
                                    <span>{line}</span>
                                  </li>
                                ) : null
                              )}
                            </ol>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
