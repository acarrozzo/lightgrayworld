export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import WorldToolNav from '@/components/WorldToolNav'
import Icon from '@/components/Icon'
import { SKILLS, SKILL_GROUPS, SKILL_TEACHERS, skillTone } from '@/lib/skillbook'

export const metadata = {
  title: 'Skills — Light Gray RPG',
  description: 'Every skill in Light Gray RPG, grouped as the original Skills page did, with what it does, what it costs, and where to learn it.',
}

// A sample level/MAG so the table can show concrete numbers next to the
// formula. Chosen to sit where a player first meets these skills.
const SAMPLE_LEVEL = 3
const SAMPLE_MAG = 5

/**
 * Read-only reference view of the skill registry. Derived live from
 * game-data/skills.js — the same definitions the engine learns from and
 * fights with — so it cannot drift from gameplay.
 */
export default function SkillsPage() {
  const teacherOrder = Object.entries(SKILL_TEACHERS)

  return (
    <div className="min-h-screen fill-surface-canvas">
      <WorldToolNav active="skills" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-fg-bright">Skills</h1>
          <p className="mt-1 text-sm text-fg-secondary">
            Every skill, by group. Levels are bought with SP (the next level&apos;s number, in SP). Passives work on their own
            while the right weapon or shield is in hand; special attacks are a normal swing plus a bonus, for MP.
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

        {SKILL_GROUPS.map((group) => {
          const rows = SKILLS.filter((s) => s.group === group.id)
          return (
            <section key={group.id} className="mb-8">
              <h2 className="text-lg font-semibold text-fg-bright">{group.name}</h2>
              <p className="mb-3 text-sm text-fg-secondary">{group.blurb}</p>
              <div className="overflow-x-auto rounded border border-line-subtle/80 bg-surface-panel">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line-subtle text-left text-xs uppercase tracking-wide text-fg-muted">
                      <th className="px-3 py-2">Skill</th>
                      <th className="px-3 py-2">Effect</th>
                      <th className="px-3 py-2">Formula</th>
                      <th className="px-3 py-2 whitespace-nowrap">At lvl {SAMPLE_LEVEL}, mag {SAMPLE_MAG}</th>
                      <th className="px-3 py-2">Learn</th>
                      <th className="px-3 py-2">Use</th>
                      <th className="px-3 py-2">Teachers</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((skill) => {
                      const tone = skillTone(skill.hue)
                      const preview = skill.preview?.(SAMPLE_LEVEL, SAMPLE_MAG) ?? null
                      const learnCosts = `${skill.learnCost(1)} SP, then ${skill.learnCost(2)}, ${skill.learnCost(3)}…`
                      return (
                        <tr key={skill.id} className="border-b border-line-subtle/60 align-top last:border-b-0">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Icon name={skill.icon} size={24} className={tone.text} />
                              <span className={`font-medium ${tone.text}`}>{skill.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-fg-secondary max-w-xs">{skill.description}</td>
                          <td className="px-3 py-2 font-mono text-xs text-fg-primary">{skill.formula}</td>
                          <td className="px-3 py-2 text-fg-secondary tabular-nums whitespace-nowrap">
                            {preview ? `+${preview.min}–${preview.max}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-fg-secondary whitespace-nowrap">{learnCosts}</td>
                          <td className="px-3 py-2 text-resource-mp tabular-nums whitespace-nowrap">
                            {skill.castCost ? (
                              <>
                                {skill.castCost(SAMPLE_LEVEL)} MP
                                <span className="text-fg-disabled"> at lvl {SAMPLE_LEVEL}</span>
                              </>
                            ) : (
                              <span className="text-fg-disabled">passive</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-fg-secondary">
                            {skill.teachers.map((tier, i) => (
                              <span key={tier.flag}>
                                {i > 0 && <span className="text-fg-disabled"> · </span>}
                                {SKILL_TEACHERS[tier.flag]?.name ?? tier.flag}{' '}
                                <span className="tabular-nums text-fg-muted">{tier.max}</span>
                              </span>
                            ))}
                          </td>
                          <td className="px-3 py-2">
                            {skill.implemented ? (
                              <span className="rounded border border-status-success/50 px-1.5 py-0.5 text-xs text-status-success">
                                {skill.kind === 'strike' ? 'usable' : 'active'}
                              </span>
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
    </div>
  )
}
