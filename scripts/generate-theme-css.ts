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
import { themeToCssVars } from '../src/lib/theme/tokens'

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

parts.push(
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
