'use client'

import { useEffect, useState, useMemo } from 'react'
import { dashboardApi, walletApi } from '@/lib/api'
import type { MonthlyCashflowItem } from '@/lib/api'
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
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

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
  const [calcBase, setCalcBase] = useState<CalcSnapshot | null>(null)
  const [byMonthState, setByMonthState] = useState<Record<string, MonthlyCashflowItem[]>>({})
  const [calcOpen, setCalcOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        // Sincroniza dados da Carteira do backend para o localStorage
        // (garante que o gráfico tenha os valores mesmo no primeiro acesso,
        // sem precisar abrir a tela Carteira antes)
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
        } catch { /* usa o que já houver no localStorage */ }

        if (cancelled) return

        const plrName = loadPlrName()
        const valeCategoria = loadValeCategoria()
        const saldoFinalYm = loadSaldoFinalYm()

        const now = new Date()
        const curYm = now.getFullYear() * 12 + now.getMonth()

        // Ponto de início: saldoFinalYm configurado ou 3 meses atrás
        const sfYmStr = saldoFinalYm
        const startYm = sfYmStr ? ymToNum(sfYmStr) : curYm - 3
        // Range: até 5 anos a frente do ponto de início
        const endYm = startYm + 12 * 5

        // ── Meses do gráfico ──────────────────────────────────────────────────
        const monthList: string[] = []
        for (let n = startYm; n <= endYm; n++) {
          monthList.push(numToYm(n))
        }

        // Anos e meses únicos para o endpoint (produto cartesiano no backend)
        const yearsSet = new Set<number>()
        const monthsSet = new Set<number>()
        for (let n = startYm; n <= endYm; n++) {
          yearsSet.add(Math.floor(n / 12))
          monthsSet.add((n % 12) + 1) // backend usa 1-12
        }
        const years = Array.from(yearsSet).sort((a, b) => a - b)
        const months = Array.from(monthsSet).sort((a, b) => a - b)

        // ── Chamada única ao endpoint agregado ───────────────────────────────
        const cashflow = await dashboardApi.monthlyCashflow(years, months, valeCategoria, plrName)
          .catch(() => [] as MonthlyCashflowItem[])

        if (cancelled) return

        const isEs = (c?: string | null) => (c ?? '').trim().toLowerCase() === 'espanha'

        // ── PLR total = soma de todos os "type 4" do range (manipulatedValue) ─
        const plrTotal = cashflow
          .filter(i => i.type?.startsWith('4'))
          .reduce((s, i) => s + (i.manipulatedValue ?? 0), 0)

        // ── SALDO FINAL = Total Contas Bancárias − PLR total ─────────────────
        const contasBancariasTotal = loadContasBancariasTotal()
        const saldoFinal = contasBancariasTotal - plrTotal

        const nomeGrupoEspanha = loadNomeGrupoEspanha()
        const contasBancariasEspanha = loadContasBancariasEspanha()
        const gruposEncontrados = loadGruposNomes()

        // Agrupa os itens do cashflow por monthYear para cálculo rápido
        const byMonth: Record<string, MonthlyCashflowItem[]> = {}
        for (const item of cashflow) {
          if (!byMonth[item.monthYear]) byMonth[item.monthYear] = []
          byMonth[item.monthYear].push(item)
        }

        // Acumulado Espanha: começa com o saldo total do grupo e diminui conforme despesas
        let despesaEspanhaAcum = 0

        const points: ChartPoint[] = monthList.map((ym) => {
          const items = byMonth[ym] ?? []

          // Despesa Espanha = type 1 + Espanha + hasPay=false
          const despesaEspanha = items
            .filter(i => i.type?.startsWith('1') && isEs(i.taxCountry) && i.hasPay === false)
            .reduce((s, i) => s + (i.value ?? 0), 0)

          despesaEspanhaAcum += despesaEspanha
          const investAcumEspanha = contasBancariasEspanha - despesaEspanhaAcum

          // Despesa Brasil = type 1 + Brasil + hasPay=false
          const despesaBR = items
            .filter(i => i.type?.startsWith('1') && !isEs(i.taxCountry) && i.hasPay === false)
            .reduce((s, i) => s + (i.value ?? 0), 0)

          // Receita Brasil = type 2 + Brasil (manipulatedValue, todos hasReceivable)
          const receitaBR = items
            .filter(i => i.type?.startsWith('2') && !isEs(i.taxCountry))
            .reduce((s, i) => s + (i.manipulatedValue ?? 0), 0)

          const isConfiguredMonth = saldoFinalYm ? ym === saldoFinalYm : false

          // Vale Refeição = type 3 (manipulatedValue), só no mês configurado
          const valeRefeicaoBR = isConfiguredMonth
            ? items
                .filter(i => i.type?.startsWith('3') && !isEs(i.taxCountry))
                .reduce((s, i) => s + (i.manipulatedValue ?? 0), 0)
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
        const configuredItems = byMonth[saldoFinalYm] ?? []
        const valeRefeicaoTotal = configuredItems
          .filter(i => i.type?.startsWith('3') && !isEs(i.taxCountry))
          .reduce((s, i) => s + (i.manipulatedValue ?? 0), 0)

        const despesaEspanhaTotal = cashflow
          .filter(i => i.type?.startsWith('1') && isEs(i.taxCountry) && i.hasPay === false)
          .reduce((s, i) => s + (i.value ?? 0), 0)

        setCalcBase({ plrName, plrTotal, contasBancariasTotal, saldoFinal, saldoFinalYm, valeRefeicaoTotal, contasBancariasEspanha, nomeGrupoEspanha, gruposEncontrados, despesaEspanhaTotal })
        setByMonthState(byMonth)
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

  // Filtra pontos conforme slicers — DEVE ficar antes de qualquer early return (regra de hooks)
  const filteredData = useMemo(() => {
    if (selectedYears.size === 0 && selectedMonths.size === 0) return data
    return data.filter(d => {
      const [mName, yStr] = d.yearMonth.split('/')
      const y = parseInt(yStr)
      const m = MONTHS[mName] ?? 0
      const yearOk = selectedYears.size === 0 || selectedYears.has(y)
      const monthOk = selectedMonths.size === 0 || selectedMonths.has(m)
      return yearOk && monthOk
    })
  }, [data, selectedYears, selectedMonths])

  // Recalcula a memória de cálculo respeitando os filtros ativos
  const calc = useMemo(() => {
    if (!calcBase) return null
    const isEs = (c?: string | null) => (c ?? '').trim().toLowerCase() === 'espanha'
    const filteredYms = new Set(filteredData.map(d => d.yearMonth))

    const despesaEspanhaTotal = Object.entries(byMonthState)
      .filter(([ym]) => filteredYms.has(ym))
      .flatMap(([, items]) => items)
      .filter(i => i.type?.startsWith('1') && isEs(i.taxCountry) && i.hasPay === false)
      .reduce((s, i) => s + (i.value ?? 0), 0)

    const plrTotal = Object.entries(byMonthState)
      .filter(([ym]) => filteredYms.has(ym))
      .flatMap(([, items]) => items)
      .filter(i => i.type?.startsWith('4'))
      .reduce((s, i) => s + (i.manipulatedValue ?? 0), 0)

    const saldoFinal = calcBase.contasBancariasTotal - plrTotal

    const saldoFinalYmVisible = calcBase.saldoFinalYm && filteredYms.has(calcBase.saldoFinalYm)
    const valeRefeicaoTotal = saldoFinalYmVisible
      ? (byMonthState[calcBase.saldoFinalYm!] ?? [])
          .filter(i => i.type?.startsWith('3') && !isEs(i.taxCountry))
          .reduce((s, i) => s + (i.manipulatedValue ?? 0), 0)
      : 0

    return {
      ...calcBase,
      despesaEspanhaTotal,
      plrTotal,
      saldoFinal,
      valeRefeicaoTotal,
      saldoFinalYm: saldoFinalYmVisible ? calcBase.saldoFinalYm : null,
    }
  }, [calcBase, filteredData, byMonthState])

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
      return next.size === 0 ? prev : next
    })
  }

  function toggleMonth(m: number) {
    setSelectedMonths(prev => {
      const next = new Set(prev)
      next.has(m) ? next.delete(m) : next.add(m)
      return next.size === 0 ? prev : next
    })
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
      {/* Memória de cálculo — colapsável, fechado por padrão */}
      {calc && (
        <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-1)' }}>
          {/* Header clicável */}
          <button
            type="button"
            onClick={() => setCalcOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-[var(--bg-4)]"
            style={{ background: 'var(--bg-3)', borderBottom: calcOpen ? '1px solid var(--border-1)' : 'none' }}
          >
            <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
              🧮 Memória de Cálculo
            </span>
            {calcOpen
              ? <ChevronUp size={14} style={{ color: 'var(--text-3)' }} />
              : <ChevronDown size={14} style={{ color: 'var(--text-3)' }} />}
          </button>

          {calcOpen && (
            <div className="p-4 space-y-4 text-xs" style={{ background: 'var(--bg-2)' }}>

              {/* Espanha */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
                  🇪🇸 Acumulado Espanha (€)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Saldo inicial</p>
                    <p className="font-mono font-semibold" style={{ color: calc.contasBancariasEspanha === 0 ? 'var(--red)' : 'var(--text-1)' }}>
                      {calc.contasBancariasEspanha === 0 ? '⚠ não encontrado' : formatEur(calc.contasBancariasEspanha)}
                    </p>
                  </div>
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Total despesas</p>
                    <p className="font-mono font-semibold" style={{ color: 'var(--red)' }}>
                      − {formatEur(calc.despesaEspanhaTotal)}
                    </p>
                  </div>
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid rgba(59,130,246,0.3)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Saldo projetado</p>
                    <p className="font-mono font-bold" style={{ color: (calc.contasBancariasEspanha - calc.despesaEspanhaTotal) >= 0 ? '#3b82f6' : 'var(--red)' }}>
                      = {formatEur(calc.contasBancariasEspanha - calc.despesaEspanhaTotal)}
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-1)' }} />

              {/* Brasil */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
                  🇧🇷 Saldo Brasil (R$)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Contas bancárias BR</p>
                    <p className="font-mono font-semibold" style={{ color: 'var(--text-1)' }}>
                      {formatBrl(calc.contasBancariasTotal)}
                    </p>
                  </div>
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>
                      PLR{calc.plrName ? ` — ${calc.plrName}` : ''}
                    </p>
                    <p className="font-mono font-semibold" style={{ color: 'var(--red)' }}>
                      − {formatBrl(calc.plrTotal)}
                    </p>
                  </div>
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid rgba(22,163,74,0.3)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>
                      Saldo Final{calc.saldoFinalYm ? ` (${calc.saldoFinalYm})` : ''}
                    </p>
                    <p className="font-mono font-bold" style={{ color: calc.saldoFinal >= 0 ? 'var(--green-400)' : 'var(--red)' }}>
                      = {formatBrl(calc.saldoFinal)}
                    </p>
                  </div>
                </div>
                {calc.saldoFinalYm && calc.valeRefeicaoTotal > 0 && (
                  <div className="mt-2 rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>
                      Vale Alimentação/Refeição ({calc.saldoFinalYm})
                    </p>
                    <p className="font-mono font-semibold" style={{ color: 'var(--green-400)' }}>
                      + {formatBrl(calc.valeRefeicaoTotal)}
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  )
}
