'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { generateYearMonthOptions, formatYearMonth, currentYearMonth } from '@/lib/utils'
import { dateApi, SearchDateMonthYearOutput } from '@/lib/api'
import type { YearMonth } from '@/types'

interface YearMonthSelectorProps {
  value: string
  onChange: (value: string) => void
}

export function YearMonthSelector({ value, onChange }: YearMonthSelectorProps) {
  const [options, setOptions] = useState<YearMonth[]>(generateYearMonthOptions())

  useEffect(() => {
    dateApi.monthYearAll(2020, 2030).then((res) => {
      const list = (res as SearchDateMonthYearOutput).monthYears
                ?? (res as SearchDateMonthYearOutput).MonthYears
                ?? []
      if (list.length === 0) return
      // API retorna crescente (Jan/2020 → Dez/2030), inverter para recente primeiro
      const sorted = [...list].reverse()
      setOptions(sorted.map((v) => ({ value: v, label: formatYearMonth(v) })))
    }).catch(() => {
      // fallback silencioso — mantém opções locais geradas
    })
  }, [])

  const idx = options.findIndex((o) => o.value === value)

  const prev = () => idx < options.length - 1 && onChange(options[idx + 1].value)
  const next = () => idx > 0 && onChange(options[idx - 1].value)

  const isCurrentMonth = value === currentYearMonth()

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={prev}
        disabled={idx >= options.length - 1}
        className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-3)] disabled:opacity-30"
        style={{ color: 'var(--text-2)' }}
      >
        <ChevronLeft size={16} />
      </button>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1.5 rounded-lg text-xs sm:text-sm font-medium cursor-pointer focus:outline-none focus:border-[var(--green-border)] max-w-[140px] sm:max-w-none"
        style={{
          background: 'var(--bg-3)',
          border: '1px solid var(--border-1)',
          color: isCurrentMonth ? 'var(--green-400)' : 'var(--text-1)',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: 'var(--bg-3)' }}>
            {o.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={next}
        disabled={idx <= 0}
        className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-3)] disabled:opacity-30"
        style={{ color: 'var(--text-2)' }}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
