'use client'

import Icon from './Icon'

export default function IconTest() {
  const testIcons = [
    { name: 'attack', color: 'red' },
    { name: 'heal', color: 'green' },
    { name: 'magic', color: 'blue' },
    { name: 'aim', color: 'yellow' },
    { name: 'inv', color: 'purple' },
    { name: 'character', color: 'gray' },
  ]

  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <h3 className="text-white mb-4">Icon Test - Sprite Sheet</h3>
      <div className="grid grid-cols-3 gap-4">
        {testIcons.map((icon, index) => (
          <div key={index} className="flex items-center gap-2">
            <Icon name={icon.name} size={32} color={icon.color} />
            <span className="text-white text-sm">{icon.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
