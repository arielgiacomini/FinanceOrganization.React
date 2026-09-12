'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { CountryFlag } from '@/components/ui/Flags'
import { CreditCard, ChevronDown, ChevronUp } from 'lucide-react'
import type { CountryFilter } from '@/components/ui/CountryTabs'

interface CountrySummary {
  total: number
  positive: number  // pago (bills) ou recebido (receivables)
  pending: number
}

export interface CountrySummaryItem {
  code: string
  summary: CountrySummary
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
  countries: CountrySummaryItem[]
  labels: { total: string; positive: string; pending: string }
  accountSummary?: AccountSummaryItem[]
}

function MiniCard({ label, value, color, currency }: {
  label: string; value: number; color: string; currency: string
}) {
  return (
    <div>
      <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-base font-semibold" style={{ color }}>{formatCurrency(value, currency)}</p>
    </div>
  )
}

// Resumo escrito em fonte pequena, exibido na linha do colapso (quando fechado)
function InlineSummary({ countryFilter, countries, labels }: {
  countryFilter: CountryFilter
  countries: CountrySummaryItem[]
  labels: { total: string; positive: string; pending: string }
}) {
  function block(data: CountrySummary, currency: string, flag?: React.ReactNode) {
    return (
      <span className="inline-flex items-center gap-x-2 flex-wrap">
        {flag}
        <span style={{ color: 'var(--text-3)' }}>{labels.total} <span className="font-mono font-semibold" style={{ color: 'var(--text-1)' }}>{formatCurrency(data.total, currency)}</span></span>
        <span style={{ color: 'var(--text-3)' }}>{labels.positive} <span className="font-mono font-semibold" style={{ color: 'var(--green-400)' }}>{formatCurrency(data.positive, currency)}</span></span>
        <span style={{ color: 'var(--text-3)' }}>{labels.pending} <span className="font-mono font-semibold" style={{ color: 'var(--amber)' }}>{formatCurrency(data.pending, currency)}</span></span>
      </span>
    )
  }

  if (countryFilter !== 'Todos') {
    const data = countries.find(c => c.code === countryFilter)?.summary ?? { total: 0, positive: 0, pending: 0 }
    return <div className="flex items-center gap-x-3 gap-y-1 text-xs flex-wrap">{block(data, countryFilter)}</div>
  }

  return (
    <div className="flex items-center gap-x-3 gap-y-1 text-xs flex-wrap">
      {countries.map((c, i) => (
        <span key={c.code} className="inline-flex items-center gap-x-2 flex-wrap">
          {i > 0 && <span style={{ color: 'var(--border-2)' }}>·</span>}
          {block(c.summary, c.code, <CountryFlag code={c.code} size={13} />)}
        </span>
      ))}
    </div>
  )
}

function AccountBreakdown({ items }: { items: AccountSummaryItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
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
  )
}

export function SummaryCards({ countryFilter, countries, labels, accountSummary = [] }: SummaryCardsProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="card overflow-hidden">
      {/* Linha do colapso: resumo escrito (fechado) + botão toggle */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--bg-3)]"
      >
        <div className="min-w-0 text-left">
          {!open && <InlineSummary countryFilter={countryFilter} countries={countries} labels={labels} />}
          {open && <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Resumo do mês</span>}
        </div>
        <span className="flex items-center gap-1 flex-shrink-0 text-xs" style={{ color: 'var(--text-3)' }}>
          {open ? 'Ocultar' : 'Ver tudo'}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {/* Conteúdo expandido */}
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4" style={{ borderTop: '1px solid var(--border-1)' }}>
          {countryFilter !== 'Todos' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
              {(() => {
                const data = countries.find(c => c.code === countryFilter)?.summary ?? { total: 0, positive: 0, pending: 0 }
                const currency = countryFilter
                return [
                  { label: labels.total,    value: data.total,    color: 'var(--text-1)'    },
                  { label: labels.positive, value: data.positive, color: 'var(--green-400)' },
                  { label: labels.pending,  value: data.pending,  color: 'var(--amber)'     },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg px-4 py-3" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
                    <p className="text-lg font-semibold" style={{ color }}>{formatCurrency(value, currency)}</p>
                  </div>
                ))
              })()}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 pt-3" style={{ gridTemplateColumns: countries.length > 1 ? 'repeat(auto-fit, minmax(240px, 1fr))' : undefined }}>
              {countries.map(c => (
                <div key={c.code} className="rounded-lg px-5 py-4" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
                  <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-1)' }}>
                    <CountryFlag code={c.code} size={20} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{c.code}</span>
                  </div>
                  <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 sm:gap-3">
                    <MiniCard label={labels.total}    value={c.summary.total}    color="var(--text-1)"    currency={c.code} />
                    <MiniCard label={labels.positive} value={c.summary.positive} color="var(--green-400)" currency={c.code} />
                    <MiniCard label={labels.pending}  value={c.summary.pending}  color="var(--amber)"     currency={c.code} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Resumo por conta */}
          {accountSummary.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-3)' }}>Por conta ({accountSummary.length})</p>
              <AccountBreakdown items={accountSummary} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
