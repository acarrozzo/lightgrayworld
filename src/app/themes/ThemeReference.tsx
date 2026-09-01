'use client'

import { useState } from 'react'
import { THEMES } from '@/lib/theme/themes'
import { themeToCssVars, resolveRegions } from '@/lib/theme/tokens'
import { REGIONS } from '@/lib/theme/regions'
import { ROLE_CATALOG, REGION_SLOT_DOCS } from '@/lib/theme/role-catalog'
import { useThemeStore } from '@/store/themeStore'
import type { Theme } from '@/lib/theme/types'

/**
 * The theme reference: every semantic role, across every theme.
 *
 * Laid out as a matrix — roles down, themes across — because the question this
 * page exists to answer is "does this role hold its meaning in every theme?".
 * A per-theme catalogue would answer a different and less useful question,
 * since a player only ever sees one theme at a time anyway.
 *
 * This is documentation, not diagnostics. The contrast ratios and ΔE numbers
 * live in the development-only Color Lab; what a reader wants here is what a
 * role *means* and where it turns up.
 */

/**
 * One cell: a role's colour shown on that theme's own panel.
 *
 * Both a fill and a letterform, because the two failure modes are different —
 * a colour can work as a bar and still be unreadable as text.
 */
function RoleCell({ theme, cssVar }: { theme: Theme; cssVar: string }) {
  const vars = themeToCssVars(theme)
  const color = vars[cssVar]
  const panel = vars['--surface-panel']

  return (
    <div
      className="flex h-11 w-full items-center gap-1.5 rounded border border-line-subtle px-1.5"
      style={{ background: panel }}
      title={`${cssVar}: ${color}`}
    >
      <span className="h-6 w-6 shrink-0 rounded-sm" style={{ background: color }} />
      <span className="truncate text-xs font-bold leading-none" style={{ color }}>
        Aa
      </span>
    </div>
  )
}

function ThemeColumnHeader({
  theme,
  isApplied,
  onApply,
}: {
  theme: Theme
  isApplied: boolean
  onApply: () => void
}) {
  const vars = themeToCssVars(theme)
  return (
    <th className="sticky top-0 z-20 bg-surface-canvas p-1 align-bottom">
      <button
        type="button"
        onClick={onApply}
        aria-pressed={isApplied}
        title={`Apply ${theme.name}`}
        className={`flex w-full flex-col items-center gap-1 rounded-md border px-1.5 py-1.5 transition-colors ${
          isApplied
            ? 'border-accent bg-surface-selected'
            : 'border-line-subtle bg-surface-panel hover:border-line-strong hover:bg-surface-hover'
        }`}
      >
        <span
          className="h-4 w-full rounded-sm border border-line-subtle"
          style={{
            background: `linear-gradient(90deg, ${vars['--surface-canvas']} 0 34%, ${vars['--accent']} 34% 67%, ${vars['--action-attack']} 67% 100%)`,
          }}
        />
        <span
          className="w-full truncate text-center text-[10px] font-semibold leading-tight"
          style={{ color: vars['--accent'] }}
        >
          {theme.name}
        </span>
        {isApplied && (
          <span className="text-[8px] uppercase tracking-wider text-accent">applied</span>
        )}
      </button>
    </th>
  )
}

/** Roles down, themes across. The shared frame for both matrices on the page. */
function Matrix({
  children,
  themeId,
  setTheme,
}: {
  children: React.ReactNode
  themeId: string
  setTheme: (id: string) => void
}) {
  return (
    // Wide content scrolls inside its own container; the page body never does.
    <div className="overflow-x-auto rounded-lg border border-line-subtle bg-surface-canvas">
      <table className="w-full min-w-[62rem] border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 min-w-[17rem] bg-surface-canvas p-1 text-left align-bottom">
              <span className="text-[10px] uppercase tracking-widest text-fg-muted">
                Role · meaning · where it is used
              </span>
            </th>
            {THEMES.map((t) => (
              <ThemeColumnHeader
                key={t.id}
                theme={t}
                isApplied={t.id === themeId}
                onApply={() => setTheme(t.id)}
              />
            ))}
          </tr>
        </thead>
        {children}
      </table>
    </div>
  )
}

