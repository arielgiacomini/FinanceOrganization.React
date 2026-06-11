'use client'

import { useEffect, useState, useCallback } from 'react'
import { billsToPayApi, accountsApi, categoriesApi } from '@/lib/api'
import { formatCurrency, formatDate, formatYearMonth, FREQUENCES, REGISTRATION_TYPES } from '@/lib/utils'
import type { BillToPay, Account, EditBillToPayViewModel } from '@/types'
import { Td, TRow, Spinner, Empty, Modal } from '@/components/ui'
import { BillToPayForm } from '@/components/forms/BillToPayForm'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { normalizeCountry } from '@/components/ui/CountryTabs'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'
import { PayBillModal } from '@/components/ui/PayBillModal'
import {
  X, CheckCircle2, AlertCircle, CircleDollarSign,
  TrendingUp, Calendar, Pencil, Trash2, ReceiptText,
  SquareCheck, Square, Minus, PencilLine, ChevronDown, ChevronUp,
} from 'lucide-react'

interface BillToPayHistoryProps {
  bill: BillToPay
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
function isCurrentMonth(ym?: string): boolean { return ymToNum(ym) === currentYmNum() }
function isPastMonth(ym?: string): boolean { return ymToNum(ym) < currentYmNum() }

function sortByYearMonth(data: BillToPay[]): BillToPay[] {
  const cur = currentYmNum()
  const past    = data.filter(h => ymToNum(h.yearMonth) < cur)
                      .sort((a, b) => ymToNum(a.yearMonth) - ymToNum(b.yearMonth))
  const current = data.filter(h => ymToNum(h.yearMonth) === cur)
  const future  = data.filter(h => ymToNum(h.yearMonth) > cur)
                      .sort((a, b) => ymToNum(a.yearMonth) - ymToNum(b.yearMonth))
  return [...past, ...current, ...future]
}

const readonlyInputStyle = {
  background: 'var(--bg-4)', border: '1px solid var(--border-1)',
  color: 'var(--text-3)', cursor: 'not-allowed', opacity: 0.7,
}

function BulkEditForm({ selected, onSuccess, onCancel }: {
  selected: BillToPay[], onSuccess: () => void, onCancel: () => void
}) {
  const first = selected[0]
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    value: first?.value?.toString() ?? '',
    account: first?.account ?? '',
    category: first?.category ?? '',
    frequence: first?.frequence ?? '',
    registrationType: first?.registrationType ?? '',
    additionalMessage: first?.additionalMessage ?? '',
    country: first?.country ?? 'Brasil',
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

  function set(key: string, value: string) { setForm(f => ({ ...f, [key]: value })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const basket = selected.map((h) => ({
        Id: h.id,
        IdFixedInvoice: Math.trunc(Number(h.idBillToPayRegistration)),
        Name: h.name || first?.name || '',
        Account: form.account || h.account,
        Category: form.category || h.category,
        Frequence: form.frequence || h.frequence,
        RegistrationType: form.registrationType || h.registrationType,
        AdditionalMessage: form.additionalMessage,
        Country: form.country,
        Value: !isNaN(parseFloat(form.value.replace(',', '.'))) ? parseFloat(form.value.replace(',', '.')) : h.value,
        DueDate: h.dueDate,
        YearMonth: h.yearMonth,
        HasPay: h.hasPay,
        PayDay: h.payDay ?? null,
        PurchaseDate: h.purchaseDate ?? null,
        LastChangeDate: new Date().toISOString(),
      }))
      await billsToPayApi.editBasket(basket as never)
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const diff = (key: keyof BillToPay) => new Set(selected.map(h => String(h[key] ?? ''))).size > 1

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-lg px-4 py-3 text-xs" style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(96,165,250,0.2)' }}>
        Editando <strong>{selected.length}</strong> registro(s).
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label flex items-center gap-1.5">Nome <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>leitura</span></label>
          <input className="input" readOnly value={first?.name ?? ''} style={readonlyInputStyle} />
        </div>
        <div>
          <label className="label flex items-center gap-1.5">Mês/Ano <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>leitura</span></label>
          <input className="input" readOnly value={selected.length === 1 ? (first?.yearMonth ?? '') : `${selected.length} meses`} style={readonlyInputStyle} />
        </div>
        <div>
          <label className="label flex items-center gap-1.5">Valor {diff('value') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}</label>
          <CurrencyInput value={form.value} country={form.country} onChange={v => set('value', v)} />
        </div>
        <div>
          <label className="label flex items-center gap-1.5">Conta {diff('account') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}</label>
          <select className="input w-full" value={form.account} onChange={e => set('account', e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label flex items-center gap-1.5">Categoria {diff('category') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}</label>
          <select className="input w-full" value={form.category} onChange={e => set('category', e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label flex items-center gap-1.5">Frequência {diff('frequence') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}</label>
          <select className="input w-full" value={form.frequence} onChange={e => set('frequence', e.target.value)}>
            {FREQUENCES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="label flex items-center gap-1.5">Tipo de Cadastro {diff('registrationType') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}</label>
          <select className="input w-full" value={form.registrationType} onChange={e => set('registrationType', e.target.value)}>
            {REGISTRATION_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="label flex items-center gap-1.5">País {diff('country') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}</label>
          <div className="flex gap-2">
            {[{ value: 'Brasil', Flag: FlagBrasil }, { value: 'Espanha', Flag: FlagEspanha }].map(({ value, Flag }) => (
              <button key={value} type="button" onClick={() => set('country', value)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all"
                style={{ background: form.country === value ? 'var(--green-dim)' : 'var(--bg-3)', border: `1px solid ${form.country === value ? 'var(--green-border)' : 'var(--border-1)'}`, color: form.country === value ? 'var(--green-400)' : 'var(--text-2)' }}>
                <Flag size={16} />{value}
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-2">
          <label className="label">Observação</label>
          <textarea className="input resize-y w-full" rows={4} style={{ minHeight: 96 }} value={form.additionalMessage} onChange={e => set('additionalMessage', e.target.value)} />
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

const STATUS_FILTERS = [
  { key: 'all',    label: 'Todos'     },
  { key: 'unpaid', label: 'Não pagos' },
  { key: 'paid',   label: 'Pagos'     },
] as const
type StatusFilter = typeof STATUS_FILTERS[number]['key']

export function BillToPayHistory({ bill, onClose, onRefreshParent }: BillToPayHistoryProps) {
  const [history, setHistory] = useState<BillToPay[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editTarget, setEditTarget]     = useState<BillToPay | null>(null)
  const [payTarget, setPayTarget]       = useState<BillToPay | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BillToPay | null>(null)
  const [deleting, setDeleting]         = useState(false)
  const [bulkEditOpen, setBulkEditOpen]     = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting]     = useState(false)
  const [showDetails, setShowDetails]       = useState(false)
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>('all')
  const [relatedTarget, setRelatedTarget]   = useState<BillToPay | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await billsToPayApi.searchByRegistration(Number(bill.idBillToPayRegistration))
      setHistory(sortByYearMonth(res.output?.data ?? []))
      setSelected(new Set())
    } finally { setLoading(false) }
  }, [bill.idBillToPayRegistration])

  useEffect(() => { load() }, [load])

  const totalPaid    = history.filter(h => h.hasPay).reduce((s, h) => s + h.value, 0)
  const totalPending = history.filter(h => !h.hasPay).reduce((s, h) => s + h.value, 0)
  const total        = history.reduce((s, h) => s + h.value, 0)
  const paidCount    = history.filter(h => h.hasPay).length
  const pendingCount = history.length - paidCount

  const visibleHistory = history.filter(h =>
    statusFilter === 'all' ? true : statusFilter === 'paid' ? h.hasPay : !h.hasPay
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
      await billsToPayApi.delete({ id: [deleteTarget.id] })
      setDeleteTarget(null)
      await load(); onRefreshParent()
    } finally { setDeleting(false) }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    try {
      await Promise.all(selectedItems.map(h => billsToPayApi.delete({ id: [h.id] })))
      setBulkDeleteOpen(false)
      await load(); onRefreshParent()
    } finally { setBulkDeleting(false) }
  }

  const stats = [
    { icon: <Calendar size={13} />,     label: 'Parcelas',    value: `${paidCount} / ${history.length}`, color: 'var(--text-2)'    },
    { icon: <TrendingUp size={13} />,   label: 'Total',       value: formatCurrency(total, bill.country),        color: 'var(--text-1)'    },
    { icon: <CheckCircle2 size={13} />, label: 'Pago',        value: formatCurrency(totalPaid, bill.country),    color: 'var(--green-400)' },
    { icon: <AlertCircle size={13} />,  label: 'Pendente',    value: formatCurrency(totalPending, bill.country), color: 'var(--amber)'     },
  ]

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
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>
              <ReceiptText size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-sm sm:text-base truncate" style={{ color: 'var(--text-1)' }}>{bill.name}</h2>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>
                {bill.account} · {bill.frequence} · ID #{bill.idBillToPayRegistration}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg flex-shrink-0 ml-2" style={{ color: 'var(--text-3)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Stats — 2 cols on mobile, 4 on desktop */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-2)' }}>
            {stats.map(({ icon, label, value, color }) => (
              <div key={label} className="px-4 sm:px-6 py-3 sm:py-4">
                <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-3)' }}>
                  {icon}<span className="text-xs">{label}</span>
                </div>
                <p className="text-sm sm:text-base font-semibold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="flex flex-col gap-2 px-4 sm:px-6 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-3)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
                  <span style={{ color: 'var(--green-400)' }}>{selected.size}</span> selecionado(s)
                </span>
                {(() => {
                  const brItems = selectedItems.filter(h => (h.country ?? '').trim().toLowerCase() !== 'espanha')
                  const esItems = selectedItems.filter(h => (h.country ?? '').trim().toLowerCase() === 'espanha')
                  const brTotal = brItems.reduce((s, h) => s + (h.value ?? 0), 0)
                  const esTotal = esItems.reduce((s, h) => s + (h.value ?? 0), 0)
                  const hasBoth = brItems.length > 0 && esItems.length > 0
                  return (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'var(--text-3)' }}>
                      <span style={{ color: 'var(--border-2)' }}>·</span>
                      {brItems.length > 0 && (
                        <span className="flex items-center gap-1">
                          {hasBoth && <FlagBrasil size={12} />}
                          <span className="font-mono font-semibold" style={{ color: 'var(--red)' }}>
                            {formatCurrency(brTotal, 'Brasil')}
                          </span>
                        </span>
                      )}
                      {esItems.length > 0 && (
                        <span className="flex items-center gap-1">
                          {hasBoth && <span style={{ color: 'var(--border-2)' }}>·</span>}
                          {hasBoth && <FlagEspanha size={12} />}
                          <span className="font-mono font-semibold" style={{ color: 'var(--red)' }}>
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
                const count = key === 'all' ? history.length : key === 'paid' ? paidCount : pendingCount
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
            {showDetails ? 'Ocultar' : 'Detalhes'}
          </button>
        </div>

        {/* Content — cards on mobile, table on desktop */}
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
                      <button type="button" onClick={toggleAll} style={{ color: allSelected ? 'var(--green-400)' : someSelected ? 'var(--amber)' : 'var(--text-3)' }}>
                        {allSelected ? <SquareCheck size={16} /> : someSelected ? <Minus size={16} /> : <Square size={16} />}
                      </button>
                    </th>
                    {['Mês/Ano', 'País', 'Valor', 'Qtd Compras', 'Vencimento', 'Pago em', 'Status', 'Ações'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium sm:sticky sm:top-0 sm:z-10" style={{ color: 'var(--text-3)', background: 'var(--bg-3)', boxShadow: 'inset 0 -1px 0 var(--border-1)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleHistory.map(h => {
                    const isSelected = selected.has(h.id)
                    const isCurrent  = isCurrentMonth(h.yearMonth)
                    const bg = isSelected ? 'rgba(96,165,250,0.10)' : isCurrent && !h.hasPay ? 'rgba(251,191,36,0.08)' : h.hasPay ? 'rgba(34,197,94,0.06)' : 'var(--bg-1)'
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
                        <Td><span className="font-mono text-xs font-semibold" style={{ color: h.hasPay ? 'var(--text-3)' : 'var(--red)' }}>{formatCurrency(h.value, h.country)}</span></Td>
                        <Td>
                          {h.detailsQuantity ? (
                            <button type="button" onClick={() => setRelatedTarget(h)}
                              title="Ver registros relacionados"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-colors"
                              style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(96,165,250,0.3)' }}>
                              <ReceiptText size={11} /> {h.detailsQuantity}
                            </button>
                          ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                        </Td>
                        <Td className="text-xs">{formatDate(h.dueDate)}</Td>
                        <Td className="text-xs">{formatDate(h.payDay)}</Td>
                        <Td>{h.hasPay ? <span className="badge-paid"><CheckCircle2 size={10} />Pago</span> : <span className="badge-pending"><AlertCircle size={10} />Pendente</span>}</Td>
                        <Td>
                          <div className="flex items-center gap-1">
                            {!h.hasPay && (
                              <button type="button" title="Pagar" className="p-1.5 rounded-md hover:bg-[var(--green-dim)]" style={{ color: 'var(--green-400)' }} onClick={() => setPayTarget(h)}>
                                <CircleDollarSign size={14} />
                              </button>
                            )}
                            <button type="button" title="Editar" className="p-1.5 rounded-md hover:bg-[var(--bg-4)]" style={{ color: 'var(--text-3)' }} onClick={() => setEditTarget(h)}>
                              <Pencil size={14} />
                            </button>
                            <button type="button" title="Excluir" className="p-1.5 rounded-md hover:bg-[var(--red-dim)]" style={{ color: 'var(--text-3)' }} onClick={() => setDeleteTarget(h)}>
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
        {editTarget && <BillToPayForm initial={editTarget} onSuccess={() => { setEditTarget(null); load(); onRefreshParent() }} onCancel={() => setEditTarget(null)} />}
      </Modal>
      {payTarget && <PayBillModal bill={payTarget} onClose={() => setPayTarget(null)} onSuccess={() => { setPayTarget(null); load(); onRefreshParent() }} />}
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
                <span className="font-mono" style={{ color: 'var(--red)' }}>{formatCurrency(h.value, h.country)}</span>
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

      {/* Registros relacionados (Compra Livre da mesma categoria) */}
      <Modal open={!!relatedTarget} onClose={() => setRelatedTarget(null)} title="Registros Relacionados" size="lg">
        {relatedTarget && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{relatedTarget.name}</span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>· {relatedTarget.category} · {formatYearMonth(relatedTarget.yearMonth)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 rounded-lg px-4 py-3" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Qtd. registros</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{relatedTarget.detailsQuantity}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Valor realizado</p>
                <p className="text-sm font-semibold font-mono" style={{ color: 'var(--green-400)' }}>{formatCurrency(relatedTarget.detailsAmount ?? 0, relatedTarget.country)}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Valor restante</p>
                <p className="text-sm font-semibold font-mono" style={{ color: relatedTarget.hasPay ? 'var(--text-3)' : 'var(--red)' }}>{formatCurrency(relatedTarget.value, relatedTarget.country)}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Valor total</p>
                <p className="text-sm font-semibold font-mono" style={{ color: 'var(--text-1)' }}>{formatCurrency(relatedTarget.value + (relatedTarget.detailsAmount ?? 0), relatedTarget.country)}</p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-1)' }}>
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse', background: 'var(--bg-1)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-1)' }}>
                    {['Conta', 'Descrição', 'Categoria', 'Valor', 'Data de Compra', 'Status', 'Mensagem'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-3)', background: 'var(--bg-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(relatedTarget.details ?? []).map(d => (
                    <TRow key={d.id}>
                      <Td className="text-xs">{d.account ?? '—'}</Td>
                      <Td className="text-xs"><span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{d.name ?? '—'}</span></Td>
                      <Td className="text-xs">{d.category ?? '—'}</Td>
                      <Td><span className="font-mono text-xs font-semibold" style={{ color: 'var(--green-400)' }}>{formatCurrency(d.value, d.country)}</span></Td>
                      <Td className="text-xs">{formatDate(d.purchaseDate)}</Td>
                      <Td>{d.hasPay ? <span className="badge-paid"><CheckCircle2 size={10} />Pago</span> : <span className="badge-pending"><AlertCircle size={10} />Pendente</span>}</Td>
                      <Td className="text-xs"><span style={{ color: 'var(--text-3)' }}>{d.additionalMessage ?? '—'}</span></Td>
                    </TRow>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
