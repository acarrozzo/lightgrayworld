'use client'

import { useGameStore } from '@/lib/game-state'
import Icon from './Icon'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onClearFeed: () => void
  onScrollToTop: () => void
  onScrollToBottom: () => void
}

export default function SettingsModal({
  isOpen,
  onClose,
  onClearFeed,
  onScrollToTop,
  onScrollToBottom,
}: SettingsModalProps) {
  const { logout } = useGameStore()

  const handleLogout = () => {
    logout()
    onClose()
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
        className="relative flex h-[90vh] w-[90vw] max-w-4xl flex-col overflow-hidden rounded-2xl border border-purple-500/40 bg-gray-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">System Settings</h2>
            <p className="text-sm text-gray-400">Customize your experience and manage game utilities.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
            aria-label="Close settings"
          >
            <Icon name="x" size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <section className="mb-8">
            <h3 className="text-lg font-semibold text-white">Feed Controls</h3>
            <p className="text-sm text-gray-400">Manage the game feed and navigation tools.</p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onClearFeed}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              >
                Clear Feed
              </button>

              <button
                type="button"
                onClick={onScrollToTop}
                className="rounded-full bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              >
                ↑ Top
              </button>

              <button
                type="button"
                onClick={onScrollToBottom}
                className="rounded-full bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              >
                ↓ Bottom
              </button>
            </div>
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

        <div className="border-t border-gray-800 px-6 py-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-purple-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

