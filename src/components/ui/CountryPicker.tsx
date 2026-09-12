'use client'

import { loadUserCountries } from '@/lib/wallet'
import { CountryFlag } from '@/components/ui/Flags'

interface CountryPickerProps {
  value: string
  onChange: (country: string) => void
  size?: 'sm' | 'md'
}

/** Seletor de país de um lançamento — mostra os países ativos do usuário
 *  (Configurações → país configurável) em vez de dois botões fixos
 *  "Brasil"/"Espanha" escritos na mão em cada formulário. */
export function CountryPicker({ value, onChange, size = 'md' }: CountryPickerProps) {
  const countries = loadUserCountries()
  const padding = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'

  return (
    <div className="flex gap-1.5 flex-wrap">
      {countries.map(c => {
        const active = value === c.code
        return (
          <button
            key={c.code}
            type="button"
            onClick={() => onChange(c.code)}
            className={`flex items-center gap-1.5 rounded-lg font-medium transition-all ${padding}`}
            style={{
              background: active ? 'var(--green-dim)' : 'var(--bg-3)',
              border: `1px solid ${active ? 'var(--green-border)' : 'var(--border-1)'}`,
              color: active ? 'var(--green-400)' : 'var(--text-2)',
            }}
          >
            <CountryFlag code={c.code} size={size === 'sm' ? 12 : 14} />
            {c.code}
          </button>
        )
      })}
    </div>
  )
}
