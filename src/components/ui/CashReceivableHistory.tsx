'use client'

import { useEffect, useState, useCallback } from 'react'
import { cashReceivableApi, accountsApi, categoriesApi } from '@/lib/api'
import { formatCurrency, formatDate, formatYearMonth, FREQUENCES, REGISTRATION_TYPES } from '@/lib/utils'
import type { CashReceivable, Account, EditCashReceivableViewModel } from '@/types'
import { Td, TRow, Spinner, Empty, Modal } from '@/components/ui'
import { CashReceivableForm } from '@/components/forms/CashReceivableForm'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { ReceiveModal } from '@/components/ui/ReceiveModal'
import { normalizeCountry } from '@/components/ui/CountryTabs'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'
import {
  X, CheckCircle2, AlertCircle, CircleDollarSign,
  TrendingUp, Calendar, Pencil, Trash2, ReceiptText,
  SquareCheck, Square, Minus, Plus, PencilLine, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react'

interface CashReceivableHistoryProps {
  item: CashReceivable
  onClose: () => void
  onRefreshParent: () => void
}

const MONTHS: Record<string, number> = {
  Janeiro: 0, Fevereiro: 1, Março: 2, Abril: 3, Maio: 4, Junho: 5,
  Julho: 6, Agosto: 7, Setembro: 8, Outubro: 9, Novembro: 10, Dezembro: 11,
}

function ymToNum(ym?: string): number {
  if (!ym) return 0
  const [month, year] = ym.split('/')
  return parseInt(year) * 12 + (MONTHS[month] ?? 0)
}

function currentYmNum(): number {
  const now = new Date()
  return now.getFullYear() * 12 + now.getMonth()
}

function isCurrentMonth(ym?: string) { return ymToNum(ym) === currentYmNum() }
function isPastMonth(ym?: string) { return ymToNum(ym) < currentYmNum() }

function sortHistory(data: CashReceivable[]): CashReceivable[] {
  const cur = currentYmNum()
  const past    = data.filter(h => ymToNum(h.yearMonth) < cur)
                      .sort((a, b) => ymToNum(a.yearMonth) - ymToNum(b.yearMonth))
  const current = data.filter(h => ymToNum(h.yearMonth) === cur)
  const future  = data.filter(h => ymToNum(h.yearMonth) > cur)
                      .sort((a, b) => ymToNum(a.yearMonth) - ymToNum(b.yearMonth))
  return [...past, ...current, ...future]
}

// ─── Bulk Edit Form ───────────────────────────────────────────────────────────

const readonlyStyle = {
  background: 'var(--bg-4)', border: '1px solid var(--border-1)',
  color: 'var(--text-3)', cursor: 'not-allowed', opacity: 0.7,
}

function BulkEditForm({ selected, onSuccess, onCancel }: {
  selected: CashReceivable[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const first = selected[0]
  const isSingle = selected.length === 1
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustOp, setAdjustOp]     = useState<'add' | 'sub'>('sub')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustValue, setAdjustValue] = useState(true)
  const [adjustManip, setAdjustManip] = useState(true)
  const [editValues, setEditValues] = useState(false)

  const [form, setForm] = useState({
    name:              first?.name ?? '',
    account:           first?.account ?? '',
    frequence:         first?.frequence ?? '',
    registrationType:  first?.registrationType ?? '',
    category:          first?.category ?? '',
    value:             first?.value?.toString() ?? '',
    manipulatedValue:  first?.manipulatedValue?.toString() ?? '',
    additionalMessage: first?.additionalMessage ?? '',
    country:           first?.country ?? 'Brasil',
    dueDate:           first?.dueDate ? String(first.dueDate).slice(0, 10) : '',
    agreementDate:     first?.agreementDate ? String(first.agreementDate).slice(0, 10) : '',
    dateReceived:      first?.dateReceived ? String(first.dateReceived).slice(0, 10) : '',
    hasReceived:       first?.hasReceived ?? false,
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

  function set(key: string, val: string | boolean) { setForm(f => ({ ...f, [key]: val })) }

  function applyAdjust() {
    const amount = parseFloat(adjustAmount.replace(',', '.')) || 0
    if (amount <= 0 || (!adjustValue && !adjustManip)) return
    const delta = adjustOp === 'add' ? amount : -amount
    if (adjustValue) set('value', String(Math.max(0, (parseFloat(form.value.replace(',', '.')) || 0) + delta)))
    if (adjustManip) set('manipulatedValue', String(Math.max(0, (parseFloat(form.manipulatedValue.replace(',', '.')) || 0) + delta)))
    setAdjustOpen(false)
    setAdjustAmount('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const basket: EditCashReceivableViewModel[] = selected.map(h => ({
        id: h.id,
        idCashReceivableRegistration: h.idCashReceivableRegistration,
        name:              form.name || h.name,
        account:           form.account || h.account,
        frequence:         form.frequence || h.frequence,
        registrationType:  form.registrationType || h.registrationType,
        category:          form.category || h.category,
        value:             editValues ? (parseFloat(form.value.replace(',', '.')) || h.value) : h.value,
        manipulatedValue:  editValues ? (parseFloat(form.manipulatedValue.replace(',', '.')) || h.manipulatedValue) : h.manipulatedValue,
        yearMonth:         h.yearMonth,
        hasReceived:       form.hasReceived,
        dateReceived:      h.dateReceived,
        dueDate:           h.dueDate,
        agreementDate:     h.agreementDate,
        additionalMessage: form.additionalMessage,
        lastChangeDate:    new Date().toISOString(),
        country:           form.country,
        mustEditRegistrationAccount: true,
      }))
      await cashReceivableApi.editBasket(basket)
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const diff = (key: keyof CashReceivable) => new Set(selected.map(h => String(h[key] ?? ''))).size > 1

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-lg px-4 py-3 text-xs" style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(96,165,250,0.2)' }}>
        Editando <strong>{selected.length}</strong> registro(s).
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nome */}
        <div className="sm:col-span-2">
          <label className="label flex items-center gap-1.5">
            Nome / Descrição *
            {diff('name') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}
          </label>
          <input className="input w-full" type="text" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>

        {/* Conta + Categoria */}
        <div>
          <label className="label flex items-center gap-1.5">
            Conta
            {diff('account') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}
          </label>
          <select className="input w-full" value={form.account} onChange={e => set('account', e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label flex items-center gap-1.5">
            Categoria
            {diff('category') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}
          </label>
          <select className="input w-full" value={form.category} onChange={e => set('category', e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Valor + Saldo — toggle de edição */}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="label mb-0">Valor e Saldo</span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={editValues} onChange={e => { setEditValues(e.target.checked); if (!e.target.checked) setAdjustOpen(false) }}
                className="w-4 h-4 rounded accent-green-500" />
              <span className="text-xs" style={{ color: editValues ? 'var(--green-400)' : 'var(--text-3)' }}>
                Editar valores
              </span>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={adjustOpen ? "sm:col-span-2" : ""}>
              <label className="label flex items-center gap-1.5">
                Valor *
                {diff('value') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}
                {editValues && (
                  <button type="button"
                    className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                    onClick={() => { setAdjustOpen(v => !v); setAdjustAmount(''); setAdjustOp('sub') }}
                    style={{
                      color: adjustOpen ? 'var(--green-400)' : 'var(--blue)',
                      background: adjustOpen ? 'var(--green-dim)' : undefined,
                      border: '1px solid ' + (adjustOpen ? 'var(--green-border)' : 'rgba(96,165,250,0.3)'),
                    }}>
                    <RefreshCw size={11} /> {adjustOpen ? 'Fechar reajuste' : 'Reajustar'}
                  </button>
                )}
              </label>
              <div style={!editValues ? readonlyStyle : undefined} className={!editValues ? 'rounded-lg overflow-hidden pointer-events-none' : ''}>
                <CurrencyInput value={form.value} country={form.country} onChange={v => { if (editValues) set('value', v) }} />
              </div>
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                Saldo (Valor Manipulado)
                {diff('manipulatedValue') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}
              </label>
              <div style={!editValues ? readonlyStyle : undefined} className={!editValues ? 'rounded-lg overflow-hidden pointer-events-none' : ''}>
                <CurrencyInput value={form.manipulatedValue} country={form.country} onChange={v => { if (editValues) set('manipulatedValue', v) }} />
              </div>
            </div>
          </div>
        </div>

        {/* Painel de reajuste */}
        {adjustOpen && (
          <div className="sm:col-span-2 rounded-xl p-4 space-y-3 animate-slide-up"
            style={{ background: 'var(--bg-3)', border: '1px solid rgba(96,165,250,0.3)' }}>
            <div className="flex items-center gap-2">
              <RefreshCw size={14} style={{ color: 'var(--blue)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Reajustar valor</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Operação</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAdjustOp('sub')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all"
                    style={{ background: adjustOp === 'sub' ? 'var(--red-dim)' : 'var(--bg-2)', borderColor: adjustOp === 'sub' ? 'var(--red)' : 'var(--border-1)', color: adjustOp === 'sub' ? 'var(--red)' : 'var(--text-2)' }}>
                    <Minus size={14} /> Subtrair
                  </button>
                  <button type="button" onClick={() => setAdjustOp('add')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all"
                    style={{ background: adjustOp === 'add' ? 'var(--green-dim)' : 'var(--bg-2)', borderColor: adjustOp === 'add' ? 'var(--green-border)' : 'var(--border-1)', color: adjustOp === 'add' ? 'var(--green-400)' : 'var(--text-2)' }}>
                    <Plus size={14} /> Somar
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Valor do reajuste</label>
                <CurrencyInput value={adjustAmount} country={form.country} onChange={setAdjustAmount} />
              </div>
            </div>
            <div>
              <label className="label">Aplicar em</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={adjustValue} onChange={e => setAdjustValue(e.target.checked)} className="w-4 h-4 rounded accent-green-500" />
                  <span className="text-xs" style={{ color: 'var(--text-2)' }}>Aplicar no Valor</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={adjustManip} onChange={e => setAdjustManip(e.target.checked)} className="w-4 h-4 rounded accent-green-500" />
                  <span className="text-xs" style={{ color: 'var(--text-2)' }}>Aplicar em Valor Manipulado</span>
                </label>
              </div>
              {!adjustValue && !adjustManip && <p className="text-xs mt-1.5" style={{ color: 'var(--red)' }}>Selecione ao menos um campo.</p>}
            </div>
            {adjustAmount && parseFloat(adjustAmount.replace(',', '.')) > 0 && (adjustValue || adjustManip) && (
              <div className="rounded-lg px-3 py-2.5 text-xs space-y-1.5" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
                <div className="flex items-center justify-between font-medium" style={{ color: adjustOp === 'add' ? 'var(--green-400)' : 'var(--red)' }}>
                  <span>{adjustOp === 'add' ? '+ Soma' : '− Subtração'}:</span>
                  <span className="font-mono">{(parseFloat(adjustAmount.replace(',', '.')) || 0).toFixed(2)}</span>
                </div>
                {adjustValue && (
                  <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: 'var(--border-1)' }}>
                    <span style={{ color: 'var(--text-3)' }}>Aplicar no Valor: <span className="font-mono">{(parseFloat(form.value.replace(',', '.')) || 0).toFixed(2)}</span> →</span>
                    <span className="font-mono font-bold" style={{ color: 'var(--text-1)' }}>
                      {((parseFloat(form.value.replace(',', '.')) || 0) + (adjustOp === 'add' ? 1 : -1) * (parseFloat(adjustAmount.replace(',', '.')) || 0)).toFixed(2)}
                    </span>
                  </div>
                )}
                {adjustManip && (
                  <div className="flex items-center justify-between" style={{ borderTop: !adjustValue ? '1px solid var(--border-1)' : undefined, paddingTop: !adjustValue ? 6 : 0 }}>
                    <span style={{ color: 'var(--text-3)' }}>Aplicar em Valor Manipulado: <span className="font-mono">{(parseFloat(form.manipulatedValue.replace(',', '.')) || 0).toFixed(2)}</span> →</span>
                    <span className="font-mono font-bold" style={{ color: 'var(--text-1)' }}>
                      {((parseFloat(form.manipulatedValue.replace(',', '.')) || 0) + (adjustOp === 'add' ? 1 : -1) * (parseFloat(adjustAmount.replace(',', '.')) || 0)).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setAdjustOpen(false)}>Cancelar</button>
              <button type="button" className="btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={applyAdjust}
                disabled={!adjustAmount || parseFloat(adjustAmount.replace(',', '.')) <= 0 || (!adjustValue && !adjustManip)}>
                Aplicar reajuste
              </button>
            </div>
          </div>
        )}

        {/* Data Vencimento + País */}
        <div>
          <label className="label flex items-center gap-1.5">Data de Vencimento <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>leitura</span></label>
          <input type="date" className="input w-full" value={form.dueDate} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label className="label">País</label>
          <div className="flex gap-2">
            {([{ value: 'Brasil', Flag: FlagBrasil }, { value: 'Espanha', Flag: FlagEspanha }] as const).map(({ value, Flag }) => (
              <button key={value} type="button" onClick={() => set('country', value)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all"
                style={{
                  background: form.country === value ? 'var(--green-dim)' : 'var(--bg-3)',
                  border: `1px solid ${form.country === value ? 'var(--green-border)' : 'var(--border-1)'}`,
                  color: form.country === value ? 'var(--green-400)' : 'var(--text-2)',
                }}>
                <Flag size={16} />{value}
              </button>
            ))}
          </div>
        </div>

        {/* Frequência + Tipo de Registro */}
        <div>
          <label className="label flex items-center gap-1.5">
            Frequência
            {diff('frequence') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}
          </label>
          <select className="input w-full" value={form.frequence} onChange={e => set('frequence', e.target.value)}>
            {FREQUENCES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="label flex items-center gap-1.5">
            Tipo de Registro
            {diff('registrationType') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}
          </label>
          <select className="input w-full" value={form.registrationType} onChange={e => set('registrationType', e.target.value)}>
            {REGISTRATION_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Data de Acordo + Data de Recebimento */}
        <div>
          <label className="label flex items-center gap-1.5">Data de Acordo <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>leitura</span></label>
          <input type="date" className="input w-full" value={form.agreementDate} readOnly style={readonlyStyle} />
        </div>
        <div>
          <label className="label flex items-center gap-1.5">Data de Recebimento <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>leitura</span></label>
          <input type="date" className="input w-full" value={form.dateReceived} readOnly style={readonlyStyle} />
        </div>

        {/* Status */}
        <div className="sm:col-span-2">
          <label className="label">Status</label>
          <div className="flex gap-2">
            {([{ label: 'Aguardando', value: false }, { label: 'Recebido', value: true }] as const).map(({ label, value }) => (
              <button key={label} type="button" onClick={() => set('hasReceived', value)}
                className="flex-1 py-2 rounded-lg border text-sm font-medium transition-all"
                style={{
                  background: form.hasReceived === value ? (value ? 'var(--green-dim)' : 'rgba(245,158,11,0.1)') : 'var(--bg-3)',
                  border: `1px solid ${form.hasReceived === value ? (value ? 'var(--green-border)' : 'rgba(245,158,11,0.4)') : 'var(--border-1)'}`,
                  color: form.hasReceived === value ? (value ? 'var(--green-400)' : 'var(--amber)') : 'var(--text-2)',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Observação */}
        <div className="sm:col-span-2">
          <label className="label">Observação</label>
          <textarea className="input w-full resize-y" rows={4} style={{ minHeight: 96 }} value={form.additionalMessage} onChange={e => set('additionalMessage', e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Spinner size={16} /> : <PencilLine size={16} />}
          Salvar em {selected.length} registro(s)
        </button>
      </div>
    </form>
  )
}


// ─── Main Drawer ──────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { key: 'all',        label: 'Todos'         },
  { key: 'unreceived', label: 'Não recebidos' },
  { key: 'received',   label: 'Recebidos'     },
] as const
type StatusFilter = typeof STATUS_FILTERS[number]['key']

export function CashReceivableHistory({ item, onClose, onRefreshParent }: CashReceivableHistoryProps) {
  const [history, setHistory] = useState<CashReceivable[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showDetails, setShowDetails] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [editTarget, setEditTarget]     = useState<CashReceivable | null>(null)
  const [receiveTarget, setReceiveTarget] = useState<CashReceivable | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CashReceivable | null>(null)
  const [deleting, setDeleting]         = useState(false)
  const [bulkEditOpen, setBulkEditOpen]     = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await cashReceivableApi.searchByRegistration(Number(item.idCashReceivableRegistration))
      setHistory(sortHistory(res.output?.data ?? []))
      setSelected(new Set())
    } finally {
      setLoading(false)
    }
  }, [item.idCashReceivableRegistration])

  useEffect(() => { load() }, [load])

  const totalReceived = history.filter(h => h.hasReceived).reduce((s, h) => s + h.value, 0)
  const totalPending  = history.filter(h => !h.hasReceived).reduce((s, h) => s + h.value, 0)
  const total         = history.reduce((s, h) => s + h.value, 0)
  const receivedCount = history.filter(h => h.hasReceived).length
  const pendingCount  = history.length - receivedCount

  const visibleHistory = history.filter(h =>
    statusFilter === 'all' ? true : statusFilter === 'received' ? h.hasReceived : !h.hasReceived
  )

  const allSelected  = visibleHistory.length > 0 && visibleHistory.every(h => selected.has(h.id))
  const someSelected = selected.size > 0 && !allSelected
  const selectedItems = history.filter(h => selected.has(h.id))

  function changeFilter(key: StatusFilter) {
    setStatusFilter(key)
    setSelected(new Set())
  }
  function toggleAll() { setSelected(allSelected ? new Set() : new Set(visibleHistory.map(h => h.id))) }
  function toggleOne(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await cashReceivableApi.delete({ id: [deleteTarget.id] })
      setDeleteTarget(null)
      await load(); onRefreshParent()
    } finally { setDeleting(false) }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    try {
      await Promise.all(selectedItems.map(h => cashReceivableApi.delete({ id: [h.id] })))
      setBulkDeleteOpen(false)
      await load(); onRefreshParent()
    } finally { setBulkDeleting(false) }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} onClick={onClose} />

      {/* Drawer: right on desktop, bottom sheet on mobile */}
      <div
        className="history-drawer fixed z-50 flex flex-col
          bottom-0 left-0 right-0 rounded-t-2xl
          sm:bottom-auto sm:top-0 sm:left-auto sm:right-0 sm:h-screen sm:rounded-none"
        style={{
          width: '100%',
          maxHeight: '92dvh',
          background: 'var(--bg-1)',
          borderTop: '1px solid var(--border-2)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
          animation: 'slideInBottom 0.25s ease-out',
        }}
      >
        <style>{`
          @media (min-width: 640px) {
            .history-drawer {
              width: min(960px, 100vw) !important;
              max-height: 100vh !important;
              border-top: none !important;
              border-left: 1px solid var(--border-2) !important;
              box-shadow: -8px 0 32px rgba(0,0,0,0.4) !important;
              animation: slideInRight 0.25s ease-out !important;
            }
          }
          @keyframes slideInBottom {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-2)' }} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-4 sm:px-6 py-4 sm:py-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-1)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--green-dim)', color: 'var(--green-400)' }}>
              <ReceiptText size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-sm sm:text-base truncate" style={{ color: 'var(--text-1)' }}>{item.name}</h2>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>
                {item.account} · {item.category} · {item.frequence} · ID #{item.idCashReceivableRegistration}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-3)] flex-shrink-0 ml-2" style={{ color: 'var(--text-3)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Stats — 2 cols on mobile, 4 on desktop */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-2)' }}>
            {[
              { icon: <Calendar size={13} />,     label: 'Parcelas',       value: `${receivedCount} / ${history.length} recebidas`, color: 'var(--text-2)'    },
              { icon: <TrendingUp size={13} />,   label: 'Total geral',    value: formatCurrency(total, item.country),               color: 'var(--text-1)'    },
              { icon: <CheckCircle2 size={13} />, label: 'Total recebido', value: formatCurrency(totalReceived, item.country),       color: 'var(--green-400)' },
              { icon: <AlertCircle size={13} />,  label: 'Pendente',       value: formatCurrency(totalPending, item.country),        color: 'var(--amber)'     },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="px-4 sm:px-6 py-3 sm:py-4">
                <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-3)' }}>{icon}<span className="text-xs">{label}</span></div>
                <p className="text-sm sm:text-base font-semibold truncate" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="flex flex-col gap-2 px-4 sm:px-6 py-2 sm:py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-3)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs sm:text-sm font-medium" style={{ color: 'var(--text-2)' }}>
                  <span style={{ color: 'var(--green-400)' }}>{selected.size}</span> selecionado(s)
                </span>
                {(() => {
                  const brItems = selectedItems.filter(h => (h.country ?? '').trim().toLowerCase() !== 'espanha')
                  const esItems = selectedItems.filter(h => (h.country ?? '').trim().toLowerCase() === 'espanha')
                  const brTotal = brItems.reduce((s, h) => s + (h.manipulatedValue ?? h.value ?? 0), 0)
                  const esTotal = esItems.reduce((s, h) => s + (h.manipulatedValue ?? h.value ?? 0), 0)
                  const hasBoth = brItems.length > 0 && esItems.length > 0
                  return (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'var(--text-3)' }}>
                      <span style={{ color: 'var(--border-2)' }}>·</span>
                      {brItems.length > 0 && (
                        <span className="flex items-center gap-1">
                          {hasBoth && <FlagBrasil size={12} />}
                          <span className="font-mono font-semibold" style={{ color: 'var(--green-400)' }}>
                            {formatCurrency(brTotal, 'Brasil')}
                          </span>
                        </span>
                      )}
                      {esItems.length > 0 && (
                        <span className="flex items-center gap-1">
                          {hasBoth && <span style={{ color: 'var(--border-2)' }}>·</span>}
                          {hasBoth && <FlagEspanha size={12} />}
                          <span className="font-mono font-semibold" style={{ color: 'var(--green-400)' }}>
                            {formatCurrency(esTotal, 'Espanha')}
                          </span>
                        </span>
                      )}
                    </div>
                  )
                })()}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setSelected(new Set())}>Limpar</button>
                <button type="button" onClick={() => setBulkEditOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(96,165,250,0.25)' }}>
                  <PencilLine size={13} /> Editar {selected.size}
                </button>
                <button type="button" onClick={() => setBulkDeleteOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(248,113,113,0.25)' }}>
                  <Trash2 size={13} /> Excluir {selected.size}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Options bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-2)' }}>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>
              {statusFilter === 'all'
                ? `${history.length} registro(s)`
                : `${visibleHistory.length} de ${history.length} registro(s)`}
            </span>
            <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
              {STATUS_FILTERS.map(({ key, label }) => {
                const count = key === 'all' ? history.length : key === 'received' ? receivedCount : pendingCount
                const active = statusFilter === key
                return (
                  <button key={key} type="button" onClick={() => changeFilter(key)}
                    className="text-xs px-2.5 py-1 rounded-md font-medium transition-colors"
                    style={{
                      background: active ? 'var(--green-dim)' : 'transparent',
                      color: active ? 'var(--green-400)' : 'var(--text-3)',
                    }}>
                    {label} <span style={{ opacity: 0.7 }}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <button type="button"
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showDetails ? 'border-[var(--green-border)] text-[var(--green-400)] bg-[var(--green-dim)]' : 'border-[var(--border-1)] text-[var(--text-3)]'}`}
            onClick={() => setShowDetails(v => !v)}>
            {showDetails ? <ChevronUp size={12} className="inline mr-1" /> : <ChevronDown size={12} className="inline mr-1" />}
            {showDetails ? 'Ocultar detalhes' : 'Mostrar detalhes'}
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex justify-center items-center h-48"><Spinner size={28} /></div>
          ) : history.length === 0 ? (
            <Empty message="Nenhum histórico encontrado." />
          ) : visibleHistory.length === 0 ? (
            <Empty message="Nenhum registro neste filtro." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse', background: 'var(--bg-1)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-1)' }}>
                  <th className="px-4 py-3 w-10 sm:sticky sm:top-0 sm:z-10" style={{ background: 'var(--bg-3)', boxShadow: 'inset 0 -1px 0 var(--border-1)' }}>
                    <button type="button" onClick={toggleAll}
                      style={{ color: allSelected ? 'var(--green-400)' : someSelected ? 'var(--amber)' : 'var(--text-3)' }}>
                      {allSelected ? <SquareCheck size={16} /> : someSelected ? <Minus size={16} /> : <Square size={16} />}
                    </button>
                  </th>
                  {['Mês/Ano', 'País', 'Valor', 'Saldo', 'Vencimento', 'Recebido em', 'Status', 'Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium sm:sticky sm:top-0 sm:z-10" style={{ color: 'var(--text-3)', background: 'var(--bg-3)', boxShadow: 'inset 0 -1px 0 var(--border-1)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleHistory.map(h => {
                  const isSelected = selected.has(h.id)
                  const isCurrent  = isCurrentMonth(h.yearMonth)
                  const bg = isSelected ? 'rgba(96,165,250,0.10)' : isCurrent && !h.hasReceived ? 'rgba(251,191,36,0.08)' : h.hasReceived ? 'rgba(34,197,94,0.06)' : 'var(--bg-1)'

                  return (
                    <TRow key={h.id} bg={bg}>
                      <Td>
                        <button type="button" onClick={() => toggleOne(h.id)} style={{ color: isSelected ? 'var(--blue)' : 'var(--text-3)' }}>
                          {isSelected ? <SquareCheck size={15} /> : <Square size={15} />}
                        </button>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium" style={{ color: isCurrent ? 'var(--amber)' : isPastMonth(h.yearMonth) ? 'var(--text-3)' : 'var(--text-1)' }}>
                            {formatYearMonth(h.yearMonth)}
                          </span>
                          {isCurrent && <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(251,191,36,0.15)', color: 'var(--amber)', border: '1px solid rgba(251,191,36,0.3)' }}>Atual</span>}
                          {isPastMonth(h.yearMonth) && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>Passado</span>}
                        </div>
                        {showDetails && h.additionalMessage && <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{h.additionalMessage}</p>}
                      </Td>
                      <Td>
                        {h.country ? (
                          <div className="flex items-center gap-1.5">
                            {normalizeCountry(h.country) === 'Espanha' ? <FlagEspanha size={15} /> : <FlagBrasil size={15} />}
                            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{normalizeCountry(h.country)}</span>
                          </div>
                        ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </Td>
                      <Td><span className="font-mono text-xs font-semibold" style={{ color: h.hasReceived ? 'var(--text-3)' : 'var(--green-400)' }}>{formatCurrency(h.value, h.country)}</span></Td>
                      <Td><span className="font-mono text-xs" style={{ color: h.manipulatedValue < h.value ? 'var(--amber)' : 'var(--text-2)' }}>{formatCurrency(h.manipulatedValue, h.country)}</span></Td>
                      <Td className="text-xs">{formatDate(h.dueDate)}</Td>
                      <Td className="text-xs">{formatDate(h.dateReceived)}</Td>
                      <Td>
                        {h.hasReceived
                          ? <span className="badge-paid"><CheckCircle2 size={10} />Recebido</span>
                          : <span className="badge-pending"><AlertCircle size={10} />Aguardando</span>}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          {!h.hasReceived && (
                            <button type="button" title="Receber" className="p-1.5 rounded-md transition-colors hover:bg-[var(--green-dim)]" style={{ color: 'var(--green-400)' }} onClick={() => setReceiveTarget(h)}>
                              <CircleDollarSign size={14} />
                            </button>
                          )}
                          <button type="button" title="Editar" className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-4)]" style={{ color: 'var(--text-3)' }} onClick={() => setEditTarget(h)}>
                            <Pencil size={14} />
                          </button>
                          <button type="button" title="Excluir" className="p-1.5 rounded-md transition-colors hover:bg-[var(--red-dim)]" style={{ color: 'var(--text-3)' }} onClick={() => setDeleteTarget(h)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </Td>
                    </TRow>
                  )
                })}
              </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar Lançamento" size="lg">
        {editTarget && <CashReceivableForm initial={editTarget} onSuccess={() => { setEditTarget(null); load(); onRefreshParent() }} onCancel={() => setEditTarget(null)} />}
      </Modal>

      {receiveTarget && <ReceiveModal item={receiveTarget} onClose={() => setReceiveTarget(null)} onSuccess={() => { setReceiveTarget(null); load(); onRefreshParent() }} />}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir Lançamento" size="sm">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>Deseja excluir <strong style={{ color: 'var(--text-1)' }}>{formatYearMonth(deleteTarget.yearMonth)}</strong>?</p>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Spinner size={16} /> : <Trash2 size={16} />} Excluir
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={bulkEditOpen} onClose={() => setBulkEditOpen(false)} title={`Edição em Massa — ${selected.size} registro(s)`} size="lg">
        <BulkEditForm selected={selectedItems} onSuccess={() => { setBulkEditOpen(false); load(); onRefreshParent() }} onCancel={() => setBulkEditOpen(false)} />
      </Modal>

      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title="Excluir em Massa" size="sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>Deseja excluir <strong style={{ color: 'var(--red)' }}>{selected.size} registro(s)</strong>?</p>
          <div className="rounded-lg px-4 py-3 max-h-40 overflow-auto space-y-1" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
            {selectedItems.map(h => (
              <div key={h.id} className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-2)' }}>{formatYearMonth(h.yearMonth)}</span>
                <span className="font-mono" style={{ color: 'var(--green-400)' }}>{formatCurrency(h.value, h.country)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setBulkDeleteOpen(false)}>Cancelar</button>
            <button type="button" className="btn-danger" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <Spinner size={16} /> : <Trash2 size={16} />} Excluir tudo
            </button>
          </div>
        </div>
      </Modal>

      <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </>
  )
}
