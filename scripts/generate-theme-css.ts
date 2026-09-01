/**
 * Emits `src/app/generated-themes.css` from the typed theme definitions.
 *
 * Themes are authored in TypeScript but shipped as static CSS for two reasons:
 *
 *  - **No flash.** A `[data-theme]` block is applied by the browser before
 *    first paint, given the tiny inline script in the root layout that reads
 *    the stored preference. Applying ~250 custom properties from React after
 *    hydration would show the default theme first, every load.
 *
 *  - **Instant switching.** Changing themes is a single attribute write; the
 *    browser re-resolves every `var()` itself. Nothing re-renders.
 *
 * The file is generated and committed. Run `npm run generate-themes` after
 * editing any theme; `npm run build` and `npm run dev` do it automatically.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { THEMES, DEFAULT_THEME_ID } from '../src/lib/theme/themes'
import { isFillableVar, themeToCssVars } from '../src/lib/theme/tokens'

const OUT = join(process.cwd(), 'src/app/generated-themes.css')

const defaultTheme = THEMES.find((t) => t.id === DEFAULT_THEME_ID)
if (!defaultTheme) throw new Error(`Default theme ${DEFAULT_THEME_ID} is not registered`)

const varsFor = (t: (typeof THEMES)[number]) => themeToCssVars(t)

function block(selector: string, vars: Record<string, string>, indent = '  '): string {
  const lines = Object.entries(vars).map(([k, v]) => `${indent}${k}: ${v};`)
  return `${selector} {\n${lines.join('\n')}\n}`
}

/**
 * Register every token as a Tailwind colour, so `--surface-panel` is reachable
 * as `bg-surface-panel`, `--fg-muted` as `text-fg-muted`, and so on.
 *
 * `@theme inline` matters here: it substitutes the `var()` reference into the
 * generated utilities rather than resolving the value at build time, which is
 * what lets a `[data-theme]` block further down the cascade re-point every
 * utility at once. Opacity modifiers keep working — Tailwind compiles
 * `bg-action-attack/20` to a `color-mix()` against the same variable.
 */
function themeRegistration(vars: Record<string, string>): string {
  const lines = Object.keys(vars).map((name) => `  --color-${name.slice(2)}: var(${name});`)
  return `@theme inline {\n${lines.join('\n')}\n}`
}

const defaultVars = varsFor(defaultTheme)

const parts: string[] = [
  `/*`,
  ` * GENERATED FILE — do not edit.`,
  ` * Produced by scripts/generate-theme-css.ts from src/lib/theme/themes/.`,
  ` * Run \`npm run generate-themes\` after changing a theme.`,
  ` */`,
  '',
  themeRegistration(defaultVars),
  '',
  `/* Default theme (${defaultTheme.name}), applied when no preference is stored. */`,
  block(':root', defaultVars),
  '',
]

for (const theme of THEMES) {
  parts.push(`/* ${theme.name} — ${theme.description} */`)
  parts.push(block(`[data-theme='${theme.id}']`, varsFor(theme)))
  parts.push('')
}

/**
 * A filled element, paired with the text colour that reads on it.
 *
 * One class sets both, so the two cannot drift apart. That pairing is the whole
 * point: the previous approach let a button hard-code `text-fg-bright` while
 * taking its background from data, which produced white labels on gold fills at
 * under 2:1 — unreadable, and invisible to a build that only checked colours in
 * isolation.
 *
 * Buttons stay light-on-dark like the rest of the interface. Rather than
 * flipping labels to dark on a pale fill — which passes contrast but looks
 * wrong beside every other control — the fill itself is deepened, in OKLab, so
 * the hue survives: a gold button is deep bronze, not pale gold with black text.
 * `--fill-<role>` holds that deepened value; the role's own `--<role>` is left
 * bright for use as text.
 *
 * Surfaces are exempt from deepening — a panel is already a background and
 * belongs to an elevation ladder — so they fill with their own value and hover
 * to the shared hover surface.
 *
 * Hover is scoped to genuinely interactive elements. `.fill-*` is used on page
 * wrappers and static panels too, and those must not light up under the pointer.
 * `:where()` keeps the selector at zero specificity so a caller's own
 * `hover:bg-*` still wins.
 */
function fillClasses(vars: Record<string, string>): string {
  const interactive = ":where(button, a, [role='button'], summary, label, [tabindex])"
  const blocks: string[] = []

  for (const name of Object.keys(vars)) {
    if (!isFillableVar(name)) continue
    if (name.startsWith('--on-') || name.startsWith('--fill-')) continue
    if (!(`--fill-${name.slice(2)}` in vars)) continue

    const role = name.slice(2)
    blocks.push(
      `.fill-${role} {\n` +
        `  background-color: var(--fill-${role});\n` +
        `  color: var(--on-${role});\n` +
        `}\n` +
        `${interactive}.fill-${role}:hover {\n` +
        `  background-color: var(--hover-${role});\n` +
        `}`
    )
  }
  return blocks.join('\n')
}

parts.push(
  `/*`,
  ` * Paired fills.`,
  ` *`,
  ` * \`.fill-<role>\` sets a background and the text colour that is readable on`,
  ` * it, both from the same theme variables. Use it for any control whose`,
  ` * background is a game role rather than a surface — the text colour cannot be`,
  ` * forgotten or mismatched, and it re-resolves with the theme like everything`,
  ` * else. For a fill you do not control, \`text-on-<role>\` is available on its`,
  ` * own.`,
  ` */`,
  fillClasses(defaultVars),
  ''
)

parts.push(
  `/*`,
  ` * A label drawn on top of a partially-filled bar.`,
  ` *`,
  ` * A centred bar label sits over two backgrounds at once — the bright fill on`,
  ` * one side of the boundary and the dark track on the other — so no single`,
  ` * colour can read against both. The bright text keeps a dark halo instead,`,
  ` * which works over either. This is why the vitals bars can stay bright: a`,
  ` * gauge should be vivid, and deepening it to carry a label would dull it.`,
  ` */`,
  `.label-over-fill {`,
  `  color: var(--fg-bright);`,
  `  text-shadow:`,
  `    0 1px 2px var(--surface-canvas),`,
  `    0 0 3px var(--surface-canvas),`,
  `    0 0 5px var(--surface-canvas);`,
  `}`,
  '',
  `/*`,
  ` * Theme switch transition.`,
  ` *`,
  ` * Only active while \`.theme-transition\` is on the root element, which the`,
  ` * theme store adds for the length of the change and then removes. A standing`,
  ` * global transition would make every hover in the application sluggish.`,
  ` */`,
  `.theme-transition,`,
  `.theme-transition *,`,
  `.theme-transition *::before,`,
  `.theme-transition *::after {`,
  `  transition:`,
  `    background-color 180ms ease,`,
  `    border-color 180ms ease,`,
  `    color 180ms ease,`,
  `    fill 180ms ease,`,
  `    stroke 180ms ease,`,
  `    box-shadow 180ms ease !important;`,
  `}`,
  '',
  `@media (prefers-reduced-motion: reduce) {`,
  `  .theme-transition,`,
  `  .theme-transition *,`,
  `  .theme-transition *::before,`,
  `  .theme-transition *::after {`,
  `    transition: none !important;`,
  `  }`,
  `}`,
  ''
)

writeFileSync(OUT, parts.join('\n'), 'utf8')

const count = Object.keys(defaultVars).length
console.log(`generate-theme-css: ${THEMES.length} themes x ${count} variables -> ${OUT}`)
