/**
 * Sugestão de categoria com base no histórico de nomes já cadastrados em
 * Contas a Pagar. Busca os últimos meses uma única vez (cacheado em memória
 * pela sessão do app) e casa o nome digitado por substring — sem chamada
 * nova à API a cada tecla.
 */

import { billsToPayApi } from '@/lib/api'
import { buildYearMonth } from '@/lib/utils'

const HISTORY_MONTHS = 6
const MIN_CHARS = 3

const ACCENT_MAP: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n',
}

function normalize(s: string): string {
  return s.toLowerCase().split('').map(ch => ACCENT_MAP[ch] ?? ch).join('').trim()
}

interface HistoryEntry {
  normalizedName: string
  originalName: string
  category: string
}

export interface CategorySuggestion {
  category: string
  matchedName: string
  count: number
}

let historyCache: HistoryEntry[] | null = null
let historyPromise: Promise<HistoryEntry[]> | null = null

/** Carrega (e cacheia pela sessão) o histórico dos últimos meses para sugestão. */
export function loadCategoryHistory(): Promise<HistoryEntry[]> {
  if (historyCache) return Promise.resolve(historyCache)
  if (historyPromise) return historyPromise

  const now = new Date()
  const months = Array.from({ length: HISTORY_MONTHS }, (_, i) =>
    buildYearMonth(new Date(now.getFullYear(), now.getMonth() - i, 1))
  )

  historyPromise = Promise.all(
    months.map(yearMonth => billsToPayApi.search({ yearMonth, showDetails: false }).catch(() => null))
  ).then(results => {
    const entries: HistoryEntry[] = []
    for (const res of results) {
      const bills = res?.output?.data ?? []
      for (const b of bills) {
        if (!b.name || !b.category) continue
        entries.push({ normalizedName: normalize(b.name), originalName: b.name, category: b.category })
      }
    }
    historyCache = entries
    return entries
  })

  return historyPromise
}

const MAX_SUGGESTIONS = 3

function matchCategories(q: string, history: HistoryEntry[]): CategorySuggestion[] {
  const matches = history.filter(h => h.normalizedName.includes(q) || q.includes(h.normalizedName))
  if (!matches.length) return []

  const byCategory: Record<string, { count: number; sampleName: string }> = {}
  matches.forEach(m => {
    const entry = byCategory[m.category] ?? { count: 0, sampleName: m.originalName }
    entry.count++
    byCategory[m.category] = entry
  })

  return Object.entries(byCategory)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, MAX_SUGGESTIONS)
    .map(([category, v]) => ({ category, matchedName: v.sampleName, count: v.count }))
}

/**
 * Sugere até 3 categorias (da mais usada para a menos usada) entre os nomes do
 * histórico que casam com o nome digitado. Roda a cada mudança do nome — nunca
 * "trava" numa escolha anterior, então o usuário pode refinar a qualquer momento.
 */
export async function suggestCategoriesForName(typedName: string): Promise<CategorySuggestion[]> {
  const q = normalize(typedName)
  if (q.length < MIN_CHARS) return []
  const history = await loadCategoryHistory()
  return matchCategories(q, history)
}
