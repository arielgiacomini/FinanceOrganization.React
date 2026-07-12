'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { dashboardApi, categoriesApi, billsToPayApi } from '@/lib/api'
import type { DailyExpenseRecord } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Spinner, Modal, TRow, Td } from '@/components/ui'
import { CategoryFilter, matchesCategory, parseCategory } from '@/components/ui/CategoryFilter'
import { BillToPayForm } from '@/components/forms/BillToPayForm'
import { PayBillModal } from '@/components/ui/PayBillModal'
import { BillToPayHistory } from '@/components/ui/BillToPayHistory'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'
import { normalizeCountry } from '@/components/ui/CountryTabs'
import type { BillToPay } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, Cell,
} from 'recharts'
import {
  RefreshCw, Pencil, Trash2, CircleDollarSign,
  History, CheckCircle2, AlertCircle,
} from 'lucide-react'

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

type ChartSize = 'compact' | 'normal' | 'large'
const DAILY_CHART_SIZE_KEY = 'daily_expense_chart_size'
const DAILY_FONT_SIZES: Record<ChartSize, { tick: number; tickSub: number; dataLabel: number; yAxis: number }> = {
  compact: { tick: 10, tickSub: 9,  dataLabel: 10, yAxis: 9  },
  normal:  { tick: 12, tickSub: 11, dataLabel: 11, yAxis: 10 },
  large:   { tick: 14, tickSub: 13, dataLabel: 13, yAxis: 12 },
}

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

function sortBills(data: BillToPay[]): BillToPay[] {
  const byDue = (a: BillToPay, b: BillToPay) =>
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  return [
    ...data.filter(b => !b.hasPay).sort(byDue),
    ...data.filter(b =>  b.hasPay).sort(byDue),
  ]
}

