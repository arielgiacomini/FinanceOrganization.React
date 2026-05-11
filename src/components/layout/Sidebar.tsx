'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowUpCircle, ArrowDownCircle,
  CreditCard, TrendingUp, ChevronRight, Menu, X, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { clearSession } from '@/lib/auth'

const nav = [
  { href: '/',                 label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/contas-a-pagar',   label: 'Contas a Pagar',   icon: ArrowUpCircle   },
  { href: '/contas-a-receber', label: 'Contas a Receber', icon: ArrowDownCircle },
  { href: '/contas',           label: 'Contas Bancárias', icon: CreditCard      },
  { href: '/analise',          label: 'Análise',          icon: TrendingUp      },
]

export function Sidebar() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  function logout() {
    clearSession()
    window.location.href = '/login/'
  }

  // Fecha ao trocar de rota
  useEffect(() => { setOpen(false) }, [path])

  // Trava scroll do body quando menu aberto no mobile
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const NavLinks = () => (
    <>
      {nav.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? path === '/' : path.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group',
              active
                ? 'text-[var(--green-400)] bg-[var(--green-dim)]'
                : 'text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-3)]'
            )}
          >
            <Icon size={16} className="flex-shrink-0" />
            <span className="flex-1 font-medium">{label}</span>
            {active && <ChevronRight size={14} className="opacity-60" />}
          </Link>
        )
      })}
    </>
  )

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className="fixed left-0 top-0 h-screen w-64 flex-col hidden lg:flex"
        style={{ background: 'var(--bg-1)', borderRight: '1px solid var(--border-1)' }}
      >
        <div className="px-6 py-6 border-b" style={{ borderColor: 'var(--border-1)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-black font-bold text-sm"
              style={{ background: 'var(--green-500)' }}>F</div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Finance</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Organization</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5"><NavLinks /></nav>
        <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--border-1)' }}>
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--red-dim)]"
            style={{ color: 'var(--text-3)' }}>
            <LogOut size={16} />
            <span>Sair</span>
          </button>
          <p className="text-xs px-3 mt-2" style={{ color: 'var(--text-3)' }}>© {new Date().getFullYear()} · Finance Org</p>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header
        className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14 lg:hidden"
        style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border-1)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-black font-bold text-xs"
            style={{ background: 'var(--green-500)' }}>F</div>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Finance Org</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-3)]"
          style={{ color: 'var(--text-2)' }}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* ── Mobile overlay ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        className={cn(
          'fixed top-0 left-0 h-screen w-72 z-50 flex flex-col lg:hidden transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ background: 'var(--bg-1)', borderRight: '1px solid var(--border-1)' }}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b" style={{ borderColor: 'var(--border-1)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-black font-bold text-xs"
              style={{ background: 'var(--green-500)' }}>F</div>
            <span className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Finance Org</span>
          </div>
          <button type="button" onClick={() => setOpen(false)} style={{ color: 'var(--text-3)' }}>
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto"><NavLinks /></nav>
        <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--border-1)' }}>
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--red-dim)]"
            style={{ color: 'var(--text-3)' }}>
            <LogOut size={16} />
            <span>Sair</span>
          </button>
          <p className="text-xs px-3 mt-2" style={{ color: 'var(--text-3)' }}>© {new Date().getFullYear()} · Finance Org</p>
        </div>
      </div>
    </>
  )
}
