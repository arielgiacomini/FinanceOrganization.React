'use client'

import { useEffect, useState } from 'react'
import { formatYearMonth, currentYearMonth } from '@/lib/utils'
import { loadSaldoFinalYm } from '@/lib/wallet'
import { PageHeader } from '@/components/ui'
import { AppLayout } from '@/components/layout/AppLayout'
import { FinanceChart } from '@/components/ui/FinanceChart'
import { InvestmentChart } from '@/components/ui/InvestmentChart'
import { DailyExpenseChart } from '@/components/ui/DailyExpenseChart'
import { WeeklySpendingSummary } from '@/components/ui/WeeklySpendingSummary'

function DashboardPageInner() {
  const [ym, setYm] = useState(currentYearMonth())

  useEffect(() => {
    const configured = loadSaldoFinalYm()
    setYm(configured || currentYearMonth())
  }, [])

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader title="Dashboard" subtitle={`Resumo de ${formatYearMonth(ym)}`} />

      {/* Resumo semanal de gastos */}
      <WeeklySpendingSummary />

      {/* Gráfico de Evolução Financeira */}
      <FinanceChart monthsRange={12} />

      {/* Despesas por dia / mês */}
      <DailyExpenseChart />

      {/* Gráfico de Projeção de Investimentos */}
      <InvestmentChart />
    </div>
  )
}

export default function DashboardPage() {
  return <AppLayout><DashboardPageInner /></AppLayout>
}
