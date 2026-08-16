'use client'

import { APP_VERSION, isVersionNew } from '@/lib/version'

export function AppVersionBadge({ className }: { className?: string }) {
  const isNew = isVersionNew()
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      <span
        className="text-xs font-mono px-1.5 py-0.5 rounded"
        style={{ background: 'var(--bg-3)', color: 'var(--text-3)', border: '1px solid var(--border-1)' }}
      >
        {APP_VERSION}
      </span>
      {isNew && (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
          style={{ background: 'var(--green-dim)', color: 'var(--green-400)', border: '1px solid var(--green-border)' }}
        >
          new
        </span>
      )}
    </span>
  )
}
