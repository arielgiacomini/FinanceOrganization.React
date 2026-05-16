'use client'

import { useEffect, useState } from 'react'
import { billsToPayApi, cashReceivableApi } from '@/lib/api'
import { formatCurrency, formatYearMonth, currentYearMonth } from '@/lib/utils'
import type { BillToPay, CashReceivable } from '@/types'
import { PageHeader, Spinner, Table, Tr, Td } from '@/components/ui'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'
import { normalizeCountry } from '@/components/ui/CountryTabs'
import { ArrowUpCircle, ArrowDownCircle, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/AppLayout'
import { FinanceChart } from '@/components/ui/FinanceChart'

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</span>
      <span className="text-lg font-semibold" style={{ color }}>{value}</span>
    </div>
  )
}

interface CountryBlockProps {
  flag: React.ReactNode
  country: string
  bills: BillToPay[]
  receivables: CashReceivable[]
  currency: string
}

function CountryBlock({ flag, country, bills, receivables, currency }: CountryBlockProps) {
  const totalBills      = bills.reduce((s, b) => s + b.value, 0)
  const paidBills       = bills.filter((b) => b.hasPay)
  const pendingBills    = bills.filter((b) => !b.hasPay)
  const totalReceivable = receivables.reduce((s, r) => s + r.value, 0)
  const totalReceived   = receivables.filter((r) => r.hasReceived).reduce((s, r) => s + r.value, 0)
  const balance         = totalReceivable - totalBills

  return (
    <div className="card overflow-hidden">
      {/* Header do país */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-3)' }}
      >
        {flag}
        <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{country}</span>
      </div>

      {/* Stats do país */}
      <div className="grid grid-cols-5 gap-0 divide-x" style={{ borderBottom: '1px solid var(--border-1)' }}>
        {[
          { label: 'A Pagar',   value: formatCurrency(totalBills, currency),      color: 'var(--red)',        icon: <ArrowUpCircle size={12} /> },
          { label: 'A Receber', value: formatCurrency(totalReceivable, currency),  color: 'var(--green-400)',  icon: <ArrowDownCircle size={12} /> },
          { label: 'Saldo',     value: formatCurrency(balance, currency),          color: balance >= 0 ? 'var(--green-400)' : 'var(--red)', icon: <TrendingUp size={12} /> },
          { label: 'Pagos',     value: `${paidBills.length}/${bills.length}`,      color: 'var(--text-2)',     icon: <CheckCircle2 size={12} /> },
          { label: 'Pendentes', value: String(pendingBills.length),                color: 'var(--amber)',      icon: <AlertCircle size={12} /> },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="px-4 py-3 flex flex-col gap-1" style={{ borderColor: 'var(--border-1)' }}>
            <div className="flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
              {icon}
              <span className="text-xs">{label}</span>
            </div>
            <span className="text-sm font-semibold" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Tabelas lado a lado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x" style={{ borderColor: 'var(--border-1)' }}>
        {/* Pendentes a pagar */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
              Pendentes a Pagar
            </h3>
            <Link href="/contas-a-pagar" className="text-xs" style={{ color: 'var(--green-400)' }}>
              Ver tudo →
            </Link>
          </div>
          {pendingBills.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--text-3)' }}>✓ Tudo pago</p>
          ) : (
            <div className="space-y-2">
              {pendingBills.slice(0, 5).map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                  style={{ background: 'var(--bg-3)' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-1)' }}>{b.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{b.account}</p>
                  </div>
                  <span className="text-xs font-mono font-semibold ml-3 flex-shrink-0" style={{ color: 'var(--red)' }}>
                    {formatCurrency(b.value, currency)}
                  </span>
                </div>
              ))}
              {pendingBills.length > 5 && (
                <p className="text-xs text-center pt-1" style={{ color: 'var(--text-3)' }}>
                  +{pendingBills.length - 5} mais
                </p>
              )}
            </div>
          )}
        </div>

        {/* A receber */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
              A Receber
            </h3>
            <Link href="/contas-a-receber" className="text-xs" style={{ color: 'var(--green-400)' }}>
              Ver tudo →
            </Link>
          </div>
          {receivables.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--text-3)' }}>Sem registros</p>
          ) : (
            <div className="space-y-2">
              {receivables.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                  style={{ background: 'var(--bg-3)' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-1)' }}>{r.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{r.account}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className="text-xs font-mono font-semibold" style={{ color: 'var(--green-400)' }}>
                      {formatCurrency(r.value, currency)}
                    </span>
                    {r.hasReceived
                      ? <CheckCircle2 size={12} style={{ color: 'var(--green-400)' }} />
                      : <AlertCircle size={12} style={{ color: 'var(--amber)' }} />}
                  </div>
                </div>
              ))}
              {receivables.length > 5 && (
                <p className="text-xs text-center pt-1" style={{ color: 'var(--text-3)' }}>
                  +{receivables.length - 5} mais
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DashboardPageInner() {
  const ym = currentYearMonth()
  const [bills, setBills] = useState<BillToPay[]>([])
  const [receivables, setReceivables] = useState<CashReceivable[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      billsToPayApi.search({ yearMonth: ym, showDetails: true }),
      cashReceivableApi.search({ yearMonth: ym, showDetails: true }),
    ]).then(([b, r]) => {
      setBills(b.output?.data ?? [])
      setReceivables(r.output?.data ?? [])
    }).finally(() => setLoading(false))
  }, [ym])

  // Quando country não vier da API, assume Brasil como padrão
  const getCountry = (country?: string | null) => normalizeCountry(country) === 'Espanha' ? 'Espanha' : 'Brasil'
  const brasilBills        = bills.filter(b => getCountry(b.country) === 'Brasil')
  const espanhaBills       = bills.filter(b => getCountry(b.country) === 'Espanha')
  const brasilReceivables  = receivables.filter(r => getCountry(r.country) === 'Brasil')
  const espanhaReceivables = receivables.filter(r => getCountry(r.country) === 'Espanha')

  // Saldo global convertido (apenas ilustrativo, sem taxa de câmbio)
  const totalPagar    = bills.reduce((s, b) => s + b.value, 0)
  const totalReceber  = receivables.reduce((s, r) => s + r.value, 0)
  const pendingCount  = bills.filter(b => !b.hasPay).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Dashboard"
        subtitle={`Resumo de ${formatYearMonth(ym)}`}
      />

      {/* Resumo global */}
      <div
        className="card px-4 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 lg:px-6 lg:gap-6"
        style={{ borderColor: 'var(--border-2)' }}
      >
        <StatMini
          label="Total a Pagar (todos os países)"
          value={`${bills.length} lançamentos`}
          color="var(--text-2)"
        />
        <StatMini
          label="Contas pendentes"
          value={String(pendingCount)}
          color={pendingCount > 0 ? 'var(--amber)' : 'var(--green-400)'}
        />
        <StatMini
          label="Total a Receber (todos os países)"
          value={`${receivables.length} lançamentos`}
          color="var(--text-2)"
        />
      </div>

      {/* Gráfico de Evolução Financeira */}
      <FinanceChart monthsRange={12} />

      {/* Brasil */}
      <CountryBlock
        flag={<FlagBrasil size={22} />}
        country="Brasil"
        bills={brasilBills}
        receivables={brasilReceivables}
        currency="Brasil"
      />

      {/* Espanha */}
      <CountryBlock
        flag={<FlagEspanha size={22} />}
        country="Espanha"
        bills={espanhaBills}
        receivables={espanhaReceivables}
        currency="Espanha"
      />
    </div>
  )
}

export default function DashboardPage() {
  return <AppLayout><DashboardPageInner /></AppLayout>
}
