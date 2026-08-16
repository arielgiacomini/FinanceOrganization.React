'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { Sidebar } from '@/components/layout/Sidebar'
import { RecordsAwaitingAlert } from '@/components/ui/RecordsAwaitingAlert'
import { cn } from '@/lib/utils'

const SIDEBAR_COLLAPSED_KEY = 'finance_sidebar_collapsed'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed(v => {
      const next = !v
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }

  return (
    <AuthGuard>
      <div className="min-h-screen">
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        <main className={cn(
          'pt-14 lg:pt-0 min-h-screen transition-[margin] duration-200',
          collapsed ? 'lg:ml-16' : 'lg:ml-64'
        )}>
          <div className="p-4 md:p-6 lg:p-8 animate-fade-in">
            <RecordsAwaitingAlert />
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
