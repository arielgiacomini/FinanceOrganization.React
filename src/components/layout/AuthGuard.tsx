'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import { Spinner } from '@/components/ui'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (pathname === '/login') {
      setChecking(false)
      return
    }
    if (!isAuthenticated()) {
      router.replace('/login')
    } else {
      setChecking(false)
    }
  }, [pathname, router])

  if (checking && pathname !== '/login') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-0)' }}>
        <Spinner size={32} />
      </div>
    )
  }

  return <>{children}</>
}
