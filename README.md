# Light Gray RPG - Modern Multiplayer Version

A modern, real-time multiplayer text-based RPG built with Next.js, TypeScript, and Socket.io.

## 🚀 Features

- **Real-time Multiplayer**: Live chat and player presence
- **Room-based Navigation**: Explore different game areas
- **Character Progression**: Level up, gain stats, learn skills
- **Modern UI**: Responsive design with Tailwind CSS
- **Type Safety**: Full TypeScript support
- **Database**: SQLite with Prisma ORM

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite with Prisma ORM
- **Real-time**: Socket.io
- **State Management**: Zustand
- **Authentication**: Custom auth system

## 🎮 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Test Account

- **Username**: testuser
- **Password**: password123

## 🏗️ Project Structure

```
src/
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   └── page.tsx        # Main page
├── components/         # React components
│   ├── GameInterface.tsx
│   ├── GameHeader.tsx
│   ├── GameContent.tsx
│   ├── GameSidebar.tsx
│   ├── GameChat.tsx
│   └── LoginForm.tsx
├── lib/               # Utilities
│   ├── prisma.ts      # Database client
│   └── game-state.ts  # Zustand store
└── hooks/             # Custom hooks
    └── useSocket.ts   # Socket.io hook
```

## 🎯 Game Features

### Current Implementation
- ✅ User authentication (login/register)
- ✅ Room navigation system
- ✅ Real-time chat
- ✅ Player presence tracking
- ✅ Character stats display
- ✅ Responsive UI

### Planned Features
- 🔄 Combat system
- 🔄 Inventory management
- 🔄 Quest system
- 🔄 Equipment system
- 🔄 Magic spells
- 🔄 Guild/party system

## 🗄️ Database Schema

The game uses a comprehensive database schema with:
- **Users**: Player accounts and character data
- **Rooms**: Game locations with connections
- **Equipment**: Character gear and items
- **Inventory**: Player items
- **Chat**: Message history
- **Quests**: Quest progress tracking

## 🔧 Development

### Database Commands
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database
npx prisma db seed

# View database
npx prisma studio
```

### Socket.io Events

**Client → Server:**
- `player-login`: Player connects
- `player-move`: Player changes rooms
- `chat-message`: Send chat message
- `game-action`: Perform game action

**Server → Client:**
- `player-joined`: Another player joined room
- `player-left`: Player left room
- `player-entered`: Player entered room
- `chat-message`: New chat message
- `player-action`: Player performed action

## 📝 License

This project is for educational purposes.

## 🤝 Contributing

This is a personal project, but suggestions and improvements are welcome!

---

**Note**: This is a modern rebuild of the original Light Gray RPG, designed to be truly multiplayer with real-time features and a modern tech stack.# Database connection test
