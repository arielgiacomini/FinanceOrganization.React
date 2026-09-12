'use client'

import { useEffect, useRef, useState } from 'react'
import { billsToPayApi, accountsApi, categoriesApi, NetworkError } from '@/lib/api'
import { buildYearMonth, formatCurrency, getFrequences, getRegistrationTypes } from '@/lib/utils'
import type { Account } from '@/types'
import { Spinner } from '@/components/ui'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { CountryPicker } from '@/components/ui/CountryPicker'
import { Check, Plus, SlidersHorizontal, Lightbulb, CalendarDays, WifiOff, CloudOff, X } from 'lucide-react'
import { loadQuickBillEnabledFields, loadQuickBillDefaultValues, loadUserCountries, loadDefaultCountryCode, DEFAULT_ACTIVE_COUNTRY_CODES, syncUserCountriesFromApi } from '@/lib/wallet'
import { loadCategoryHistory, suggestCategoriesForName } from '@/lib/categorySuggestion'
import type { CategorySuggestion } from '@/lib/categorySuggestion'
import { saveCachedAccounts, loadCachedAccounts, saveCachedCategories, loadCachedCategories } from '@/lib/offlineCache'
import { enqueueBill, getPendingQueue, removeFromQueue, syncPendingQueue } from '@/lib/offlineQueue'
import type { PendingBill } from '@/lib/offlineQueue'

// Constrói "YYYY-MM-DD" a partir de campos locais — nunca via toISOString(),
// que reinterpreta como UTC e desloca um dia em fusos negativos (Brasil, UTC-3).
function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// Reformatação pura de string (sem passar por Date) — evita qualquer risco de fuso horário.
function formatDDMMYYYY(dateKey: string): string {
  const [y, m, d] = dateKey.split('-')
  return `${d}/${m}/${y}`
}

// Normalização tolerante (minúsculo, sem acento, sem espaço nas pontas) — usada só
// pra casar o parâmetro "conta" vindo de URL externa com o nome exato cadastrado.
const ACCENT_MAP: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n',
}
function looseNormalize(s: string): string {
  return s.toLowerCase().trim().split('').map(ch => ACCENT_MAP[ch] ?? ch).join('')
}

// Acha a conta cadastrada que melhor casa com um texto livre (parâmetro de URL externa).
// 1) igual exato (ignorando maiúsculas/acentos); 2) por pontuação de palavras em comum —
// exige só a MAIORIA das palavras (não todas), porque automações externas (ex: atalho do
// iOS lendo notificação do cartão) costumam incluir a bandeira do cartão ("MC", "Visa")
// que não faz parte do nome cadastrado aqui, e isso não pode derrubar o casamento inteiro.
// Entre os candidatos, prioriza quem bate mais palavras e, empatado, o nome mais curto.
function findAccountMatch(query: string, accounts: Account[]): Account | null {
  const q = looseNormalize(query)
  if (!q) return null

  const exact = accounts.find(a => looseNormalize(a.name) === q)
  if (exact) return exact

  const tokens = q.split(/\s+/).filter(Boolean)
  if (!tokens.length) return null

  const minMatches = Math.ceil(tokens.length / 2)
  const scored = accounts
    .map(a => {
      const name = looseNormalize(a.name)
      const matches = tokens.filter(t => name.includes(t)).length
      return { account: a, matches }
    })
    .filter(({ matches }) => matches >= minMatches)
  if (!scored.length) return null

  scored.sort((a, b) => b.matches - a.matches || a.account.name.length - b.account.name.length)
  return scored[0].account
}

// Rascunho de sessão — mantém o que o usuário já preencheu caso o modal seja
// fechado sem querer (clique fora, X, etc.), para não ter que preencher de novo.
const QUICK_DRAFT_KEY = 'finance_quick_billtopay_draft'

