'use client'

import { useEffect, useState, useCallback } from 'react'
import { cashReceivableApi, accountsApi, categoriesApi } from '@/lib/api'
import { formatCurrency, formatDate, formatYearMonth, FREQUENCES, REGISTRATION_TYPES } from '@/lib/utils'
import type { CashReceivable, Account, EditCashReceivableViewModel } from '@/types'
import { Td, TRow, Spinner, Empty, Modal } from '@/components/ui'
import { CashReceivableForm } from '@/components/forms/CashReceivableForm'
import { ReceiveModal } from '@/components/ui/ReceiveModal'
import { normalizeCountry } from '@/components/ui/CountryTabs'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'
import {
  X, CheckCircle2, AlertCircle, CircleDollarSign,
  TrendingUp, Calendar, Pencil, Trash2, ReceiptText,
  SquareCheck, Square, Minus, PencilLine, ChevronDown, ChevronUp,
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
                      .sort((a, b) => ymToNum(b.yearMonth) - ymToNum(a.yearMonth))
                      .slice(0, 3)
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
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name:             first?.name ?? '',
    account:          first?.account ?? '',
    frequence:        first?.frequence ?? '',
    registrationType: first?.registrationType ?? '',
    category:         first?.category ?? '',
    value:            first?.value?.toString() ?? '',
    manipulatedValue: first?.manipulatedValue?.toString() ?? '',
    additionalMessage: first?.additionalMessage ?? '',
    country:          first?.country ?? 'Brasil',
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

  function set(key: string, val: string) { setForm(f => ({ ...f, [key]: val })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const basket: EditCashReceivableViewModel[] = selected.map(h => ({
        id: h.id,
        idCashReceivableRegistration: h.idCashReceivableRegistration,
        name: form.name || h.name,
        account: form.account || h.account,
        frequence: form.frequence || h.frequence,
        registrationType: form.registrationType || h.registrationType,
        category: form.category || h.category,
        value: parseFloat(form.value.replace(',', '.')) || h.value,
        manipulatedValue: parseFloat(form.manipulatedValue.replace(',', '.')) || h.manipulatedValue,
        yearMonth: h.yearMonth,
        hasReceived: h.hasReceived,
        dateReceived: h.dateReceived,
        additionalMessage: form.additionalMessage,
        lastChangeDate: new Date().toISOString(),
        country: form.country,
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

  const diff = (key: keyof CashReceivable) => new Set(selected.map(h => h[key])).size > 1

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-lg px-4 py-3 text-xs" style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(96,165,250,0.2)' }}>
        Editando <strong>{selected.length}</strong> registro(s).
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label flex items-center gap-1.5">Nome <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>leitura</span></label>
          <input className="input" readOnly value={first?.name ?? ''} style={readonlyStyle} />
        </div>
        <div>
          <label className="label flex items-center gap-1.5">Mês/Ano <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>leitura</span></label>
          <input className="input" readOnly value={selected.length === 1 ? (first?.yearMonth ?? '') : `${selected.length} meses`} style={readonlyStyle} />
        </div>
        <div>
          <label className="label flex items-center gap-1.5">Status <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>leitura</span></label>
          <input className="input" readOnly value={selected.length === 1 ? (first?.hasReceived ? 'Recebido' : 'Aguardando') : '—'} style={readonlyStyle} />
        </div>
        <div className="col-span-2">
          <label className="label flex items-center gap-1.5">
            Nome
            {diff('name') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}
          </label>
          <input className="input" type="text" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label className="label flex items-center gap-1.5">
            Valor
            {diff('value') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}
          </label>
          <input className="input" type="text" inputMode="decimal" value={form.value} onChange={e => set('value', e.target.value)} />
        </div>
        <div>
          <label className="label flex items-center gap-1.5">
            Saldo (Valor Manipulado)
            {diff('manipulatedValue') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}
          </label>
          <input className="input" type="text" inputMode="decimal" value={form.manipulatedValue} onChange={e => set('manipulatedValue', e.target.value)} />
        </div>
        <div>
          <label className="label flex items-center gap-1.5">
            Conta
            {diff('account') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}
          </label>
          <select className="input" value={form.account} onChange={e => set('account', e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label flex items-center gap-1.5">
            Categoria
            {diff('category') && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>valores diferentes</span>}
          </label>
          <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">País</label>
          <div className="flex gap-2">
            {[{ value: 'Brasil', Flag: FlagBrasil }, { value: 'Espanha', Flag: FlagEspanha }].map(({ value, Flag }) => (
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
        <div className="col-span-2">
          <label className="label">Observação</label>
          <textarea className="input resize-none" rows={2} value={form.additionalMessage} onChange={e => set('additionalMessage', e.target.value)} />
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

export function CashReceivableHistory({ item, onClose, onRefreshParent }: CashReceivableHistoryProps) {
  const [history, setHistory] = useState<CashReceivable[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showDetails, setShowDetails] = useState(false)

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

  const allSelected  = history.length > 0 && selected.size === history.length
  const someSelected = selected.size > 0 && !allSelected
  const selectedItems = history.filter(h => selected.has(h.id))

  function toggleAll() { setSelected(allSelected ? new Set() : new Set(history.map(h => h.id))) }
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

      <div className="fixed top-0 right-0 h-screen z-50 flex flex-col"
        style={{ width: 'min(960px, 100vw)', background: 'var(--bg-1)', borderLeft: '1px solid var(--border-2)', boxShadow: '-8px 0 32px rgba(0,0,0,0.4)', animation: 'slideInRight 0.25s ease-out' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-1)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--green-dim)', color: 'var(--green-400)' }}>
              <ReceiptText size={17} />
            </div>
            <div>
              <h2 className="font-semibold text-base" style={{ color: 'var(--text-1)' }}>{item.name}</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                {item.account} · {item.category} · {item.frequence} · ID #{item.idCashReceivableRegistration}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-3)] flex-shrink-0 ml-4" style={{ color: 'var(--text-3)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-2)' }}>
            {[
              { icon: <Calendar size={13} />,     label: 'Parcelas',       value: `${receivedCount} / ${history.length} recebidas`, color: 'var(--text-2)'    },
              { icon: <TrendingUp size={13} />,   label: 'Total geral',    value: formatCurrency(total, item.country),               color: 'var(--text-1)'    },
              { icon: <CheckCircle2 size={13} />, label: 'Total recebido', value: formatCurrency(totalReceived, item.country),       color: 'var(--green-400)' },
              { icon: <AlertCircle size={13} />,  label: 'Pendente',       value: formatCurrency(totalPending, item.country),        color: 'var(--amber)'     },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="px-6 py-4">
                <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-3)' }}>{icon}<span className="text-xs">{label}</span></div>
                <p className="text-base font-semibold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between px-6 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-3)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
              <span style={{ color: 'var(--green-400)' }}>{selected.size}</span> registro(s) selecionado(s)
            </span>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setSelected(new Set())}>Limpar</button>
              <button type="button" onClick={() => setBulkEditOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(96,165,250,0.25)' }}>
                <PencilLine size={14} /> Editar {selected.size}
              </button>
              <button type="button" onClick={() => setBulkDeleteOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(248,113,113,0.25)' }}>
                <Trash2 size={14} /> Excluir {selected.size}
              </button>
            </div>
          </div>
        )}

        {/* Options bar */}
        <div className="flex items-center justify-between px-6 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-2)' }}>
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>{history.length} registro(s)</span>
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
          ) : (
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse', background: 'var(--bg-1)' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-3)' }}>
                  <th className="px-4 py-3 w-10">
                    <button type="button" onClick={toggleAll}
                      style={{ color: allSelected ? 'var(--green-400)' : someSelected ? 'var(--amber)' : 'var(--text-3)' }}>
                      {allSelected ? <SquareCheck size={16} /> : someSelected ? <Minus size={16} /> : <Square size={16} />}
                    </button>
                  </th>
                  {['Mês/Ano', 'País', 'Valor', 'Saldo', 'Vencimento', 'Recebido em', 'Status', 'Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(h => {
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
