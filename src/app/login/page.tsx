'use client'

import { useState, useEffect } from 'react'
import { AUTH_USER, AUTH_PASSWORD, createSession, saveSession, isAuthenticated } from '@/lib/auth'
import { Spinner } from '@/components/ui'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'
import { LogIn, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (isAuthenticated()) {
      window.location.href = '/'
    } else {
      setChecking(false)
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 600))
    if (user.trim() === AUTH_USER && pass === AUTH_PASSWORD) {
      saveSession(createSession())
      window.location.href = '/'
    } else {
      setError('Usuário ou senha incorretos.')
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-0)' }}>
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-0)' }}>
      <div className="w-full max-w-sm animate-slide-up">

        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-black font-bold text-2xl mx-auto mb-4"
            style={{ background: 'var(--green-500)' }}>F</div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-1)' }}>Finance Organization</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Controle financeiro pessoal</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <FlagBrasil size={14} />
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>Brasil</span>
            <span style={{ color: 'var(--text-3)' }}>·</span>
            <FlagEspanha size={14} />
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>Espanha</span>
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Usuário</label>
              <input className="input" type="text" value={user} onChange={e => setUser(e.target.value)}
                placeholder="seu usuário" autoFocus autoComplete="username" required />
            </div>
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <input className="input pr-10" type={showPass ? 'text' : 'password'}
                  value={pass} onChange={e => setPass(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && (
              <p className="text-sm rounded-lg px-3 py-2 text-center"
                style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>{error}</p>
            )}
            <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
              {loading ? <Spinner size={18} /> : <LogIn size={18} />}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-3)' }}>
          Sessão expira após 8 horas
        </p>
      </div>
    </div>
  )
}
