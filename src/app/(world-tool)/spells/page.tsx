export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import Icon from '@/components/Icon'
import AnchorTarget from '@/components/world-tool/AnchorTarget'
import { SPELLS, SPELL_SCHOOLS, SPELL_TEACHERS, spellTone } from '@/lib/spellbook'

export const metadata = {
  title: 'Spells — Light Gray RPG',
  description: 'Every spell in Light Gray RPG, grouped by school, with its formula, MP cost, and where to learn it.',
}

// A sample level/MAG so the table can show concrete numbers next to the
// formula. Chosen to sit where a player first meets these spells.
const SAMPLE_LEVEL = 1
const SAMPLE_MAG = 5

/**
 * Read-only reference view of the spell registry. Derived live from
 * game-data/spells.js — the same definitions the engine learns and casts from —
 * so it cannot drift from gameplay.
 */
export default function SpellsPage() {
  const teacherOrder = Object.entries(SPELL_TEACHERS)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <AnchorTarget />
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg-bright">Spells</h1>
        <p className="mt-1 text-sm text-fg-secondary">
          Every spell, by school. Levels are bought with SP (the next level&apos;s number, in SP); casting costs MP.
          Caps come from the best teacher met — each teacher is listed with the level it trains to.
          Formulas read <span className="text-stat-mag">mag</span> as effective MAG (core + gear + buffs).
        </p>
        <p className="mt-2 text-xs text-fg-muted">
          Teachers, in order:{' '}
          {teacherOrder.map(([flag, t], i) => (
            <span key={flag}>
              {i > 0 && ' · '}
              <span className="text-fg-secondary">{t.name}</span> <span className="text-fg-disabled">(room {t.roomId})</span>
            </span>
          ))}
        </p>
      </header>

      {SPELL_SCHOOLS.map((school) => {
        const rows = SPELLS.filter((s) => s.school === school.id)
        return (
          <section key={school.id} className="mb-8">
            <h2 className="text-lg font-semibold text-fg-bright">{school.name}</h2>
            <p className="mb-3 text-sm text-fg-secondary">{school.blurb}</p>
            <div className="overflow-x-auto rounded border border-line-subtle/80 bg-surface-panel">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-subtle text-left text-xs uppercase tracking-wide text-fg-muted">
                    <th className="px-3 py-2">Spell</th>
                    <th className="px-3 py-2">Effect</th>
                    <th className="px-3 py-2">Formula</th>
                    <th className="px-3 py-2 whitespace-nowrap">At lvl {SAMPLE_LEVEL}, mag {SAMPLE_MAG}</th>
                    <th className="px-3 py-2">Learn</th>
                    <th className="px-3 py-2">Cast</th>
                    <th className="px-3 py-2">Teachers</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((spell) => {
                    const tone = spellTone(spell.hue)
                    const preview = spell.preview?.(SAMPLE_LEVEL, SAMPLE_MAG) ?? null
                    const learnCosts = spell.teachers.length
                      ? `${spell.learnCost(1)} SP, then ${spell.learnCost(2)}, ${spell.learnCost(3)}…`
                      : '—'
                    return (
                      <tr key={spell.id} data-anchor={spell.id} className="border-b border-line-subtle/60 align-top last:border-b-0">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Icon name={spell.icon} size={24} className={tone.text} />
                            <span className={`font-medium ${tone.text}`}>{spell.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-fg-secondary max-w-xs">{spell.description}</td>
                        <td className="px-3 py-2 font-mono text-xs text-fg-primary">{spell.formula}</td>
                        <td className="px-3 py-2 text-fg-secondary tabular-nums whitespace-nowrap">
                          {preview ? `${preview.min}–${preview.max}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-fg-secondary whitespace-nowrap">{learnCosts}</td>
                        <td className="px-3 py-2 text-resource-mp tabular-nums whitespace-nowrap">
                          {spell.castCost(SAMPLE_LEVEL, SAMPLE_MAG)} MP
                          <span className="text-fg-disabled"> at lvl {SAMPLE_LEVEL}</span>
                        </td>
                        <td className="px-3 py-2 text-fg-secondary">
                          {spell.teachers.map((tier, i) => (
                            <span key={tier.flag}>
                              {i > 0 && <span className="text-fg-disabled"> · </span>}
                              {SPELL_TEACHERS[tier.flag]?.name ?? tier.flag}{' '}
                              <span className="tabular-nums text-fg-muted">{tier.max}</span>
                            </span>
                          ))}
                        </td>
                        <td className="px-3 py-2">
                          {spell.implemented ? (
                            <span className="rounded border border-status-success/50 px-1.5 py-0.5 text-xs text-status-success">castable</span>
                          ) : (
                            <span className="rounded border border-line-subtle px-1.5 py-0.5 text-xs text-fg-muted">not ported</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