function saveQuickDraft(data: Record<string, string>) {
  try { sessionStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify(data)) } catch {}
}
function loadQuickDraft(): Record<string, string> | null {
  try { const r = sessionStorage.getItem(QUICK_DRAFT_KEY); return r ? JSON.parse(r) : null } catch { return null }
}
function clearQuickDraft() {
  try { sessionStorage.removeItem(QUICK_DRAFT_KEY) } catch {}
}

export interface QuickBillPrefill {
  name: string
  value: string
  purchaseDate: string
  account: string
  category: string
  country: string
  frequence: string
  registrationType: string
  additionalMessage: string
  initialMonthYear: string
  fynallyMonthYear: string
  bestPayDay: string
}

// Campos em comum entre os dois modos, usados para repassar o que o usuário já
// preencheu ao trocar de formulário (em qualquer direção) ou vindo de parâmetros
// de URL (ex: atalho externo) — todos opcionais, o que não vier cai no rascunho
// ou no valor padrão configurado normalmente.
export interface BillToPayQuickValues {
  name?: string
  value?: string
  purchaseDate?: string
  account?: string
  category?: string
  country?: string
  frequence?: string
  registrationType?: string
  additionalMessage?: string
}

interface QuickBillToPayFormProps {
  onSaved: () => void
  /** queued=true quando o cadastro foi só guardado na fila offline, não confirmado pela API. */
  onDone: (queued?: boolean) => void
  onSwitchFull: (prefill: QuickBillPrefill) => void
  onCancel: () => void
  initialValues?: BillToPayQuickValues
  /**
   * Chave de lançamento rápido (?chave= na URL) — quando presente, usa as rotas
   * autenticadas via header X-Quick-Capture-Key em vez de sessão logada, para
   * funcionar direto de um atalho externo sem precisar entrar no sistema.
   */
  quickCaptureKey?: string
}

