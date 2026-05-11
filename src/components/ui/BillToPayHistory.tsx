'use client'

import { useEffect, useState, useCallback } from 'react'
import { billsToPayApi, accountsApi, categoriesApi } from '@/lib/api'
import { formatCurrency, formatDate, formatYearMonth, FREQUENCES, REGISTRATION_TYPES } from '@/lib/utils'
import type { BillToPay, Account, EditBillToPayViewModel } from '@/types'
import { Td, TRow, Spinner, Empty, Modal } from '@/components/ui'
import { BillToPayForm } from '@/components/forms/BillToPayForm'
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

/** Retorna true se o registro é do mês atual */
function isCurrentMonth(ym?: string): boolean {
  return ymToNum(ym) === currentYmNum()
}

/** Retorna true se o registro é dos últimos N meses (excluindo o atual) */
function isPastMonth(ym?: string): boolean {
  const n = ymToNum(ym)
  const cur = currentYmNum()
  return n < cur
}

/**
 * Ordenação: últimos 3 meses (crescente: Fev→Mar→Abr) → mês atual → próximos meses (crescente)
 */
function sortByYearMonth(data: BillToPay[]): BillToPay[] {
  const cur = currentYmNum()

  const past    = data.filter(h => ymToNum(h.yearMonth) < cur)
                      .sort((a, b) => ymToNum(b.yearMonth) - ymToNum(a.yearMonth)) // DESC para pegar os 3 mais recentes
                      .slice(0, 3)
                      .sort((a, b) => ymToNum(a.yearMonth) - ymToNum(b.yearMonth)) // ASC para exibir Fev, Mar, Abr

  const current = data.filter(h => ymToNum(h.yearMonth) === cur)

  const future  = data.filter(h => ymToNum(h.yearMonth) > cur)
                      .sort((a, b) => ymToNum(a.yearMonth) - ymToNum(b.yearMonth)) // ASC

  return [...past, ...current, ...future]
}

// ─── Bulk Edit Form ───────────────────────────────────────────────────────────

interface BulkEditFormProps {
  selected: BillToPay[]
  onSuccess: () => void
  onCancel: () => void
}

// Campos somente leitura — informativos, não alteráveis em massa
const readonlyInputStyle = {
  background: 'var(--bg-4)',
  border: '1px solid var(--border-1)',
  color: 'var(--text-3)',
  cursor: 'not-allowed',
  opacity: 0.7,
}

