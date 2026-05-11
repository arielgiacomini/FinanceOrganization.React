'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { AuthGuard } from '@/components/layout/AuthGuard'

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'

  if (isLogin) return <>{children}</>

  return (
    <AuthGuard>
      <div className="min-h-screen">
        <Sidebar />
        <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
          <div className="p-4 md:p-6 lg:p-8 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
