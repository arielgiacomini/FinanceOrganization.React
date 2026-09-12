'use client'

import { useEffect, useState } from 'react'
import { getSession, clearSession } from '@/lib/auth'
import { AppVersionBadge } from '@/components/ui/AppVersionBadge'
import { Clock, LogOut } from 'lucide-react'

// Tela provisória — ainda não existe integração de pagamento (ver plano de
// comercialização). Por enquanto só informa que o trial acabou e dá um jeito
// de sair/trocar de conta; quando o meio de pagamento for escolhido, o botão
// de assinar entra aqui.
export default function AssinaturaPage() {
  const [email, setEmail] = useState<string | undefined>()

  useEffect(() => {
    setEmail(getSession()?.email)
  }, [])

  function logout() {
    clearSession()
    window.location.href = '/login/'
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-0)' }}>
      <div className="w-full max-w-sm text-center animate-slide-up">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'var(--amber-dim)' }}>
          <Clock size={24} style={{ color: 'var(--amber)' }} />
        </div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-1)' }}>
          Seu período de teste acabou
        </h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-3)' }}>
          {email ? `${email} — ` : ''}pra continuar usando o Finance Organization é preciso assinar um plano.
        </p>

        <div className="rounded-2xl p-6 mt-6 text-left" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            A assinatura ainda não está disponível para autoatendimento. Entre em contato pra continuar
            usando sua conta:
          </p>
          <a
            href="mailto:contato@arielgiacomini.com.br"
            className="btn-primary w-full justify-center py-2.5 mt-4"
          >
            contato@arielgiacomini.com.br
          </a>
        </div>

        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-1.5 text-sm mt-6"
          style={{ color: 'var(--text-3)' }}
        >
          <LogOut size={14} /> Sair / trocar de conta
        </button>

        <div className="flex items-center justify-center mt-6">
          <AppVersionBadge />
        </div>
      </div>
    </div>
  )
}