function BulkEditForm({ selected, onSuccess, onCancel }: BulkEditFormProps) {
  const first = selected[0]
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Inicia com os valores do primeiro registro selecionado
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

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      // Serializa com as chaves exatas que a API C# espera (PascalCase)
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
        Value: parseFloat(form.value.replace(',', '.')) || h.value,
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

  const hasMultipleValues = {
    value: new Set(selected.map(h => h.value)).size > 1,
    account: new Set(selected.map(h => h.account)).size > 1,
    category: new Set(selected.map(h => h.category)).size > 1,
    frequence: new Set(selected.map(h => h.frequence)).size > 1,
    registrationType: new Set(selected.map(h => h.registrationType)).size > 1,
    country: new Set(selected.map(h => h.country)).size > 1,
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div
        className="rounded-lg px-4 py-3 text-xs"
        style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(96,165,250,0.2)' }}
      >
        Editando <strong>{selected.length}</strong> registro(s). Os campos em destaque podem ser alterados. Os demais são apenas informativos.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* ── Somente leitura ── */}
        <div>
          <label className="label flex items-center gap-1.5">
            Nome
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>leitura</span>
          </label>
          <input className="input" readOnly value={first?.name ?? ''} style={readonlyInputStyle} />
        </div>

        <div>
          <label className="label flex items-center gap-1.5">
            Mês/Ano
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>leitura</span>
          </label>
          <input className="input" readOnly
            value={selected.length === 1 ? (first?.yearMonth ?? '') : `${selected.length} meses selecionados`}
            style={readonlyInputStyle} />
        </div>

        <div>
          <label className="label flex items-center gap-1.5">
            Vencimento
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>leitura</span>
          </label>
          <input className="input" readOnly
            value={selected.length === 1 ? formatDate(first?.dueDate) : '—'}
            style={readonlyInputStyle} />
        </div>

        <div>
          <label className="label flex items-center gap-1.5">
            Status
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>leitura</span>
          </label>
          <input className="input" readOnly
            value={selected.length === 1 ? (first?.hasPay ? 'Pago' : 'Pendente') : '—'}
            style={readonlyInputStyle} />
        </div>

        {/* ── Editáveis ── */}
        <div>
          <label className="label flex items-center gap-1.5">
            Valor (R$)
            {hasMultipleValues.value && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>
            )}
          </label>
          <input className="input" type="text" inputMode="decimal"
            value={form.value} onChange={e => set('value', e.target.value)} />
        </div>

        <div>
          <label className="label flex items-center gap-1.5">
            Conta
            {hasMultipleValues.account && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>
            )}
          </label>
          <select className="input" value={form.account} onChange={e => set('account', e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label flex items-center gap-1.5">
            Categoria
            {hasMultipleValues.category && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>
            )}
          </label>
          <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="label flex items-center gap-1.5">
            Frequência
            {hasMultipleValues.frequence && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>
            )}
          </label>
          <select className="input" value={form.frequence} onChange={e => set('frequence', e.target.value)}>
            {FREQUENCES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div>
          <label className="label flex items-center gap-1.5">
            Tipo de Cadastro
            {hasMultipleValues.registrationType && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>
            )}
          </label>
          <select className="input" value={form.registrationType} onChange={e => set('registrationType', e.target.value)}>
            {REGISTRATION_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label className="label flex items-center gap-1.5">
            País
            {hasMultipleValues.country && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>
            )}
          </label>
          <div className="flex gap-2">
            {[
              { value: 'Brasil',  label: 'Brasil',  Flag: FlagBrasil  },
              { value: 'Espanha', label: 'Espanha', Flag: FlagEspanha },
            ].map(({ value, label, Flag }) => (
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

        <div className="col-span-2">
          <label className="label">Descrição / Observação</label>
          <textarea className="input resize-none" rows={2} value={form.additionalMessage}
            onChange={e => set('additionalMessage', e.target.value)} />
        </div>
      </div>

      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
          {error}
        </p>
      )}

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

// ─── Main Component ───────────────────────────────────────────────────────────

export function BillToPayHistory({ bill, onClose, onRefreshParent }: BillToPayHistoryProps) {
  const [history, setHistory] = useState<BillToPay[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Single actions
  const [editTarget, setEditTarget]     = useState<BillToPay | null>(null)
  const [payTarget, setPayTarget]       = useState<BillToPay | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BillToPay | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Bulk actions
  const [bulkEditOpen, setBulkEditOpen]     = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting]     = useState(false)
  const [showDetails, setShowDetails]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await billsToPayApi.searchByRegistration(Number(bill.idBillToPayRegistration))
      setHistory(sortByYearMonth(res.output?.data ?? []))
      setSelected(new Set())
    } finally {
      setLoading(false)
    }
  }, [bill.idBillToPayRegistration])

  useEffect(() => { load() }, [load])

  const totalPaid    = history.filter(h => h.hasPay).reduce((s, h) => s + h.value, 0)
  const totalPending = history.filter(h => !h.hasPay).reduce((s, h) => s + h.value, 0)
  const total        = history.reduce((s, h) => s + h.value, 0)
  const paidCount    = history.filter(h => h.hasPay).length

  // Selection helpers
  const allSelected = history.length > 0 && selected.size === history.length
  const someSelected = selected.size > 0 && !allSelected
  const selectedItems = history.filter(h => selected.has(h.id))

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(history.map(h => h.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Single actions

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await billsToPayApi.delete({ id: [deleteTarget.id] })
      setDeleteTarget(null)
      await load()
      onRefreshParent()
    } finally {
      setDeleting(false)
    }
  }

  // Bulk delete
  async function handleBulkDelete() {
    setBulkDeleting(true)
    try {
      await Promise.all(selectedItems.map(h => billsToPayApi.delete({ id: [h.id] })))
      setBulkDeleteOpen(false)
      await load()
      onRefreshParent()
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-screen z-50 flex flex-col"
        style={{
          width: 'min(960px, 100vw)',
          background: 'var(--bg-1)',
          borderLeft: '1px solid var(--border-2)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
          animation: 'slideInRight 0.25s ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-1)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>
              <ReceiptText size={17} />
            </div>
            <div>
              <h2 className="font-semibold text-base" style={{ color: 'var(--text-1)' }}>{bill.name}</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                {bill.account} · {bill.category} · {bill.frequence} · ID #{bill.idBillToPayRegistration}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-3)] flex-shrink-0 ml-4"
            style={{ color: 'var(--text-3)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Stats bar */}
        {!loading && (
          <div className="grid grid-cols-4 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-2)' }}>
            {[
              { icon: <Calendar size={13} />,     label: 'Parcelas',    value: `${paidCount} / ${history.length} pagas`, color: 'var(--text-2)'    },
              { icon: <TrendingUp size={13} />,   label: 'Total geral', value: formatCurrency(total, bill.country),        color: 'var(--text-1)'    },
              { icon: <CheckCircle2 size={13} />, label: 'Total pago',  value: formatCurrency(totalPaid, bill.country),    color: 'var(--green-400)' },
              { icon: <AlertCircle size={13} />,  label: 'Pendente',    value: formatCurrency(totalPending, bill.country), color: 'var(--amber)'     },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="px-6 py-4">
                <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-3)' }}>
                  {icon}<span className="text-xs">{label}</span>
                </div>
                <p className="text-base font-semibold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Bulk action bar — aparece quando há seleção */}
        {selected.size > 0 && (
          <div
            className="flex items-center justify-between px-6 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-3)' }}
          >
            <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
              <span style={{ color: 'var(--green-400)' }}>{selected.size}</span> registro(s) selecionado(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 12, padding: '6px 12px' }}
                onClick={() => setSelected(new Set())}
              >
                Limpar seleção
              </button>
              <button
                type="button"
                onClick={() => setBulkEditOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(96,165,250,0.25)' }}
              >
                <PencilLine size={14} /> Editar {selected.size} registro(s)
              </button>
              <button
                type="button"
                onClick={() => setBulkDeleteOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(248,113,113,0.25)' }}
              >
                <Trash2 size={14} /> Excluir {selected.size} registro(s)
              </button>
            </div>
          </div>
        )}

        {/* Options bar */}
        <div className="flex items-center justify-between px-6 py-2 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-2)' }}>
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>{history.length} registro(s)</span>
          <button
            type="button"
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showDetails ? 'border-[var(--green-border)] text-[var(--green-400)] bg-[var(--green-dim)]' : 'border-[var(--border-1)] text-[var(--text-3)]'}`}
            onClick={() => setShowDetails(v => !v)}
          >
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
          ) : (
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse', background: 'var(--bg-1)' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-3)' }}>
                  {/* Select All */}
                  <th className="px-4 py-3 w-10">
                    <button type="button" onClick={toggleAll} className="flex items-center justify-center"
                      style={{ color: allSelected ? 'var(--green-400)' : someSelected ? 'var(--amber)' : 'var(--text-3)' }}>
                      {allSelected
                        ? <SquareCheck size={16} />
                        : someSelected
                        ? <Minus size={16} />
                        : <Square size={16} />}
                    </button>
                  </th>
                  {['Mês/Ano', 'País', 'Valor', 'Vencimento', 'Pago em', 'Status', 'Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-3)' }}>
                      {h}
                    </th>
                  ))}

                </tr>
              </thead>
              <tbody>
                {history.map(h => {
                  const isSelected = selected.has(h.id)
                  const isCurrent = isCurrentMonth(h.yearMonth)
                  const bg = isSelected
                    ? 'rgba(96,165,250,0.10)'
                    : isCurrent && !h.hasPay
                    ? 'rgba(251,191,36,0.08)'
                    : h.hasPay
                    ? 'rgba(34,197,94,0.06)'
                    : 'var(--bg-1)'

                  return (
                    <TRow key={h.id} bg={bg}>
                      {/* Checkbox */}
                      <Td>
                        <button type="button" onClick={() => toggleOne(h.id)}
                          className="flex items-center justify-center"
                          style={{ color: isSelected ? 'var(--blue)' : 'var(--text-3)' }}>
                          {isSelected ? <SquareCheck size={15} /> : <Square size={15} />}
                        </button>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium" style={{ color: isCurrent ? 'var(--amber)' : isPastMonth(h.yearMonth) ? 'var(--text-3)' : 'var(--text-1)' }}>
                            {formatYearMonth(h.yearMonth)}
                          </span>
                          {isCurrent && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                              style={{ background: 'rgba(251,191,36,0.15)', color: 'var(--amber)', border: '1px solid rgba(251,191,36,0.3)' }}>
                              Atual
                            </span>
                          )}
                          {isPastMonth(h.yearMonth) && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>
                              Passado
                            </span>
                          )}
                        </div>
                        {showDetails && h.additionalMessage && (
                          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{h.additionalMessage}</p>
                        )}
                      </Td>
                      {/* País */}
                      <Td>
                        {h.country ? (
                          <div className="flex items-center gap-1.5">
                            {normalizeCountry(h.country) === 'Espanha'
                              ? <FlagEspanha size={15} />
                              : <FlagBrasil size={15} />}
                            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{normalizeCountry(h.country)}</span>
                          </div>
                        ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </Td>
                      <Td>
                        <span className="font-mono text-xs font-semibold"
                          style={{ color: h.hasPay ? 'var(--text-3)' : 'var(--red)' }}>
                          {formatCurrency(h.value, h.country)}
                        </span>
                      </Td>
                      <Td className="text-xs">{formatDate(h.dueDate)}</Td>
                      <Td className="text-xs">{formatDate(h.payDay)}</Td>
                      <Td>
                        {h.hasPay
                          ? <span className="badge-paid"><CheckCircle2 size={10} />Pago</span>
                          : <span className="badge-pending"><AlertCircle size={10} />Pendente</span>}
                      </Td>

                      <Td>
                        <div className="flex items-center gap-1">
                          {!h.hasPay && (
                            <button type="button" title="Pagar"
                              className="p-1.5 rounded-md transition-colors hover:bg-[var(--green-dim)]"
                              style={{ color: 'var(--green-400)' }}
                              onClick={() => setPayTarget(h)}>
                              <CircleDollarSign size={14} />
                            </button>
                          )}
                          <button type="button" title="Editar"
                            className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-4)]"
                            style={{ color: 'var(--text-3)' }}
                            onClick={() => setEditTarget(h)}>
                            <Pencil size={14} />
                          </button>
                          <button type="button" title="Excluir"
                            className="p-1.5 rounded-md transition-colors hover:bg-[var(--red-dim)]"
                            style={{ color: 'var(--text-3)' }}
                            onClick={() => setDeleteTarget(h)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </Td>
                    </TRow>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modals ── */}

      {/* Single edit */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar Lançamento" size="lg">
        {editTarget && (
          <BillToPayForm initial={editTarget}
            onSuccess={() => { setEditTarget(null); load(); onRefreshParent() }}
            onCancel={() => setEditTarget(null)} />
        )}
      </Modal>

      {/* Single pay */}
      {payTarget && (
        <PayBillModal
          bill={payTarget}
          onClose={() => setPayTarget(null)}
          onSuccess={() => { setPayTarget(null); load(); onRefreshParent() }}
        />
      )}

      {/* Single delete */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir Lançamento" size="sm">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Deseja excluir o lançamento de{' '}
              <strong style={{ color: 'var(--text-1)' }}>{formatYearMonth(deleteTarget.yearMonth)}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Spinner size={16} /> : <Trash2 size={16} />} Excluir
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk edit */}
      <Modal open={bulkEditOpen} onClose={() => setBulkEditOpen(false)} title={`Edição em Massa — ${selected.size} registro(s)`} size="lg">
        <BulkEditForm
          selected={selectedItems}
          onSuccess={() => { setBulkEditOpen(false); load(); onRefreshParent() }}
          onCancel={() => setBulkEditOpen(false)}
        />
      </Modal>

      {/* Bulk delete */}
      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title="Excluir em Massa" size="sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Deseja excluir os <strong style={{ color: 'var(--red)' }}>{selected.size} registro(s)</strong> selecionados?
            Esta ação não pode ser desfeita.
          </p>
          <div
            className="rounded-lg px-4 py-3 max-h-40 overflow-auto space-y-1"
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}
          >
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

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}
