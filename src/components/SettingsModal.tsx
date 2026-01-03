'use client'

import Icon from './Icon'
import { useNotificationStore } from '@/store/notificationStore'
import { useFontPreferenceStore } from '@/store/fontPreferenceStore'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onLogout: () => Promise<void> | void
}

export default function SettingsModal({
  isOpen,
  onClose,
  onLogout,
}: SettingsModalProps) {
  const enabled = useNotificationStore((state) => state.enabled)
  const setEnabled = useNotificationStore((state) => state.setEnabled)
  const fontFamily = useFontPreferenceStore((state) => state.fontFamily)
  const setFontFamily = useFontPreferenceStore((state) => state.setFontFamily)

  const handleLogout = async () => {
    await onLogout()
    onClose()
  }

  const handleToggleNotifications = () => {
    setEnabled(!enabled)
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex h-auto max-h-[85vh] w-[90vw] max-w-3xl flex-col overflow-hidden rounded-lg border border-gray-700/50 bg-gray-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-gray-700/50 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-white">System Settings</h2>
            <p className="text-xs text-gray-400">Customize your experience and manage game utilities.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-gray-400 transition-colors hover:text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
            aria-label="Close settings"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

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
            <h3 className="text-lg font-semibold text-white">Appearance</h3>
            <p className="text-sm text-gray-400">Choose your preferred font style.</p>

            <div className="mt-4 space-y-3">
              <label
                htmlFor="font-regular"
                className="flex items-center gap-3 cursor-pointer group"
              >
                <div className="relative">
                  <input
                    id="font-regular"
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
                htmlFor="font-mono"
                className="flex items-center gap-3 cursor-pointer group"
              >
                <div className="relative">
                  <input
                    id="font-mono"
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
                onClick={handleLogout}
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

        <div className="border-t border-gray-700/50 px-4 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-gray-700 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

