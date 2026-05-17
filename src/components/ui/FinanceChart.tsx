'use client'

import { useEffect, useState } from 'react'
import { billsToPayApi, cashReceivableApi } from '@/lib/api'
import {
  loadPlrName,
  loadSaldoFinalYm,
  loadValeCategoria,
  loadNomeGrupoEspanha,
  loadContasBancariasTotal,
  loadContasBancariasEspanha,
  loadGruposNomes,
} from '@/lib/wallet'
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
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
}
function formatBrl(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
}





function numToYm(n: number): string {
  const year = Math.floor(n / 12)
  const month = n % 12
  const monthName = Object.keys(MONTHS).find(k => MONTHS[k] === month)!
  return `${monthName}/${year}`
}

interface CalcSnapshot {
  plrName: string
  plrTotal: number
  contasBancariasTotal: number
  saldoFinal: number
  saldoFinalYm: string
  valeRefeicaoTotal: number
  contasBancariasEspanha: number
  nomeGrupoEspanha: string
  gruposEncontrados: string[]
  despesaEspanhaTotal: number
}

interface FinanceChartProps {
  monthsRange?: number
}

export function FinanceChart({ monthsRange = 12 }: FinanceChartProps) {
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [calc, setCalc] = useState<CalcSnapshot | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const plrName = loadPlrName()

        const now = new Date()
        const curYm = now.getFullYear() * 12 + now.getMonth()

        // Ponto de início: saldoFinalYm configurado ou 3 meses atrás
        const sfYmStr = loadSaldoFinalYm()
        const startYm = sfYmStr ? ymToNum(sfYmStr) : curYm - 3
        // Range: até 5 anos a frente do ponto de início
        const endYm = startYm + 12 * 5

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
        const valeCategoria = loadValeCategoria()

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

        const nomeGrupoEspanha = loadNomeGrupoEspanha()
        const contasBancariasEspanha = loadContasBancariasEspanha()

        // Nomes dos grupos da Carteira (para debug no painel)
        const gruposEncontrados = loadGruposNomes()

        // Acumulado Espanha: começa com o saldo total do grupo e vai diminuindo conforme despesas
        let despesaEspanhaAcum = 0

        const points: ChartPoint[] = results.map(({ ym, bills, rec }) => {
          const billsList = bills as BillToPay[]
          const recList = rec as CashReceivable[]

          // Despesa Espanha = contas a pagar da Espanha não pagas
          const despesaEspanha = billsList
            .filter(b => isEspanha(b.country) && !b.hasPay)
            .reduce((s, b) => s + (b.value ?? 0), 0)

          despesaEspanhaAcum += despesaEspanha

          // Acumulado = saldo inicial da carteira Espanha − todas as despesas até este mês
          const investAcumEspanha = contasBancariasEspanha - despesaEspanhaAcum

          // Despesa Brasil = contas a pagar Brasil onde hasPay === false
          const despesaBR = billsList
            .filter(b => !isEspanha(b.country) && !b.hasPay)
            .reduce((s, b) => s + (b.value ?? 0), 0)

          // Receita Brasil = manipulatedValue dos recebíveis Brasil do mês
          // + Saldo Final da Carteira APENAS no mês configurado (equivale ao J8 do Excel)
          // + Vale Alimentação/Refeição APENAS no mês configurado (categoria DSC_CATEGORIA = F8)
          const receitaBR = recList
            .filter(r => !isEspanha(r.country))
            .reduce((s, r) => s + (r.manipulatedValue ?? 0), 0)

          const isConfiguredMonth = saldoFinalYm ? ym === saldoFinalYm : false

          const valeRefeicaoBR = isConfiguredMonth
            ? recList
                .filter(r => !isEspanha(r.country) && r.category?.trim() === valeCategoria.trim())
                .reduce((s, r) => s + (r.manipulatedValue ?? 0), 0)
            : 0

          const saldoBrasil = (receitaBR + (isConfiguredMonth ? saldoFinal : 0) + valeRefeicaoBR) - despesaBR

          return {
            yearMonth: ym,
            label: shortLabel(ym),
            despesaEspanha,
            investAcumEspanha,
            saldoBrasil,
          }
        })

        // ── Snapshot para o painel de memória de cálculo ────────────────────
        const configuredResult = results.find(r => r.ym === saldoFinalYm)
        const valeRefeicaoTotal = configuredResult
          ? (configuredResult.rec as CashReceivable[])
              .filter(r => !isEspanha(r.country) && r.category?.trim() === valeCategoria.trim())
              .reduce((s, r) => s + (r.manipulatedValue ?? 0), 0)
          : 0
        // Soma total das despesas Espanha em todos os meses carregados (para exibir no painel)
        const despesaEspanhaTotal = results.reduce((s, { bills }) =>
          s + (bills as BillToPay[])
            .filter(b => isEspanha(b.country) && !b.hasPay)
            .reduce((ss, b) => ss + (b.value ?? 0), 0), 0)
        setCalc({ plrName, plrTotal, contasBancariasTotal, saldoFinal, saldoFinalYm, valeRefeicaoTotal, contasBancariasEspanha, nomeGrupoEspanha, gruposEncontrados, despesaEspanhaTotal })

        setData(points)

        // Inicializa slicers: todos os meses, ano atual + próximo por padrão
        setSelectedMonths(new Set(Object.values(MONTHS)))
        setSelectedYears(new Set([now.getFullYear(), now.getFullYear() + 1]))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [monthsRange])

  const [hiddenLines, setHiddenLines] = useState<Record<string, boolean>>({})
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set())
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set())

  if (loading) {
    return (
      <div className="card flex items-center justify-center" style={{ minHeight: 400 }}>
        <Spinner size={32} />
      </div>
    )
  }

  // Anos disponíveis: do ano do saldoFinalYm configurado até +5 anos
  const sfYmForYears = loadSaldoFinalYm()
  const baseYear = sfYmForYears ? parseInt(sfYmForYears.split('/')[1]) : new Date().getFullYear()
  const availableYears = Array.from({ length: 6 }, (_, i) => baseYear + i)
  const MONTH_NAMES = Object.keys(MONTHS)
  const availableMonths = Array.from({ length: 12 }, (_, i) => i)

  function toggleYear(y: number) {
    setSelectedYears(prev => {
      const next = new Set(prev)
      next.has(y) ? next.delete(y) : next.add(y)
      return next.size === 0 ? prev : next // impede desselecionar tudo
    })
  }

  function toggleMonth(m: number) {
    setSelectedMonths(prev => {
      const next = new Set(prev)
      next.has(m) ? next.delete(m) : next.add(m)
      return next.size === 0 ? prev : next
    })
  }

  // Filtra pontos conforme slicers
  const filteredData = (selectedYears.size === 0 && selectedMonths.size === 0)
    ? data
    : data.filter(d => {
        const [mName, yStr] = d.yearMonth.split('/')
        const y = parseInt(yStr)
        const m = MONTHS[mName] ?? 0
        const yearOk = selectedYears.size === 0 || selectedYears.has(y)
        const monthOk = selectedMonths.size === 0 || selectedMonths.has(m)
        return yearOk && monthOk
      })

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

  function toggleLine(key: string) {
    setHiddenLines(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function CustomLabel({ x, y, value, dataKey }: any) {
    if (!value || value === 0) return null
    const isBrl = dataKey === 'saldoBrasil'
    const label = isBrl ? `R$${value.toFixed(2)}` : `€${value.toFixed(2)}`
    return (
      <text x={x} y={Number(y) - 6} textAnchor="middle" fontSize={10} fill={value < 0 ? '#dc2626' : '#9ca3af'}>
        {label}
      </text>
    )
  }

  const LINES = [
    { key: 'despesaEspanha',    name: 'Despesa Espanha (€)',          color: '#dc2626' },
    { key: 'investAcumEspanha', name: 'Acumulado Invest. Espanha (€)', color: '#3b82f6' },
    { key: 'saldoBrasil',       name: 'Saldo Brasil (R$)',             color: '#16a34a' },
  ]

  function CustomLegend() {
    return (
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
          <ComposedChart data={filteredData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
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

            {!hiddenLines['despesaEspanha'] && (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="despesaEspanha"
                name="Despesa Espanha (€)"
                fill="#dc2626"
                fillOpacity={0.4}
                stroke="#dc2626"
                strokeWidth={1.5}
                label={<CustomLabel dataKey="despesaEspanha" />}
              />
            )}
            {!hiddenLines['investAcumEspanha'] && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="investAcumEspanha"
                name="Acumulado Invest. Espanha (€)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                label={<CustomLabel dataKey="investAcumEspanha" />}
              />
            )}
            {!hiddenLines['saldoBrasil'] && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="saldoBrasil"
                name="Saldo Brasil (R$)"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                label={<CustomLabel dataKey="saldoBrasil" />}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Slicers — Anos e Meses */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Anos */}
        <div>
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-3)', fontSize: 10 }}>Anos</p>
          <div className="flex flex-wrap gap-1.5">
            {availableYears.map(y => {
              const active = selectedYears.has(y)
              return (
                <button key={y} type="button" onClick={() => toggleYear(y)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: active ? 'var(--green-400)' : 'var(--bg-3)',
                    color: active ? '#fff' : 'var(--text-2)',
                    border: `1px solid ${active ? 'var(--green-400)' : 'var(--border-1)'}`,
                  }}>
                  {y}
                </button>
              )
            })}
          </div>
        </div>
        {/* Meses */}
        <div>
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-3)', fontSize: 10 }}>Meses</p>
          <div className="flex flex-wrap gap-1.5">
            {availableMonths.map(m => {
              const active = selectedMonths.has(m)
              const name = MONTH_NAMES[m]?.slice(0, 3) ?? ''
              return (
                <button key={m} type="button" onClick={() => toggleMonth(m)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: active ? 'var(--green-400)' : 'var(--bg-3)',
                    color: active ? '#fff' : 'var(--text-2)',
                    border: `1px solid ${active ? 'var(--green-400)' : 'var(--border-1)'}`,
                  }}>
                  {name}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <CustomLegend />
      {/* Painel de memória de cálculo */}
      {calc && (
        <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-1)' }}>
          {/* Header */}
          <div className="px-4 py-2.5 flex items-center gap-2"
            style={{ background: 'var(--bg-3)', borderBottom: '1px solid var(--border-1)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
              🧮 Memória de Cálculo
            </span>
          </div>

          <div className="p-4 space-y-4 text-xs" style={{ background: 'var(--bg-2)' }}>

            {/* ── Bloco A: Acumulado Investimento Espanha ── */}
            <div className="space-y-2">
              <p className="font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)', fontSize: 10 }}>
                A. Acumulado Investimento Espanha (€)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                  <p style={{ color: 'var(--text-3)' }}>
                    Saldo inicial
                    {calc.nomeGrupoEspanha && (
                      <span className="block mt-0.5" style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 10 }}>
                        grupo "{calc.nomeGrupoEspanha}"
                      </span>
                    )}
                  </p>
                  <p className="font-mono font-semibold mt-0.5" style={{ color: calc.contasBancariasEspanha === 0 ? 'var(--red)' : 'var(--text-1)' }}>
                    {calc.contasBancariasEspanha === 0 ? '⚠ Grupo não encontrado' : formatEur(calc.contasBancariasEspanha)}
                  </p>
                </div>
                <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                  <p style={{ color: 'var(--text-3)' }}>Total despesas Espanha</p>
                  <p className="font-mono font-semibold mt-0.5" style={{ color: 'var(--red)' }}>
                    − {formatEur(calc.despesaEspanhaTotal)}
                  </p>
                </div>
                <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid rgba(59,130,246,0.3)' }}>
                  <p style={{ color: 'var(--text-3)' }}>Saldo projetado (final do período)</p>
                  <p className="font-mono font-bold mt-0.5" style={{ color: (calc.contasBancariasEspanha - calc.despesaEspanhaTotal) >= 0 ? '#3b82f6' : 'var(--red)' }}>
                    = {formatEur(calc.contasBancariasEspanha - calc.despesaEspanhaTotal)}
                  </p>
                </div>
              </div>
              {calc.contasBancariasEspanha === 0 && calc.gruposEncontrados.length > 0 && (
                <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)' }}>
                  <p className="font-semibold mb-1" style={{ color: 'var(--red)', fontSize: 10 }}>
                    Grupos encontrados na Carteira (configure o nome exato em Carteira → Configurações do Gráfico):
                  </p>
                  {calc.gruposEncontrados.map((g, i) => (
                    <p key={i} className="font-mono" style={{ color: 'var(--text-2)', fontSize: 10 }}>"{g}"</p>
                  ))}
                </div>
              )}
              <div className="rounded-lg px-4 py-3 font-mono text-xs leading-relaxed"
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                <span style={{ color: '#3b82f6' }}>Acumulado Espanha (mês N)</span>
                <span style={{ color: 'var(--text-3)' }}> = </span>
                <span style={{ color: 'var(--text-1)' }}>Saldo inicial</span>
                <span style={{ color: 'var(--text-3)' }}> − </span>
                <span style={{ color: 'var(--red)' }}>Σ Despesa Espanha (meses 1…N)</span>
                <br />
                <span style={{ color: 'var(--text-3)', fontSize: 10 }}>
                  Saldo inicial = soma das caixinhas do grupo "{calc.nomeGrupoEspanha || 'Conta Bancária Espanha'}" na Carteira
                </span>
                <br />
                <span style={{ color: 'var(--text-3)', fontSize: 10 }}>
                  Despesa Espanha = Σ value (contas a pagar com país = Espanha, não pagas)
                </span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-1)' }} />

            {/* ── Bloco B: Saldo Brasil ── */}
            <div className="space-y-2">
              <p className="font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)', fontSize: 10 }}>
                B. Saldo Brasil (R$)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                  <p style={{ color: 'var(--text-3)' }}>Total Contas Bancárias BR</p>
                  <p className="font-mono font-semibold mt-0.5" style={{ color: 'var(--text-1)' }}>
                    {formatBrl(calc.contasBancariasTotal)}
                  </p>
                </div>
                <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                  <p style={{ color: 'var(--text-3)' }}>
                    PLR — Empréstimo próximos meses
                    {calc.plrName && (
                      <span className="block truncate mt-0.5" style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 10 }}>
                        "{calc.plrName}"
                      </span>
                    )}
                  </p>
                  <p className="font-mono font-semibold mt-0.5" style={{ color: 'var(--red)' }}>
                    − {formatBrl(calc.plrTotal)}
                  </p>
                </div>
                <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid rgba(22,163,74,0.3)' }}>
                  <p style={{ color: 'var(--text-3)' }}>
                    Saldo Final
                    {calc.saldoFinalYm && (
                      <span className="ml-1" style={{ color: 'var(--blue)' }}>({calc.saldoFinalYm})</span>
                    )}
                  </p>
                  <p className="font-mono font-bold mt-0.5" style={{ color: calc.saldoFinal >= 0 ? 'var(--green-400)' : 'var(--red)' }}>
                    = {formatBrl(calc.saldoFinal)}
                  </p>
                </div>
              </div>
              {calc.saldoFinalYm && calc.valeRefeicaoTotal > 0 && (
                <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                  <p style={{ color: 'var(--text-3)' }}>
                    Vale Alimentação/Refeição
                    <span className="ml-1" style={{ color: 'var(--blue)' }}>({calc.saldoFinalYm})</span>
                  </p>
                  <p className="font-mono font-semibold mt-0.5" style={{ color: 'var(--green-400)' }}>
                    + {formatBrl(calc.valeRefeicaoTotal)}
                  </p>
                </div>
              )}
              <div className="rounded-lg px-4 py-3 font-mono text-xs leading-relaxed"
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                <span style={{ color: 'var(--green-400)' }}>Saldo Brasil</span>
                <span style={{ color: 'var(--text-3)' }}> = </span>
                <span style={{ color: 'var(--blue)' }}>Receita BR</span>
                <span style={{ color: 'var(--text-3)' }}> + </span>
                <span style={{ color: calc.saldoFinalYm ? 'var(--amber)' : 'var(--text-3)' }}>
                  Saldo Final{calc.saldoFinalYm ? ` (só em ${calc.saldoFinalYm})` : ' (mês não configurado)'}
                </span>
                <span style={{ color: 'var(--text-3)' }}> + </span>
                <span style={{ color: calc.saldoFinalYm ? 'var(--amber)' : 'var(--text-3)' }}>
                  Vale Refeição{calc.saldoFinalYm ? ` (só em ${calc.saldoFinalYm})` : ''}
                </span>
                <span style={{ color: 'var(--text-3)' }}> − </span>
                <span style={{ color: 'var(--red)' }}>Despesa BR</span>
                <br />
                <span style={{ color: 'var(--text-3)', fontSize: 10 }}>
                  onde Receita BR = Σ manipulatedValue (recebíveis Brasil do mês)
                </span>
                <br />
                <span style={{ color: 'var(--text-3)', fontSize: 10 }}>
                  onde Vale Refeição = Σ manipulatedValue (categoria configurada, mês configurado)
                </span>
                <br />
                <span style={{ color: 'var(--text-3)', fontSize: 10 }}>
                  onde Despesa BR = Σ value (contas a pagar Brasil, não pagas)
                </span>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
