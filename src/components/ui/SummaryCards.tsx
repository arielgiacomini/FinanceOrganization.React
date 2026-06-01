'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'
import { CreditCard, ChevronDown, ChevronUp } from 'lucide-react'
import type { CountryFilter } from '@/components/ui/CountryTabs'

interface CountrySummary {
  total: number
  positive: number  // pago (bills) ou recebido (receivables)
  pending: number
}

export interface AccountSummaryItem {
  name: string
  total: number
  pending: number
  hex?: string
  isCreditCard?: boolean
  currency: string
}

interface SummaryCardsProps {
  countryFilter: CountryFilter
  brasil: CountrySummary
  espanha: CountrySummary
  labels: { total: string; positive: string; pending: string }
  accountSummary?: AccountSummaryItem[]
}

function MiniCard({ label, value, color, currency }: {
  label: string
  value: number
  color: string
  currency: string
}) {
  return (
    <div>
      <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-base font-semibold" style={{ color }}>{formatCurrency(value, currency)}</p>
    </div>
  )
}

// Rodapé compacto e expansível com os totais por conta
function AccountBreakdown({ items }: { items: AccountSummaryItem[] }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null

  return (
    <div style={{ borderTop: '1px solid var(--border-1)' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2 transition-colors hover:bg-[var(--bg-3)]"
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>
          Por conta ({items.length})
        </span>
        {open ? <ChevronUp size={13} style={{ color: 'var(--text-3)' }} /> : <ChevronDown size={13} style={{ color: 'var(--text-3)' }} />}
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3 pt-0.5">
          {items.map(item => (
            <div key={item.name}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
              style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.hex || 'var(--border-2)', display: 'inline-block', flexShrink: 0 }} />
              {item.isCreditCard && <CreditCard size={10} style={{ color: 'var(--text-3)', flexShrink: 0 }} />}
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>{item.name}</span>
              <span className="text-xs font-mono font-semibold" style={{ color: item.isCreditCard ? 'var(--amber)' : 'var(--text-2)' }}>
                {formatCurrency(item.total, item.currency)}
              </span>
              {item.pending > 0 && item.pending !== item.total && (
                <span className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>
                  ({formatCurrency(item.pending, item.currency)} pend.)
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SummaryCards({ countryFilter, brasil, espanha, labels, accountSummary = [] }: SummaryCardsProps) {
  // Filtro único — 3 cards simples + breakdown
  if (countryFilter !== 'Todos') {
    const data = countryFilter === 'Brasil' ? brasil : espanha
    const currency = countryFilter
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: labels.total,    value: data.total,    color: 'var(--text-1)'    },
            { label: labels.positive, value: data.positive, color: 'var(--green-400)' },
            { label: labels.pending,  value: data.pending,  color: 'var(--amber)'     },
          ].map(({ label, value, color }) => (
            <div key={label} className="card px-4 py-3">
              <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
              <p className="text-lg font-semibold" style={{ color }}>{formatCurrency(value, currency)}</p>
            </div>
          ))}
        </div>
        {accountSummary.length > 0 && (
          <div className="card overflow-hidden">
            <AccountBreakdown items={accountSummary} />
          </div>
        )}
      </div>
    )
  }

  // Todos — dois cards lado a lado, cada um com resumo do país
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Brasil */}
        <div className="card px-5 py-4">
          <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-1)' }}>
            <FlagBrasil size={20} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Brasil</span>
          </div>
          <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 sm:gap-3">
            <MiniCard label={labels.total}    value={brasil.total}    color="var(--text-1)"    currency="Brasil"  />
            <MiniCard label={labels.positive} value={brasil.positive} color="var(--green-400)" currency="Brasil"  />
            <MiniCard label={labels.pending}  value={brasil.pending}  color="var(--amber)"     currency="Brasil"  />
          </div>
        </div>

        {/* Espanha */}
        <div className="card px-5 py-4">
          <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-1)' }}>
            <FlagEspanha size={20} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Espanha</span>
          </div>
          <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 sm:gap-3">
            <MiniCard label={labels.total}    value={espanha.total}    color="var(--text-1)"    currency="Espanha" />
            <MiniCard label={labels.positive} value={espanha.positive} color="var(--green-400)" currency="Espanha" />
            <MiniCard label={labels.pending}  value={espanha.pending}  color="var(--amber)"     currency="Espanha" />
          </div>
        </div>
      </div>
      {accountSummary.length > 0 && (
        <div className="card overflow-hidden">
          <AccountBreakdown items={accountSummary} />
        </div>
      )}
    </div>
  )
}
