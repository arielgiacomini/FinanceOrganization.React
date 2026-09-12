import { format, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { YearMonth } from '@/types'
import { getSession } from '@/lib/auth'
import { findCountryInfo } from '@/lib/countries'

// ─── Currency ─────────────────────────────────────────────────────────────────

// Fallback pra país vazio/desconhecido (nunca deveria acontecer com dado
// válido, mas mantém o comportamento de sempre em vez de quebrar a formatação).
const FALLBACK_CURRENCY = 'BRL'
const FALLBACK_LOCALE = 'pt-BR'

export function formatCurrency(value: number, country?: string | null, opts?: { compact?: boolean }): string {
  const info = findCountryInfo(country)
  return new Intl.NumberFormat(info?.locale ?? FALLBACK_LOCALE, {
    style: 'currency',
    currency: info?.currency ?? FALLBACK_CURRENCY,
    // compact: números grandes/redondos (gráficos de projeção) mostram sem
    // ",00" — só usa casas decimais quando o valor realmente tem centavos.
    ...(opts?.compact ? { minimumFractionDigits: 0 } : {}),
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

/** "YYYY-MM-DD" de hoje em horário local — nunca via `new Date().toISOString()`,
 *  que converte pra UTC antes de fatiar e pode cair no dia seguinte (fusos
 *  negativos, fim do dia) ou anterior (fusos positivos, início do dia). */
export function todayDateInputValue(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

/** Extrai "YYYY-MM-DD" direto do prefixo de uma data ISO vinda da API (ex:
 *  "2026-09-04T00:00:00"), pra popular um `<input type="date">` — nunca via
 *  `new Date(valor).toISOString()`, que desloca o dia dependendo do fuso
 *  horário do navegador de quem está usando o app. */
export function safeDateInputValue(value?: string | null): string {
  if (!value) return ''
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value)
  return match ? match[1] : ''
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

// Essas duas listas não têm espelho no backend (ao contrário das outras
// configs em wallet.ts) — não dá pra simplesmente limpar no login de um
// usuário novo sem perder o que o dono já tinha customizado. Em vez disso,
// cada usuário tem a sua própria chave, sufixada pelo id da sessão.
function scopedKey(base: string): string {
  const userId = getSession()?.userId
  return userId ? `${base}:${userId}` : base
}

export function getFrequences(): string[] {
  if (typeof window === 'undefined') return DEFAULT_FREQUENCES
  try {
    const v = localStorage.getItem(scopedKey(FREQ_KEY))
    return v ? JSON.parse(v) : DEFAULT_FREQUENCES
  } catch { return DEFAULT_FREQUENCES }
}

export function getRegistrationTypes(): string[] {
  if (typeof window === 'undefined') return DEFAULT_REGISTRATION_TYPES
  try {
    const v = localStorage.getItem(scopedKey(REG_KEY))
    return v ? JSON.parse(v) : DEFAULT_REGISTRATION_TYPES
  } catch { return DEFAULT_REGISTRATION_TYPES }
}

export function saveFrequences(list: string[]) {
  localStorage.setItem(scopedKey(FREQ_KEY), JSON.stringify(list))
}

export function saveRegistrationTypes(list: string[]) {
  localStorage.setItem(scopedKey(REG_KEY), JSON.stringify(list))
}

// Manter retrocompatibilidade
export const FREQUENCES = DEFAULT_FREQUENCES
export const REGISTRATION_TYPES = DEFAULT_REGISTRATION_TYPES

// ─── Contas com Saldo Disponível ──────────────────────────────────────────────

/** Fallback usado quando o registro ainda não existe na wallet API. */
export const DEFAULT_SALDO_CONTAS = ['Vale Refeição iFood Beneficios']