function RoleRow({ role }: { role: (typeof ROLE_CATALOG)[number]['roles'][number] }) {
  return (
    <tr className="group">
      <th
        scope="row"
        className="sticky left-0 z-10 border-t border-line-subtle bg-surface-canvas p-2 text-left align-top group-hover:bg-surface-panel"
      >
        <code className="text-xs font-semibold text-fg-bright">{role.token}</code>
        <p className="mt-0.5 text-[11px] leading-snug text-fg-secondary">{role.meaning}</p>
        <p className="mt-0.5 text-[10px] leading-snug text-fg-muted">{role.usedFor}</p>
        <code className="mt-1 block font-mono text-[9px] text-fg-disabled">{role.cssVar}</code>
      </th>
      {THEMES.map((t) => (
        <td key={t.id} className="border-t border-line-subtle p-1 align-middle">
          <RoleCell theme={t} cssVar={role.cssVar} />
        </td>
      ))}
    </tr>
  )
}

/** A region rendered as it actually appears: a title and subtitle over its tint. */
function RegionCell({ theme, regionId }: { theme: Theme; regionId: string }) {
  const regions = resolveRegions(theme)
  const p = regions[regionId as keyof typeof regions]
  const vars = themeToCssVars(theme)

  return (
    <div
      className="h-11 w-full overflow-hidden rounded border border-line-subtle px-1.5 py-1"
      style={{ background: `linear-gradient(${p.tint}, transparent), ${vars['--surface-panel']}` }}
      title={`base ${p.base} · title ${p.title}`}
    >
      <div className="flex items-center gap-1">
        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: p.icon }} />
        <span className="truncate text-[11px] font-bold leading-tight" style={{ color: p.title }}>
          Room
        </span>
      </div>
      <div className="truncate text-[9px] leading-tight" style={{ color: p.subtitle }}>
        subtitle
      </div>
      <span className="mt-0.5 block h-1 w-full rounded-full" style={{ background: p.direction }} />
    </div>
  )
}

