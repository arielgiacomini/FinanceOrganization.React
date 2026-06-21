'use client'

import { useEffect, useState, useMemo } from 'react'
import { walletApi } from '@/lib/api'
import {
  loadNomeGrupoInvestimento,
  loadInvestimentoAnosProjecao,
  loadInvestimentoTotal,
  loadInvestimentoBoxes,
} from '@/lib/wallet'
import { Spinner } from '@/components/ui'
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface ChartPoint {
  label: string
  totalBrl: number
  totalEur: number
}

function shortLabel(month: number, year: number): string {
  return `${MONTHS_PT[month].slice(0, 3)}/${String(year).slice(2)}`
}

function formatBrl(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
}

function formatEur(v: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
}

export function InvestmentChart() {
  const [loading, setLoading] = useState(true)
  const [totals, setTotals] = useState<{ brl: number; eur: number }>({ brl: 0, eur: 0 })
  const [boxes, setBoxes] = useState<Array<{ label: string; value: number; currency: string }>>([])
  const [grupoNome, setGrupoNome] = useState('')
  const [anosProjecao, setAnosProjecao] = useState(5)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        try {
          const res = await walletApi.search()
          const records = res.output?.data ?? []
          for (const rec of records) {
            if (rec.walletKey === 'finance_wallet' && rec.walletValue) {
              localStorage.setItem('finance_wallet', rec.walletValue)
            }
            if (rec.walletKey === 'finance_plr_config' && rec.walletValue) {
              localStorage.setItem('finance_plr_config', rec.walletValue)
            }
          }
        } catch {}

        if (cancelled) return

        setGrupoNome(loadNomeGrupoInvestimento())
        setAnosProjecao(loadInvestimentoAnosProjecao())
        setTotals(loadInvestimentoTotal())
        setBoxes(loadInvestimentoBoxes())
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const data = useMemo(() => {
    const now = new Date()
    const startMonth = now.getMonth()
    const startYear = now.getFullYear()
    const totalMonths = anosProjecao * 12

    const points: ChartPoint[] = []
    for (let i = 0; i <= totalMonths; i++) {
      const m = (startMonth + i) % 12
      const y = startYear + Math.floor((startMonth + i) / 12)
      points.push({
        label: shortLabel(m, y),
        totalBrl: totals.brl,
        totalEur: totals.eur,
      })
    }
    return points
  }, [totals, anosProjecao])

  const [hiddenLines, setHiddenLines] = useState<Record<string, boolean>>({})

  if (loading) {
    return (
      <div className="card flex items-center justify-center" style={{ minHeight: 300 }}>
        <Spinner size={32} />
      </div>
    )
  }

  if (totals.brl === 0 && totals.eur === 0) {
    return (
      <div className="card p-4 lg:p-5">
        <div className="mb-3">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
            Projeção de Investimentos
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            Nenhum dado encontrado no grupo &quot;{grupoNome}&quot; da Carteira.
          </p>
        </div>
      </div>
    )
  }

  const hasBrl = totals.brl > 0
  const hasEur = totals.eur > 0

  const LINES = [
    ...(hasBrl ? [{ key: 'totalBrl', name: `Investimento (R$)`, color: '#16a34a' }] : []),
    ...(hasEur ? [{ key: 'totalEur', name: `Investimento (€)`, color: '#3b82f6' }] : []),
  ]

  function toggleLine(key: string) {
    setHiddenLines(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload || !payload.length) return null
    return (
      <div
        className="rounded-lg px-3 py-2 text-xs"
        style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
      >
        <p className="font-semibold mb-1.5" style={{ color: 'var(--text-1)' }}>{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 my-0.5">
            <span style={{ width: 8, height: 8, background: p.color, borderRadius: '50%', display: 'inline-block' }} />
            <span style={{ color: 'var(--text-3)' }}>{p.name}:</span>
            <span className="font-mono font-medium" style={{ color: 'var(--text-1)' }}>
              {p.dataKey === 'totalBrl' ? formatBrl(p.value) : formatEur(p.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="card p-4 lg:p-5">
      <div className="mb-3">
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
          Projeção de Investimentos
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
          Grupo &quot;{grupoNome}&quot; — valor atual projetado por {anosProjecao} {anosProjecao === 1 ? 'ano' : 'anos'}
        </p>
      </div>

      {/* Resumo das caixinhas */}
      <div className="flex flex-wrap gap-2 mb-4">
        {boxes.filter(b => b.value > 0).map((b, i) => (
          <div
            key={i}
            className="rounded-lg px-3 py-2"
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}
          >
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>{b.label}</p>
            <p className="font-mono font-semibold text-sm" style={{ color: b.currency === 'Espanha' ? 'var(--amber)' : 'var(--green-400)' }}>
              {b.currency === 'Espanha' ? formatEur(b.value) : formatBrl(b.value)}
            </p>
          </div>
        ))}
      </div>

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" opacity={0.4} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--text-3)' }}
              stroke="var(--border-2)"
              interval="preserveStartEnd"
            />
            {hasBrl && (
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: 'var(--text-3)' }}
                stroke="var(--border-2)"
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
                label={{ value: 'R$', angle: 0, position: 'insideTopLeft', fill: 'var(--text-3)', fontSize: 11 }}
              />
            )}
            {hasEur && (
              <YAxis
                yAxisId={hasBrl ? 'right' : 'left'}
                orientation={hasBrl ? 'right' : 'left'}
                tick={{ fontSize: 10, fill: 'var(--text-3)' }}
                stroke="var(--border-2)"
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
                label={{ value: '€', angle: 0, position: hasBrl ? 'insideTopRight' : 'insideTopLeft', fill: 'var(--text-3)', fontSize: 11 }}
              />
            )}
            <Tooltip content={<CustomTooltip />} />

            {hasBrl && !hiddenLines['totalBrl'] && (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="totalBrl"
                name="Investimento (R$)"
                fill="#16a34a"
                fillOpacity={0.15}
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
            {hasEur && !hiddenLines['totalEur'] && (
              <Line
                yAxisId={hasBrl ? 'right' : 'left'}
                type="monotone"
                dataKey="totalEur"
                name="Investimento (€)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap justify-center gap-3 pt-3">
        {LINES.map(({ key, name, color }) => {
          const hidden = !!hiddenLines[key]
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleLine(key)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-opacity"
              style={{
                background: 'var(--bg-3)',
                border: `1px solid ${hidden ? 'var(--border-1)' : color}`,
                opacity: hidden ? 0.4 : 1,
                cursor: 'pointer',
                color: 'var(--text-2)',
              }}
            >
              <span style={{ width: 10, height: 2, background: hidden ? 'var(--text-3)' : color, display: 'inline-block', borderRadius: 1 }} />
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
