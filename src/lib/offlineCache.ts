/**
 * Cache local simples (localStorage) de dados de referência — usado pra deixar o
 * Cadastro Rápido usável mesmo offline (contas e categorias da última vez que a
 * tela abriu com internet). Sem expiração: a cópia mais recente sempre substitui
 * a anterior quando a API responde com sucesso.
 */

import type { Account } from '@/types'

const ACCOUNTS_KEY = 'finance_cached_accounts'
const CATEGORIES_KEY = 'finance_cached_categories_billtopay'

export function saveCachedAccounts(accounts: Account[]) {
  try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)) } catch {}
}

export function loadCachedAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveCachedCategories(categories: string[]) {
  try { localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories)) } catch {}
}

export function loadCachedCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