export function DailyExpenseChart() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  // Meses visíveis no mobile: mês atual + próximos 6 (total 7)
  const mobileVisibleMonths = new Set<number>(
    Array.from({ length: 7 }, (_, i) => ((currentMonth - 1 + i) % 12) + 1)
  )

  const [chartSize, setChartSize] = useState<ChartSize>('normal')
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedYears, setSelectedYears] = useState<number[]>([...AVAILABLE_YEARS])
  const [dayYear, setDayYear] = useState(currentYear)
  const [dayMonth, setDayMonth] = useState(now.getMonth() + 1)

  const [catGroup, setCatGroup] = useState('Viagem')
  const [catSub, setCatSub] = useState('Preparação:Espanha')

  const [categories, setCategories] = useState<string[]>([])
  const [allData, setAllData] = useState<DailyExpenseRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [accountFilter, setAccountFilter] = useState('Todos')
  const [hasLoaded, setHasLoaded] = useState(false)

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsBills, setDetailsBills] = useState<BillToPay[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [showDetails, setShowDetails] = useState(true)
  const [hideZero, setHideZero] = useState(false)
  const [barFilterLabel, setBarFilterLabel] = useState<string | null>(null)
  const [barSelection, setBarSelection] = useState<{ yearMonth: string | null; day: number | null } | null>(null)
  // ref para que loadDetailBills leia o filtro sem precisar estar nas deps
  const barFilterRef = useRef<{ yearMonth: string | null; day: number | null }>({ yearMonth: null, day: null })
  const accountFilterRef = useRef(accountFilter)
  accountFilterRef.current = accountFilter
  const [sortCol, setSortCol] = useState<string>('purchaseDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [editTarget, setEditTarget] = useState<BillToPay | null>(null)
  const [payTarget, setPayTarget] = useState<BillToPay | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BillToPay | null>(null)
  const [historyTarget, setHistoryTarget] = useState<BillToPay | null>(null)
  const [deleting, setDeleting] = useState(false)

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
    const stored = localStorage.getItem(DAILY_CHART_SIZE_KEY) as ChartSize | null
    if (stored && stored in DAILY_FONT_SIZES) setChartSize(stored)
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
      if (d.account && d.value > 0 && !seen[d.account] &&
          (!catGroup || matchesCategory(d.category, catGroup, catSub))) {
        seen[d.account] = true
        list.push(d.account)
      }
    })
    return list
  }, [allData, catGroup, catSub])

  useEffect(() => {
    if (!catGroup || !hasLoaded) return
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
  }, [catGroup, catSub, hasLoaded])

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

  // Inclui todos os registros; negativos são tratados como positivos (descontos)
  const positiveRows = useMemo(() => filteredData, [filteredData])

  // Pontos que têm ao menos um registro negativo (desconto) — por moeda
  const discountBrlSet = useMemo(() => {
    const s: Record<string, boolean> = {}
    filteredData.forEach(d => {
      if (!isSpain(d) && d.value < 0)
        s[viewMode === 'day' ? String(d.day) : d.monthYear] = true
    })
    return s
  }, [filteredData, viewMode])

  const discountEurSet = useMemo(() => {
    const s: Record<string, boolean> = {}
    filteredData.forEach(d => {
      if (isSpain(d) && d.value < 0)
        s[viewMode === 'day' ? String(d.day) : d.monthYear] = true
    })
    return s
  }, [filteredData, viewMode])

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
        if (isSpain(d)) map[d.day].valueEur += Math.abs(d.value)
        else             map[d.day].valueBrl += Math.abs(d.value)
      })
      return Object.values(map).sort((a, b) => (a.day ?? 0) - (b.day ?? 0))
    }
    const map: Record<string, ChartPoint> = {}
    positiveRows.forEach(d => {
      if (!map[d.monthYear]) map[d.monthYear] = { monthYear: d.monthYear, valueBrl: 0, valueEur: 0 }
      if (isSpain(d)) map[d.monthYear].valueEur += Math.abs(d.value)
      else            map[d.monthYear].valueBrl += Math.abs(d.value)
    })
    return Object.values(map).sort((a, b) => monthYearOrder(a.monthYear ?? '') - monthYearOrder(b.monthYear ?? ''))
  }, [positiveRows, viewMode])

  const totalBrl = useMemo(() => positiveRows.filter(d => !isSpain(d)).reduce((s, d) => s + Math.abs(d.value), 0), [positiveRows])
  const totalEur = useMemo(() => positiveRows.filter(d =>  isSpain(d)).reduce((s, d) => s + Math.abs(d.value), 0), [positiveRows])
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

  const selectedBarPoint = useMemo(() => {
    if (!barSelection) return null
    if (viewMode === 'day' && barSelection.day !== null)
      return chartData.find(p => p.day === barSelection.day) ?? null
    if (viewMode === 'month' && barSelection.yearMonth)
      return chartData.find(p => p.monthYear === barSelection.yearMonth) ?? null
    return null
  }, [barSelection, chartData, viewMode])

  const selectedBarQty = useMemo(() => {
    if (!barSelection) return null
    const rows = viewMode === 'day' && barSelection.day !== null
      ? filteredData.filter(d => d.day === barSelection.day)
      : viewMode === 'month' && barSelection.yearMonth
        ? filteredData.filter(d => d.monthYear === barSelection.yearMonth)
        : []
    return rows.reduce((s, d) => s + d.quantity, 0)
  }, [barSelection, filteredData, viewMode])

  const fs = DAILY_FONT_SIZES[chartSize]

  function handleSizeChange(size: ChartSize) {
    setChartSize(size)
    localStorage.setItem(DAILY_CHART_SIZE_KEY, size)
  }

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
        <text x={0} y={0} dy={14} textAnchor="middle" fill={color} fontSize={fs.tick}
          fontWeight={isHoliday || isWeekend ? 700 : 400}>
          {payload?.value}
        </text>
        <text x={0} y={0} dy={30} textAnchor="middle" fill={color} fontSize={fs.tickSub}>
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
        <text x={0} y={0} dy={14} textAnchor="middle" fill="var(--text-3)" fontSize={fs.tick}>
          {label}
        </text>
      </g>
    )
  }

  function toggleYear(y: number) {
    yearChangedRef.current = true
    setSelectedYears(prev => {
      // Se "Todos" está ativo, começa uma seleção nova com apenas este ano
      if (prev.length === AVAILABLE_YEARS.length) return [y]
      if (prev.includes(y)) {
        // Não permite desmarcar o último
        if (prev.length === 1) return prev
        return prev.filter(yr => yr !== y)
      }
      return [...prev, y].sort((a, b) => a - b)
    })
  }

  function selectAllYears() {
    yearChangedRef.current = true
    setSelectedYears([...AVAILABLE_YEARS])
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

  const loadDetailBills = useCallback(async () => {
    const { yearMonth, day } = barFilterRef.current
    // Sem categoria e sem mês selecionado: volume indeterminado — não busca
    if (!catGroup && !yearMonth) {
      setDetailsBills([])
      return
    }
    setDetailsLoading(true)
    try {
      const category = catGroup ? (catSub ? `${catGroup}:${catSub}` : catGroup) : undefined
      const res = await billsToPayApi.search({
        ...(category ? { category } : {}),
        ...(yearMonth ? { yearMonth } : {}),
      })
      let data = res.output?.data ?? []
      if (catGroup) data = data.filter(b => matchesCategory(b.category, catGroup, catSub))
      if (accountFilterRef.current !== 'Todos') {
        data = data.filter(b => b.account === accountFilterRef.current)
      }
      if (day !== null) {
        data = data.filter(b => {
          const raw = b.purchaseDate ?? b.dueDate
          if (!raw) return false
          return new Date(raw + 'T12:00:00').getDate() === day
        })
      }
      setDetailsBills(sortBills(data))
    } catch {
      setDetailsBills([])
    } finally {
      setDetailsLoading(false)
    }
  }, [catGroup, catSub])

  async function handleDeleteBill() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await billsToPayApi.delete({ id: [deleteTarget.id] })
      setDeleteTarget(null)
      loadDetailBills()
    } finally {
      setDeleting(false)
    }
  }

  function toggleDetails() {
    if (!detailsOpen) loadDetailBills()
    setDetailsOpen(v => !v)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleBarClick(data: any) {
    const pt = data?.activePayload?.[0]?.payload as ChartPoint | undefined
    if (!pt) return

    let yearMonth: string | null = null
    let day: number | null = null
    let label: string | null = null

    if (viewMode === 'month') {
      yearMonth = pt.monthYear ?? null
      label = yearMonth
    } else {
      yearMonth = `${MONTH_NAMES[dayMonth - 1]}/${dayYear}`
      day = pt.day ?? null
      label = day !== null ? `Dia ${day} · ${yearMonth}` : yearMonth
    }

    // Clicar na mesma barra deseleciona
    if (barSelection?.yearMonth === yearMonth && barSelection?.day === day) {
      clearBarFilter()
      return
    }

    barFilterRef.current = { yearMonth, day }
    setBarFilterLabel(label)
    setBarSelection({ yearMonth, day })
    if (!detailsOpen) setDetailsOpen(true)
    loadDetailBills()
  }

  function clearBarFilter() {
    barFilterRef.current = { yearMonth: null, day: null }
    setBarFilterLabel(null)
    setBarSelection(null)
    if (detailsOpen) loadDetailBills()
  }

  function handleSort(col: string) {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sortedBills = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const allYears = selectedYears.length === AVAILABLE_YEARS.length
    return [...detailsBills]
      .filter(b => !hideZero || b.value !== 0)
      .filter(b => {
        // Quando uma barra está selecionada o mês/ano já vem da API — não filtra de novo
        if (barSelection) return true
        if (allYears) return true
        const y = parseInt(b.yearMonth?.split('/')?.[1] ?? '0')
        return selectedYears.includes(y)
      })
      .sort((a, b) => {
      switch (sortCol) {
        case 'name':         return dir * (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR')
        case 'country':      return dir * (a.country ?? '').localeCompare(b.country ?? '', 'pt-BR')
        case 'account':      return dir * (a.account ?? '').localeCompare(b.account ?? '', 'pt-BR')
        case 'yearMonth':    return dir * ((a.yearMonth ?? '') > (b.yearMonth ?? '') ? 1 : -1)
        case 'value':        return dir * (a.value - b.value)
        case 'dueDate':      return dir * ((a.dueDate ?? '') > (b.dueDate ?? '') ? 1 : -1)
        case 'purchaseDate': {
          const pa = a.purchaseDate ?? a.dueDate ?? ''
          const pb = b.purchaseDate ?? b.dueDate ?? ''
          return dir * (pa > pb ? 1 : -1)
        }
        case 'payDay':       return dir * ((a.payDay ?? '') > (b.payDay ?? '') ? 1 : -1)
        case 'status':       return dir * ((a.hasPay ? 1 : 0) - (b.hasPay ? 1 : 0))
        default:             return 0
      }
    })
  }, [detailsBills, sortCol, sortDir, hideZero, selectedYears, barSelection])

  // Recarrega detalhes quando categoria muda (e reseta filtro de barra)
  useEffect(() => {
    if (detailsOpen) {
      barFilterRef.current = { yearMonth: null, day: null }
      setBarFilterLabel(null)
      setBarSelection(null)
      loadDetailBills()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catGroup, catSub])

  // Reseta filtro de conta quando a conta selecionada não existe na categoria atual
  useEffect(() => {
    if (accountFilter !== 'Todos' && !accounts.includes(accountFilter)) {
      setAccountFilter('Todos')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts])

  // Recarrega detalhes quando filtro de conta muda
  useEffect(() => {
    if (detailsOpen) loadDetailBills()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountFilter])

  const brlBarColor = (pt: ChartPoint) => {
    if (viewMode !== 'day') return '#dc2626'
    if (pt.holiday) return '#a78bfa'
    if (pt.weekend) return 'var(--amber)'
    return '#dc2626'
  }

  // Shapes customizados que expandem a barra para o centro quando a moeda irmã é zero no mesmo ponto
  const BrlBarShape = (props: any) => {
    const { x, y, width, height, fill } = props
    if (!height || height <= 0) return <g />
    const isAlone = hasEur && !(props.payload?.valueEur > 0)
    const w = isAlone ? width * 2 + 2 : width
    const cr = Math.min(2, w / 2, height)
    const path = `M${x+cr},${y} h${w-2*cr} a${cr},${cr} 0 0 1 ${cr},${cr} v${height-cr} H${x} V${y+cr} a${cr},${cr} 0 0 1 ${cr},${-cr} z`
    return <path d={path} fill={fill} />
  }

  const EurBarShape = (props: any) => {
    const { x, y, width, height, fill } = props
    if (!height || height <= 0) return <g />
    const isAlone = hasBrl && !(props.payload?.valueBrl > 0)
    const w = isAlone ? width * 2 + 2 : width
    const xPos = isAlone ? x - width - 2 : x
    const cr = Math.min(2, w / 2, height)
    const path = `M${xPos+cr},${y} h${w-2*cr} a${cr},${cr} 0 0 1 ${cr},${cr} v${height-cr} H${xPos} V${y+cr} a${cr},${cr} 0 0 1 ${cr},${-cr} z`
    return <path d={path} fill={fill} />
  }

  const labelStyle = (fontSize: number, color: string) => ({
    fontSize,
    fill: color,
    fontFamily: 'var(--font-mono, monospace)',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BrlLabel = ({ x, y, width, value, index }: any) => {
    if (!(value > 0)) return null
    const pt = chartData[index]
    const key = viewMode === 'day' ? String(pt?.day ?? '') : (pt?.monthYear ?? '')
    const hasDiscount = !!discountBrlSet[key]
    const isAlone = hasEur && !(pt?.valueEur > 0)
    const effectiveWidth = isAlone ? (width ?? 0) * 2 + 2 : (width ?? 0)
    const cx = (x ?? 0) + effectiveWidth / 2
    const labelFs = fs.dataLabel
    const fw = 14; const fh = fw * 0.667
    return (
      <g>
        {hasDiscount && (
          <g transform={`translate(${cx - 14},${(y ?? 0) - 40})`}>
            <rect width={28} height={13} rx={4} fill="rgba(74,222,128,0.15)" stroke="rgba(74,222,128,0.5)" strokeWidth={0.8} />
            <text x={14} y={9.5} textAnchor="middle" fontSize={9} fill="#4ade80">desc</text>
          </g>
        )}
        {/* Bandeira Brasil */}
        <g transform={`translate(${cx - fw / 2},${(y ?? 0) - 24})`}>
          <rect width={fw} height={fh} fill="#009c3b" rx="1" />
          <polygon points={`${fw/2},${fh*0.08} ${fw*0.95},${fh/2} ${fw/2},${fh*0.92} ${fw*0.05},${fh/2}`} fill="#FFDF00" />
          <circle cx={fw / 2} cy={fh / 2} r={fw * 0.15} fill="#002776" />
        </g>
        <text x={cx} y={(y ?? 0) - 4} textAnchor="middle" fontSize={labelFs}
          fill="var(--text-2)" fontFamily="var(--font-mono, monospace)">{fmtBrl(value)}</text>
      </g>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const EurLabel = ({ x, y, width, value, index }: any) => {
    if (!(value > 0)) return null
    const pt = chartData[index]
    const key = viewMode === 'day' ? String(pt?.day ?? '') : (pt?.monthYear ?? '')
    const hasDiscount = !!discountEurSet[key]
    const isAlone = hasBrl && !(pt?.valueBrl > 0)
    const effectiveWidth = isAlone ? (width ?? 0) * 2 + 2 : (width ?? 0)
    const xStart = isAlone ? (x ?? 0) - (width ?? 0) - 2 : (x ?? 0)
    const cx = xStart + effectiveWidth / 2
    const labelFs = fs.dataLabel
    const fw = 14; const fh = fw * 0.667
    return (
      <g>
        {hasDiscount && (
          <g transform={`translate(${cx - 14},${(y ?? 0) - 40})`}>
            <rect width={28} height={13} rx={4} fill="rgba(74,222,128,0.15)" stroke="rgba(74,222,128,0.5)" strokeWidth={0.8} />
            <text x={14} y={9.5} textAnchor="middle" fontSize={9} fill="#4ade80">desc</text>
          </g>
        )}
        {/* Bandeira Espanha */}
        <g transform={`translate(${cx - fw / 2},${(y ?? 0) - 24})`}>
          <rect width={fw} height={fh} fill="#c60b1e" rx="1" />
          <rect y={fh / 4} width={fw} height={fh / 2} fill="#ffc400" />
        </g>
        <text x={cx} y={(y ?? 0) - 4} textAnchor="middle" fontSize={labelFs}
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
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Toggle tamanho de fonte */}
          <div className="flex items-center gap-0.5">
            {(['compact', 'normal', 'large'] as ChartSize[]).map((size, i) => {
              const active = chartSize === size
              const labelFontSize = [10, 13, 16][i]
              return (
                <button
                  key={size}
                  type="button"
                  title={['Compacto', 'Normal', 'Ampliado'][i]}
                  onClick={() => handleSizeChange(size)}
                  className="flex items-center justify-center w-8 h-7 rounded-md transition-all"
                  style={{
                    background: active ? 'var(--bg-5)' : 'transparent',
                    border: `1px solid ${active ? 'var(--border-2)' : 'var(--border-1)'}`,
                    color: active ? 'var(--text-1)' : 'var(--text-3)',
                    fontSize: labelFontSize,
                    fontWeight: 600,
                    lineHeight: 1,
                  }}
                >
                  A
                </button>
              )
            })}
          </div>
          <button type="button" onClick={() => doLoad(AVAILABLE_YEARS)} disabled={loading}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-3)', background: 'var(--bg-3)', border: '1px solid var(--border-1)', opacity: loading ? 0.5 : 1 }}>
            {loading ? <Spinner size={12} /> : <RefreshCw size={12} />}
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* Toggle Por Mês / Por Dia + Resumo inline */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex gap-1.5">
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
        {!loading && chartData.length > 0 && (
          <div className="flex flex-wrap items-start gap-x-5 gap-y-1">
            {/* Badge de período selecionado */}
            {selectedBarPoint && barFilterLabel && (
              <div className="flex flex-col justify-between self-stretch gap-1">
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(251,191,36,0.25)', whiteSpace: 'nowrap' }}>
                  ▲ {barFilterLabel}
                </span>
                <p style={{ color: 'var(--text-3)', fontSize: 10 }}>selecionado</p>
              </div>
            )}

            {/* R$ — total ou barra selecionada */}
            {(selectedBarPoint ? selectedBarPoint.valueBrl > 0 : hasBrl) && (
              <div>
                <p style={{ color: 'var(--text-3)', fontSize: 10 }}>
                  {selectedBarPoint ? `R$ — ${barFilterLabel}` : 'Total R$'}
                </p>
                <p className="text-xl font-bold font-mono leading-tight" style={{ color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(selectedBarPoint ? selectedBarPoint.valueBrl : totalBrl, 'Brasil')}
                </p>
              </div>
            )}

            {/* € — total ou barra selecionada */}
            {(selectedBarPoint ? selectedBarPoint.valueEur > 0 : hasEur) && (
              <div>
                <p style={{ color: 'var(--text-3)', fontSize: 10 }}>
                  {selectedBarPoint ? `€ — ${barFilterLabel}` : 'Total €'}
                </p>
                <p className="text-xl font-bold font-mono leading-tight" style={{ color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(selectedBarPoint ? selectedBarPoint.valueEur : totalEur, 'Espanha')}
                </p>
              </div>
            )}

            {/* Lançamentos — total ou barra selecionada */}
            <div>
              <p style={{ color: 'var(--text-3)', fontSize: 10 }}>Lançamentos</p>
              <p className="text-xl font-bold font-mono leading-tight" style={{ color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                {selectedBarPoint ? (selectedBarQty ?? 0) : qty}
              </p>
            </div>

            {/* Maior mês — só quando sem barra selecionada */}
            {!selectedBarPoint && hasBrl && !hasEur && maxBrl > 0 && (
              <div>
                <p style={{ color: 'var(--text-3)', fontSize: 10 }}>Maior {unitLabel} R$</p>
                <p className="text-xl font-bold font-mono leading-tight" style={{ color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(maxBrl, 'Brasil')}
                </p>
              </div>
            )}
            {!selectedBarPoint && hasEur && !hasBrl && maxEur > 0 && (
              <div>
                <p style={{ color: 'var(--text-3)', fontSize: 10 }}>Maior {unitLabel} €</p>
                <p className="text-xl font-bold font-mono leading-tight" style={{ color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(maxEur, 'Espanha')}
                </p>
              </div>
            )}
          </div>
        )}
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
          Ano
        </p>
        <div className="flex flex-wrap gap-1.5">
          {viewMode === 'month' && (() => {
            const allActive = selectedYears.length === AVAILABLE_YEARS.length
            return (
              <button type="button"
                onClick={selectAllYears}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: allActive ? 'var(--green-400)' : 'var(--bg-3)',
                  color: allActive ? '#fff' : 'var(--text-2)',
                  border: `1px solid ${allActive ? 'var(--green-400)' : 'var(--border-1)'}`,
                }}>
                Todos
              </button>
            )
          })()}
          {AVAILABLE_YEARS.map(y => {
            const allActive = selectedYears.length === AVAILABLE_YEARS.length
            const active = viewMode === 'month'
              ? !allActive && selectedYears.includes(y)
              : dayYear === y
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
          Nenhum dado para os filtros selecionados.
        </p>
      )}

      {/* Resultados */}
      {!loading && chartData.length > 0 && (
        <>
          {/* Título da categoria selecionada + período */}
          {(catGroup || barFilterLabel) && (
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
              {catGroup && (
                <div>
                  <p style={{ color: 'var(--text-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                    Categoria
                  </p>
                  <h2 className="font-bold tracking-tight leading-none mt-1"
                    style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--text-1)' }}>
                    {catGroup}
                    {catSub && (
                      <span className="font-semibold" style={{ fontSize: '0.72em', color: 'var(--text-2)' }}> · {catSub}</span>
                    )}
                  </h2>
                </div>
              )}
              {barFilterLabel && (
                <div className="mb-0.5">
                  <p style={{ color: 'var(--text-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                    Período selecionado
                  </p>
                  <p className="font-bold tracking-tight leading-none mt-1"
                    style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', color: 'var(--amber)' }}>
                    {barFilterLabel}
                    <button
                      type="button"
                      onClick={clearBarFilter}
                      className="ml-2 text-base font-normal opacity-50 hover:opacity-100 transition-opacity"
                      title="Limpar seleção">
                      ✕
                    </button>
                  </p>
                </div>
              )}
            </div>
          )}

          <ResponsiveContainer width="100%" height={viewMode === 'day' ? 360 : 320}>
            <BarChart
              data={chartData}
              margin={{ top: 60, right: 8, left: 0, bottom: 4 }}
              barCategoryGap="25%"
              barGap={2}
              style={{ cursor: 'pointer' }}
              onClick={handleBarClick}
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
                tick={{ fontSize: fs.yAxis, fill: 'var(--text-3)' }}
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
                <Bar dataKey="valueBrl" name="valueBrl" shape={BrlBarShape}>
                  {chartData.map((pt, i) => {
                    const sel = barSelection
                    const isSelected = sel
                      ? (viewMode === 'month' ? pt.monthYear === sel.yearMonth : pt.day === sel.day)
                      : true
                    return (
                      <Cell key={i} fill={brlBarColor(pt)} opacity={sel ? (isSelected ? 1 : 0.3) : 1} />
                    )
                  })}
                  <LabelList dataKey="valueBrl" position="top" content={BrlLabel} />
                </Bar>
              )}
              {/* Barra € (Espanha) */}
              {hasEur && (
                <Bar dataKey="valueEur" name="valueEur" shape={EurBarShape}>
                  {chartData.map((pt, i) => {
                    const sel = barSelection
                    const isSelected = sel
                      ? (viewMode === 'month' ? pt.monthYear === sel.yearMonth : pt.day === sel.day)
                      : true
                    return (
                      <Cell key={i} fill="#b91c1c" opacity={sel ? (isSelected ? 1 : 0.3) : 1} />
                    )
                  })}
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

          {/* Ver Registros — busca real na API */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={toggleDetails}
                className="flex items-center gap-2 text-xs py-1 transition-colors"
                style={{ color: 'var(--text-3)' }}>
                <span className={`transition-transform inline-block ${detailsOpen ? 'rotate-90' : ''}`}>▶</span>
                Ver registros{detailsBills.length > 0 ? ` (${detailsBills.length})` : ''}
                {detailsLoading && <Spinner size={12} />}
              </button>
              {barFilterLabel && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
                  {barFilterLabel}
                  <button
                    onClick={clearBarFilter}
                    className="ml-0.5 leading-none opacity-70 hover:opacity-100"
                    title="Limpar filtro"
                  >✕</button>
                </span>
              )}
            </div>

            {detailsOpen && (
              <div className="mt-3 overflow-hidden rounded-xl" style={{ border: '1px solid var(--border-1)', background: 'var(--bg-2)' }}>
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border-1)' }}>
                  <button
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showDetails ? 'border-[var(--green-border)] text-[var(--green-400)] bg-[var(--green-dim)]' : 'border-[var(--border-1)] text-[var(--text-3)]'}`}
                    onClick={() => setShowDetails(v => !v)}
                  >
                    {showDetails ? 'Ocultar detalhes' : 'Mostrar detalhes'}
                  </button>
                  <button
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${hideZero ? 'border-[var(--amber-dim)] text-[var(--amber)] bg-[var(--amber-dim)]' : 'border-[var(--border-1)] text-[var(--text-3)]'}`}
                    onClick={() => setHideZero(v => !v)}
                  >
                    {hideZero ? 'Mostrar valor zero' : 'Ocultar valor zero'}
                  </button>
                  <span className="ml-auto text-xs" style={{ color: 'var(--text-3)' }}>
                    {sortedBills.length} registros
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: 'collapse', background: 'var(--bg-2)' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-2)' }}>
                        {([
                          { label: 'Nome',       key: 'name'         },
                          { label: 'País',       key: 'country'      },
                          { label: 'Conta',      key: 'account'      },
                          { label: 'Mês/Ano',    key: 'yearMonth'    },
                          { label: 'Valor',      key: 'value'        },
                          { label: 'Vencimento', key: 'dueDate'      },
                          { label: 'Data Compra',key: 'purchaseDate' },
                          { label: 'Pago em',    key: 'payDay'       },
                          { label: 'Status',     key: 'status'       },
                          { label: 'Ações',      key: null           },
                        ] as { label: string; key: string | null }[]).map(({ label, key }) => (
                          <th
                            key={label}
                            className="px-4 py-3 text-left text-xs font-medium"
                            style={{
                              color: key && sortCol === key ? 'var(--text-1)' : 'var(--text-3)',
                              background: 'var(--bg-2)',
                              boxShadow: 'inset 0 -1px 0 var(--border-1)',
                              cursor: key ? 'pointer' : 'default',
                              userSelect: 'none',
                              whiteSpace: 'nowrap',
                            }}
                            onClick={() => key && handleSort(key)}
                          >
                            <span className="inline-flex items-center gap-1">
                              {label}
                              {key && (
                                <span style={{ fontSize: 10, opacity: sortCol === key ? 1 : 0.3 }}>
                                  {sortCol === key ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
                                </span>
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailsLoading ? (
                        <tr>
                          <td colSpan={10} className="py-12 text-center">
                            <div className="flex justify-center"><Spinner /></div>
                          </td>
                        </tr>
                      ) : sortedBills.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>
                            Nenhum registro encontrado
                          </td>
                        </tr>
                      ) : sortedBills.map(b => {
                        const currency = normalizeCountry(b.country) === 'Espanha' ? 'Espanha' : 'Brasil'
                        const bg = b.hasPay ? '#1b2e1d' : 'var(--bg-2)'
                        return (
                          <TRow key={b.id} bg={bg}>
                            <Td>
                              <p className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{b.name}</p>
                              {showDetails && b.additionalMessage && (
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{b.additionalMessage}</p>
                              )}
                            </Td>
                              <Td>
                                {b.country ? (
                                  <div className="flex items-center gap-1.5">
                                    {normalizeCountry(b.country) === 'Espanha'
                                      ? <FlagEspanha size={15} />
                                      : <FlagBrasil size={15} />}
                                    <span className="text-xs" style={{ color: 'var(--text-2)' }}>
                                      {normalizeCountry(b.country)}
                                    </span>
                                  </div>
                                ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                              </Td>
                              <Td className="text-xs">{b.account ?? '—'}</Td>
                              <Td className="text-xs">{b.yearMonth ?? '—'}</Td>
                              <Td>
                                <span className="font-mono text-sm" style={{ color: b.hasPay ? 'var(--green-400)' : 'var(--red)' }}>
                                  {formatCurrency(b.value, currency)}
                                </span>
                              </Td>
                              <Td className="text-xs">{formatDate(b.dueDate)}</Td>
                              <Td className="text-xs">{b.purchaseDate ? formatDate(b.purchaseDate) : <span style={{ color: 'var(--text-3)' }}>—</span>}</Td>
                              <Td className="text-xs">{b.payDay ? formatDate(b.payDay) : <span style={{ color: 'var(--text-3)' }}>—</span>}</Td>
                              <Td>
                                {b.hasPay
                                  ? <span className="badge-paid"><CheckCircle2 size={10} />Pago</span>
                                  : <span className="badge-pending"><AlertCircle size={10} />Pendente</span>}
                              </Td>
                              <Td>
                                <div className="flex items-center gap-1">
                                  {!b.hasPay && (
                                    <button title="Pagar"
                                      className="p-1.5 rounded-md transition-colors hover:bg-[var(--green-dim)]"
                                      style={{ color: 'var(--green-400)' }}
                                      onClick={() => setPayTarget(b)}>
                                      <CircleDollarSign size={15} />
                                    </button>
                                  )}
                                  <button title="Histórico"
                                    className="p-1.5 rounded-md transition-colors hover:bg-[var(--blue-dim)]"
                                    style={{ color: 'var(--blue)' }}
                                    onClick={() => setHistoryTarget(b)}>
                                    <History size={15} />
                                  </button>
                                  <button title="Editar"
                                    className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-4)]"
                                    style={{ color: 'var(--text-3)' }}
                                    onClick={() => setEditTarget(b)}>
                                    <Pencil size={15} />
                                  </button>
                                  <button title="Excluir"
                                    className="p-1.5 rounded-md transition-colors hover:bg-[var(--red-dim)]"
                                    style={{ color: 'var(--text-3)' }}
                                    onClick={() => setDeleteTarget(b)}>
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </Td>
                          </TRow>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modais de ação */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar Conta a Pagar" size="lg">
        {editTarget && (
          <BillToPayForm
            initial={editTarget}
            onSuccess={() => { setEditTarget(null); loadDetailBills() }}
            onCancel={() => setEditTarget(null)}
          />
        )}
      </Modal>

      {payTarget && (
        <PayBillModal
          bill={payTarget}
          onClose={() => setPayTarget(null)}
          onSuccess={() => { setPayTarget(null); loadDetailBills() }}
        />
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir Conta" size="sm">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Deseja excluir <strong style={{ color: 'var(--text-1)' }}>{deleteTarget.name}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button className="btn-danger" onClick={handleDeleteBill} disabled={deleting}>
                {deleting ? <Spinner size={16} /> : <Trash2 size={16} />} Excluir
              </button>
            </div>
          </div>
        )}
      </Modal>

      {historyTarget && (
        <BillToPayHistory
          bill={historyTarget}
          onClose={() => setHistoryTarget(null)}
          onRefreshParent={loadDetailBills}
        />
      )}
    </div>
  )
}
