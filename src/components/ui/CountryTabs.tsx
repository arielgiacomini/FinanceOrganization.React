'use client'

import { cn } from '@/lib/utils'
import { FlagBrasil, FlagEspanha, FlagGlobe } from '@/components/ui/Flags'

export type CountryFilter = 'Todos' | 'Brasil' | 'Espanha'

const TABS: { value: CountryFilter; Flag: React.ComponentType<{ size?: number }>; label: string }[] = [
  { value: 'Todos',   Flag: FlagGlobe,   label: 'Todos'   },
  { value: 'Brasil',  Flag: FlagBrasil,  label: 'Brasil'  },
  { value: 'Espanha', Flag: FlagEspanha, label: 'Espanha' },
]

interface CountryTabsProps {
  value: CountryFilter
  onChange: (v: CountryFilter) => void
  counts?: Partial<Record<CountryFilter, number>>
}

export function CountryTabs({ value, onChange, counts }: CountryTabsProps) {
  return (
    <div
      className="inline-flex items-center gap-0.5 p-1 rounded-xl overflow-x-auto max-w-full"
      style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}
    >
      {TABS.map(({ value: tabValue, Flag, label }) => {
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
            <Flag size={tabValue === 'Todos' ? 16 : 18} />
            <span>{label}</span>
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
  if (normalized === 'Brasil') return '🇧🇷'
  if (normalized === 'Espanha') return '🇪🇸'
  return '🌎'
}
