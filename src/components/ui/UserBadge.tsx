'use client'

import { useEffect, useState } from 'react'
import { getSession, type Session } from '@/lib/auth'

// Cor do avatar é derivada do id do usuário (não muda entre sessões do mesmo
// usuário) — ajuda a diferenciar de relance quando mais de uma pessoa usa o
// mesmo aparelho/navegador em momentos diferentes.
const AVATAR_COLORS = [
  '#4ade80', '#60a5fa', '#f87171', '#fbbf24', '#a78bfa',
  '#34d399', '#f472b6', '#38bdf8', '#fb923c', '#a3e635',
]

function colorForUser(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

interface UserBadgeProps {
  /** Só o avatar (sem nome/e-mail) — usado no menu colapsado e na barra mobile. */
  avatarOnly?: boolean
  className?: string
}

/** Identidade visual de qual conta está logada — evita confusão em aparelhos
 *  compartilhados por mais de uma pessoa, agora que o login é por usuário de
 *  verdade. */
export function UserBadge({ avatarOnly = false, className }: UserBadgeProps) {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    setSession(getSession())
  }, [])

  if (!session) return null

  const displayName = session.name?.trim() || session.email?.trim() || 'Minha conta'
  const initial = displayName.charAt(0).toUpperCase()
  const color = colorForUser(session.userId)
  const title = [session.name, session.email].filter(Boolean).join(' · ') || undefined

  const avatar = (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
      style={{ background: color, color: '#0a0a0a' }}
    >
      {initial}
    </div>
  )

  if (avatarOnly) {
    return (
      <div className={className ?? 'flex justify-center'} title={title}>
        {avatar}
      </div>
    )
  }

  // Login por senha não devolve o nome (só o cadastro devolve) — nesse caso
  // mostra o e-mail em destaque em vez de cair num genérico "Minha conta"
  // enquanto tiver algo real pra identificar a conta.
  const hasName = !!session.name?.trim()
  return (
    <div className={className ?? 'flex items-center gap-2.5 min-w-0'} title={title}>
      {avatar}
      <div className="min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>
          {displayName}
        </p>
        {hasName && session.email && (
          <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{session.email}</p>
        )}
      </div>
    </div>
  )
}
