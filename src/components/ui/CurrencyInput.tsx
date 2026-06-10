'use client'

import { useState, useEffect, useRef } from 'react'

interface CurrencyInputProps {
  value: string        // valor numérico como string ex: "150.50" ou "-50.00"
  country: string      // 'Brasil' ou 'Espanha'
  onChange: (raw: string) => void  // retorna string numérica ex: "150.50"
  placeholder?: string
  required?: boolean
}

function formatCurrencyDisplay(raw: string, country: string): string {
  const num = parseFloat(raw.replace(',', '.'))
  if (isNaN(num)) return ''
  const isSpain = country === 'Espanha'
  return new Intl.NumberFormat(isSpain ? 'es-ES' : 'pt-BR', {
    style: 'currency',
    currency: isSpain ? 'EUR' : 'BRL',
    minimumFractionDigits: 2,
  }).format(num)
}

function parseRaw(display: string): string {
  const isNegative = display.trim().startsWith('-')
  // Remove tudo exceto dígitos
  const digits = display.replace(/[^\d]/g, '')
  if (!digits) return isNegative ? '' : ''
  // Trata como centavos: últimos 2 dígitos são decimais
  const num = parseInt(digits, 10) / 100
  return isNegative ? (-num).toFixed(2) : num.toFixed(2)
}

function hasValue(value: string): boolean {
  const n = parseFloat(value)
  return !isNaN(n)
}

export function CurrencyInput({ value, country, onChange, placeholder, required }: CurrencyInputProps) {
  const [display, setDisplay] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isSpain = country === 'Espanha'
  const symbol = isSpain ? '€' : 'R$'

  // Quando value muda externamente (ex: reset do form), atualiza o display
  useEffect(() => {
    if (!focused) {
      if (hasValue(value)) {
        setDisplay(formatCurrencyDisplay(value, country))
      } else {
        setDisplay('')
      }
    }
  }, [value, country, focused])

  // Quando país muda, reformata
  useEffect(() => {
    if (hasValue(value)) {
      setDisplay(formatCurrencyDisplay(value, country))
    }
  }, [country])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target.value
    // Permite manter o sinal negativo enquanto digita
    if (input === '-') {
      setDisplay('-')
      onChange('')
      return
    }
    const raw = parseRaw(input)
    if (!raw) {
      setDisplay('')
      onChange('')
      return
    }
    setDisplay(formatCurrencyDisplay(raw, country))
    onChange(raw)
  }

  function handleFocus() {
    setFocused(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function handleBlur() {
    setFocused(false)
    if (!hasValue(value)) {
      setDisplay('')
    }
  }

  function toggleSign() {
    const n = parseFloat(value)
    if (isNaN(n)) return
    const flipped = (n === 0 ? 0 : -n).toFixed(2)
    setDisplay(formatCurrencyDisplay(flipped, country))
    onChange(flipped)
  }

  const numVal = parseFloat(value)
  const isNegative = !isNaN(numVal) && numVal < 0

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
        <span className="text-xs font-semibold" style={{
          color: isNegative ? 'var(--red)' : isSpain ? 'var(--amber)' : 'var(--green-400)',
        }}>
          {symbol}
        </span>
      </div>
      <input
        ref={inputRef}
        className="input pl-9 pr-12"
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={focused ? '0,00' : (placeholder ?? (isSpain ? '0,00 €' : 'R$ 0,00'))}
        required={required}
        style={{
          borderColor: isNegative
            ? 'rgba(220,38,38,0.4)'
            : hasValue(value) && numVal > 0
              ? isSpain ? 'rgba(251,191,36,0.4)' : 'var(--green-border)'
              : undefined,
          color: isNegative ? 'var(--red)' : undefined,
        }}
      />
      <button
        type="button"
        onClick={toggleSign}
        title="Inverter sinal (positivo/negativo)"
        aria-label="Inverter sinal"
        className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md text-xs font-bold transition-colors"
        style={{
          background: isNegative ? 'var(--red-dim)' : 'var(--bg-3)',
          color: isNegative ? 'var(--red)' : 'var(--text-3)',
          border: `1px solid ${isNegative ? 'rgba(220,38,38,0.4)' : 'var(--border-1)'}`,
        }}
      >
        ±
      </button>
    </div>
  )
}
