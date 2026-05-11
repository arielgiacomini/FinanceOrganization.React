'use client'

import { useState, useEffect } from 'react'
import { cashReceivableApi, accountsApi, categoriesApi } from '@/lib/api'
import { FREQUENCES, REGISTRATION_TYPES, generateYearMonthOptions, currentYearMonth, formatCurrency } from '@/lib/utils'
import type { CashReceivable, Account } from '@/types'
import { Spinner } from '@/components/ui'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'

interface CashReceivableFormProps {
  initial?: CashReceivable
  onSuccess: () => void
  onCancel: () => void
}

const COUNTRIES = [
  { value: 'Brasil',  label: 'Brasil',  Flag: FlagBrasil  },
  { value: 'Espanha', label: 'Espanha', Flag: FlagEspanha },
]

const readonlyStyle = {
  background: 'var(--bg-4)',
  border: '1px solid var(--border-1)',
  color: 'var(--text-3)',
  cursor: 'not-allowed',
  opacity: 0.75,
}

export function CashReceivableForm({ initial, onSuccess, onCancel }: CashReceivableFormProps) {
  const isEdit = !!initial
  const ymOptions = generateYearMonthOptions()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name:              initial?.name ?? '',
    account:           initial?.account ?? '',
    category:          initial?.category ?? '',
    value:             initial?.value?.toString() ?? '',
    manipulatedValue:  initial?.manipulatedValue?.toString() ?? '',
    frequence:         initial?.frequence ?? 'Mensal',
    registrationType:  initial?.registrationType ?? 'Compra Livre',
    agreementDate:     initial?.agreementDate ? initial.agreementDate.slice(0, 10) : '',
    dueDate:           initial?.dueDate ? new Date(initial.dueDate).toISOString().slice(0, 10) : '',
    dateReceived:      initial?.dateReceived ? initial.dateReceived.slice(0, 10) : '',
    hasReceived:       initial?.hasReceived ?? false,
    initialMonthYear:  initial?.yearMonth ?? currentYearMonth(),
    fynallyMonthYear:  initial?.yearMonth ?? currentYearMonth(),
    bestReceivingDay:  '',
    additionalMessage: initial?.additionalMessage ?? '',
    country:           initial?.country ?? 'Brasil',
  })

  useEffect(() => {
    Promise.all([
      accountsApi.searchAll(),
      categoriesApi.search({ accountType: 'Conta a Receber', enable: true }),
    ]).then(([accRes, cats]) => {
      setAccounts(accRes.data ?? [])
      setCategories(cats ?? [])
    }).catch(() => {})
  }, [])

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isEdit) {
        // Sanitize: strings vazias viram null (API espera DateTime? null, não "")
        const safeDate = (d: string) => d && d.trim() ? d : null
        const vm = {
          Id: initial!.id,
          IdCashReceivableRegistration: Number(initial!.idCashReceivableRegistration),
          Name: form.name || initial!.name || '',
          Account: form.account || initial!.account || '',
          Frequence: form.frequence || initial!.frequence || '',
          RegistrationType: form.registrationType || initial!.registrationType || '',
          AgreementDate: safeDate(form.agreementDate),
          DueDate: safeDate(form.dueDate),
          YearMonth: form.initialMonthYear || initial!.yearMonth || '',
          Category: form.category || initial!.category || '',
          Value: parseFloat(form.value.replace(',', '.')) || initial!.value,
          ManipulatedValue: parseFloat(form.manipulatedValue.replace(',', '.')) || initial!.manipulatedValue || 0,
          DateReceived: safeDate(form.dateReceived),
          HasReceived: form.hasReceived,
          AdditionalMessage: form.additionalMessage || null,
          Enabled: true,
          LastChangeDate: new Date().toISOString(),
          Country: form.country,
          MustEditRegistrationAccount: true,
        }
        await cashReceivableApi.edit(vm as never)
      } else {
        const vm = {
          name: form.name,
          account: form.account,
          category: form.category,
          value: parseFloat(form.value.replace(',', '.')) || 0,
          frequence: form.frequence,
          registrationType: form.registrationType,
          agreementDate: form.agreementDate || undefined,
          initialMonthYear: form.initialMonthYear,
          fynallyMonthYear: form.fynallyMonthYear,
          bestReceivingDay: parseInt(form.bestReceivingDay) || 1,
          additionalMessage: form.additionalMessage || undefined,
          accountType: 'Conta a Receber',
          country: form.country,
        }
        await cashReceivableApi.create(vm as never)
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

        {/* Nome */}
        <div className="col-span-2">
          <label className="label">Nome / Descrição *</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Salário" required />
        </div>

        {/* Conta */}
        <div>
          <label className="label">Conta</label>
          <select className="input" value={form.account} onChange={(e) => set('account', e.target.value)}>
            <option value="">Selecione...</option>
            {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
        </div>

        {/* Categoria */}
        <div>
          <label className="label">Categoria</label>
          <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">Selecione...</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Valor */}
        <div>
          <label className="label">Valor *</label>
          <input className="input" type="text" inputMode="decimal" value={form.value} onChange={(e) => set('value', e.target.value)} placeholder="0,00" required />
        </div>

        {/* Valor Manipulado — só na edição */}
        {isEdit ? (
          <div>
            <label className="label">
              Saldo (Valor Manipulado)
              <span className="ml-1.5 text-xs" style={{ color: 'var(--text-3)' }}>— saldo disponível</span>
            </label>
            <input className="input" type="text" inputMode="decimal" value={form.manipulatedValue} onChange={(e) => set('manipulatedValue', e.target.value)} placeholder="0,00" />
          </div>
        ) : (
          <div>
            <label className="label">Melhor dia para receber</label>
            <input className="input" type="number" min={1} max={31} value={form.bestReceivingDay} onChange={(e) => set('bestReceivingDay', e.target.value)} placeholder="Ex: 5" />
          </div>
        )}

        {/* País */}
        <div>
          <label className="label">País</label>
          <div className="flex gap-2">
            {COUNTRIES.map(({ value, label, Flag }) => (
              <button key={value} type="button" onClick={() => set('country', value)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all"
                style={{
                  background: form.country === value ? 'var(--green-dim)' : 'var(--bg-3)',
                  border: `1px solid ${form.country === value ? 'var(--green-border)' : 'var(--border-1)'}`,
                  color: form.country === value ? 'var(--green-400)' : 'var(--text-2)',
                }}>
                <Flag size={16} />{label}
              </button>
            ))}
          </div>
        </div>

        {/* Frequência */}
        <div>
          <label className="label">Frequência</label>
          <select className="input" value={form.frequence} onChange={(e) => set('frequence', e.target.value)}>
            {FREQUENCES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        {/* Tipo de Registro */}
        <div>
          <label className="label">Tipo de Registro</label>
          <select className="input" value={form.registrationType} onChange={(e) => set('registrationType', e.target.value)}>
            {REGISTRATION_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Mês/Ano — só criação */}
        {!isEdit && (
          <>
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

        {/* Mês/Ano referência — só edição */}
        {isEdit && (
          <div>
            <label className="label">Mês/Ano</label>
            <select className="input" value={form.initialMonthYear} onChange={(e) => set('initialMonthYear', e.target.value)}>
              {ymOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}

        {/* Data de Acordo */}
        <div>
          <label className="label">Data de Acordo</label>
          <input className="input" type="date" value={form.agreementDate} onChange={(e) => set('agreementDate', e.target.value)} />
        </div>

        {/* Data de Vencimento */}
        <div>
          <label className="label">Data de Vencimento</label>
          <input className="input" type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </div>

        {/* Recebido — só edição */}
        {isEdit && (
          <>
            <div>
              <label className="label">Data de Recebimento</label>
              <input className="input" type="date" value={form.dateReceived} onChange={(e) => set('dateReceived', e.target.value)} />
            </div>

            <div>
              <label className="label">Status</label>
              <div className="flex gap-2">
                {[{ value: false, label: 'Aguardando' }, { value: true, label: 'Recebido' }].map(({ value, label }) => (
                  <button key={String(value)} type="button" onClick={() => set('hasReceived', value)}
                    className="flex-1 py-2 rounded-lg border text-sm font-medium transition-all"
                    style={{
                      background: form.hasReceived === value ? (value ? 'var(--green-dim)' : 'var(--amber-dim)') : 'var(--bg-3)',
                      border: `1px solid ${form.hasReceived === value ? (value ? 'var(--green-border)' : 'rgba(251,191,36,0.3)') : 'var(--border-1)'}`,
                      color: form.hasReceived === value ? (value ? 'var(--green-400)' : 'var(--amber)') : 'var(--text-2)',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ID do Registro — leitura */}
            <div>
              <label className="label flex items-center gap-1.5">
                ID do Registro
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>leitura</span>
              </label>
              <input className="input" readOnly value={initial?.idCashReceivableRegistration ?? ''} style={readonlyStyle} />
            </div>
          </>
        )}

        {/* Observação */}
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
