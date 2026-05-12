'use client'

import { useEffect, useState, useCallback } from 'react'
import { billsToPayApi } from '@/lib/api'
import { formatCurrency, formatYearMonth, currentYearMonth } from '@/lib/utils'
import type { MonthlyAverage } from '@/types'
import { PageHeader, Spinner, Empty } from '@/components/ui'
import { YearMonthSelector } from '@/components/ui/YearMonthSelector'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'

function AnalisePageInner() {
  const [ym, setYm] = useState(currentYearMonth())
  const [data, setData] = useState<MonthlyAverage[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await billsToPayApi.monthlyAverage({ yearMonth: ym })
      setData(res.output?.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [ym])

  useEffect(() => { load() }, [load])

  const maxValue = Math.max(...data.map((d) => d.totalValue), 1)

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Análise Financeira"
        subtitle="Média mensal de gastos"
        action={<YearMonthSelector value={ym} onChange={setYm} />}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : data.length === 0 ? (
        <Empty message="Sem dados para este período." />
      ) : (
        <div className="space-y-3">
          {data.map((d, i) => {
            const prev = data[i + 1]
            const diff = prev ? d.totalValue - prev.totalValue : 0
            const pct = (d.totalValue / maxValue) * 100

            return (
              <div key={d.yearMonth} className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                      {formatYearMonth(d.yearMonth)}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {d.count} lançamento(s) · média {formatCurrency(d.averageValue)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold font-mono" style={{ color: 'var(--text-1)' }}>
                      {formatCurrency(d.totalValue)}
                    </p>
                    {prev && (
                      <div className="flex items-center justify-end gap-1 mt-0.5 text-xs">
                        {diff > 0
                          ? <><TrendingUp size={12} style={{ color: 'var(--red)' }} /><span style={{ color: 'var(--red)' }}>+{formatCurrency(diff)}</span></>
                          : diff < 0
                          ? <><TrendingDown size={12} style={{ color: 'var(--green-400)' }} /><span style={{ color: 'var(--green-400)' }}>{formatCurrency(diff)}</span></>
                          : <><Minus size={12} style={{ color: 'var(--text-3)' }} /><span style={{ color: 'var(--text-3)' }}>Igual</span></>
                        }
                      </div>
                    )}
                  </div>
                </div>

                {/* Bar */}
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-4)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: 'var(--green-500)',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function AnalisePage() {
  return <AppLayout><AnalisePageInner /></AppLayout>
}
