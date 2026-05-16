'use client'

import { useEffect, useState } from 'react'
import { billsToPayApi, cashReceivableApi } from '@/lib/api'
import { Spinner } from '@/components/ui'
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { BillToPay, CashReceivable } from '@/types'

interface ChartPoint {
  yearMonth: string
  label: string
  despesaEspanha: number
  investAcumEspanha: number
  saldoBrasil: number
}

const MONTHS: Record<string, number> = {
  Janeiro: 0, Fevereiro: 1, Março: 2, Abril: 3, Maio: 4, Junho: 5,
  Julho: 6, Agosto: 7, Setembro: 8, Outubro: 9, Novembro: 10, Dezembro: 11,
}

function ymToNum(ym: string): number {
  const [m, y] = ym.split('/')
  return parseInt(y) * 12 + (MONTHS[m] ?? 0)
}

function shortLabel(ym: string): string {
  const [m, y] = ym.split('/')
  return `${m.slice(0, 3)}/${y.slice(2)}`
}

function isEspanha(country?: string | null): boolean {
  return (country ?? '').trim().toLowerCase() === 'espanha'
}

function formatEur(v: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}
function formatBrl(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

function loadPlrName(): string {
  try {
    const raw = localStorage.getItem('finance_plr_config')
    if (raw) return JSON.parse(raw).name ?? ''
  } catch {}
  return 'PLR - Ciclo 2 - 2025 de méritocracia (encerrando 2025)'
}

function loadSaldoFinalYm(): string {
  try {
    const raw = localStorage.getItem('finance_plr_config')
    if (raw) return JSON.parse(raw).saldoFinalYm ?? ''
  } catch {}
  return ''
}

function loadContasBancariasTotal(): number {
  try {
    const raw = localStorage.getItem('finance_wallet')
    if (!raw) return 0
    const wallet = JSON.parse(raw)
    const group = wallet.groups?.find((g: any) =>
      g.label?.trim().toLowerCase() === 'contas bancárias' ||
      g.label?.trim().toLowerCase() === 'contas bancarias'
    )
    if (!group) return 0
    return (group.boxes ?? [])
      .filter((b: any) => b.currency === 'Brasil')
      .reduce((s: number, b: any) => s + (parseFloat(b.value) || 0), 0)
  } catch { return 0 }
}

function numToYm(n: number): string {
  const year = Math.floor(n / 12)
  const month = n % 12
  const monthName = Object.keys(MONTHS).find(k => MONTHS[k] === month)!
  return `${monthName}/${year}`
}

interface FinanceChartProps {
  monthsRange?: number
}

export function FinanceChart({ monthsRange = 12 }: FinanceChartProps) {
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const plrName = loadPlrName()

        const now = new Date()
        const curYm = now.getFullYear() * 12 + now.getMonth()
        const startYm = curYm - 3
        const endYm = curYm + monthsRange

        // ── Meses do gráfico ──────────────────────────────────────────────────
        const monthList: string[] = []
        for (let n = startYm; n <= endYm; n++) {
          monthList.push(numToYm(n))
        }

        // ── PLR: busca próximos 24 meses e soma manipulatedValue pelo nome ────
        let plrTotal = 0
        if (plrName) {
          const plrMonths: string[] = []
          for (let n = curYm; n <= curYm + 24; n++) {
            plrMonths.push(numToYm(n))
          }
          const plrResults = await Promise.all(
            plrMonths.map(ym =>
              cashReceivableApi.search({ yearMonth: ym, showDetails: false })
                .then(r => r.output?.data ?? [])
                .catch(() => [] as CashReceivable[])
            )
          )
          for (const recList of plrResults) {
            for (const r of recList as CashReceivable[]) {
              if (r.name?.trim() === plrName.trim()) {
                plrTotal += r.manipulatedValue ?? 0
              }
            }
          }
        }

        // ── SALDO FINAL = Total Contas Bancárias − PLR total ─────────────────
        const contasBancariasTotal = loadContasBancariasTotal()
        const saldoFinal = contasBancariasTotal - plrTotal
        const saldoFinalYm = loadSaldoFinalYm()

        // ── Dados mensais do gráfico ──────────────────────────────────────────
        const results = await Promise.all(
          monthList.map(async (ym) => {
            const [bills, rec] = await Promise.all([
              billsToPayApi.search({ yearMonth: ym, showDetails: false }),
              cashReceivableApi.search({ yearMonth: ym, showDetails: false }),
            ])
            return {
              ym,
              bills: bills.output?.data ?? [],
              rec: rec.output?.data ?? [],
            }
          })
        )

        if (cancelled) return

        let investAcum = 0

        const points: ChartPoint[] = results.map(({ ym, bills, rec }) => {
          const billsList = bills as BillToPay[]
          const recList = rec as CashReceivable[]

          // Despesa Espanha = todas as contas a pagar da Espanha (independente de hasPay)
          const despesaEspanha = billsList
            .filter(b => isEspanha(b.country))
            .reduce((s, b) => s + (b.value ?? 0), 0)

          // Receita Espanha (para acumular investimento)
          const receitaEspanha = recList
            .filter(r => isEspanha(r.country))
            .reduce((s, r) => s + (r.value ?? 0), 0)

          investAcum += (receitaEspanha - despesaEspanha)

          // Despesa Brasil = contas a pagar Brasil onde hasPay === false
          const despesaBR = billsList
            .filter(b => !isEspanha(b.country) && !b.hasPay)
            .reduce((s, b) => s + (b.value ?? 0), 0)

          // Receita Brasil = manipulatedValue dos recebíveis Brasil do mês
          // + Saldo Final da Carteira APENAS no mês corrente (equivale ao J8 do Excel)
          const receitaBR = recList
            .filter(r => !isEspanha(r.country))
            .reduce((s, r) => s + (r.manipulatedValue ?? 0), 0)

          const isCurrentMonth = saldoFinalYm ? ym === saldoFinalYm : false
          const saldoBrasil = (receitaBR + (isCurrentMonth ? saldoFinal : 0)) - despesaBR

          return {
            yearMonth: ym,
            label: shortLabel(ym),
            despesaEspanha,
            investAcumEspanha: investAcum,
            saldoBrasil,
          }
        })

        setData(points)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [monthsRange])

  if (loading) {
    return (
      <div className="card flex items-center justify-center" style={{ minHeight: 400 }}>
        <Spinner size={32} />
      </div>
    )
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
              {p.dataKey === 'saldoBrasil' ? formatBrl(p.value) : formatEur(p.value)}
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
          Evolução Financeira
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
          Despesa Espanha (€), Investimento Acumulado (€) e Saldo Brasil (R$) — próximos {monthsRange} meses
        </p>
      </div>

      <div style={{ width: '100%', height: 360 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" opacity={0.4} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--text-3)' }}
              stroke="var(--border-2)"
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: 'var(--text-3)' }}
              stroke="var(--border-2)"
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
              label={{ value: '€', angle: 0, position: 'insideTopLeft', fill: 'var(--text-3)', fontSize: 11 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: 'var(--text-3)' }}
              stroke="var(--border-2)"
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
              label={{ value: 'R$', angle: 0, position: 'insideTopRight', fill: 'var(--text-3)', fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />

            <Area
              yAxisId="left"
              type="monotone"
              dataKey="despesaEspanha"
              name="Despesa Espanha (€)"
              fill="#dc2626"
              fillOpacity={0.4}
              stroke="#dc2626"
              strokeWidth={1.5}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="investAcumEspanha"
              name="Acumulado Invest. Espanha (€)"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="saldoBrasil"
              name="Saldo Brasil (R$)"
              stroke="#16a34a"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
