'use client'

import { useState, useEffect, useRef } from 'react'

interface CurrencyInputProps {
  value: string        // valor numérico como string ex: "150.50"
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
  // Remove tudo exceto dígitos e vírgula/ponto
  const digits = display.replace(/[^\d]/g, '')
  if (!digits) return ''
  // Trata como centavos: últimos 2 dígitos são decimais
  const num = parseInt(digits, 10) / 100
  return num.toFixed(2)
}

export function CurrencyInput({ value, country, onChange, placeholder, required }: CurrencyInputProps) {
  const [display, setDisplay] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isSpain = country === 'Espanha'
  const symbol = isSpain ? '€' : 'R$'
  const locale = isSpain ? 'es-ES' : 'pt-BR'
  const currency = isSpain ? 'EUR' : 'BRL'

  // Quando value muda externamente (ex: reset do form), atualiza o display
  useEffect(() => {
    if (!focused) {
      if (value && parseFloat(value) > 0) {
        setDisplay(formatCurrencyDisplay(value, country))
      } else {
        setDisplay('')
      }
    }
  }, [value, country, focused])

  // Quando país muda, reformata
  useEffect(() => {
    if (value && parseFloat(value) > 0) {
      setDisplay(formatCurrencyDisplay(value, country))
    }
  }, [country])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = parseRaw(e.target.value)
    setDisplay(formatCurrencyDisplay(raw, country))
    onChange(raw)
  }

  function handleFocus() {
    setFocused(true)
    // Seleciona tudo ao focar
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function handleBlur() {
    setFocused(false)
    if (!value || parseFloat(value) === 0) {
      setDisplay('')
    }
  }

  return (
    <div className="relative">
      {/* Badge de moeda */}
      <div
        className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none"
      >
        <span className="text-xs font-semibold" style={{
          color: isSpain ? 'var(--amber)' : 'var(--green-400)',
        }}>
          {symbol}
        </span>
      </div>
      <input
        ref={inputRef}
        className="input pl-9"
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={focused ? '0,00' : (placeholder ?? (isSpain ? '0,00 €' : 'R$ 0,00'))}
        required={required}
        style={{
          borderColor: display && parseFloat(value) > 0
            ? isSpain ? 'rgba(251,191,36,0.4)' : 'var(--green-border)'
            : undefined,
        }}
      />
    </div>
  )
}