export function QuickBillToPayForm({ onSaved, onDone, onSwitchFull, onCancel, initialValues, quickCaptureKey }: QuickBillToPayFormProps) {
  const [enabledFields] = useState(() => loadQuickBillEnabledFields())
  const [defaults] = useState(() => loadQuickBillDefaultValues())

  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [frequenceList] = useState(() => getFrequences())
  const [regTypeList] = useState(() => getRegistrationTypes())

  const today = toDateInputValue(new Date())

  // Estado inicial NUNCA lê sessionStorage aqui — esta tela pode ser pré-renderizada
  // em build estático (sem acesso a sessionStorage), e ler o rascunho já no useState
  // faz a primeira renderização do cliente divergir do HTML do servidor (erro de
  // hidratação). O rascunho, quando existir, é aplicado logo após montar (useEffect
  // abaixo), que só roda no navegador e não precisa bater com o HTML do servidor.
  const [hasDraft, setHasDraft] = useState(false)

  const [name, setName] = useState(initialValues?.name ?? '')
  const [value, setValue] = useState(initialValues?.value ?? '')
  const [purchaseDate, setPurchaseDate] = useState(initialValues?.purchaseDate || today)
  // Calendário só aparece quando o usuário pede ("Informar Data") — se a data inicial não
  // bate com Hoje/Ontem/Anteontem, já começa no modo manual.
  const [manualDateMode, setManualDateMode] = useState(() => {
    const initial = initialValues?.purchaseDate || today
    const quickKeys = [0, -1, -2].map(n => toDateInputValue(addDays(new Date(), n)))
    return !quickKeys.includes(initial)
  })
  const [account, setAccount] = useState(initialValues?.account ?? defaults.account)
  const [category, setCategory] = useState(initialValues?.category ?? defaults.category)
  // Começa sempre com o mesmo valor estático do build (SSR não tem acesso ao
  // localStorage) — o valor real (país ativo configurado, ou rascunho salvo)
  // é aplicado logo depois de montar, no efeito abaixo, pra não conflitar com
  // o HTML pré-renderizado.
  const [country, setCountry] = useState(initialValues?.country ?? DEFAULT_ACTIVE_COUNTRY_CODES[0])
  const [frequence, setFrequence] = useState(initialValues?.frequence ?? defaults.frequence)
  const [registrationType, setRegistrationType] = useState(initialValues?.registrationType ?? defaults.registrationType)
  const [additionalMessage, setAdditionalMessage] = useState(initialValues?.additionalMessage ?? defaults.additionalMessage)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [flashMessage, setFlashMessage] = useState<null | 'saved' | 'queued'>(null)
  const [categorySuggestions, setCategorySuggestions] = useState<CategorySuggestion[]>([])
  const [usingCachedRefData, setUsingCachedRefData] = useState(false)
  const [refDataLoaded, setRefDataLoaded] = useState(false)
  const [pendingQueue, setPendingQueue] = useState<PendingBill[]>([])
  const [syncingQueue, setSyncingQueue] = useState(false)

  // Fila offline: carrega o que já estava pendente, e tenta sincronizar assim que
  // monta (caso a conexão já tenha voltado) e sempre que o navegador avisar que
  // ficou online de novo.
  useEffect(() => {
    setPendingQueue(getPendingQueue())

    function runSync() {
      setSyncingQueue(true)
      syncPendingQueue(() => setPendingQueue(getPendingQueue()), quickCaptureKey)
        .finally(() => setSyncingQueue(false))
    }
    runSync()

    window.addEventListener('online', runSync)
    return () => window.removeEventListener('online', runSync)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleManualSync() {
    setSyncingQueue(true)
    syncPendingQueue(() => setPendingQueue(getPendingQueue()), quickCaptureKey).finally(() => setSyncingQueue(false))
  }

  function handleRemoveQueued(id: string) {
    removeFromQueue(id)
    setPendingQueue(getPendingQueue())
  }

  // Aplica o rascunho salvo (se existir) já depois de montar no navegador — nunca
  // durante a renderização inicial, pra não conflitar com o HTML pré-renderizado.
  // initialValues (troca vinda do formulário completo) tem prioridade e ignora
  // qualquer rascunho antigo, por ser a intenção mais recente do usuário.
  useEffect(() => {
    // País ativo real (lido do localStorage) — só existe no cliente, por isso
    // só é aplicado aqui dentro do efeito, nunca no useState inicial. Roda
    // mesmo quando initialValues existe (ex: parâmetros de URL do atalho
    // externo — ?nome=&valor=&conta= — nunca trazem país), a não ser que
    // initialValues já traga um país explícito (troca vinda do formulário
    // completo, que sim deve ser respeitada como está).
    const activeCountries = loadUserCountries()
    const freshCountry = loadDefaultCountryCode()
    if (!initialValues?.country) setCountry(freshCountry)

    if (initialValues) return
    const draft = loadQuickDraft()
    if (!draft) return
    setHasDraft(true)
    if (draft.name) setName(draft.name)
    if (draft.value) setValue(draft.value)
    if (draft.purchaseDate) {
      setPurchaseDate(draft.purchaseDate)
      const quickKeys = [0, -1, -2].map(n => toDateInputValue(addDays(new Date(), n)))
      setManualDateMode(!quickKeys.includes(draft.purchaseDate))
    }
    if (draft.account) setAccount(draft.account)
    if (draft.category) setCategory(draft.category)
    // Só restaura o país do rascunho se ele ainda estiver ativo — um rascunho
    // salvo antes de o usuário desativar um país em Configurações não deve
    // trazer de volta um país que ele não usa mais.
    setCountry(draft.country && activeCountries.some(c => c.code === draft.country) ? draft.country : freshCountry)
    if (draft.frequence) setFrequence(draft.frequence)
    if (draft.registrationType) setRegistrationType(draft.registrationType)
    if (draft.additionalMessage) setAdditionalMessage(draft.additionalMessage)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Este formulário também é usado standalone em /lancamento-rapido (atalho
  // externo, sem AppLayout) — que por isso não passa pela sincronização de
  // países que o AppLayout faz em toda navegação normal. Sem isso, abrir o
  // atalho num aparelho/navegador que nunca visitou Configurações mostra o
  // país de fábrica (Brasil/Espanha) em vez do que foi realmente configurado.
  // Pulado no modo de chave de lançamento rápido: /v1/wallet/search exige
  // sessão logada (não está na allowlist da chave), e sem sessão a chamada
  // derrubaria a tela inteira pro /login/ antes mesmo do formulário aparecer.
  useEffect(() => {
    if (quickCaptureKey) return
    syncUserCountriesFromApi().then(changed => {
      if (changed && !initialValues?.country) setCountry(loadDefaultCountryCode())
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Salva o rascunho a cada alteração (pula o primeiro render para não gravar
  // o estado inicial vazio como se fosse um rascunho de verdade).
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    saveQuickDraft({ name, value, purchaseDate, account, category, country, frequence, registrationType, additionalMessage })
  }, [name, value, purchaseDate, account, category, country, frequence, registrationType, additionalMessage])

  useEffect(() => {
    Promise.all(quickCaptureKey ? [
      accountsApi.searchAllQuickCapture(quickCaptureKey),
      categoriesApi.searchQuickCapture({ accountType: 'Conta a Pagar', enable: true }, quickCaptureKey),
    ] : [
      accountsApi.searchAll(),
      categoriesApi.search({ accountType: 'Conta a Pagar', enable: true }),
    ]).then(([accRes, cats]) => {
      const loadedAccounts = (accRes.data ?? [])
        .filter(a => a.enable)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
      const loadedCategories = cats ?? []
      setAccounts(loadedAccounts)
      setCategories(loadedCategories)
      setUsingCachedRefData(false)
      setRefDataLoaded(true)
      // Guarda a cópia mais recente pra usar como fallback na próxima vez que abrir sem rede.
      saveCachedAccounts(loadedAccounts)
      saveCachedCategories(loadedCategories)

      // Conta veio de parâmetro externo (ex: atalho) e pode ser só um pedaço do nome
      // (ex: "Cartão Itaú") — acha o cadastro correspondente e corrige.
      if (initialValues?.account) {
        const match = findAccountMatch(initialValues.account, loadedAccounts)
        if (match) setAccount(match.name)
      }
    }).catch(() => {
      // Sem rede (ou API fora) — usa a última cópia salva no aparelho, se existir.
      const cachedAccounts = loadCachedAccounts()
      const cachedCategories = loadCachedCategories()
      setAccounts(cachedAccounts)
      setCategories(cachedCategories)
      setUsingCachedRefData(cachedAccounts.length > 0 || cachedCategories.length > 0)
      setRefDataLoaded(true)

      if (initialValues?.account) {
        const match = findAccountMatch(initialValues.account, cachedAccounts)
        if (match) setAccount(match.name)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Aquece o cache do histórico assim que o formulário abre, pra sugestão sair rápido.
  // Pulado no modo de chave de lançamento rápido: loadCategoryHistory() busca em
  // /v1/bills-to-pay/search, que exige sessão logada e não está na allowlist da
  // chave — sem sessão, essa chamada por si só já derruba a tela pro /login/.
  useEffect(() => { if (enabledFields.category && !quickCaptureKey) loadCategoryHistory() }, [enabledFields.category, quickCaptureKey])

  // Sugestão de categoria com base no nome digitado — roda de novo a cada mudança do nome
  // (mesmo já tendo uma categoria escolhida), pré-carregando a de maior probabilidade e
  // deixando as próximas como alternativa. Assim o usuário pode ajustar a qualquer momento
  // só continuando a editar o nome.
  useEffect(() => {
    if (!enabledFields.category || quickCaptureKey) return
    const t = setTimeout(() => {
      suggestCategoriesForName(name).then(list => {
        setCategorySuggestions(list)
        if (list.length) setCategory(list[0].category)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [name, enabledFields.category])

  function resetQuickFields() {
    setName('')
    setValue('')
    setPurchaseDate(today)
    setManualDateMode(false)
  }

  function handleClearDraft() {
    clearQuickDraft()
    setHasDraft(false)
    setName('')
    setValue('')
    setPurchaseDate(today)
    setManualDateMode(false)
    setAccount(defaults.account)
    setCategory(defaults.category)
    setCountry(defaults.country)
    setFrequence(defaults.frequence)
    setRegistrationType(defaults.registrationType)
    setAdditionalMessage(defaults.additionalMessage)
  }

  // Repassa tudo que já foi preenchido (ou definido como padrão) para o
  // formulário completo, para o usuário não perder o que já digitou ao trocar.
  function buildPrefill(): QuickBillPrefill {
    const purchase = purchaseDate ? new Date(purchaseDate + 'T12:00:00') : new Date()
    const yearMonth = buildYearMonth(purchase)
    return {
      name,
      value,
      purchaseDate,
      account: enabledFields.account ? account : defaults.account,
      category: enabledFields.category ? category : defaults.category,
      country: enabledFields.country ? country : defaults.country,
      frequence: enabledFields.frequence ? frequence : defaults.frequence,
      registrationType: enabledFields.registrationType ? registrationType : defaults.registrationType,
      additionalMessage: enabledFields.additionalMessage ? additionalMessage : defaults.additionalMessage,
      initialMonthYear: yearMonth,
      fynallyMonthYear: yearMonth,
      bestPayDay: purchaseDate ? String(purchase.getDate()) : '',
    }
  }

  async function submit(keepOpen: boolean) {
    setError('')
    if (!name.trim()) { setError('Informe o nome/descrição.'); return }
    const parsedValue = !isNaN(parseFloat(value.replace(',', '.'))) ? parseFloat(value.replace(',', '.')) : 0
    if (parsedValue <= 0) { setError('Informe um valor válido.'); return }

    setLoading(true)
    const purchase = purchaseDate ? new Date(purchaseDate + 'T12:00:00') : new Date()
    const yearMonth = buildYearMonth(purchase)
    const now = new Date().toISOString()
    const vm = {
      name: name.trim(),
      account: enabledFields.account ? account : defaults.account,
      category: enabledFields.category ? category : defaults.category,
      value: parsedValue,
      frequence: enabledFields.frequence ? frequence : defaults.frequence,
      registrationType: enabledFields.registrationType ? registrationType : defaults.registrationType,
      initialMonthYear: yearMonth,
      fynallyMonthYear: yearMonth,
      purchaseDate: purchaseDate || null,
      bestPayDay: purchaseDate ? purchase.getDate() : null,
      additionalMessage: (enabledFields.additionalMessage ? additionalMessage : defaults.additionalMessage) || null,
      accountType: 'Conta a Pagar',
      country: enabledFields.country ? country : defaults.country,
      creationDate: now,
      lastChangeDate: null,
    }
    try {
      if (quickCaptureKey) {
        await billsToPayApi.createQuickCapture(vm as never, quickCaptureKey)
      } else {
        await billsToPayApi.create(vm as never)
      }
      onSaved()
      if (keepOpen) {
        resetQuickFields()
        setFlashMessage('saved')
        setTimeout(() => setFlashMessage(null), 1500)
      } else {
        clearQuickDraft()
        onDone()
      }
    } catch (err: unknown) {
      if (err instanceof NetworkError) {
        // Sem conexão — guarda na fila local em vez de mostrar erro. Vai ser
        // reenviado sozinho assim que a internet voltar.
        try {
          enqueueBill(vm)
          setPendingQueue(getPendingQueue())
          onSaved()
          if (keepOpen) {
            resetQuickFields()
            setFlashMessage('queued')
            setTimeout(() => setFlashMessage(null), 2000)
          } else {
            clearQuickDraft()
            onDone(true)
          }
        } catch {
          setError('Sem conexão — não foi possível cadastrar agora. Tente novamente quando a internet voltar.')
        }
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao salvar')
      }
    } finally {
      setLoading(false)
    }
  }

  const dateChips = [
    { label: 'Hoje',      date: new Date() },
    { label: 'Ontem',     date: addDays(new Date(), -1) },
    { label: 'Anteontem', date: addDays(new Date(), -2) },
  ]

  return (
    <form onSubmit={e => { e.preventDefault(); submit(false) }} className="space-y-4">
      {pendingQueue.length > 0 && (
        <div className="rounded-lg text-xs px-3 py-2 space-y-2"
          style={{ background: 'var(--blue-dim)', border: '1px solid rgba(96,165,250,0.3)' }}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--blue)' }}>
              <CloudOff size={13} className="flex-shrink-0" />
              {pendingQueue.length} lançamento{pendingQueue.length > 1 ? 's' : ''} aguardando envio
            </span>
            <button type="button" onClick={handleManualSync} disabled={syncingQueue}
              className="underline flex-shrink-0" style={{ color: 'var(--blue)' }}>
              {syncingQueue ? 'Enviando...' : 'Tentar agora'}
            </button>
          </div>
          <div className="space-y-1">
            {pendingQueue.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-2" style={{ color: 'var(--text-2)' }}>
                <span className="truncate">
                  {item.name} — <span className="font-mono">{formatCurrency(item.value, (item.vm.country as string | undefined) ?? 'Brasil')}</span>
                </span>
                {item.lastError ? (
                  <button type="button" title={item.lastError} onClick={() => handleRemoveQueued(item.id)}
                    className="flex items-center gap-1 flex-shrink-0" style={{ color: 'var(--red)' }}>
                    Falhou <X size={11} />
                  </button>
                ) : (
                  <span className="flex-shrink-0" style={{ color: 'var(--text-3)' }}>na fila</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {usingCachedRefData && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
          style={{ background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(251,191,36,0.25)' }}>
          <WifiOff size={13} className="flex-shrink-0" />
          Sem conexão — mostrando Contas e Categorias salvas da última vez online.
        </div>
      )}
      <div>
        <label className="label">Nome / Descrição *</label>
        <input
          className="input w-full"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex: Almoço, Mercado, Uber..."
          autoFocus
          required
        />
      </div>

      {enabledFields.category && (
        <div>
          <label className="label">Categoria</label>
          <SearchableSelect value={category} options={categories} onChange={setCategory} />
          {categorySuggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                <Lightbulb size={11} className="flex-shrink-0" /> Sugestões com base no nome:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {categorySuggestions.map(s => {
                  const active = category === s.category
                  return (
                    <button
                      key={s.category}
                      type="button"
                      onClick={() => setCategory(s.category)}
                      title={`usado em "${s.matchedName}"`}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                      style={{
                        background: active ? 'var(--blue-dim)' : 'var(--bg-3)',
                        color: active ? 'var(--blue)' : 'var(--text-2)',
                        border: `1px solid ${active ? 'rgba(96,165,250,0.3)' : 'var(--border-1)'}`,
                      }}
                    >
                      {active && <Check size={12} className="flex-shrink-0" />}
                      <strong>{s.category}</strong>
                      <span style={{ opacity: 0.75 }}>{s.count}x</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="label">Valor *</label>
        <CurrencyInput
          value={value}
          country={country}
          onChange={setValue}
          required
        />
      </div>

      <div>
        <label className="label">Data de Compra</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {dateChips.map(({ label, date }) => {
            const key = toDateInputValue(date)
            const active = !manualDateMode && purchaseDate === key
            return (
              <button
                key={label}
                type="button"
                onClick={() => { setPurchaseDate(key); setManualDateMode(false) }}
                className="px-3 py-1.5 rounded-lg border text-sm font-medium transition-all"
                style={{
                  background: active ? 'var(--green-dim)' : 'var(--bg-3)',
                  border: `1px solid ${active ? 'var(--green-border)' : 'var(--border-1)'}`,
                  color: active ? 'var(--green-400)' : 'var(--text-2)',
                }}
              >
                {label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setManualDateMode(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all"
            style={{
              background: manualDateMode ? 'var(--green-dim)' : 'var(--bg-3)',
              border: `1px solid ${manualDateMode ? 'var(--green-border)' : 'var(--border-1)'}`,
              color: manualDateMode ? 'var(--green-400)' : 'var(--text-2)',
            }}
          >
            <CalendarDays size={14} /> Informar Data
          </button>
        </div>
        {manualDateMode ? (
          <input className="input w-full" type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
        ) : (
          <p className="text-sm px-1" style={{ color: 'var(--text-3)' }}>{formatDDMMYYYY(purchaseDate)}</p>
        )}
      </div>

      {enabledFields.account && (
        <div>
          <label className="label">Conta</label>
          {accounts.length === 0 ? (
            <p className="text-xs py-1" style={{ color: 'var(--text-3)' }}>
              {!refDataLoaded ? 'Carregando contas...' : 'Nenhuma conta disponível offline — abra esta tela uma vez com internet.'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accounts.map(a => {
                const active = account === a.name
                const hex = a.colors?.backgroundColorHexadecimal
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAccount(active ? '' : a.name)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all"
                    style={{
                      background: active ? (hex ? `${hex}22` : 'var(--green-dim)') : 'var(--bg-3)',
                      border: `1px solid ${active ? (hex ?? 'var(--green-border)') : 'var(--border-1)'}`,
                      color: active ? (hex ?? 'var(--green-400)') : 'var(--text-2)',
                    }}
                  >
                    {hex && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: hex, display: 'inline-block', flexShrink: 0 }} />
                    )}
                    {a.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {enabledFields.country && (
        <div>
          <label className="label">País</label>
          <CountryPicker value={country} onChange={setCountry} />
        </div>
      )}

      {enabledFields.frequence && (
        <div>
          <label className="label">Frequência</label>
          <select className="input w-full" value={frequence} onChange={e => setFrequence(e.target.value)}>
            {frequenceList.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      )}

      {enabledFields.registrationType && (
        <div>
          <label className="label">Tipo de Registro</label>
          <select className="input w-full" value={registrationType} onChange={e => setRegistrationType(e.target.value)}>
            {regTypeList.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      )}

      {enabledFields.additionalMessage && (
        <div>
          <label className="label">Observação</label>
          <textarea
            className="input w-full resize-y"
            rows={2}
            value={additionalMessage}
            onChange={e => setAdditionalMessage(e.target.value)}
            placeholder="Informações adicionais..."
          />
        </div>
      )}

      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
          {error}
        </p>
      )}

      <div className="flex items-center justify-between pt-2 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {hasDraft && (
            <button type="button" onClick={handleClearDraft}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--red-dim)]"
              style={{ color: 'var(--text-3)' }}>
              🗑 Limpar rascunho
            </button>
          )}
          <button
            type="button"
            onClick={() => onSwitchFull(buildPrefill())}
            className="inline-flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: 'var(--text-3)' }}
          >
            <SlidersHorizontal size={12} /> Usar formulário completo
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {flashMessage === 'saved' && <span className="text-xs font-medium" style={{ color: 'var(--green-400)' }}>Cadastrado ✓</span>}
          {flashMessage === 'queued' && <span className="text-xs font-medium" style={{ color: 'var(--blue)' }}>Salvo localmente ✓</span>}
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn-secondary" disabled={loading} onClick={() => submit(true)}>
            {loading ? <Spinner size={14} /> : <Plus size={14} />} Salvar e cadastrar outra
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Spinner size={16} /> : <Check size={16} />} Cadastrar
          </button>
        </div>
      </div>
    </form>
  )
}
