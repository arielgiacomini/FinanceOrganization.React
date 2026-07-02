'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { dashboardApi, categoriesApi } from '@/lib/api'
import type { DailyExpenseRecord } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Spinner } from '@/components/ui'
import { CategoryFilter, matchesCategory, parseCategory } from '@/components/ui/CategoryFilter'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, Cell,
} from 'recharts'
import { RefreshCw } from 'lucide-react'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const PALETTE = [
  '#4ade80', '#60a5fa', '#f87171', '#fbbf24', '#a78bfa',
  '#34d399', '#f472b6', '#38bdf8', '#fb923c', '#a3e635',
]

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const AVAILABLE_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030]

type ViewMode = 'day' | 'month'

interface ChartPoint {
  valueBrl: number
  valueEur: number
  day?: number
  dayWeek?: string
  weekend?: boolean
  holiday?: boolean
  monthYear?: string
}

function monthYearOrder(my: string): number {
  const [m, y] = my.split('/')
  return (parseInt(y) || 0) * 12 + MONTH_NAMES.indexOf(m)
}

function isSpain(r: DailyExpenseRecord) {
  return r.taxCountry === 'Espanha'
}

export function DailyExpenseChart() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  // Meses visíveis no mobile: mês atual + próximos 6 (total 7)
  const mobileVisibleMonths = new Set<number>(
    Array.from({ length: 7 }, (_, i) => ((currentMonth - 1 + i) % 12) + 1)
  )

  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedYears, setSelectedYears] = useState<number[]>([...AVAILABLE_YEARS])
  const [dayYear, setDayYear] = useState(currentYear)
  const [dayMonth, setDayMonth] = useState(now.getMonth() + 1)

  const [catGroup, setCatGroup] = useState('Alimentação')
  const [catSub, setCatSub] = useState('Café da Manhã')

  const [categories, setCategories] = useState<string[]>([])
  const [allData, setAllData] = useState<DailyExpenseRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [accountFilter, setAccountFilter] = useState('Todos')
  const [hasLoaded, setHasLoaded] = useState(false)

  const fetchedYearsRef = useRef<Record<number, boolean>>({})
  const fetchedCatsRef = useRef<Record<string, boolean>>({})
  const pendingAutoSubRef = useRef<string | null>(null)
  const yearChangedRef = useRef(false)
  const allDataRef = useRef<DailyExpenseRecord[]>([])

  allDataRef.current = allData

  const doLoad = useCallback(async (years: number[]) => {
    setLoading(true)
    setAccountFilter('Todos')
    fetchedYearsRef.current = {}
    try {
      const res = await dashboardApi.dailyExpenseByCategoryAccount(ALL_MONTHS, years)
      setAllData(res ?? [])
      setHasLoaded(true)
    } catch {
      setAllData([])
      setHasLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    categoriesApi.search({ accountType: 'Conta a Pagar', enable: true })
      .then(cats => setCategories(cats ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    doLoad(AVAILABLE_YEARS)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hasLoaded || !yearChangedRef.current) return
    yearChangedRef.current = false
    const yearsToCheck = viewMode === 'month' ? selectedYears : [dayYear]
    const toFetch = yearsToCheck.filter(y => {
      if (fetchedYearsRef.current[y]) return false
      return !allDataRef.current.some(r => r.monthYear.endsWith(`/${y}`))
    })
    if (!toFetch.length) return
    toFetch.forEach(y => { fetchedYearsRef.current[y] = true })
    dashboardApi
      .dailyExpenseByCategoryAccount(ALL_MONTHS, toFetch)
      .then(res => {
        if (!res?.length) return
        setAllData(prev => {
          const existing = new Set(prev.map(r => `${r.account}|${r.category}|${r.date}`))
          const newRows = res.filter(r => !existing.has(`${r.account}|${r.category}|${r.date}`))
          return newRows.length ? [...prev, ...newRows] : prev
        })
      })
      .catch(() => {})
  }, [selectedYears, dayYear, viewMode, hasLoaded])

  const accounts = useMemo(() => {
    const seen: Record<string, boolean> = {}
    const list: string[] = []
    allData.forEach(d => {
      if (d.account && d.value > 0 && !seen[d.account]) {
        seen[d.account] = true
        list.push(d.account)
      }
    })
    return list
  }, [allData])

  const catDataCount = useMemo(() => {
    if (!catGroup) return allData.length
    return allData.filter(r => matchesCategory(r.category, catGroup, catSub)).length
  }, [allData, catGroup, catSub])

  useEffect(() => {
    if (!catGroup || !hasLoaded) return
    if (catDataCount > 0) return
    const key = catSub ? `${catGroup}:${catSub}` : catGroup
    if (fetchedCatsRef.current[key]) return
    fetchedCatsRef.current[key] = true
    const catParam = catSub ? `${catGroup}:${catSub}` : catGroup
    dashboardApi
      .dailyExpenseByCategoryAccount(ALL_MONTHS, AVAILABLE_YEARS, catParam)
      .then(res => {
        if (!res?.length) return
        setAllData(prev => {
          const existing = new Set(prev.map(r => `${r.account}|${r.category}|${r.date}`))
          const newRows = res.filter(r => !existing.has(`${r.account}|${r.category}|${r.date}`))
          return newRows.length ? [...prev, ...newRows] : prev
        })
      })
      .catch(() => {})
  }, [catGroup, catSub, catDataCount, hasLoaded])

  const filteredData = useMemo(() => {
    let rows = allData
    if (catGroup) rows = rows.filter(r => matchesCategory(r.category, catGroup, catSub))
    if (accountFilter !== 'Todos') rows = rows.filter(r => r.account === accountFilter)
    if (viewMode === 'day') {
      const targetMY = `${MONTH_NAMES[dayMonth - 1]}/${dayYear}`
      rows = rows.filter(r => r.monthYear === targetMY)
    } else {
      rows = rows.filter(r => {
        const y = parseInt(r.monthYear.split('/')[1] ?? '0')
        return selectedYears.includes(y)
      })
    }
    return rows
  }, [allData, catGroup, catSub, accountFilter, viewMode, dayMonth, dayYear, selectedYears])

  const positiveRows = useMemo(() => filteredData.filter(d => d.value > 0), [filteredData])

  const chartData = useMemo((): ChartPoint[] => {
    if (viewMode === 'day') {
      const map: Record<number, ChartPoint> = {}
      positiveRows.forEach(d => {
        if (!map[d.day]) {
          map[d.day] = {
            day: d.day, valueBrl: 0, valueEur: 0,
            dayWeek: d.dayWeek, weekend: d.weekend, holiday: d.holiday,
          }
        }
        if (isSpain(d)) map[d.day].valueEur += d.value
        else             map[d.day].valueBrl += d.value
      })
      return Object.values(map).sort((a, b) => (a.day ?? 0) - (b.day ?? 0))
    }
    const map: Record<string, ChartPoint> = {}
    positiveRows.forEach(d => {
      if (!map[d.monthYear]) map[d.monthYear] = { monthYear: d.monthYear, valueBrl: 0, valueEur: 0 }
      if (isSpain(d)) map[d.monthYear].valueEur += d.value
      else            map[d.monthYear].valueBrl += d.value
    })
    return Object.values(map).sort((a, b) => monthYearOrder(a.monthYear ?? '') - monthYearOrder(b.monthYear ?? ''))
  }, [positiveRows, viewMode])

  const totalBrl = useMemo(() => positiveRows.filter(d => !isSpain(d)).reduce((s, d) => s + d.value, 0), [positiveRows])
  const totalEur = useMemo(() => positiveRows.filter(d =>  isSpain(d)).reduce((s, d) => s + d.value, 0), [positiveRows])
  const hasBrl = totalBrl > 0
  const hasEur = totalEur > 0

  const maxBrlPoint = chartData.reduce<ChartPoint | null>((best, d) => d.valueBrl > (best?.valueBrl ?? 0) ? d : best, null)
  const maxEurPoint = chartData.reduce<ChartPoint | null>((best, d) => d.valueEur > (best?.valueEur ?? 0) ? d : best, null)
  const maxBrl = maxBrlPoint?.valueBrl ?? 0
  const maxEur = maxEurPoint?.valueEur ?? 0
  const ptWithBrl = chartData.filter(d => d.valueBrl > 0).length
  const ptWithEur = chartData.filter(d => d.valueEur > 0).length
  const avgBrl = ptWithBrl ? totalBrl / ptWithBrl : 0
  const avgEur = ptWithEur ? totalEur / ptWithEur : 0

  const qty = positiveRows.reduce((s, d) => s + d.quantity, 0)
  const unitLabel = viewMode === 'day' ? 'dia' : 'mês'

  const formatTickY = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
  const fmtBrl = (v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v.toFixed(0)}`
  const fmtEur = (v: number) => v >= 1000 ? `€${(v / 1000).toFixed(1)}k`  : `€${v.toFixed(0)}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomDayTick = ({ x, y, payload }: any) => {
    const pt = chartData.find(p => p.day === payload?.value)
    const abbr = pt?.dayWeek ? pt.dayWeek.slice(0, 3) : ''
    const isHoliday = !!pt?.holiday
    const isWeekend = !!pt?.weekend
    const color = isHoliday ? 'var(--red)' : isWeekend ? 'var(--amber)' : 'var(--text-3)'
    return (
      <g transform={`translate(${x ?? 0},${y ?? 0})`}>
        <text x={0} y={0} dy={14} textAnchor="middle" fill={color} fontSize={12}
          fontWeight={isHoliday || isWeekend ? 700 : 400}>
          {payload?.value}
        </text>
        <text x={0} y={0} dy={30} textAnchor="middle" fill={color} fontSize={11}>
          {abbr}
        </text>
      </g>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomMonthTick = ({ x, y, payload }: any) => {
    const parts = String(payload?.value ?? '').split('/')
    const label = (parts[0]?.slice(0, 3) ?? '') + '/' + (parts[1]?.slice(2) ?? '')
    return (
      <g transform={`translate(${x ?? 0},${y ?? 0})`}>
        <text x={0} y={0} dy={14} textAnchor="middle" fill="var(--text-3)" fontSize={12}>
          {label}
        </text>
      </g>
    )
  }

  function toggleYear(y: number) {
    yearChangedRef.current = true
    setSelectedYears(prev => {
      if (prev.includes(y)) {
        if (prev.length === 1) return prev
        return prev.filter(yr => yr !== y)
      }
      return [...prev, y].sort((a, b) => a - b)
    })
  }

  function handleDayYearChange(y: number) {
    yearChangedRef.current = true
    setDayYear(y)
  }

  function switchMode(mode: ViewMode) {
    yearChangedRef.current = true
    setViewMode(mode)
    setAccountFilter('Todos')
  }

  const brlBarColor = (pt: ChartPoint) => {
    if (viewMode !== 'day') return '#dc2626'
    if (pt.holiday) return '#a78bfa'
    if (pt.weekend) return 'var(--amber)'
    return '#dc2626'
  }

  const labelStyle = (fontSize: number, color: string) => ({
    fontSize,
    fill: color,
    fontFamily: 'var(--font-mono, monospace)',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BrlLabel = ({ x, y, width, value }: any) => {
    if (!(value > 0)) return null
    const cx = (x ?? 0) + (width ?? 0) / 2
    const fs = viewMode === 'day' ? 11 : 12
    const fw = 14; const fh = fw * 0.667
    return (
      <g>
        {/* Bandeira Brasil */}
        <g transform={`translate(${cx - fw / 2},${(y ?? 0) - 24})`}>
          <rect width={fw} height={fh} fill="#009c3b" rx="1" />
          <polygon points={`${fw/2},${fh*0.08} ${fw*0.95},${fh/2} ${fw/2},${fh*0.92} ${fw*0.05},${fh/2}`} fill="#FFDF00" />
          <circle cx={fw / 2} cy={fh / 2} r={fw * 0.15} fill="#002776" />
        </g>
        <text x={cx} y={(y ?? 0) - 4} textAnchor="middle" fontSize={fs}
          fill="var(--text-2)" fontFamily="var(--font-mono, monospace)">{fmtBrl(value)}</text>
      </g>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const EurLabel = ({ x, y, width, value }: any) => {
    if (!(value > 0)) return null
    const cx = (x ?? 0) + (width ?? 0) / 2
    const fs = viewMode === 'day' ? 11 : 12
    const fw = 14; const fh = fw * 0.667
    return (
      <g>
        {/* Bandeira Espanha */}
        <g transform={`translate(${cx - fw / 2},${(y ?? 0) - 24})`}>
          <rect width={fw} height={fh} fill="#c60b1e" rx="1" />
          <rect y={fh / 4} width={fw} height={fh / 2} fill="#ffc400" />
        </g>
        <text x={cx} y={(y ?? 0) - 4} textAnchor="middle" fontSize={fs}
          fill="var(--text-2)" fontFamily="var(--font-mono, monospace)">{fmtEur(value)}</text>
      </g>
    )
  }

  return (
    <div className="card p-4 lg:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
            Despesas por {viewMode === 'day' ? 'Dia' : 'Mês/Ano'}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            {viewMode === 'day'
              ? 'Total de gastos por dia no mês selecionado'
              : 'Total mensal por categoria nos anos selecionados'}
          </p>
        </div>
        <button type="button" onClick={() => doLoad(AVAILABLE_YEARS)} disabled={loading}
          className="flex-shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-3)', background: 'var(--bg-3)', border: '1px solid var(--border-1)', opacity: loading ? 0.5 : 1 }}>
          {loading ? <Spinner size={12} /> : <RefreshCw size={12} />}
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      {/* Toggle Por Mês / Por Dia */}
      <div className="flex flex-wrap gap-1.5">
        {(['month', 'day'] as const).map(mode => (
          <button key={mode} type="button" onClick={() => switchMode(mode)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: viewMode === mode ? 'var(--green-400)' : 'var(--bg-3)',
              color: viewMode === mode ? '#fff' : 'var(--text-2)',
              border: `1px solid ${viewMode === mode ? 'var(--green-400)' : 'var(--border-1)'}`,
            }}>
            {mode === 'day' ? 'Por Dia' : 'Por Mês'}
          </button>
        ))}
      </div>

      {/* Filtro de categoria */}
      {categories.length > 0 && (
        <CategoryFilter
          categories={categories}
          selectedGroup={catGroup}
          selectedSub={catSub}
          onGroupChange={g => {
            const firstSub = categories
              .map(c => parseCategory(c))
              .filter(p => p.group === g)
              .map(p => p.sub)[0] ?? null
            pendingAutoSubRef.current = firstSub
            setCatGroup(g)
          }}
          onSubChange={s => {
            if (s === '' && pendingAutoSubRef.current !== null) {
              const autoSub = pendingAutoSubRef.current
              pendingAutoSubRef.current = null
              setCatSub(autoSub)
            } else {
              pendingAutoSubRef.current = null
              setCatSub(s)
            }
          }}
        />
      )}

      {/* Seletor de Anos */}
      <div>
        <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-3)', fontSize: 10 }}>
          {viewMode === 'month' ? 'Anos' : 'Ano'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_YEARS.map(y => {
            const active = viewMode === 'month' ? selectedYears.includes(y) : dayYear === y
            return (
              <button key={y} type="button"
                onClick={() => viewMode === 'month' ? toggleYear(y) : handleDayYearChange(y)}
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

      {/* Seletor de Mês — somente em Por Dia */}
      {viewMode === 'day' && (
        <div>
          <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-3)', fontSize: 10 }}>
            Mês
          </p>
          {/* Mobile: mês atual + próximos 6 */}
          <div className="flex sm:hidden flex-wrap gap-1">
            {MONTH_NAMES.map((m, i) => {
              const monthNum = i + 1
              if (!mobileVisibleMonths.has(monthNum)) return null
              const active = dayMonth === monthNum
              return (
                <button key={i} type="button"
                  onClick={() => setDayMonth(monthNum)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: active ? 'var(--green-400)' : 'var(--bg-3)',
                    color: active ? '#fff' : 'var(--text-2)',
                    border: `1px solid ${active ? 'var(--green-400)' : 'var(--border-1)'}`,
                  }}>
                  {m.slice(0, 3)}
                </button>
              )
            })}
          </div>
          {/* Desktop: todos os 12 meses */}
          <div className="hidden sm:flex flex-wrap gap-1">
            {MONTH_NAMES.map((m, i) => {
              const monthNum = i + 1
              const active = dayMonth === monthNum
              return (
                <button key={i} type="button"
                  onClick={() => setDayMonth(monthNum)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: active ? 'var(--green-400)' : 'var(--bg-3)',
                    color: active ? '#fff' : 'var(--text-2)',
                    border: `1px solid ${active ? 'var(--green-400)' : 'var(--border-1)'}`,
                  }}>
                  {m.slice(0, 3)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Chips de conta */}
      {accounts.length > 0 && hasLoaded && !loading && (
        <div className="flex flex-wrap gap-1.5">
          <button type="button"
            onClick={() => setAccountFilter('Todos')}
            className="text-xs px-2.5 py-1 rounded-full border transition-colors"
            style={{
              background: accountFilter === 'Todos' ? 'var(--bg-5)' : 'transparent',
              borderColor: accountFilter === 'Todos' ? 'var(--border-2)' : 'var(--border-1)',
              color: accountFilter === 'Todos' ? 'var(--text-1)' : 'var(--text-3)',
            }}>
            Todas as contas
          </button>
          {accounts.map((acc, i) => {
            const color = PALETTE[i % PALETTE.length]
            const active = accountFilter === acc
            const accRows = allData.filter(d => d.account === acc && d.value > 0 && matchesCategory(d.category, catGroup, catSub))
            const accTotal = accRows.reduce((s, d) => s + d.value, 0)
            const accCurrency = accRows.some(d => isSpain(d)) ? 'Espanha' : 'Brasil'
            return (
              <button key={acc} type="button"
                onClick={() => setAccountFilter(active ? 'Todos' : acc)}
                className="text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5"
                style={{
                  background: active ? `${color}22` : 'transparent',
                  borderColor: active ? color : 'var(--border-1)',
                  color: active ? color : 'var(--text-3)',
                }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                {acc}
                <span className="font-mono" style={{ opacity: active ? 1 : 0.6 }}>
                  {formatCurrency(accTotal, accCurrency)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Carregando */}
      {loading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}

      {/* Sem dados */}
      {hasLoaded && !loading && chartData.length === 0 && (
        <p className="text-sm text-center py-10" style={{ color: 'var(--text-3)' }}>
          {!catGroup
            ? 'Selecione uma categoria para visualizar os dados.'
            : 'Nenhum dado para os filtros selecionados.'}
        </p>
      )}

      {/* Resultados */}
      {!loading && chartData.length > 0 && (
        <>
          {/* Cards de resumo — separados por moeda */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {hasBrl && (
              <div className="card px-3 py-2">
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)', fontSize: 10 }}>Total R$ (Brasil)</p>
                <p className="text-sm font-semibold font-mono" style={{ color: '#dc2626' }}>
                  {formatCurrency(totalBrl, 'Brasil')}
                </p>
              </div>
            )}
            {hasEur && (
              <div className="card px-3 py-2">
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)', fontSize: 10 }}>Total € (Espanha)</p>
                <p className="text-sm font-semibold font-mono" style={{ color: '#b91c1c' }}>
                  {formatCurrency(totalEur, 'Espanha')}
                </p>
              </div>
            )}
            <div className="card px-3 py-2">
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)', fontSize: 10 }}>Qtd. lançamentos</p>
              <p className="text-sm font-semibold font-mono" style={{ color: 'var(--text-2)' }}>{qty}</p>
            </div>
            {hasBrl && !hasEur && (
              <>
                <div className="card px-3 py-2">
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)', fontSize: 10 }}>Maior {unitLabel} (R$)</p>
                  <p className="text-sm font-semibold font-mono" style={{ color: '#dc2626' }}>
                    {formatCurrency(maxBrl, 'Brasil')}
                  </p>
                  {maxBrlPoint && (
                    <p style={{ color: 'var(--text-3)', fontSize: 10, marginTop: 2 }}>
                      {viewMode === 'day' ? `Dia ${maxBrlPoint.day}` : maxBrlPoint.monthYear}
                    </p>
                  )}
                </div>
                <div className="card px-3 py-2">
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)', fontSize: 10 }}>Média por {unitLabel} (R$)</p>
                  <p className="text-sm font-semibold font-mono" style={{ color: 'var(--amber)' }}>
                    {formatCurrency(avgBrl, 'Brasil')}
                  </p>
                </div>
              </>
            )}
            {hasEur && !hasBrl && (
              <>
                <div className="card px-3 py-2">
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)', fontSize: 10 }}>Maior {unitLabel} (€)</p>
                  <p className="text-sm font-semibold font-mono" style={{ color: '#b91c1c' }}>
                    {formatCurrency(maxEur, 'Espanha')}
                  </p>
                  {maxEurPoint && (
                    <p style={{ color: 'var(--text-3)', fontSize: 10, marginTop: 2 }}>
                      {viewMode === 'day' ? `Dia ${maxEurPoint.day}` : maxEurPoint.monthYear}
                    </p>
                  )}
                </div>
                <div className="card px-3 py-2">
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)', fontSize: 10 }}>Média por {unitLabel} (€)</p>
                  <p className="text-sm font-semibold font-mono" style={{ color: 'var(--amber)' }}>
                    {formatCurrency(avgEur, 'Espanha')}
                  </p>
                </div>
              </>
            )}
            {hasBrl && hasEur && (
              <>
                <div className="card px-3 py-2">
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)', fontSize: 10 }}>Maior {unitLabel} (R$)</p>
                  <p className="text-sm font-semibold font-mono" style={{ color: '#dc2626' }}>
                    {formatCurrency(maxBrl, 'Brasil')}
                  </p>
                  {maxBrlPoint && (
                    <p style={{ color: 'var(--text-3)', fontSize: 10, marginTop: 2 }}>
                      {viewMode === 'day' ? `Dia ${maxBrlPoint.day}` : maxBrlPoint.monthYear}
                    </p>
                  )}
                </div>
                <div className="card px-3 py-2">
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)', fontSize: 10 }}>Maior {unitLabel} (€)</p>
                  <p className="text-sm font-semibold font-mono" style={{ color: '#b91c1c' }}>
                    {formatCurrency(maxEur, 'Espanha')}
                  </p>
                  {maxEurPoint && (
                    <p style={{ color: 'var(--text-3)', fontSize: 10, marginTop: 2 }}>
                      {viewMode === 'day' ? `Dia ${maxEurPoint.day}` : maxEurPoint.monthYear}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <ResponsiveContainer width="100%" height={viewMode === 'day' ? 360 : 320}>
            <BarChart
              data={chartData}
              margin={{ top: 48, right: 8, left: 0, bottom: 4 }}
              barCategoryGap="25%"
              barGap={2}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey={viewMode === 'day' ? 'day' : 'monthYear'}
                tick={viewMode === 'day'
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ? (props: any) => <CustomDayTick {...props} />
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  : (props: any) => <CustomMonthTick {...props} />
                }
                axisLine={false}
                tickLine={false}
                interval={viewMode === 'day' ? 0 : 'preserveStartEnd'}
                height={viewMode === 'day' ? 52 : 28}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-3)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatTickY}
                width={52}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border-2)',
                  borderRadius: 8,
                  fontSize: 11,
                  padding: '8px 12px',
                }}
                labelStyle={{ color: 'var(--text-1)', marginBottom: 6, fontWeight: 600 }}
                itemStyle={{ color: 'var(--text-2)' }}
                labelFormatter={(label, payload) => {
                  if (viewMode === 'day') {
                    const pt = payload?.[0]?.payload as ChartPoint | undefined
                    const suffix = pt?.holiday
                      ? ` (${pt.dayWeek} · Feriado)`
                      : pt?.weekend
                      ? ` (${pt.dayWeek} · Fim de semana)`
                      : pt?.dayWeek ? ` (${pt.dayWeek})` : ''
                    return `Dia ${label}${suffix}`
                  }
                  return String(label)
                }}
                formatter={(val, name) => {
                  const v = val as number
                  if (name === 'valueBrl') return [formatCurrency(v, 'Brasil'), 'R$ (Brasil)']
                  if (name === 'valueEur') return [formatCurrency(v, 'Espanha'), '€ (Espanha)']
                  return [String(v), String(name)]
                }}
              />
              {/* Barra R$ (Brasil) */}
              {hasBrl && (
                <Bar dataKey="valueBrl" name="valueBrl" radius={[3, 3, 0, 0]}>
                  {chartData.map((pt, i) => (
                    <Cell key={i} fill={brlBarColor(pt)} />
                  ))}
                  <LabelList dataKey="valueBrl" position="top" content={BrlLabel} />
                </Bar>
              )}
              {/* Barra € (Espanha) */}
              {hasEur && (
                <Bar dataKey="valueEur" name="valueEur" radius={[3, 3, 0, 0]} fill="#b91c1c">
                  <LabelList dataKey="valueEur" position="top" content={EurLabel} />
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>

          {/* Legenda */}
          <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-3)' }}>
            {hasBrl && (
              <span className="flex items-center gap-1.5">
                <span style={{ width: 10, height: 10, background: '#dc2626', borderRadius: 2, display: 'inline-block' }} />
                R$ (Brasil)
              </span>
            )}
            {hasEur && (
              <span className="flex items-center gap-1.5">
                <span style={{ width: 10, height: 10, background: '#b91c1c', borderRadius: 2, display: 'inline-block' }} />
                € (Espanha)
              </span>
            )}
            {viewMode === 'day' && (
              <>
                <span className="flex items-center gap-1.5">
                  <span style={{ width: 10, height: 10, background: 'var(--amber)', borderRadius: 2, display: 'inline-block' }} />
                  Final de semana
                </span>
                <span className="flex items-center gap-1.5">
                  <span style={{ width: 10, height: 10, background: 'var(--red)', borderRadius: 2, display: 'inline-block' }} />
                  Feriado
                </span>
              </>
            )}
          </div>

          <details className="group">
            <summary className="text-xs cursor-pointer select-none flex items-center gap-2 py-1"
              style={{ color: 'var(--text-3)' }}>
              <span className="transition-transform group-open:rotate-90 inline-block">▶</span>
              Ver dados detalhados ({positiveRows.length} registros)
            </summary>
            <div className="mt-3 overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border-1)' }}>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ background: 'var(--bg-3)' }}>
                    {['Mês/Ano', 'Dia', 'Dia Semana', 'Conta', 'País', 'Qtd.', 'Valor'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 font-medium whitespace-nowrap"
                        style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--border-1)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positiveRows.map((d, i) => {
                    const rowColor = d.holiday
                      ? 'rgba(248,113,113,0.08)'
                      : d.weekend
                      ? 'rgba(251,191,36,0.07)'
                      : i % 2 === 0 ? 'var(--bg-2)' : 'var(--bg-1)'
                    const dayColor = d.holiday ? 'var(--red)' : d.weekend ? 'var(--amber)' : 'var(--text-2)'
                    const currency = isSpain(d) ? 'Espanha' : 'Brasil'
                    return (
                      <tr key={i} style={{ background: rowColor }}>
                        <td className="px-3 py-2" style={{ color: 'var(--text-3)' }}>{d.monthYear}</td>
                        <td className="px-3 py-2 font-semibold" style={{ color: dayColor }}>
                          {d.day}{d.holiday ? ' ✦' : d.weekend ? ' ★' : ''}
                        </td>
                        <td className="px-3 py-2" style={{ color: dayColor }}>{d.dayWeek}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-2)' }}>{d.account}</td>
                        <td className="px-3 py-2" style={{ color: isSpain(d) ? 'var(--blue)' : 'var(--green-400)' }}>
                          {isSpain(d) ? '🇪🇸' : '🇧🇷'}
                        </td>
                        <td className="px-3 py-2 text-center" style={{ color: 'var(--text-3)' }}>{d.quantity}</td>
                        <td className="px-3 py-2 font-mono font-semibold"
                          style={{ color: isSpain(d) ? 'var(--blue)' : 'var(--green-400)' }}>
                          {formatCurrency(d.value, currency)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  )
}
