'use client'

import { Player } from '@/lib/game-state'
import { useState } from 'react'
import Icon from './Icon'

interface GameSidebarProps {
  player: Player
  onClose?: () => void
}

export default function GameSidebar({ player, onClose }: GameSidebarProps) {
  const [activeTab, setActiveTab] = useState('stats')

  const tabs = [
    { id: 'stats', label: 'Stats', icon: 'character', color: 'blue' },
    { id: 'inventory', label: 'Inventory', icon: 'inv', color: 'green' },
    { id: 'skills', label: 'Skills', icon: 'attack', color: 'red' },
    { id: 'quests', label: 'Quests', icon: 'inv', color: 'purple' },
  ]

  return (
    <div className="flex-1 flex flex-col">
      {/* Mobile close button */}
      {onClose && (
        <div className="xl:hidden flex justify-end p-2 border-b border-gray-700">
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Close"
          >
            <Icon name="x" size={20} />
          </button>
        </div>
      )}
      
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 text-sm font-medium ${
              activeTab === tab.id
                ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Icon name={tab.icon} size={16} color={tab.color} className="mr-1" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-4">
        {activeTab === 'stats' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Character Stats</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Level:</span>
                <span className="text-white">{player.level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">HP:</span>
                <span className="text-red-400">{player.hp}/{player.hpMax}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">MP:</span>
                <span className="text-blue-400">{player.mp}/{player.mpMax}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-700">
              <h4 className="text-md font-semibold text-white mb-2">Attributes</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">STR:</span>
                  <span className="text-white">10</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">DEX:</span>
                  <span className="text-white">10</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">MAG:</span>
                  <span className="text-white">10</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">DEF:</span>
                  <span className="text-white">10</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Inventory</h3>
            <div className="text-gray-400 text-sm">
              Your inventory is empty.
            </div>
          </div>
        )}

        {activeTab === 'skills' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Skills & Spells</h3>
            <div className="text-gray-400 text-sm">
              No skills learned yet.
            </div>
          </div>
        )}

        {activeTab === 'quests' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Quests</h3>
            <div className="text-gray-400 text-sm">
              No active quests.
            </div>
          </div>
        )}
      </div>
      <div className="h-[200px] p-4 bg-gray-600 overflow-y-scroll">
        <div className="text-gray-400 text-sm">
          # 🧱 LightGray World – Changelog

All notable changes to this project will be documented in this file.  
This project adheres to [Semantic Versioning](https://semver.org/).

---

## [0.1.0] – Initial Foundation Release
**Date:** 2025-11-01  
**Tagline:** Core multiplayer world and full-stack infrastructure established.

### Overview
This release lays the groundwork for **LightGray World**, a browser-based multiplayer RPG world engine.  
It includes full-stack infrastructure, real-time communication, and a modular UI system ready for future expansions.

### ⚙️ Core Stack
| Layer | Technology | Description |
|-------|-------------|-------------|
| Frontend | **Next.js 14**, **React 18**, **TypeScript** | Hybrid rendering and typed components |
| Styling | **Tailwind CSS** | Functional styling system and "Light Gray" theme |
| State | **Zustand** | Lightweight global state for session and world |
| Backend | **Next.js API routes / Node** | Game logic, actions, and auth endpoints |
| Database | **Prisma ORM + PostgreSQL** | Structured, typed world data |
| Realtime | **Socket.io** | Player presence, room actions, chat |
| Auth | Custom (local) | To be replaced with Auth.js/NextAuth |
| Hosting | Vercel (frontend) + Node server | Split deployment for static + sockets |

### 🗺️ Architecture Highlights
- Modular React components (`GameChat`, `GameFeed`, `ActionFeed`) for live world updates.
- Prisma schema defines `User`, `Room`, `Action`, `Message`, and `Presence` entities.
- Zustand store syncs user/session data between API and socket.
- Socket.io broadcasts for movement, chat, and look actions.
- Themed Tailwind UI for neutral light-gray design aesthetic.

### 💾 Developer Experience
```bash
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
        </div>
      </div>
   
    </div>
  )
}
