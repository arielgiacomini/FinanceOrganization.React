'use client'

import { useEffect, useRef, useState } from 'react'
import { billsToPayApi, accountsApi, categoriesApi } from '@/lib/api'
import { buildYearMonth, getFrequences, getRegistrationTypes } from '@/lib/utils'
import type { Account } from '@/types'
import { Spinner } from '@/components/ui'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'
import { Check, Plus, SlidersHorizontal, Lightbulb, CalendarDays } from 'lucide-react'
import { loadQuickBillEnabledFields, loadQuickBillDefaultValues } from '@/lib/wallet'
import { loadCategoryHistory, suggestCategoriesForName } from '@/lib/categorySuggestion'
import type { CategorySuggestion } from '@/lib/categorySuggestion'

const COUNTRIES = [
  { value: 'Brasil',  label: 'Brasil',  Flag: FlagBrasil  },
  { value: 'Espanha', label: 'Espanha', Flag: FlagEspanha },
]

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

// Campos em comum entre os dois modos, usados para repassar o que o usuário
// já preencheu ao trocar de formulário (em qualquer direção).
export interface BillToPayQuickValues {
  name: string
  value: string
  purchaseDate: string
  account: string
  category: string
  country: string
  frequence: string
  registrationType: string
  additionalMessage: string
}

interface QuickBillToPayFormProps {
  onSaved: () => void
  onDone: () => void
  onSwitchFull: (prefill: QuickBillPrefill) => void
  onCancel: () => void
  initialValues?: BillToPayQuickValues
}

export function QuickBillToPayForm({ onSaved, onDone, onSwitchFull, onCancel, initialValues }: QuickBillToPayFormProps) {
  const [enabledFields] = useState(() => loadQuickBillEnabledFields())
  const [defaults] = useState(() => loadQuickBillDefaultValues())

  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [frequenceList] = useState(() => getFrequences())
  const [regTypeList] = useState(() => getRegistrationTypes())

  const today = toDateInputValue(new Date())

  // initialValues (troca vinda do formulário completo) tem prioridade sobre
  // um rascunho antigo — é a intenção mais recente do usuário.
  const draft = !initialValues ? loadQuickDraft() : null
  const [hasDraft] = useState(() => !!draft)

  const [name, setName] = useState(initialValues?.name ?? draft?.name ?? '')
  const [value, setValue] = useState(initialValues?.value ?? draft?.value ?? '')
  const [purchaseDate, setPurchaseDate] = useState(initialValues?.purchaseDate || draft?.purchaseDate || today)
  // Calendário só aparece quando o usuário pede ("Informar Data") — se a data inicial não
  // bate com Hoje/Ontem/Anteontem (ex: veio de um rascunho antigo), já começa no modo manual.
  const [manualDateMode, setManualDateMode] = useState(() => {
    const initial = initialValues?.purchaseDate || draft?.purchaseDate || today
    const quickKeys = [0, -1, -2].map(n => toDateInputValue(addDays(new Date(), n)))
    return !quickKeys.includes(initial)
  })
  const [account, setAccount] = useState(initialValues?.account ?? draft?.account ?? defaults.account)
  const [category, setCategory] = useState(initialValues?.category ?? draft?.category ?? defaults.category)
  const [country, setCountry] = useState(initialValues?.country ?? draft?.country ?? defaults.country)
  const [frequence, setFrequence] = useState(initialValues?.frequence ?? draft?.frequence ?? defaults.frequence)
  const [registrationType, setRegistrationType] = useState(initialValues?.registrationType ?? draft?.registrationType ?? defaults.registrationType)
  const [additionalMessage, setAdditionalMessage] = useState(initialValues?.additionalMessage ?? draft?.additionalMessage ?? defaults.additionalMessage)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)
  const [categorySuggestions, setCategorySuggestions] = useState<CategorySuggestion[]>([])

  // Salva o rascunho a cada alteração (pula o primeiro render para não gravar
  // o estado inicial vazio como se fosse um rascunho de verdade).
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    saveQuickDraft({ name, value, purchaseDate, account, category, country, frequence, registrationType, additionalMessage })
  }, [name, value, purchaseDate, account, category, country, frequence, registrationType, additionalMessage])

  useEffect(() => {
    Promise.all([
      accountsApi.searchAll(),
      categoriesApi.search({ accountType: 'Conta a Pagar', enable: true }),
    ]).then(([accRes, cats]) => {
      setAccounts(
        (accRes.data ?? [])
          .filter(a => a.enable)
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
      )
      setCategories(cats ?? [])
    }).catch(() => {})
  }, [])

  // Aquece o cache do histórico assim que o formulário abre, pra sugestão sair rápido.
  useEffect(() => { if (enabledFields.category) loadCategoryHistory() }, [enabledFields.category])

  // Sugestão de categoria com base no nome digitado — roda de novo a cada mudança do nome
  // (mesmo já tendo uma categoria escolhida), pré-carregando a de maior probabilidade e
  // deixando as próximas como alternativa. Assim o usuário pode ajustar a qualquer momento
  // só continuando a editar o nome.
  useEffect(() => {
    if (!enabledFields.category) return
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
    try {
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
      await billsToPayApi.create(vm as never)
      onSaved()
      if (keepOpen) {
        resetQuickFields()
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 1500)
      } else {
        clearQuickDraft()
        onDone()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
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
          country={enabledFields.country ? country : defaults.country}
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
            <p className="text-xs py-1" style={{ color: 'var(--text-3)' }}>Carregando contas...</p>
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
          <div className="flex gap-2">
            {COUNTRIES.map(({ value: v, label, Flag }) => (
              <button
                key={v}
                type="button"
                onClick={() => setCountry(v)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all"
                style={{
                  background: country === v ? 'var(--green-dim)' : 'var(--bg-3)',
                  border: `1px solid ${country === v ? 'var(--green-border)' : 'var(--border-1)'}`,
                  color: country === v ? 'var(--green-400)' : 'var(--text-2)',
                }}
              >
                <Flag size={16} />
                {label}
              </button>
            ))}
          </div>
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
          {savedFlash && <span className="text-xs font-medium" style={{ color: 'var(--green-400)' }}>Cadastrado ✓</span>}
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
