import { format, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { YearMonth } from '@/types'

// ─── Currency ─────────────────────────────────────────────────────────────────

export function formatCurrency(value: number, country?: string | null): string {
  const isSpain = country?.trim() === 'Espanha'
  return new Intl.NumberFormat(isSpain ? 'es-ES' : 'pt-BR', {
    style: 'currency',
    currency: isSpain ? 'EUR' : 'BRL',
  }).format(value)
}

export function parseCurrency(str: string): number {
  const cleaned = str.replace(/[^\d,]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

// ─── Dates ────────────────────────────────────────────────────────────────────

export function formatDate(date?: string | null): string {
  if (!date) return '—'
  try {
    const d = new Date(date)
    return isValid(d) ? format(d, 'dd/MM/yyyy', { locale: ptBR }) : '—'
  } catch {
    return '—'
  }
}

export function formatDatetime(date?: string | null): string {
  if (!date) return '—'
  try {
    const d = new Date(date)
    return isValid(d) ? format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'
  } catch {
    return '—'
  }
}

// ─── YearMonth (format: "Maio/2025" — padrão da API) ─────────────────────────

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/** Gera o valor que a API aceita: "Maio/2025" */
export function buildYearMonth(date: Date): string {
  return `${MONTHS_PT[date.getMonth()]}/${date.getFullYear()}`
}

/** Converte "Maio/2025" de volta para Date */
export function parseYearMonth(ym?: string | null): Date | null {
  if (!ym) return null
  const [monthName, yearStr] = ym.split('/')
  const monthIdx = MONTHS_PT.findIndex(
    (m) => m.toLowerCase() === monthName?.toLowerCase()
  )
  if (monthIdx === -1 || !yearStr) return null
  const d = new Date(parseInt(yearStr), monthIdx, 1)
  return isValid(d) ? d : null
}

/** Formata para exibição na UI: "Maio / 2025" */
export function formatYearMonth(ym?: string | null): string {
  if (!ym) return '—'
  const [monthName, yearStr] = ym.split('/')
  if (!monthName || !yearStr) return ym
  return `${monthName} / ${yearStr}`
}

/** Gera opções para o select de mês/ano (últimos 24 + próximos 6) */
export function generateYearMonthOptions(): YearMonth[] {
  const options: YearMonth[] = []
  const now = new Date()
  for (let i = -24; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const value = buildYearMonth(d)
    options.push({ label: formatYearMonth(value), value })
  }
  return options.reverse()
}

export function currentYearMonth(): string {
  return buildYearMonth(new Date())
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export const FREQUENCES = ['Mensal', 'Anual', 'Única', 'Quinzenal', 'Semanal']
export const REGISTRATION_TYPES = ['Compra Livre', 'Conta Fixa']
