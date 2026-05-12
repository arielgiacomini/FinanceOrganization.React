'use client'

import { useState, useEffect } from 'react'
import { billsToPayApi, accountsApi, categoriesApi } from '@/lib/api'
import { getFrequences, getRegistrationTypes, generateYearMonthOptions, currentYearMonth } from '@/lib/utils'
import type { BillToPay, Account } from '@/types'
import { Spinner } from '@/components/ui'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'

interface BillToPayFormProps {
  initial?: BillToPay
  onSuccess: () => void
  onCancel: () => void
}

const DRAFT_KEY = 'finance_billtopay_draft'

function saveDraft(form: Record<string, string>) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form))
}
function loadDraft(): Record<string, string> | null {
  try { const r = sessionStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r) : null } catch { return null }
}
function clearDraft() { sessionStorage.removeItem(DRAFT_KEY) }

const COUNTRIES = [
  { value: 'Brasil',  label: 'Brasil',  Flag: FlagBrasil  },
  { value: 'Espanha', label: 'Espanha', Flag: FlagEspanha },
]

export function BillToPayForm({ initial, onSuccess, onCancel }: BillToPayFormProps) {
  const isEdit = !!initial
  const ymOptions = generateYearMonthOptions()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [frequenceList] = useState(() => getFrequences())
  const [regTypeList] = useState(() => getRegistrationTypes())

  const draft = !initial ? loadDraft() : null
  const [form, setForm] = useState({
    name: initial?.name ?? draft?.name ?? '',
    account: initial?.account ?? draft?.account ?? '',
    category: initial?.category ?? draft?.category ?? '',
    value: initial?.value?.toString() ?? draft?.value ?? '',
    frequence: initial?.frequence ?? draft?.frequence ?? 'Mensal',
    registrationType: initial?.registrationType ?? draft?.registrationType ?? 'Compra Livre',
    purchaseDate: initial?.purchaseDate ? new Date(initial.purchaseDate).toISOString().slice(0, 10) : (draft?.purchaseDate ?? ''),
    dueDate: initial?.dueDate ? new Date(initial.dueDate).toISOString().slice(0, 10) : (draft?.dueDate ?? ''),
    initialMonthYear: initial?.yearMonth ?? draft?.initialMonthYear ?? currentYearMonth(),
    fynallyMonthYear: initial?.yearMonth ?? draft?.fynallyMonthYear ?? currentYearMonth(),
    bestPayDay: draft?.bestPayDay ?? '',
    additionalMessage: initial?.additionalMessage ?? draft?.additionalMessage ?? '',
    country: initial?.country ?? draft?.country ?? 'Brasil',
  })
  const hasDraft = !initial && !!draft
  const [sameMonth, setSameMonth] = useState(true)       // Mês inicial = final
  const [noFinalMonth, setNoFinalMonth] = useState(false) // Enviar null no final

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

  function set(key: string, value: string) {
    setForm((f) => {
      const next = { ...f, [key]: value }
      // Auto-fill bestPayDay quando purchaseDate é preenchida
      if (key === 'purchaseDate' && value) {
        const day = new Date(value + 'T12:00:00').getDate()
        next.bestPayDay = String(day)
      }
      // Sync fynallyMonthYear com initialMonthYear quando sameMonth
      if (key === 'initialMonthYear' && sameMonth) {
        next.fynallyMonthYear = value
      }
      if (!initial) saveDraft(next)
      return next
    })
  }

  function handleClearDraft() {
    clearDraft()
    setForm({
      name: '', account: '', category: '', value: '',
      frequence: frequenceList[0] ?? 'Mensal',
      registrationType: regTypeList[0] ?? 'Compra Livre',
      purchaseDate: '', dueDate: '',
      initialMonthYear: currentYearMonth(),
      fynallyMonthYear: currentYearMonth(),
      bestPayDay: '', additionalMessage: '', country: 'Brasil',
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isEdit) {
        const vm = {
          Id: initial!.id,
          IdFixedInvoice: Math.trunc(Number(initial!.idBillToPayRegistration)),
          Name: form.name || initial!.name,
          Account: form.account || initial!.account,
          Category: form.category || initial!.category,
          Value: parseFloat(form.value.replace(',', '.')) || initial!.value,
          PurchaseDate: form.purchaseDate || initial!.purchaseDate || null,
          DueDate: form.dueDate || initial!.dueDate,
          YearMonth: form.initialMonthYear || initial!.yearMonth,
          Frequence: initial!.frequence,
          RegistrationType: initial!.registrationType,
          PayDay: initial!.payDay ?? null,
          HasPay: initial!.hasPay,
          LastChangeDate: new Date().toISOString(),
          AdditionalMessage: form.additionalMessage || null,
          Country: form.country,
        }
        await billsToPayApi.edit(vm as never)
      } else {
        const now = new Date().toISOString()
        const vm = {
          name: form.name,
          account: form.account,
          category: form.category,
          value: parseFloat(form.value.replace(',', '.')) || 0,
          frequence: form.frequence,
          registrationType: form.registrationType,
          initialMonthYear: form.initialMonthYear,
          fynallyMonthYear: noFinalMonth ? null : (sameMonth ? form.initialMonthYear : form.fynallyMonthYear),
          purchaseDate: form.purchaseDate || null,
          bestPayDay: form.bestPayDay ? parseInt(form.bestPayDay) : null,
          additionalMessage: form.additionalMessage || null,
          accountType: 'Conta a Pagar',
          country: form.country,
          creationDate: now,
          lastChangeDate: null,
        }
        await billsToPayApi.create(vm as never)
      }
      if (!initial) clearDraft()
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="col-span-1 sm:col-span-2">
          <label className="label">Nome / Descrição *</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Conta de luz" required />
        </div>

        <div>
          <label className="label">Conta</label>
          <select className="input" value={form.account} onChange={(e) => set('account', e.target.value)}>
            <option value="">Selecione...</option>
            {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Categoria</label>
          <SearchableSelect
            value={form.category}
            options={categories}
            onChange={(v) => set('category', v)}
          />
        </div>

        <div>
          <label className="label">Valor *</label>
          <CurrencyInput
            value={form.value}
            country={form.country}
            onChange={(v) => set('value', v)}
            required
          />
        </div>

        {/* País */}
        <div>
          <label className="label">País</label>
          <div className="flex gap-2">
            {COUNTRIES.map(({ value, label, Flag }) => (
              <button
                key={value}
                type="button"
                onClick={() => set('country', value)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all"
                style={{
                  background: form.country === value ? 'var(--green-dim)' : 'var(--bg-3)',
                  border: `1px solid ${form.country === value ? 'var(--green-border)' : 'var(--border-1)'}`,
                  color: form.country === value ? 'var(--green-400)' : 'var(--text-2)',
                }}
              >
                <Flag size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {isEdit ? (
          <div>
            <label className="label">Data de Vencimento</label>
            <input className="input" type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </div>
        ) : (
          <div>
            <label className="label">Data de Compra</label>
            <input className="input" type="date" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} />
          </div>
        )}

        {!isEdit && (
          <>
            <div>
              <label className="label">Frequência</label>
              <select className="input" value={form.frequence} onChange={(e) => set('frequence', e.target.value)}>
                {frequenceList.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Tipo de Registro</label>
              <select className="input" value={form.registrationType} onChange={(e) => set('registrationType', e.target.value)}>
                {regTypeList.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="col-span-1 sm:col-span-2 space-y-3">
              {/* Mês/Ano inicial */}
              <div>
                <label className="label">Mês/Ano inicial</label>
                <select className="input" value={form.initialMonthYear} onChange={(e) => set('initialMonthYear', e.target.value)}>
                  {ymOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Checkboxes */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={sameMonth} disabled={noFinalMonth}
                    onChange={e => {
                      setSameMonth(e.target.checked)
                      if (e.target.checked) set('fynallyMonthYear', form.initialMonthYear)
                    }}
                    className="w-4 h-4 rounded accent-green-500" />
                  <span className="text-xs" style={{ color: noFinalMonth ? 'var(--text-3)' : 'var(--text-2)' }}>
                    Mesmo Mês/Ano final
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={noFinalMonth}
                    onChange={e => {
                      setNoFinalMonth(e.target.checked)
                      if (e.target.checked) setSameMonth(false)
                      else setSameMonth(true)
                    }}
                    className="w-4 h-4 rounded accent-green-500" />
                  <span className="text-xs" style={{ color: 'var(--text-2)' }}>
                    Sem Mês/Ano final (aberto)
                  </span>
                </label>
              </div>

              {/* Mês/Ano final — só quando não sameMonth e não noFinalMonth */}
              {!sameMonth && !noFinalMonth && (
                <div>
                  <label className="label">Mês/Ano final</label>
                  <select className="input" value={form.fynallyMonthYear} onChange={(e) => set('fynallyMonthYear', e.target.value)}>
                    {ymOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}
              {noFinalMonth && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(96,165,250,0.2)' }}>
                  Mês/Ano final será enviado como aberto (null)
                </p>
              )}
            </div>
          </>
        )}

        {!isEdit && (
          <div>
            <label className="label flex items-center gap-1.5">
              Melhor dia para pagar
              {form.purchaseDate && form.bestPayDay && (
                <span className="text-xs" style={{ color: 'var(--green-400)' }}>auto ✓</span>
              )}
            </label>
            <input className="input" type="number" min={1} max={31} value={form.bestPayDay} onChange={(e) => set('bestPayDay', e.target.value)} placeholder="Preenchido pela data de compra" />
          </div>
        )}

        <div className="col-span-1 sm:col-span-2">
          <label className="label">Observação</label>
          <textarea className="input resize-none" rows={2} value={form.additionalMessage} onChange={(e) => set('additionalMessage', e.target.value)} placeholder="Informações adicionais..." />
        </div>
      </div>

      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
          {error}
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <div>
          {hasDraft && (
            <button type="button" onClick={handleClearDraft}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--red-dim)]"
              style={{ color: 'var(--text-3)' }}>
              🗑 Limpar rascunho
            </button>
          )}
        </div>
        <div className="flex gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? <Spinner size={16} /> : null}
          {isEdit ? 'Salvar alterações' : 'Cadastrar'}
        </button>
        </div>
      </div>
    </form>
  )
}
