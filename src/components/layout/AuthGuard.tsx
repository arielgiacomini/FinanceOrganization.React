'use client'

import { useEffect, useState } from 'react'
import { isAuthenticated } from '@/lib/auth'
import { Spinner } from '@/components/ui'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'ok' | 'redirect'>('checking')

  useEffect(() => {
    if (isAuthenticated()) {
      setStatus('ok')
    } else {
      setStatus('redirect')
      window.location.href = '/login/'
    }
  }, [])

  if (status !== 'ok') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-0)' }}>
        <Spinner size={32} />
      </div>
    )
  }

  return <>{children}</>
}
