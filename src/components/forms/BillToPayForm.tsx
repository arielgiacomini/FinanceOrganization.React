'use client'

import { useState, useEffect } from 'react'
import { billsToPayApi, accountsApi, categoriesApi } from '@/lib/api'
import { FREQUENCES, REGISTRATION_TYPES, generateYearMonthOptions, currentYearMonth } from '@/lib/utils'
import type { BillToPay, Account } from '@/types'
import { Spinner } from '@/components/ui'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'

interface BillToPayFormProps {
  initial?: BillToPay
  onSuccess: () => void
  onCancel: () => void
}

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

  const [form, setForm] = useState({
    name: initial?.name ?? '',
    account: initial?.account ?? '',
    category: initial?.category ?? '',
    value: initial?.value?.toString() ?? '',
    frequence: initial?.frequence ?? 'Mensal',
    registrationType: initial?.registrationType ?? 'Compra Livre',
    purchaseDate: initial?.purchaseDate ? new Date(initial.purchaseDate).toISOString().slice(0, 10) : '',
    dueDate: initial?.dueDate ? new Date(initial.dueDate).toISOString().slice(0, 10) : '',
    initialMonthYear: initial?.yearMonth ?? currentYearMonth(),
    fynallyMonthYear: initial?.yearMonth ?? currentYearMonth(),
    bestPayDay: '',
    additionalMessage: initial?.additionalMessage ?? '',
    country: initial?.country ?? 'Brasil',
  })

  useEffect(() => {
    Promise.all([
      accountsApi.searchAll(),
      categoriesApi.search({ accountType: 'Conta a Pagar', enable: true }),
    ]).then(([accRes, cats]) => {
      setAccounts(accRes.data ?? [])
      setCategories(cats ?? [])
    }).catch(() => {})
  }, [])

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
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
        const vm = {
          name: form.name,
          account: form.account,
          category: form.category,
          value: parseFloat(form.value.replace(',', '.')) || 0,
          frequence: form.frequence,
          registrationType: form.registrationType,
          initialMonthYear: form.initialMonthYear,
          fynallyMonthYear: form.fynallyMonthYear,
          purchaseDate: form.purchaseDate || undefined,
          bestPayDay: form.bestPayDay ? parseInt(form.bestPayDay) : undefined,
          additionalMessage: form.additionalMessage || undefined,
          accountType: 'Conta a Pagar',
          country: form.country,
        }
        await billsToPayApi.create(vm as never)
      }
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

        <div className="col-span-2">
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
          <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">Selecione...</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Valor (R$) *</label>
          <input className="input" type="text" inputMode="decimal" value={form.value} onChange={(e) => set('value', e.target.value)} placeholder="0,00" required />
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
            <label className="label">Melhor dia para pagar</label>
            <input className="input" type="number" min={1} max={31} value={form.bestPayDay} onChange={(e) => set('bestPayDay', e.target.value)} placeholder="Ex: 10" />
          </div>
        )}

        {!isEdit && (
          <>
            <div>
              <label className="label">Frequência</label>
              <select className="input" value={form.frequence} onChange={(e) => set('frequence', e.target.value)}>
                {FREQUENCES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Tipo de Registro</label>
              <select className="input" value={form.registrationType} onChange={(e) => set('registrationType', e.target.value)}>
                {REGISTRATION_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Mês/Ano inicial</label>
              <select className="input" value={form.initialMonthYear} onChange={(e) => set('initialMonthYear', e.target.value)}>
                {ymOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Mês/Ano final</label>
              <select className="input" value={form.fynallyMonthYear} onChange={(e) => set('fynallyMonthYear', e.target.value)}>
                {ymOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </>
        )}

        <div>
          <label className="label">Data de Compra</label>
          <input className="input" type="date" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} />
        </div>

        <div className="col-span-2">
          <label className="label">Observação</label>
          <textarea className="input resize-none" rows={2} value={form.additionalMessage} onChange={(e) => set('additionalMessage', e.target.value)} placeholder="Informações adicionais..." />
        </div>
      </div>

      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? <Spinner size={16} /> : null}
          {isEdit ? 'Salvar alterações' : 'Cadastrar'}
        </button>
      </div>
    </form>
  )
}
