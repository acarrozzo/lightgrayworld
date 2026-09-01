'use client'

import { useState } from 'react'
import { THEMES } from '@/lib/theme/themes'
import { resolveRegions, themeToCssVars } from '@/lib/theme/tokens'
import { REGIONS } from '@/lib/theme/regions'
import { contrast, deltaE } from '@/lib/theme/color'
import { useThemeStore } from '@/store/themeStore'
import type { Theme } from '@/lib/theme/types'

/**
 * The Color Lab.
 *
 * Every theme, every role, on one page — so a palette can be judged as a whole
 * rather than by clicking through the game hoping to catch a bad pairing. It
 * renders the same categories the brief calls out, plus the two numeric checks
 * the build enforces (`npm run validate-themes`), shown inline so a failure is
 * visible next to the colour that caused it.
 *
 * Two viewing modes matter:
 *  - **Applied** paints the section with the live theme, i.e. what a player sees.
 *  - **Side by side** paints one card per theme, for comparing palettes.
 */

function Swatch({ label, varName, note }: { label: string; varName: string; note?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-7 w-7 shrink-0 rounded border border-line-subtle"
        style={{ background: `var(${varName})` }}
      />
      <span className="min-w-0">
        <span className="block truncate text-[11px] text-fg-primary">{label}</span>
        <span className="block truncate font-mono text-[9px] text-fg-muted">{varName}</span>
        {note && <span className="block truncate text-[9px] text-fg-disabled">{note}</span>}
      </span>
    </div>
  )
}

function SwatchGrid({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-fg-muted">{title}</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map(([label, varName]) => (
          <Swatch key={varName} label={label} varName={varName} />
        ))}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line-subtle bg-surface-panel p-4">
      <h2 className="mb-3 text-sm font-bold text-fg-bright">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

/** Ratio badge that turns red when the pairing fails its threshold. */
function Ratio({ fg, bg, need }: { fg: string; bg: string; need: number }) {
  const ratio = contrast(fg, bg)
  const ok = ratio >= need
  return (
    <span
      className={`rounded px-1 py-0.5 font-mono text-[9px] ${
        ok ? 'bg-status-success/15 text-status-success' : 'bg-status-error/20 text-status-error'
      }`}
    >
      {ratio.toFixed(2)}:1 {ok ? '' : `< ${need}`}
    </span>
  )
}

function TextHierarchy({ theme }: { theme: Theme }) {
  const rows: [string, string, number][] = [
    ['Bright — headings', theme.ui.fgBright, 4.5],
    ['Primary — body', theme.ui.fgPrimary, 4.5],
    ['Secondary — supporting', theme.ui.fgSecondary, 4.5],
    ['Muted — captions', theme.ui.fgMuted, 3],
    ['Disabled', theme.ui.fgDisabled, 1],
  ]
  return (
    <div className="space-y-1 rounded border border-line-subtle bg-surface-panel p-3">
      {rows.map(([label, color, need]) => (
        <div key={label} className="flex items-center justify-between gap-3">
          <span className="text-sm" style={{ color }}>
            {label}
          </span>
          <Ratio fg={color} bg={theme.ui.surfacePanel} need={need} />
        </div>
      ))}
    </div>
  )
}

function Surfaces() {
  return (
    <div className="space-y-2">
      <div className="rounded border border-line-subtle bg-surface-canvas p-3">
        <span className="text-[11px] text-fg-muted">canvas</span>
        <div className="mt-2 rounded border border-line-subtle bg-surface-panel p-3">
          <span className="text-[11px] text-fg-muted">panel</span>
          <div className="mt-2 rounded border border-line-subtle bg-surface-raised p-3">
            <span className="text-[11px] text-fg-muted">raised</span>
            <div className="mt-2 rounded border border-line-strong bg-surface-overlay p-2">
              <span className="text-[11px] text-fg-muted">overlay · border-line-strong</span>
            </div>
          </div>
        </div>
        <div className="mt-2 rounded border border-line-subtle bg-surface-sunken p-3">
          <span className="text-[11px] text-fg-muted">sunken — feeds and inputs</span>
        </div>
      </div>
    </div>
  )
}

