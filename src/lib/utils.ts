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

export const DEFAULT_FREQUENCES = ['Livre', 'Mensal', 'Mensal:Recorrente', 'Apenas desta vez']
export const DEFAULT_REGISTRATION_TYPES = ['Compra Livre', 'Conta/Fatura Fixa']

const FREQ_KEY = 'finance_frequences'
const REG_KEY  = 'finance_registration_types'

export function getFrequences(): string[] {
  if (typeof window === 'undefined') return DEFAULT_FREQUENCES
  try {
    const v = localStorage.getItem(FREQ_KEY)
    return v ? JSON.parse(v) : DEFAULT_FREQUENCES
  } catch { return DEFAULT_FREQUENCES }
}

export function getRegistrationTypes(): string[] {
  if (typeof window === 'undefined') return DEFAULT_REGISTRATION_TYPES
  try {
    const v = localStorage.getItem(REG_KEY)
    return v ? JSON.parse(v) : DEFAULT_REGISTRATION_TYPES
  } catch { return DEFAULT_REGISTRATION_TYPES }
}

export function saveFrequences(list: string[]) {
  localStorage.setItem(FREQ_KEY, JSON.stringify(list))
}

export function saveRegistrationTypes(list: string[]) {
  localStorage.setItem(REG_KEY, JSON.stringify(list))
}

// Manter retrocompatibilidade
export const FREQUENCES = DEFAULT_FREQUENCES
export const REGISTRATION_TYPES = DEFAULT_REGISTRATION_TYPES
