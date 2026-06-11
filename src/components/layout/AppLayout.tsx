'use client'

import { AuthGuard } from '@/components/layout/AuthGuard'
import { Sidebar } from '@/components/layout/Sidebar'
import { RecordsAwaitingAlert } from '@/components/ui/RecordsAwaitingAlert'

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen">
        <Sidebar />
        <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
          <div className="p-4 md:p-6 lg:p-8 animate-fade-in">
            <RecordsAwaitingAlert />
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