function AnsiRow({ theme }: { theme: Theme }) {
  const t = theme.terminal
  const row = [
    t.black, t.red, t.green, t.yellow, t.blue, t.magenta, t.cyan, t.white,
    t.brightBlack, t.brightRed, t.brightGreen, t.brightYellow,
    t.brightBlue, t.brightMagenta, t.brightCyan, t.brightWhite,
  ]
  return (
    <div
      className="rounded-md border border-line-subtle p-2"
      style={{ background: t.background }}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold" style={{ color: t.foreground }}>
          {theme.name}
        </span>
        <span className="font-mono text-[9px]" style={{ color: t.brightBlack }}>
          {t.background}
        </span>
      </div>
      <div className="mb-1.5 font-mono text-[10px]" style={{ color: t.foreground }}>
        <span style={{ color: t.green }}>lightgray</span>
        <span>:</span>
        <span style={{ color: t.blue }}>~/grassy-field</span>
        <span>$ </span>
        <span style={{ background: t.selectionBackground, color: t.selectionForeground }}>look</span>
        <span style={{ color: t.cursor }}>▋</span>
      </div>
      <div className="flex gap-px">
        {row.map((c, i) => (
          <span
            key={i}
            className="h-3 flex-1 first:rounded-l-sm last:rounded-r-sm"
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  )
}

export default function ThemeReference() {
  const themeId = useThemeStore((state) => state.themeId)
  const setTheme = useThemeStore((state) => state.setTheme)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const isOpen = (id: string) => openGroups[id] !== false

  return (
    <div className="mx-auto max-w-[110rem] px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg-bright">Terminal Themes</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-fg-secondary">
          Every colour in the game is a <em>semantic role</em> — a name for what something means,
          not for what colour it is. A component asks for{' '}
          <code className="text-fg-primary">action.attack</code>, never for &ldquo;orange&rdquo;.
          Each theme answers all of them, which is how a whole terminal palette can be swapped
          without a single component changing.
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-fg-secondary">
          Roles stay independent even where a theme resolves them to similar values. Attack, HP,
          error and Red Town are all reds, and all four can be on screen at once during a fight in
          Red Town — so the theme system pulls them apart in every palette rather than trusting
          them to differ by luck.
        </p>
        <p className="mt-3 text-xs text-fg-muted">
          Click a theme name to apply it. {THEMES.length} themes · {ROLE_CATALOG.reduce((n, g) => n + g.roles.length, 0)}{' '}
          roles · {REGIONS.length} world regions.
        </p>
      </header>

      <div className="space-y-6">
        {ROLE_CATALOG.map((group) => (
          <section key={group.id}>
            <button
              type="button"
              onClick={() => setOpenGroups((s) => ({ ...s, [group.id]: !isOpen(group.id) }))}
              className="flex w-full items-baseline gap-2 rounded text-left"
              aria-expanded={isOpen(group.id)}
            >
              <h2 className="text-base font-bold text-fg-bright">{group.title}</h2>
              <span className="text-[10px] text-fg-muted">
                {group.roles.length} roles · {isOpen(group.id) ? 'hide' : 'show'}
              </span>
            </button>
            <p className="mb-2 mt-1 max-w-4xl text-xs leading-relaxed text-fg-muted">
              {group.blurb}
            </p>
            {isOpen(group.id) && (
              <Matrix themeId={themeId} setTheme={setTheme}>
                <tbody>
                  {group.roles.map((role) => (
                    <RoleRow key={role.cssVar} role={role} />
                  ))}
                </tbody>
              </Matrix>
            )}
          </section>
        ))}

        <section>
          <h2 className="text-base font-bold text-fg-bright">World regions</h2>
          <p className="mb-2 mt-1 max-w-4xl text-xs leading-relaxed text-fg-muted">
            Every region keeps its identity in every theme — Red Town stays warm and brick-like,
            the Beach stays pale and sandy, the Neverending Mine stays lit by brass lamplight —
            while being built from the selected palette so it harmonises with it. Each theme
            authors one colour per region; the other six slots are derived from it and then
            corrected by hand where the automatic answer was not good enough. Cells below show a
            room title, subtitle, icon and exit colour over the region&rsquo;s atmospheric tint.
          </p>
          <p className="mb-2 text-[11px] text-fg-disabled">
            Slots: {REGION_SLOT_DOCS.map((s) => s.slot).join(' · ')}
          </p>
          <Matrix themeId={themeId} setTheme={setTheme}>
            <tbody>
              {REGIONS.map(({ id, name }) => (
                <tr key={id} className="group">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-t border-line-subtle bg-surface-canvas p-2 text-left align-middle group-hover:bg-surface-panel"
                  >
                    <span className="text-xs font-semibold text-fg-bright">{name}</span>
                    <code className="mt-0.5 block font-mono text-[9px] text-fg-disabled">
                      world.{id}
                    </code>
                  </th>
                  {THEMES.map((t) => (
                    <td key={t.id} className="border-t border-line-subtle p-1 align-middle">
                      <RegionCell theme={t} regionId={id} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Matrix>
        </section>

        <section>
          <h2 className="text-base font-bold text-fg-bright">Terminal layer</h2>
          <p className="mb-3 mt-1 max-w-4xl text-xs leading-relaxed text-fg-muted">
            Underneath the game roles, each theme carries a complete 16-colour ANSI palette with a
            background, foreground, cursor and selection — the portable layer a real terminal
            emulator understands. Light Gray RPG&rsquo;s is first-party and written to be usable
            in an actual shell, not merely to feed the interface.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {THEMES.map((t) => (
              <AnsiRow key={t.id} theme={t} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
