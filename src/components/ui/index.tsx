'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import React from 'react'

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-6xl' }
  // Mobile: sempre full width com margem

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', overflowY: 'auto' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn('w-full rounded-2xl animate-slide-up mx-2 sm:mx-0 flex flex-col', widths[size])}
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border-2)',
          maxHeight: 'calc(100dvh - 32px)',
        }}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-1)' }}>
          <h2 className="font-semibold text-base" style={{ color: 'var(--text-1)' }}>{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-4)]"
            style={{ color: 'var(--text-3)' }}
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      className="animate-spin"
      style={{ color: 'var(--green-500)' }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

export function Empty({ message = 'Nenhum registro encontrado.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
        style={{ background: 'var(--bg-3)' }}
      >
        📭
      </div>
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>{message}</p>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  sub?: string
  accent?: 'green' | 'red' | 'amber' | 'blue'
  icon?: React.ReactNode
}

export function StatCard({ label, value, sub, accent = 'green', icon }: StatCardProps) {
  const colors = {
    green: { bg: 'var(--green-dim)', text: 'var(--green-400)', border: 'var(--green-border)' },
    red:   { bg: 'var(--red-dim)',   text: 'var(--red)',       border: 'rgba(248,113,113,0.2)' },
    amber: { bg: 'var(--amber-dim)', text: 'var(--amber)',     border: 'rgba(251,191,36,0.2)' },
    blue:  { bg: 'var(--blue-dim)',  text: 'var(--blue)',      border: 'rgba(96,165,250,0.2)' },
  }
  const c = colors[accent]

  return (
    <div
      className="card p-5 flex flex-col gap-3"
      style={{ borderColor: c.border }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{label}</span>
        {icon && (
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: c.bg, color: c.text }}>
            {icon}
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight" style={{ color: c.text }}>{value}</p>
        {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{sub}</p>}
      </div>
    </div>
  )
}

// ─── Page Header ──────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6 lg:mb-8">
      <div>
        <h1 className="text-xl lg:text-2xl font-semibold" style={{ color: 'var(--text-1)' }}>{title}</h1>
        {subtitle && <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────

export interface TableHeader {
  label: string
  /** Quando definido junto com `onSort`, o cabeçalho vira clicável para ordenação. */
  sortKey?: string
  /** Ex: "hidden lg:table-cell" — esconde a coluna em telas estreitas. A <Td> da
   *  mesma coluna em cada linha precisa repetir a mesma classe. */
  className?: string
}

interface TableProps {
  headers: (string | TableHeader)[]
  children: React.ReactNode
  loading?: boolean
  empty?: boolean
  headerOffset?: number
  sortCol?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
}

export function Table({ headers, children, loading, empty, headerOffset = 0, sortCol, sortDir, onSort }: TableProps) {
  return (
    <div
      // Abaixo de lg a barra mobile fixa (h-14) soma ao offset do cabeçalho de filtros sticky;
      // em lg+ não existe barra fixa, então o offset extra vira 0.
      className="overflow-hidden sm:overflow-visible rounded-xl [--sticky-top-base:3.5rem] lg:[--sticky-top-base:0px]"
      style={{ border: '1px solid var(--border-1)', background: 'var(--bg-2)' }}
    >
      <div className="overflow-x-auto sm:overflow-x-visible">
        {/* border-collapse: separate (não collapse) — o modelo "collapse" tem um bug de
            repintura no Chromium onde conteúdo de linhas por trás de células sticky "vaza"
            visualmente durante o scroll (mais visível em zooms fora de 100% exato). Cada
            <Td>/<th> desenha sua própria borda inferior via box-shadow, então a troca não
            muda a aparência. */}
        <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, background: 'var(--bg-2)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-2)' }}>
              {headers.map((h) => {
                const label = typeof h === 'string' ? h : h.label
                const sortKey = typeof h === 'string' ? undefined : h.sortKey
                const headerClassName = typeof h === 'string' ? undefined : h.className
                const sortable = !!sortKey && !!onSort
                const active = sortable && sortCol === sortKey
                return (
                  <th
                    key={label}
                    className={cn('px-4 py-3 text-left text-xs font-medium sm:sticky sm:z-20', headerClassName)}
                    style={{
                      color: active ? 'var(--text-1)' : 'var(--text-3)',
                      background: 'var(--bg-2)',
                      boxShadow: 'inset 0 -1px 0 var(--border-1)',
                      top: `calc(var(--sticky-top-base) + ${headerOffset}px)`,
                      cursor: sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => sortable && onSort!(sortKey!)}
                  >
                    {sortable ? (
                      <span className="inline-flex items-center gap-1">
                        {label}
                        <span style={{ fontSize: 10, opacity: active ? 1 : 0.3 }}>
                          {active ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
                        </span>
                      </span>
                    ) : label}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={headers.length} className="py-12 text-center">
                  <div className="flex justify-center"><Spinner /></div>
                </td>
              </tr>
            ) : empty ? (
              <tr>
                <td colSpan={headers.length}>
                  <Empty />
                </td>
              </tr>
            ) : children}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Table Row ────────────────────────────────────────────────────────────────

export function Tr({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'transition-colors duration-100',
        onClick && 'cursor-pointer hover:bg-[var(--bg-3)]'
      )}
      style={{ borderBottom: '1px solid var(--border-1)' }}
    >
      {children}
    </tr>
  )
}


// ─── TRow + Td ───────────────────────────────────────────────────────────────
// Usa CSS custom property no <tr> que o <td> herda via var().
// Esta é a única abordagem confiável — não depende de cloneElement nem Context.

interface TRowProps {
  children: React.ReactNode
  bg?: string
  /** Cor (com alpha, ex: "#22c55e12") pintada por cima do fundo da linha inteira —
   *  usada pra dar identidade visual por conta em Contas a Pagar, sem substituir o
   *  fundo de pago/selecionado, que continua vindo de `bg`. */
  tint?: string
  style?: React.CSSProperties
  onClick?: () => void
}

export function TRow({ children, bg = 'var(--bg-2)', tint, style, onClick }: TRowProps) {
  return (
    <tr
      onClick={onClick}
      style={{
        // A borda inferior da linha vem do box-shadow de cada <Td> (ver abaixo) — com
        // border-collapse: separate, borda definida no <tr> não é desenhada pelo navegador.
        // Define as CSS vars no <tr> que os <td> filhos consomem
        ['--row-bg' as string]: bg,
        ['--row-tint' as string]: tint ?? 'transparent',
        ...style,
      }}
    >
      {children}
    </tr>
  )
}

export function Td({ children, className, style, colSpan, title }: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  colSpan?: number
  title?: string
}) {
  return (
    <td
      className={cn('px-4 py-3 text-sm', className)}
      colSpan={colSpan}
      title={title}
      style={{
        color: 'var(--text-1)',
        backgroundColor: 'var(--row-bg, var(--bg-2))',
        // A 2ª sombra "inunda" a célula com --row-tint por cima do backgroundColor —
        // é como se compõe a identidade visual da conta sem trocar a cor base da linha.
        boxShadow: 'inset 0 -1px 0 var(--border-1), inset 0 0 0 999px var(--row-tint, transparent)',
        ...style,
      }}
    >
      {children}
    </td>
  )
}
