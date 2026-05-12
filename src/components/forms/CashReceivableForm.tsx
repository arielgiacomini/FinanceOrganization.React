'use client'

import { useState, useEffect } from 'react'
import { cashReceivableApi, accountsApi, categoriesApi } from '@/lib/api'
import { getFrequences, getRegistrationTypes, generateYearMonthOptions, currentYearMonth, formatCurrency } from '@/lib/utils'
import type { CashReceivable, Account } from '@/types'
import { Spinner } from '@/components/ui'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'

interface CashReceivableFormProps {
  initial?: CashReceivable
  onSuccess: () => void
  onCancel: () => void
}

const DRAFT_KEY = 'finance_cashreceivable_draft'

function saveDraft(form: Record<string, string | boolean>) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form))
}
function loadDraft(): Record<string, string | boolean> | null {
  try { const r = sessionStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r) : null } catch { return null }
}
function clearDraft() { sessionStorage.removeItem(DRAFT_KEY) }

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
  const [frequenceList] = useState(() => getFrequences())
  const [regTypeList] = useState(() => getRegistrationTypes())

  const draft = !initial ? loadDraft() : null
  const [form, setForm] = useState({
    name:              initial?.name ?? draft?.name as string ?? '',
    account:           initial?.account ?? draft?.account as string ?? '',
    category:          initial?.category ?? draft?.category as string ?? '',
    value:             initial?.value?.toString() ?? draft?.value as string ?? '',
    manipulatedValue:  initial?.manipulatedValue?.toString() ?? draft?.manipulatedValue as string ?? '',
    frequence:         initial?.frequence ?? draft?.frequence as string ?? 'Mensal',
    registrationType:  initial?.registrationType ?? draft?.registrationType as string ?? 'Compra Livre',
    agreementDate:     initial?.agreementDate ? initial.agreementDate.slice(0, 10) : (draft?.agreementDate as string ?? ''),
    dueDate:           initial?.dueDate ? new Date(initial.dueDate).toISOString().slice(0, 10) : (draft?.dueDate as string ?? ''),
    dateReceived:      initial?.dateReceived ? initial.dateReceived.slice(0, 10) : (draft?.dateReceived as string ?? ''),
    hasReceived:       initial?.hasReceived ?? (draft?.hasReceived as boolean ?? false),
    initialMonthYear:  initial?.yearMonth ?? draft?.initialMonthYear as string ?? currentYearMonth(),
    fynallyMonthYear:  initial?.yearMonth ?? draft?.fynallyMonthYear as string ?? currentYearMonth(),
    bestReceivingDay:  draft?.bestReceivingDay as string ?? '',
    additionalMessage: initial?.additionalMessage ?? draft?.additionalMessage as string ?? '',
    country:           initial?.country ?? draft?.country as string ?? 'Brasil',
  })
  const hasDraft = !initial && !!draft
  const [sameMonth, setSameMonth] = useState(true)
  const [noFinalMonth, setNoFinalMonth] = useState(false)

  useEffect(() => {
    Promise.all([
      accountsApi.searchAll(),
      categoriesApi.search({ accountType: 'Conta a Receber', enable: true }),
    ]).then(([accRes, cats]) => {
      setAccounts(
        (accRes.data ?? [])
          .filter(a => a.enable)
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
      )
      setCategories(cats ?? [])
    }).catch(() => {})
  }, [])

  function set(key: string, value: string | boolean) {
    setForm((f) => {
      const next = { ...f, [key]: value }
      if (key === 'initialMonthYear' && sameMonth) {
        next.fynallyMonthYear = value as string
      }
      if (!initial) saveDraft(next)
      return next
    })
  }

  function handleClearDraft() {
    clearDraft()
    setForm({
      name: '', account: '', category: '', value: '', manipulatedValue: '',
      frequence: 'Mensal', registrationType: 'Compra Livre',
      agreementDate: '', dueDate: '', dateReceived: '', hasReceived: false,
      initialMonthYear: currentYearMonth(), fynallyMonthYear: currentYearMonth(),
      bestReceivingDay: '', additionalMessage: '', country: 'Brasil',
    })
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
        const now = new Date().toISOString()
        const vm = {
          name: form.name,
          account: form.account,
          category: form.category,
          value: parseFloat(form.value.replace(',', '.')) || 0,
          frequence: form.frequence,
          registrationType: form.registrationType,
          agreementDate: form.agreementDate || null,
          initialMonthYear: form.initialMonthYear,
          fynallyMonthYear: noFinalMonth ? null : (sameMonth ? form.initialMonthYear : form.fynallyMonthYear),
          bestReceivingDay: parseInt(form.bestReceivingDay) || 1,
          additionalMessage: form.additionalMessage || null,
          accountType: 'Conta a Receber',
          country: form.country,
          creationDate: now,
          lastChangeDate: null,
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
        <div className="col-span-1 sm:col-span-2">
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
          <SearchableSelect
            value={form.category}
            options={categories}
            onChange={(v) => set('category', v)}
          />
        </div>

        {/* Valor */}
        <div>
          <label className="label">Valor *</label>
          <CurrencyInput
            value={form.value}
            country={form.country}
            onChange={(v) => set('value', v)}
            required
          />
        </div>

        {/* Valor Manipulado — só na edição */}
        {isEdit ? (
          <div>
            <label className="label">
              Saldo (Valor Manipulado)
              <span className="ml-1.5 text-xs" style={{ color: 'var(--text-3)' }}>— saldo disponível</span>
            </label>
            <CurrencyInput
              value={form.manipulatedValue}
              country={form.country}
              onChange={(v) => set('manipulatedValue', v)}
            />
          </div>
        ) : (
          <div>
            <label className="label">Data de Vencimento</label>
            <input className="input" type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
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
            {frequenceList.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        {/* Tipo de Registro */}
        <div>
          <label className="label">Tipo de Registro</label>
          <select className="input" value={form.registrationType} onChange={(e) => set('registrationType', e.target.value)}>
            {regTypeList.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Mês/Ano — só criação */}
        {!isEdit && (
          <>
            <div className="col-span-1 sm:col-span-2 space-y-3">
              <div>
                <label className="label">Mês/Ano inicial</label>
                <select className="input" value={form.initialMonthYear} onChange={(e) => set('initialMonthYear', e.target.value)}>
                  {ymOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
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

        {/* Melhor dia para receber */}
        {!isEdit && (
          <div>
            <label className="label">Melhor dia para receber</label>
            <input className="input" type="number" min={1} max={31} value={form.bestReceivingDay} onChange={(e) => set('bestReceivingDay', e.target.value)} placeholder="Ex: 5" />
          </div>
        )}

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
