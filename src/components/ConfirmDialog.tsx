'use client'

import Icon from './Icon'

/**
 * A yes/no stop before something the player cannot take back.
 *
 * ActionModal next door is a different thing: its buttons carry a game action
 * name that goes to the server, which is right for a sign or an NPC and wrong
 * for "are you sure", where the answer decides whether a decision already made
 * on the client goes ahead at all. Same chrome, one callback.
 *
 * Cancel is the resting position: it is the wider button, it is what Escape and
 * a click on the scrim do, and it is what the dialog does when it is dismissed
 * any other way.
 */
interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  /** Label on the button that goes ahead. Say what it does — "Teleport", not "OK". */
  confirmLabel: string
  cancelLabel?: string
  /** 'danger' paints the confirm button as a loss rather than a choice. */
  tone?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-sunken/80 backdrop-blur-sm p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-line-subtle/50 bg-surface-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel()
        }}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-line-subtle/50 px-4 py-3">
          <h2 className="text-base font-semibold text-fg-bright">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1.5 text-fg-secondary transition-colors hover:text-fg-bright hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
            aria-label={cancelLabel}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <p className="px-4 py-4 text-sm leading-relaxed text-fg-secondary whitespace-pre-wrap">{message}</p>

        <div className="border-t border-line-subtle/50 px-4 py-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded fill-surface-hover px-5 py-1.5 text-sm font-medium transition-colors hover:bg-surface-selected focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={`rounded px-5 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 ${
              tone === 'danger'
                ? 'fill-status-error focus-visible:ring-status-error'
                : 'fill-resource-mp focus-visible:ring-resource-mp'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
