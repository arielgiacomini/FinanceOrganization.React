'use client'

import { formatCurrency } from '@/lib/utils'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'
import type { CountryFilter } from '@/components/ui/CountryTabs'

interface CountrySummary {
  total: number
  positive: number  // pago (bills) ou recebido (receivables)
  pending: number
}

interface SummaryCardsProps {
  countryFilter: CountryFilter
  brasil: CountrySummary
  espanha: CountrySummary
  labels: { total: string; positive: string; pending: string }
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

export function SummaryCards({ countryFilter, brasil, espanha, labels }: SummaryCardsProps) {
  // Filtro único — 3 cards simples
  if (countryFilter !== 'Todos') {
    const data = countryFilter === 'Brasil' ? brasil : espanha
    const currency = countryFilter
    return (
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
    )
  }

  // Todos — dois cards lado a lado, cada um com resumo do país
  return (
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
  )
}