function InteractionStates() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-fg-on-accent hover:bg-accent-hover">
        Primary
      </button>
      <button className="rounded-md border border-line-subtle fill-surface-raised px-3 py-1.5 text-xs hover:border-line-strong hover:bg-surface-hover">
        Secondary — hover me
      </button>
      <button className="rounded-md fill-surface-selected px-3 py-1.5 text-xs">Selected</button>
      <button
        disabled
        className="cursor-not-allowed rounded-md bg-surface-disabled px-3 py-1.5 text-xs text-fg-disabled"
      >
        Disabled
      </button>
      <button className="rounded-md border border-line-subtle fill-surface-raised px-3 py-1.5 text-xs outline-none ring-2 ring-line-focus">
        Focused
      </button>
      <button className="rounded-md bg-action-attack px-3 py-1.5 text-xs font-bold text-fg-on-accent">
        Attack
      </button>
    </div>
  )
}

function RedFamily({ theme }: { theme: Theme }) {
  const regions = resolveRegions(theme)
  const members: [string, string][] = [
    ['action.attack', theme.game.action.attack],
    ['resource.hp', theme.game.resource.hp],
    ['status.error', theme.game.status.error],
    ['world.redTown', regions.redTown.base],
  ]
  return (
    <div>
      <p className="mb-2 text-[11px] text-fg-muted">
        These four must stay visibly distinct in every theme. ΔE is perceptual distance; the
        build requires at least 0.105 between each pair.
      </p>
      <div className="flex flex-wrap gap-2">
        {members.map(([label, color]) => (
          <div key={label} className="rounded border border-line-subtle bg-surface-raised p-2">
            <span className="block h-8 w-24 rounded" style={{ background: color }} />
            <span className="mt-1 block font-mono text-[9px] text-fg-secondary">{label}</span>
            <span className="block font-mono text-[9px] text-fg-muted">{color}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {members.flatMap((a, i) =>
          members.slice(i + 1).map((b) => {
            const d = deltaE(a[1], b[1])
            const ok = d >= 0.105
            return (
              <span
                key={`${a[0]}-${b[0]}`}
                className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${
                  ok ? 'bg-status-success/15 text-status-success' : 'bg-status-error/20 text-status-error'
                }`}
              >
                {a[0].split('.')[1]}/{b[0].split('.')[1]} ΔE {d.toFixed(3)}
              </span>
            )
          })
        )}
      </div>
    </div>
  )
}

function RegionBoard({ theme }: { theme: Theme }) {
  const regions = resolveRegions(theme)
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {REGIONS.map(({ id, name }) => {
        const p = regions[id]
        return (
          <div
            key={id}
            className="rounded border border-line-subtle p-2.5"
            style={{ background: `linear-gradient(${p.tint}, transparent), var(--surface-panel)` }}
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-3 w-3 shrink-0 rounded-sm" style={{ background: p.icon }} />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold" style={{ color: p.title }}>
                  {name}
                </div>
                <div className="truncate text-[11px]" style={{ color: p.subtitle }}>
                  A short room subtitle
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1">
              {(['base', 'direction', 'accent'] as const).map((slot) => (
                <span
                  key={slot}
                  title={`${slot} ${p[slot]}`}
                  className="h-4 flex-1 rounded-sm border border-line-subtle"
                  style={{ background: p[slot] }}
                />
              ))}
            </div>
            <div className="mt-1 flex gap-1">
              <Ratio fg={p.title} bg={theme.ui.surfacePanel} need={4.5} />
              <Ratio fg={p.subtitle} bg={theme.ui.surfacePanel} need={3} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AnsiTable({ theme }: { theme: Theme }) {
  const t = theme.terminal
  const names = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'] as const
  const normal = [t.black, t.red, t.green, t.yellow, t.blue, t.magenta, t.cyan, t.white]
  const bright = [
    t.brightBlack, t.brightRed, t.brightGreen, t.brightYellow,
    t.brightBlue, t.brightMagenta, t.brightCyan, t.brightWhite,
  ]
  return (
    <div style={{ background: t.background }} className="rounded border border-line-subtle p-3 font-mono">
      <div className="mb-2 text-[11px]" style={{ color: t.foreground }}>
        <span style={{ color: t.green }}>lightgray</span>
        <span style={{ color: t.foreground }}>:</span>
        <span style={{ color: t.blue }}>~/grassy-field</span>
        <span style={{ color: t.foreground }}>$ </span>
        <span style={{ background: t.selectionBackground, color: t.selectionForeground }}>look</span>
        <span style={{ color: t.cursor }}>▋</span>
      </div>
      {[normal, bright].map((row, i) => (
        <div key={i} className="flex gap-px">
          {row.map((c, j) => (
            <div key={j} className="flex-1">
              <div className="h-6" style={{ background: c }} />
              <div className="mt-0.5 truncate text-center text-[8px]" style={{ color: t.foreground }}>
                {i === 0 ? names[j] : `br${names[j].slice(0, 3)}`}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function ThemeReport({ theme }: { theme: Theme }) {
  const g = theme.game
  return (
    <div className="space-y-4">
      <TextHierarchy theme={theme} />
      <Surfaces />
      <InteractionStates />
      <RedFamily theme={theme} />

      <SwatchGrid
        title="Resources"
        items={[['HP', '--resource-hp'], ['MP', '--resource-mp'], ['XP', '--resource-xp'], ['Gold', '--resource-gold']]}
      />
      <SwatchGrid
        title="Stats"
        items={[['STR', '--stat-str'], ['DEX', '--stat-dex'], ['MAG', '--stat-mag'], ['DEF', '--stat-def']]}
      />
      <SwatchGrid
        title="Actions"
        items={Object.keys(g.action).map((k) => [k, `--action-${k}`] as [string, string])}
      />
      <SwatchGrid
        title="Status"
        items={Object.keys(g.status).map((k) => [k, `--status-${k}`] as [string, string])}
      />
      <SwatchGrid
        title="Feed channels"
        items={Object.keys(g.channel).map((k) => [k, `--channel-${k}`] as [string, string])}
      />
      <SwatchGrid
        title="Combat"
        items={Object.keys(g.combat).map((k) => [k, `--combat-${k}`] as [string, string])}
      />
      <SwatchGrid
        title="Loot rarity"
        items={Object.keys(g.loot).map((k) => [k, `--loot-${k}`] as [string, string])}
      />
      <SwatchGrid
        title="Enemies"
        items={Object.keys(g.enemy).map((k) => [k, `--enemy-${k}`] as [string, string])}
      />
      <SwatchGrid
        title="Terrain"
        items={Object.keys(g.terrain).map((k) => [k, `--terrain-${k}`] as [string, string])}
      />
      <SwatchGrid
        title="Room mood"
        items={Object.keys(g.mood).map((k) => [k, `--mood-${k}`] as [string, string])}
      />
      <SwatchGrid
        title="Decorative hues"
        items={Object.keys(g.hue).map((k) => [k, `--hue-${k}`] as [string, string])}
      />

      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-fg-muted">
          World regions
        </h3>
        <RegionBoard theme={theme} />
      </div>

      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-fg-muted">
          Terminal layer (exportable)
        </h3>
        <AnsiTable theme={theme} />
      </div>
    </div>
  )
}

export default function ColorLab() {
  const themeId = useThemeStore((state) => state.themeId)
  const setTheme = useThemeStore((state) => state.setTheme)
  const [compare, setCompare] = useState(false)

  const active = THEMES.find((t) => t.id === themeId) ?? THEMES[0]

  return (
    <div className="h-dvh overflow-y-auto fill-surface-canvas p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="text-lg font-bold text-fg-bright">Color Lab</h1>
        <p className="mt-0.5 text-xs text-fg-muted">
          Every semantic role in every launch theme. Development only — the route 404s in
          production. Run <code className="text-fg-secondary">npm run validate-themes</code> for the
          same checks in CI.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                t.id === themeId
                  ? 'border-accent fill-surface-selected'
                  : 'border-line-subtle bg-surface-panel text-fg-secondary hover:border-line-strong hover:bg-surface-hover'
              }`}
            >
              {t.name}
            </button>
          ))}
          <button
            onClick={() => setCompare((v) => !v)}
            className="ml-2 rounded-md border border-line-subtle bg-surface-panel px-2.5 py-1 text-xs text-fg-secondary hover:bg-surface-hover"
          >
            {compare ? 'Show applied theme' : 'Compare all side by side'}
          </button>
        </div>
      </header>

      {compare ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {THEMES.map((t) => (
            // Each card carries its own theme's variables, so all of them render
            // at once regardless of which one is actually applied.
            <div
              key={t.id}
              style={themeToCssVars(t) as unknown as React.CSSProperties}
              className="rounded-lg border border-line-subtle bg-surface-canvas p-3"
            >
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-bold text-fg-bright">{t.name}</h2>
                <span className="text-[10px] text-fg-muted">{t.appearance}</span>
              </div>
              <ThemeReport theme={t} />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <Section title={active.name}>
            <p className="text-xs text-fg-muted">{active.description}</p>
            <ThemeReport theme={active} />
          </Section>
        </div>
      )}
    </div>
  )
}
