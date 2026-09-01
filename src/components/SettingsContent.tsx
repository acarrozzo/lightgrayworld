'use client'

import { useTickerStore } from '@/store/tickerStore'
import { useFontPreferenceStore } from '@/store/fontPreferenceStore'
import ThemeSelector from '@/components/ThemeSelector'

interface SettingsContentProps {
  onLogout: () => Promise<void> | void
}

export default function SettingsContent({ onLogout }: SettingsContentProps) {
  const enabled = useTickerStore((state) => state.enabled)
  const setEnabled = useTickerStore((state) => state.setEnabled)
  const fontFamily = useFontPreferenceStore((state) => state.fontFamily)
  const setFontFamily = useFontPreferenceStore((state) => state.setFontFamily)

  const handleToggleTicker = () => {
    setEnabled(!enabled)
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-fg-bright">Activity Bar</h3>
        <p className="text-sm text-fg-secondary">Show recent action results in a slim bar at the bottom of the screen.</p>

        <div className="mt-4 flex items-center gap-4">
          <label
            htmlFor="ticker-toggle"
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="relative">
              <input
                id="ticker-toggle"
                type="checkbox"
                checked={enabled}
                onChange={handleToggleTicker}
                className="sr-only"
              />
              <div
                className={`
                  w-11 h-6 rounded-full transition-colors duration-200 ease-in-out
                  ${enabled ? 'bg-stat-mag' : 'bg-surface-hover'}
                `}
              >
                <div
                  className={`
                    w-5 h-5 bg-fg-bright rounded-full shadow-md transform transition-transform duration-200 ease-in-out
                    ${enabled ? 'translate-x-5' : 'translate-x-0.5'}
                    mt-0.5
                  `}
                />
              </div>
            </div>
            <span className="text-sm text-fg-bright">
              {enabled ? 'Activity bar visible' : 'Activity bar hidden'}
            </span>
          </label>
        </div>
        <p className="mt-2 text-xs text-fg-muted">
          When enabled, recent actions (battles, quests, pickups, equip, messages) appear in a slim bar at the bottom of the screen. Click the bar to view recent history.
        </p>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-fg-bright">Terminal Theme</h3>
        <p className="text-sm text-fg-secondary">
          Recolours the whole game. Applies immediately and follows your account to any device.
        </p>

        <ThemeSelector variant="list" className="mt-4" />
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-fg-bright">Appearance</h3>
        <p className="text-sm text-fg-secondary">Choose your preferred font style.</p>

        <div className="mt-4 space-y-3">
          <label
            htmlFor="font-regular-content"
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="relative">
              <input
                id="font-regular-content"
                type="radio"
                name="font-family"
                value="regular"
                checked={fontFamily === 'regular'}
                onChange={() => setFontFamily('regular')}
                className="sr-only"
              />
              <div
                className={`
                  w-5 h-5 rounded-full border-2 transition-colors duration-200 ease-in-out
                  ${fontFamily === 'regular' 
                    ? 'border-stat-mag bg-stat-mag' 
                    : 'border-line-strong/80 bg-transparent group-hover:border-line-strong'
                  }
                `}
              >
                {fontFamily === 'regular' && (
                  <div className="w-full h-full rounded-full bg-fg-bright scale-50" />
                )}
              </div>
            </div>
            <span className="text-sm text-fg-bright">Regular</span>
          </label>

          <label
            htmlFor="font-mono-content"
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="relative">
              <input
                id="font-mono-content"
                type="radio"
                name="font-family"
                value="mono"
                checked={fontFamily === 'mono'}
                onChange={() => setFontFamily('mono')}
                className="sr-only"
              />
              <div
                className={`
                  w-5 h-5 rounded-full border-2 transition-colors duration-200 ease-in-out
                  ${fontFamily === 'mono' 
                    ? 'border-stat-mag bg-stat-mag' 
                    : 'border-line-strong/80 bg-transparent group-hover:border-line-strong'
                  }
                `}
              >
                {fontFamily === 'mono' && (
                  <div className="w-full h-full rounded-full bg-fg-bright scale-50" />
                )}
              </div>
            </div>
            <span className="text-sm text-fg-bright">Fixed-width</span>
          </label>
        </div>
        <p className="mt-2 text-xs text-fg-muted">
          Select whether to use a regular sans-serif font or a fixed-width monospace font throughout the application.
        </p>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-fg-bright">Account</h3>
        <p className="text-sm text-fg-secondary">Manage your session and access controls.</p>

        <div className="mt-4">
          <button
            type="button"
            onClick={onLogout}
            className="rounded-full fill-status-error px-5 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-status-error focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas"
          >
            Logout
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-fg-bright">Miscellaneous</h3>
        <p className="text-sm text-fg-secondary">Additional settings coming soon.</p>
        <div className="mt-4 rounded-lg border border-dashed border-line-subtle p-4 text-sm text-fg-muted">
          Looking for something else? New options will appear here as they become available.
        </div>
      </section>
    </div>
  )
}

