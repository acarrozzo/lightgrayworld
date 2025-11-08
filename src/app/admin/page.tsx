'use client'

import AdminNPCPanel from '@/components/AdminNPCPanel'

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-gray-950 p-6 text-white">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <AdminNPCPanel />
      </div>
    </main>
  )
}

