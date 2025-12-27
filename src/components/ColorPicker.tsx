'use client'

import { AVATAR_COLORS, AvatarColorValue } from '@/lib/constants/avatars'

interface ColorPickerProps {
  selectedColor: string
  onSelectColor: (color: AvatarColorValue) => void
}

export default function ColorPicker({ selectedColor, onSelectColor }: ColorPickerProps) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {AVATAR_COLORS.map((color) => {
        const isActive = selectedColor === color.value
        return (
          <button
            key={color.value}
            type="button"
            className={`w-10 h-10 rounded-full border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
              isActive
                ? 'border-white scale-110 shadow-lg shadow-black/40'
                : 'border-gray-700 hover:border-gray-500 hover:scale-105'
            }`}
            style={{ backgroundColor: color.value }}
            title={color.name}
            onClick={() => onSelectColor(color.value)}
          />
        )
      })}
    </div>
  )
}

