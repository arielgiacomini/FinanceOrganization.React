'use client'

import { useEffect, useState } from 'react'
import { billsToPayApi, cashReceivableApi } from '@/lib/api'
import { formatYearMonth, currentYearMonth } from '@/lib/utils'
import type { BillToPay, CashReceivable } from '@/types'
import { PageHeader, Spinner } from '@/components/ui'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { FinanceChart } from '@/components/ui/FinanceChart'
import { InvestmentChart } from '@/components/ui/InvestmentChart'

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

  const totalBills   = bills.length
  const pendingCount = bills.filter(b => !b.hasPay).length
  const paidCount    = bills.filter(b => b.hasPay).length
  const totalRec     = receivables.length
  const receivedCount = receivables.filter(r => r.hasReceived).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader title="Dashboard" subtitle={`Resumo de ${formatYearMonth(ym)}`} />

      {/* Resumo rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Lançamentos a Pagar',  value: String(totalBills),                      color: 'var(--text-2)',    icon: null },
          { label: 'Pendentes de pagar',   value: String(pendingCount),                    color: pendingCount > 0 ? 'var(--amber)' : 'var(--green-400)', icon: pendingCount > 0 ? <AlertCircle size={14} /> : <CheckCircle2 size={14} /> },
          { label: 'Já pagos',             value: String(paidCount),                       color: 'var(--green-400)', icon: <CheckCircle2 size={14} /> },
          { label: 'A Receber',            value: `${receivedCount} / ${totalRec}`,        color: 'var(--green-400)', icon: null },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="card px-4 py-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
              {icon}
              <span className="text-xs">{label}</span>
            </div>
            <span className="text-lg font-semibold" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Gráfico de Evolução Financeira */}
      <FinanceChart monthsRange={12} />

      {/* Gráfico de Projeção de Investimentos */}
      <InvestmentChart />
    </div>
  )
}

export default function DashboardPage() {
  return <AppLayout><DashboardPageInner /></AppLayout>
}
