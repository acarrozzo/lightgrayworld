'use client'

import { useNotificationStore } from '@/store/notificationStore'

interface SettingsContentProps {
  onLogout: () => Promise<void> | void
}

export default function SettingsContent({ onLogout }: SettingsContentProps) {
  const enabled = useNotificationStore((state) => state.enabled)
  const setEnabled = useNotificationStore((state) => state.setEnabled)

  const handleToggleNotifications = () => {
    setEnabled(!enabled)
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-white">Notifications</h3>
        <p className="text-sm text-gray-400">Control in-app notifications for room actions.</p>

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
              {enabled ? 'Notifications enabled' : 'Notifications disabled'}
            </span>
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          When enabled, you'll receive toast notifications for actions like picking up items, dropping items, and interacting with room objects.
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

