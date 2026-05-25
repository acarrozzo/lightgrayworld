'use client'

import { useNotificationStore } from '@/store/notificationStore'
import { useFontPreferenceStore } from '@/store/fontPreferenceStore'

interface SettingsContentProps {
  onLogout: () => Promise<void> | void
}

export default function SettingsContent({ onLogout }: SettingsContentProps) {
  const enabled = useNotificationStore((state) => state.enabled)
  const setEnabled = useNotificationStore((state) => state.setEnabled)
  const fontFamily = useFontPreferenceStore((state) => state.fontFamily)
  const setFontFamily = useFontPreferenceStore((state) => state.setFontFamily)

  const handleToggleNotifications = () => {
    setEnabled(!enabled)
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-white">Activity Bar</h3>
        <p className="text-sm text-gray-400">Show recent action results in a slim bar at the bottom of the screen.</p>

        <div className="mt-4 flex items-center gap-4">
          <label
            htmlFor="notification-toggle"
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="relative">
              <input
                id="notification-toggle"
                type="checkbox"
                checked={enabled}
                onChange={handleToggleNotifications}
                className="sr-only"
              />
              <div
                className={`
                  w-11 h-6 rounded-full transition-colors duration-200 ease-in-out
                  ${enabled ? 'bg-purple-600' : 'bg-gray-700'}
                `}
              >
                <div
                  className={`
                    w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out
                    ${enabled ? 'translate-x-5' : 'translate-x-0.5'}
                    mt-0.5
                  `}
                />
              </div>
            </div>
            <span className="text-sm text-gray-200">
              {enabled ? 'Activity bar visible' : 'Activity bar hidden'}
            </span>
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          When enabled, recent actions (battles, quests, pickups, equip, messages) appear in a slim bar at the bottom of the screen. Click the bar to view recent history.
        </p>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-white">Appearance</h3>
        <p className="text-sm text-gray-400">Choose your preferred font style.</p>

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
                    ? 'border-purple-600 bg-purple-600' 
                    : 'border-gray-600 bg-transparent group-hover:border-gray-500'
                  }
                `}
              >
                {fontFamily === 'regular' && (
                  <div className="w-full h-full rounded-full bg-white scale-50" />
                )}
              </div>
            </div>
            <span className="text-sm text-gray-200">Regular</span>
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
                    ? 'border-purple-600 bg-purple-600' 
                    : 'border-gray-600 bg-transparent group-hover:border-gray-500'
                  }
                `}
              >
                {fontFamily === 'mono' && (
                  <div className="w-full h-full rounded-full bg-white scale-50" />
                )}
              </div>
            </div>
            <span className="text-sm text-gray-200">Fixed-width</span>
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Select whether to use a regular sans-serif font or a fixed-width monospace font throughout the application.
        </p>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-white">Account</h3>
        <p className="text-sm text-gray-400">Manage your session and access controls.</p>

        <div className="mt-4">
          <button
            type="button"
            onClick={onLogout}
            className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Logout
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white">Miscellaneous</h3>
        <p className="text-sm text-gray-400">Additional settings coming soon.</p>
        <div className="mt-4 rounded-lg border border-dashed border-gray-700 p-4 text-sm text-gray-500">
          Looking for something else? New options will appear here as they become available.
        </div>
      </section>
    </div>
  )
}

