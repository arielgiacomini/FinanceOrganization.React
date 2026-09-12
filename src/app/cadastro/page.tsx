'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { register, isAuthenticated, AuthError } from '@/lib/auth'
import { Spinner } from '@/components/ui'
import { AppVersionBadge } from '@/components/ui/AppVersionBadge'
import { UserPlus, Eye, EyeOff } from 'lucide-react'

export default function CadastroPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [passConfirm, setPassConfirm] = useState('')
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
    if (pass !== passConfirm) {
      setError('As senhas não coincidem.')
      return
    }
    if (pass.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    setLoading(true)
    try {
      await register(email.trim(), name.trim(), pass)
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Não foi possível criar a conta. Tente novamente.')
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
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-1)' }}>Criar conta</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Comece grátis no Finance Organization</p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Nome</label>
              <input className="input" type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Seu nome" autoFocus autoComplete="name" required />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" autoComplete="username" required />
            </div>
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <input className="input pr-10" type={showPass ? 'text' : 'password'}
                  value={pass} onChange={e => setPass(e.target.value)}
                  placeholder="••••••••" autoComplete="new-password" required minLength={6} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirmar senha</label>
              <input className="input" type={showPass ? 'text' : 'password'}
                value={passConfirm} onChange={e => setPassConfirm(e.target.value)}
                placeholder="••••••••" autoComplete="new-password" required minLength={6} />
            </div>
            {error && (
              <p className="text-sm rounded-lg px-3 py-2 text-center"
                style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>{error}</p>
            )}
            <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
              {loading ? <Spinner size={18} /> : <UserPlus size={18} />}
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-4" style={{ color: 'var(--text-3)' }}>
          Já tem conta?{' '}
          <Link href="/login/" className="font-medium" style={{ color: 'var(--green-400)' }}>
            Entrar
          </Link>
        </p>

        <div className="flex items-center justify-center mt-4">
          <AppVersionBadge />
        </div>
      </div>
    </div>
  )
}
