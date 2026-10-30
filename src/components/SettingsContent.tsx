'use client'

import { useTickerStore } from '@/store/tickerStore'
import { useLineSourcesStore } from '@/store/lineSourcesStore'
import { useFontPreferenceStore, type FontFamily } from '@/store/fontPreferenceStore'
import { useGameStore } from '@/lib/game-state'
import { GAME_VERSION } from '@/lib/version'
import ThemeSelector from '@/components/ThemeSelector'

interface SettingsContentProps {
  onLogout: () => Promise<void> | void
}

/*
 * Three small groups (Look, Feed, Account), one row per setting, one line of
 * hint under each label. The theme is the one setting with room of its own: a
 * room painted in the theme under the pointer, over the row of dots.
 */

const LABEL = 'text-[13px] font-medium text-fg-bright'
const HINT = 'mt-0.5 text-[11px] leading-snug text-fg-muted'
const GROUP_LABEL = 'text-[10px] font-semibold uppercase tracking-wider text-fg-muted'
const BOX = 'divide-y divide-line-subtle overflow-hidden rounded-lg border border-line-subtle bg-surface-sunken/40'

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label}>
      <h3 className={`mb-1.5 px-0.5 ${GROUP_LABEL}`}>{label}</h3>
      <div className={BOX}>{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: React.ReactNode; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <div className="min-w-0">
        <div className={LABEL}>{label}</div>
        <p className={HINT}>{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 rounded-full transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${on ? 'bg-accent' : 'bg-surface-hover'}`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full shadow-sm transition-transform duration-150 ${on ? 'translate-x-4 bg-fg-on-accent' : 'bg-fg-secondary'}`}
      />
    </button>
  )
}

const FONTS: { id: FontFamily; label: string; face: string }[] = [
  { id: 'regular', label: 'Sans', face: 'font-sans' },
  { id: 'mono', label: 'Mono', face: 'font-mono' },
]

function FontSwitch({ value, onChange }: { value: FontFamily; onChange: (next: FontFamily) => void }) {
  return (
    <div role="radiogroup" aria-label="Font" className="inline-flex gap-0.5 rounded-md border border-line-strong p-0.5">
      {FONTS.map((font) => {
        const on = font.id === value
        return (
          <button
            key={font.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(font.id)}
            className={`rounded px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${font.face} ${
              on ? 'bg-surface-raised text-fg-bright' : 'text-fg-secondary hover:text-fg-bright'
            }`}
          >
            {font.label}
          </button>
        )
      })}
    </div>
  )
}

export default function SettingsContent({ onLogout }: SettingsContentProps) {
  const tickerOn = useTickerStore((state) => state.enabled)
  const setTickerOn = useTickerStore((state) => state.setEnabled)
  const fontFamily = useFontPreferenceStore((state) => state.fontFamily)
  const setFontFamily = useFontPreferenceStore((state) => state.setFontFamily)
  const showSources = useLineSourcesStore((state) => state.showSources)
  const setShowSources = useLineSourcesStore((state) => state.setShowSources)
  const username = useGameStore((state) => state.player?.username)

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto flex max-w-xl flex-col gap-5">
        <Group label="Look">
          <div className="px-3 pb-3 pt-2.5">
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <span className={LABEL}>Theme</span>
              <span className="text-[11px] text-fg-muted">Applies at once</span>
            </div>
            <ThemeSelector variant="preview" />
          </div>
          <Row label="Font" hint="For every word in the game">
            <FontSwitch value={fontFamily} onChange={setFontFamily} />
          </Row>
        </Group>

        <Group label="Feed">
          <Row label="Activity bar" hint="Recent results in a slim bar along the bottom">
            <Toggle on={tickerOn} onChange={setTickerOn} label="Activity bar" />
          </Row>
          <Row label="Line sources" hint="Tag each spoken line with its room, speaker and set number">
            <Toggle on={showSources} onChange={setShowSources} label="Line sources" />
          </Row>
        </Group>

        <Group label="Account">
          <Row label={username ?? 'Signed in'} hint="Your theme follows you to any device">
            <button
              type="button"
              onClick={onLogout}
              className="rounded-md border border-status-error/55 px-3 py-1 text-xs font-semibold text-status-error transition-colors hover:bg-status-error/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-status-error"
            >
              Log out
            </button>
          </Row>
        </Group>

        <p className="text-center text-[10px] text-fg-muted">Light Gray · {GAME_VERSION}</p>
      </div>
    </div>
  )
}
