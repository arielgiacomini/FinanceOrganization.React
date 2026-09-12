'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { CountryFlag, FlagGlobe } from '@/components/ui/Flags'
import { findCountryInfo } from '@/lib/countries'
import { loadUserCountryCodes, DEFAULT_ACTIVE_COUNTRY_CODES } from '@/lib/wallet'

/** 'Todos' ou o código de um país ativo (ex: 'Brasil', 'Portugal') — a lista
 *  de abas vem sempre de Configurações → Países, nunca mais fixa. */
export type CountryFilter = string

interface CountryTabsProps {
  value: CountryFilter
  onChange: (v: CountryFilter) => void
  counts?: Partial<Record<string, number>>
}

export function CountryTabs({ value, onChange, counts }: CountryTabsProps) {
  // Estado inicial estático (SSR-safe) — corrigido pra lista real assim que monta no cliente.
  const [codes, setCodes] = useState<string[]>(DEFAULT_ACTIVE_COUNTRY_CODES)
  useEffect(() => { setCodes(loadUserCountryCodes()) }, [])

  const tabs = ['Todos', ...codes]

  return (
    <div
      className="inline-flex items-center gap-0.5 p-1 rounded-xl overflow-x-auto max-w-full"
      style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}
    >
      {tabs.map((tabValue) => {
        const active = value === tabValue
        const count = counts?.[tabValue]
        return (
          <button
            type="button"
            key={tabValue}
            onClick={() => onChange(tabValue)}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
              active
                ? 'text-[var(--text-1)] shadow-sm'
                : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
            )}
            style={active ? { background: 'var(--bg-5)' } : {}}
          >
            {tabValue === 'Todos' ? <FlagGlobe size={16} /> : <CountryFlag code={tabValue} size={18} />}
            <span>{tabValue}</span>
            {count !== undefined && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                style={{
                  background: active ? 'var(--green-dim)' : 'var(--bg-4)',
                  color: active ? 'var(--green-400)' : 'var(--text-3)',
                }}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function normalizeCountry(country?: string | null): string {
  if (!country) return '—'
  return country.trim()
}

export function countryFlag(country?: string): string {
  const normalized = normalizeCountry(country)
  return findCountryInfo(normalized)?.flag ?? '🌎'
}
