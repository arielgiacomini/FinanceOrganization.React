'use client'

import { useEffect, useMemo, useState } from 'react'
import { dashboardApi } from '@/lib/api'
import type { DailyExpenseRecord } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Spinner } from '@/components/ui'
import { ChevronDown, ChevronUp, Flame } from 'lucide-react'

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Semanas de calendário (Segunda a Domingo). Trabalha só com campos locais
// (nunca via toISOString/parsing de string) para não deslocar um dia em
// fusos negativos (ex: Brasil, UTC-3).
function mondayOf(d: Date): Date {
  const day = d.getDay() // 0=Dom .. 6=Sáb
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() + diffToMonday)
  return monday
}

function dateKeyOf(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

function weekKeyOf(d: Date): string {
  return dateKeyOf(mondayOf(d))
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function formatDayMonth(d: Date): string {
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`
}

// O campo `date` da API vem sempre fixo no dia 1 do mês (bug conhecido do backend) —
// a data real é reconstruída a partir de `monthYear` + `day`.
function recordDate(r: DailyExpenseRecord): Date | null {
  const [monthName, yearStr] = (r.monthYear ?? '').split('/')
  const monthIdx = MONTH_NAMES.indexOf(monthName)
  const year = parseInt(yearStr)
  if (monthIdx < 0 || isNaN(year) || !r.day) return null
  return new Date(year, monthIdx, r.day)
}

const ACCENT_MAP: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n',
}

function normalize(s: string): string {
  return s.toLowerCase().split('').map(ch => ACCENT_MAP[ch] ?? ch).join('')
}

const EMOJI_RULES: [string, string][] = [
  ['aliment', '🍔'],
  ['mercado', '🛒'],
  ['automov', '🚗'], ['transport', '🚗'], ['combust', '🚗'], ['uber', '🚗'],
  ['saude', '💊'], ['farmac', '💊'], ['medic', '💊'],
  ['esporte', '⚽'], ['lazer', '🎮'], ['entreten', '🎮'],
  ['casa', '🏠'], ['moradia', '🏠'], ['aluguel', '🏠'], ['financiamento', '🏠'], ['amortiza', '🏠'],
  ['vestuario', '👕'], ['roupa', '👕'],
  ['educa', '📚'],
  ['streaming', '📺'], ['assinatura', '📺'], ['servico', '📺'],
  ['internet', '📶'],
  ['viagem', '✈️'],
  ['pet', '🐾'], ['animal', '🐾'],
  ['terceiro', '🤝'],
]

function categoryEmoji(name: string): string {
  const n = normalize(name)
  for (const [kw, emoji] of EMOJI_RULES) {
    if (n.includes(kw)) return emoji
  }
  return '💸'
}

type DetailView = 'semana' | 'dia'

interface CategoryStat {
  name: string
  emoji: string
  current: number
  previous: number
  delta: number
  deltaPct: number | null
  spark: number[]
  streak: number
}

function buildCategoryStats(byCatPeriod: Record<string, Record<string, number>>, periodKeys: string[]): CategoryStat[] {
  const stats = Object.entries(byCatPeriod).map(([name, periods]) => {
    const spark = periodKeys.map(k => Math.round((periods[k] ?? 0) * 100) / 100)
    const current = spark[5]
    const previous = spark[4]
    const delta = Math.round((current - previous) * 100) / 100
    const deltaPct = previous !== 0 ? Math.round((delta / previous) * 1000) / 10 : (current > 0 ? null : 0)

    // Média dos 4 períodos completos anteriores ao atual, e streak de períodos
    // consecutivos (a partir do mais recente) abaixo dessa média — indicador
    // lúdico, não uma métrica estatística rigorosa.
    const trailingFour = spark.slice(0, 4)
    const trailingAvg = trailingFour.reduce((s, v) => s + v, 0) / trailingFour.length
    let streak = 0
    for (let i = 4; i >= 1; i--) {
      if (spark[i] < trailingAvg) streak++
      else break
    }

    return { name, emoji: categoryEmoji(name), current, previous, delta, deltaPct, spark, streak }
  })
  stats.sort((a, b) => b.delta - a.delta)
  return stats
}

function sparkPath(values: number[], w = 100, h = 32, pad = 3) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = (max - min) || 1
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0
  const pts = values.map((v, i) => {
    const x = pad + i * step
    const y = pad + (1 - (v - min) / range) * (h - pad * 2)
    return [x, y] as const
  })
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`
  const last = pts[pts.length - 1]
  return { line, area, lastX: last[0], lastY: last[1] }
}

function Sparkline({ values, tone }: { values: number[]; tone: 'up' | 'down' | 'flat' }) {
  const { line, area, lastX, lastY } = sparkPath(values)
  const color = tone === 'up' ? 'var(--red)' : tone === 'down' ? 'var(--green-400)' : 'var(--text-3)'
  return (
    <svg width="100%" height={32} viewBox="0 0 100 32" preserveAspectRatio="none" style={{ display: 'block' }}>
      <path d={area} fill={color} opacity={0.15} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} />
      <circle cx={lastX} cy={lastY} r={2.6} fill={color} />
    </svg>
  )
}

function HeroStat({
  label, total, comparisonLabel, comparisonValue, delta, deltaPct, rangeLabel,
}: {
  label: string
  total: number
  comparisonLabel: string
  comparisonValue: number
  delta: number
  deltaPct: number | null
  rangeLabel: string
}) {
  return (
    <div className="flex-1 min-w-[220px]">
      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-3)', fontSize: 10 }}>{label}</p>
      <div className="flex flex-wrap items-end gap-2.5 mt-1">
        <p className="font-mono font-bold" style={{ fontSize: 26, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(total, 'Brasil')}
        </p>
        {deltaPct !== null && (
          <span
            className="font-mono font-bold px-2 py-1 rounded-full"
            style={{
              fontSize: 12,
              color: delta <= 0 ? 'var(--green-400)' : 'var(--red)',
              background: delta <= 0 ? 'var(--green-dim)' : 'var(--red-dim)',
              border: `1px solid ${delta <= 0 ? 'var(--green-border)' : 'rgba(248,113,113,0.28)'}`,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {delta <= 0 ? '▼' : '▲'} {Math.abs(deltaPct)}%
          </span>
        )}
      </div>
      <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
        {comparisonLabel}: {formatCurrency(comparisonValue, 'Brasil')}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{rangeLabel}</p>
    </div>
  )
}

export function WeeklySpendingSummary() {
  const [records, setRecords] = useState<DailyExpenseRecord[] | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [detailView, setDetailView] = useState<DetailView>('semana')

  useEffect(() => {
    let cancelled = false
    const currentYear = new Date().getFullYear()
    dashboardApi.dailyExpenseByCategoryAccount(ALL_MONTHS, [currentYear - 1, currentYear])
      .then(res => { if (!cancelled) setRecords(res ?? []) })
      .catch(() => { if (!cancelled) setRecords([]) })
    return () => { cancelled = true }
  }, [])

  const data = useMemo(() => {
    if (!records) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const currentMonday = mondayOf(today)
    // Chave das últimas 6 semanas: semana atual (parcial) + 5 semanas anteriores completas
    const weekKeys = Array.from({ length: 6 }, (_, i) => weekKeyOf(addDays(currentMonday, -7 * (5 - i))))
    const currentWeekKey = weekKeys[5]
    const previousWeekKey = weekKeys[4]

    // Chave dos últimos 6 dias: hoje + 5 dias anteriores
    const dayKeys = Array.from({ length: 6 }, (_, i) => dateKeyOf(addDays(today, -(5 - i))))
    const currentDayKey = dayKeys[5]
    const previousDayKey = dayKeys[4]

    // total[categoria][periodKey] = soma
    const byCatWeek: Record<string, Record<string, number>> = {}
    const byCatDay: Record<string, Record<string, number>> = {}

    for (const r of records) {
      if ((r.taxCountry ?? '').trim().toLowerCase() === 'espanha') continue
      const d = recordDate(r)
      if (!d) continue
      const topCat = (r.category ?? 'Outros').split(':')[0].trim() || 'Outros'
      const value = r.value ?? 0

      const wKey = weekKeyOf(d)
      if (weekKeys.includes(wKey)) {
        if (!byCatWeek[topCat]) byCatWeek[topCat] = {}
        byCatWeek[topCat][wKey] = (byCatWeek[topCat][wKey] ?? 0) + value
      }

      const dKey = dateKeyOf(d)
      if (dayKeys.includes(dKey)) {
        if (!byCatDay[topCat]) byCatDay[topCat] = {}
        byCatDay[topCat][dKey] = (byCatDay[topCat][dKey] ?? 0) + value
      }
    }

    const categories = buildCategoryStats(byCatWeek, weekKeys)
    const categoriesDay = buildCategoryStats(byCatDay, dayKeys)

    const totalCurrent = Math.round(categories.reduce((s, c) => s + c.current, 0) * 100) / 100
    const totalPrevious = Math.round(categories.reduce((s, c) => s + c.previous, 0) * 100) / 100
    const totalDelta = Math.round((totalCurrent - totalPrevious) * 100) / 100
    const totalDeltaPct = totalPrevious !== 0 ? Math.round((totalDelta / totalPrevious) * 1000) / 10 : null

    const totalCurrentDay = Math.round(categoriesDay.reduce((s, c) => s + c.current, 0) * 100) / 100
    const totalPreviousDay = Math.round(categoriesDay.reduce((s, c) => s + c.previous, 0) * 100) / 100
    const totalDeltaDay = Math.round((totalCurrentDay - totalPreviousDay) * 100) / 100
    const totalDeltaPctDay = totalPreviousDay !== 0 ? Math.round((totalDeltaDay / totalPreviousDay) * 1000) / 10 : null

    const topRiser = categories.find(c => c.delta > 0) ?? null
    const topRiserDay = categoriesDay.find(c => c.delta > 0) ?? null

    const currentRangeLabel = `${formatDayMonth(parseDateKey(currentWeekKey))}–${formatDayMonth(today)}`
    const previousMonday = parseDateKey(previousWeekKey)
    const previousRangeLabel = `${formatDayMonth(previousMonday)}–${formatDayMonth(addDays(previousMonday, 6))}`

    const currentDayLabel = formatDayMonth(parseDateKey(currentDayKey))
    const previousDayLabel = formatDayMonth(parseDateKey(previousDayKey))

    return {
      categories, categoriesDay,
      totalCurrent, totalPrevious, totalDelta, totalDeltaPct, topRiser,
      totalCurrentDay, totalPreviousDay, totalDeltaDay, totalDeltaPctDay, topRiserDay,
      currentRangeLabel, previousRangeLabel, currentDayLabel, previousDayLabel,
    }
  }, [records])

  if (records === null) {
    return (
      <div className="card p-4 lg:p-5 flex items-center justify-center" style={{ minHeight: 96 }}>
        <Spinner size={22} />
      </div>
    )
  }

  if (!data) return null
  const hasWeekData = data.totalCurrent !== 0 || data.totalPrevious !== 0
  const hasDayData = data.totalCurrentDay !== 0 || data.totalPreviousDay !== 0
  if (!hasWeekData && !hasDayData) return null

  const {
    categories, categoriesDay,
    totalCurrent, totalPrevious, totalDelta, totalDeltaPct,
    totalCurrentDay, totalPreviousDay, totalDeltaDay, totalDeltaPctDay,
  } = data

  const weekInsight = totalDelta <= 0
    ? (data.topRiser
        ? <>Na semana, você gastou <strong style={{ color: 'var(--text-1)' }}>menos</strong>. Mas <strong style={{ color: 'var(--text-1)' }}>{data.topRiser.name}</strong> está subindo — vale ficar de olho.</>
        : <>Na semana, você gastou <strong style={{ color: 'var(--text-1)' }}>menos</strong> em relação à anterior.</>)
    : (data.topRiser
        ? <>Na semana, você gastou <strong style={{ color: 'var(--text-1)' }}>mais</strong>, puxado principalmente por <strong style={{ color: 'var(--text-1)' }}>{data.topRiser.name}</strong>.</>
        : <>Na semana, você gastou <strong style={{ color: 'var(--text-1)' }}>mais</strong> em relação à anterior.</>)

  const dayInsight = !hasDayData
    ? <>Ainda não há gastos registrados hoje.</>
    : totalDeltaDay <= 0
      ? (data.topRiserDay
          ? <>Hoje, você já gastou <strong style={{ color: 'var(--text-1)' }}>menos</strong> que ontem. Fique de olho em <strong style={{ color: 'var(--text-1)' }}>{data.topRiserDay.name}</strong>.</>
          : <>Hoje, você já gastou <strong style={{ color: 'var(--text-1)' }}>menos</strong> que ontem.</>)
      : (data.topRiserDay
          ? <>Hoje, você já gastou <strong style={{ color: 'var(--text-1)' }}>mais</strong> que ontem, puxado por <strong style={{ color: 'var(--text-1)' }}>{data.topRiserDay.name}</strong>.</>
          : <>Hoje, você já gastou <strong style={{ color: 'var(--text-1)' }}>mais</strong> que ontem.</>)

  const activeCategories = detailView === 'semana' ? categories : categoriesDay
  const comparisonWord = detailView === 'semana' ? 'semana passada' : 'ontem'
  const streakLabel = detailView === 'semana' ? 'sem. abaixo da média' : 'dias abaixo da média'

  return (
    <div className="card p-4 lg:p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
            Gastos da Semana e do Dia
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            Comparado com o período anterior — Brasil
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-6 mt-3 pb-3" style={{ borderBottom: '1px solid var(--border-1)' }}>
        <HeroStat
          label="Esta semana"
          total={totalCurrent}
          comparisonLabel="semana passada"
          comparisonValue={totalPrevious}
          delta={totalDelta}
          deltaPct={totalDeltaPct}
          rangeLabel={`${data.currentRangeLabel} vs ${data.previousRangeLabel}`}
        />
        <HeroStat
          label="Hoje"
          total={totalCurrentDay}
          comparisonLabel="ontem"
          comparisonValue={totalPreviousDay}
          delta={totalDeltaDay}
          deltaPct={totalDeltaPctDay}
          rangeLabel={`${data.currentDayLabel} vs ${data.previousDayLabel}`}
        />
      </div>

      <p className="text-xs mt-3" style={{ color: 'var(--text-2)' }}>{weekInsight}</p>
      <p className="text-xs mt-1.5" style={{ color: 'var(--text-2)' }}>{dayInsight}</p>

      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-xs mt-4 py-1 transition-colors"
        style={{ color: 'var(--text-3)' }}
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {expanded ? 'Ocultar detalhes por categoria' : 'Ver detalhes por categoria'}
      </button>

      {expanded && (
        <>
          <div className="inline-flex items-center gap-1 rounded-lg p-1 mt-3" style={{ background: 'var(--bg-3)' }}>
            <button
              type="button"
              onClick={() => setDetailView('semana')}
              className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
              style={{
                color: detailView === 'semana' ? 'var(--text-1)' : 'var(--text-3)',
                background: detailView === 'semana' ? 'var(--bg-5)' : 'transparent',
              }}
            >
              Por semana ({categories.length})
            </button>
            <button
              type="button"
              onClick={() => setDetailView('dia')}
              className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
              style={{
                color: detailView === 'dia' ? 'var(--text-1)' : 'var(--text-3)',
                background: detailView === 'dia' ? 'var(--bg-5)' : 'transparent',
              }}
            >
              Hoje ({categoriesDay.length})
            </button>
          </div>

          {activeCategories.length === 0 ? (
            <p className="text-xs mt-3" style={{ color: 'var(--text-3)' }}>
              Nenhum gasto registrado {detailView === 'semana' ? 'nesta semana' : 'hoje'}.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              {activeCategories.map(cat => {
                const tone: 'up' | 'down' | 'flat' = cat.delta > 0.005 ? 'up' : cat.delta < -0.005 ? 'down' : 'flat'
                return (
                  <div key={cat.name} className="rounded-xl p-4 flex flex-col gap-2.5" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center flex-shrink-0" style={{ width: 30, height: 30, fontSize: 16, borderRadius: 9, background: 'var(--bg-4)' }}>
                        {cat.emoji}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{cat.name}</span>
                    </div>

                    <div>
                      <p className="font-mono font-bold" style={{ fontSize: 20, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(cat.current, 'Brasil')}
                      </p>
                      <p className="font-mono text-xs" style={{ color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                        {comparisonWord} {formatCurrency(cat.previous, 'Brasil')}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="font-mono font-bold px-2 py-0.5 rounded-full"
                        style={{
                          fontSize: 11.5,
                          color: tone === 'up' ? 'var(--red)' : tone === 'down' ? 'var(--green-400)' : 'var(--text-3)',
                          background: tone === 'up' ? 'var(--red-dim)' : tone === 'down' ? 'var(--green-dim)' : 'var(--bg-3)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {tone === 'flat'
                          ? '＝ estável'
                          : `${tone === 'up' ? '▲' : '▼'} ${cat.deltaPct !== null ? Math.abs(cat.deltaPct) + '% · ' : ''}${tone === 'up' ? '+' : '−'}${formatCurrency(Math.abs(cat.delta), 'Brasil')}`}
                      </span>
                      {tone === 'down' && cat.streak >= 2 && (
                        <span
                          className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full"
                          style={{ fontSize: 11, color: 'var(--blue)', background: 'var(--blue-dim)' }}
                        >
                          <Flame size={11} /> {cat.streak} {streakLabel}
                        </span>
                      )}
                    </div>

                    <Sparkline values={cat.spark} tone={tone} />
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
