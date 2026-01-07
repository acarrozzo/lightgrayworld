'use client'

import React from 'react'

type DirectoryButton = {
  label: string
  direction: string
}

type DirectoryHeading = 
  | { parts?: string[]; text?: string; description?: string }
  | { text?: string; description?: string }

type DirectoryLocation = {
  name: string
  description?: string
  direction: string
}

type DirectoryModalContent = {
  heading?: DirectoryHeading
  locations?: DirectoryLocation[]
  questMessage?: string
  questMessageDescription?: string
  title?: string
}

interface DirectoryContentProps {
  modalContent: DirectoryModalContent
  buttons: DirectoryButton[]
}

export function DirectoryContent({ modalContent, buttons }: DirectoryContentProps) {
  const heading = modalContent.heading
  const locations = modalContent.locations || []
  const questMessage = modalContent.questMessage

  return (
    <div className="w-full">
      {/* Directory Panel */}
      <div className="bg-amber-900/30 border border-amber-800/50 rounded-lg p-6 mb-4">
        {/* Heading */}
        {heading && 'parts' in heading && heading.parts ? (
          <>
            <h3 className="text-2xl font-bold mb-2">
              <span className="text-white">{heading.parts[0]}</span>
              {' '}
              <span className="text-yellow-400">{heading.parts[1]}</span>
            </h3>
            {heading.description && (
              <p className="text-sm text-amber-200/70 mb-6 leading-relaxed">{heading.description}</p>
            )}
          </>
        ) : (
          <>
            <h3 className="text-2xl font-bold text-white mb-2">{heading?.text || 'Directory'}</h3>
            {heading?.description && (
              <p className="text-sm text-amber-200/70 mb-6 leading-relaxed">{heading.description}</p>
            )}
          </>
        )}

        {/* Location Buttons */}
        <div className="space-y-4 mb-4">
          {locations.map((location, index) => {
            const button = buttons.find(b => b.direction === location.direction)
            return (
              <div key={index} className="flex items-start gap-4">
                {button && (
                  <button
                    type="button"
                    data-direction={button.direction}
                    className="w-28 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium text-[0.97rem] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-900/30 flex-shrink-0"
                  >
                    {button.label}
                  </button>
                )}
                <div className="flex-1 space-y-1">
                  <span className="text-white text-lg">{location.name}</span>
                  {location.description && (
                    <p className="text-sm text-amber-200/70 leading-relaxed">{location.description}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Separator */}
        <div className="border-t border-amber-700/50 my-4"></div>

        {/* Quest Message */}
        {questMessage && (
          <>
            <p className="text-white text-base leading-relaxed">{questMessage}</p>
            {modalContent.questMessageDescription && (
              <p className="text-sm text-amber-200/70 mt-2 leading-relaxed">{modalContent.questMessageDescription}</p>
            )}
            <div className="border-t border-amber-700/50 my-4"></div>
          </>
        )}
      </div>
    </div>
  )
}

