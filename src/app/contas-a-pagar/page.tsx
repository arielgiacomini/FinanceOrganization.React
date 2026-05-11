'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { billsToPayApi, accountsApi } from '@/lib/api'
import { formatCurrency, formatDate, formatYearMonth, currentYearMonth } from '@/lib/utils'
import type { BillToPay, Account } from '@/types'
import { Modal, PageHeader, Table, Td, TRow, Spinner } from '@/components/ui'
import { YearMonthSelector } from '@/components/ui/YearMonthSelector'
import { CountryTabs, normalizeCountry } from '@/components/ui/CountryTabs'
import type { CountryFilter } from '@/components/ui/CountryTabs'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'
import { BillToPayForm } from '@/components/forms/BillToPayForm'
import { PayBillModal } from '@/components/ui/PayBillModal'
import { BillToPayHistory } from '@/components/ui/BillToPayHistory'
import { SummaryCards } from '@/components/ui/SummaryCards'
import {
  Plus, CheckCircle2, Pencil, Trash2,
  ChevronDown, ChevronUp, AlertCircle, History, CircleDollarSign,
} from 'lucide-react'

function sortBills(data: BillToPay[]): BillToPay[] {
  const byDueThenPurchase = (a: BillToPay, b: BillToPay) => {
    const dueDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    if (dueDiff !== 0) return dueDiff
    // Secundário: data de compra DESC (mais recente primeiro)
    const pa = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0
    const pb = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0
    return pb - pa
  }
  return [
    ...data.filter((b) => !b.hasPay).sort(byDueThenPurchase),
    ...data.filter((b) => b.hasPay).sort(byDueThenPurchase),
  ]
}

export default function ContasAPagarPage() {
  const [ym, setYm] = useState(currentYearMonth())
  const [bills, setBills] = useState<BillToPay[]>([])
  const [accountMap, setAccountMap] = useState<Record<string, Account>>({})
  const [loading, setLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [countryFilter, setCountryFilter] = useState<CountryFilter>('Todos')

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<BillToPay | null>(null)
  const [payTarget, setPayTarget] = useState<BillToPay | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BillToPay | null>(null)
  const [historyTarget, setHistoryTarget] = useState<BillToPay | null>(null)

  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    accountsApi.searchAll().then((res) => {
      const map: Record<string, Account> = {}
      for (const acc of res.data ?? []) {
        map[acc.name.trim().toLowerCase()] = acc
      }
      setAccountMap(map)
    }).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await billsToPayApi.search({ yearMonth: ym, showDetails: true })
      setBills(sortBills(res.output?.data ?? []))
    } finally {
      setLoading(false)
    }
  }, [ym])

  useEffect(() => { load() }, [load])

  // Contadores por país para as abas
  const countryCounts = useMemo(() => {
    const counts = { Todos: bills.length, Brasil: 0, Espanha: 0 } as Record<CountryFilter, number>
    for (const b of bills) {
      const gc = normalizeCountry(b.country) === 'Espanha' ? 'Espanha' : 'Brasil'
      counts[gc]++
    }
    return counts
  }, [bills])

  // Filtragem local por país
  const filtered = useMemo(() => {
    if (countryFilter === 'Todos') return bills
    const getCountry = (country?: string | null) => normalizeCountry(country) === 'Espanha' ? 'Espanha' : 'Brasil'
    return bills.filter((b) => getCountry(b.country) === countryFilter)
  }, [bills, countryFilter])

  const byCountry = (country: string) => bills.filter(b => normalizeCountry(b.country) === country)
  const sumValues = (arr: typeof bills) => arr.reduce((s, b) => s + b.value, 0)

  const totalPaid    = filtered.filter((b) => b.hasPay).reduce((s, b) => s + b.value, 0)
  const totalPending = filtered.filter((b) => !b.hasPay).reduce((s, b) => s + b.value, 0)
  const total        = filtered.reduce((s, b) => s + b.value, 0)

  const brasilBills  = byCountry('Brasil')
  const espanhaBills = byCountry('Espanha')
  const summaryBrasil  = { total: sumValues(brasilBills),  positive: sumValues(brasilBills.filter(b => b.hasPay)),  pending: sumValues(brasilBills.filter(b => !b.hasPay))  }
  const summaryEspanha = { total: sumValues(espanhaBills), positive: sumValues(espanhaBills.filter(b => b.hasPay)), pending: sumValues(espanhaBills.filter(b => !b.hasPay)) }


  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await billsToPayApi.delete({ id: [deleteTarget.id] })
      setDeleteTarget(null)
      await load()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Contas a Pagar"
        subtitle={formatYearMonth(ym)}
        action={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <YearMonthSelector value={ym} onChange={setYm} />
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> Nova conta
            </button>
          </div>
        }
      />

      {/* Summary */}
      <SummaryCards
        countryFilter={countryFilter}
        brasil={summaryBrasil}
        espanha={summaryEspanha}
        labels={{ total: 'Total do mês', positive: 'Pago', pending: 'Pendente' }}
      />

      {/* Filters bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <CountryTabs value={countryFilter} onChange={setCountryFilter} counts={countryCounts} />
        <div className="flex items-center gap-2">
          <button
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showDetails ? 'border-[var(--green-border)] text-[var(--green-400)] bg-[var(--green-dim)]' : 'border-[var(--border-1)] text-[var(--text-3)]'}`}
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? <ChevronUp size={12} className="inline mr-1" /> : <ChevronDown size={12} className="inline mr-1" />}
            {showDetails ? 'Ocultar detalhes' : 'Mostrar detalhes'}
          </button>
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>{filtered.length} registros</span>
        </div>
      </div>

      {/* Desktop: tabela | Mobile: cards */}

      {/* Cards mobile */}
      <div className="flex flex-col gap-3 sm:hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--text-3)' }}>Nenhum registro encontrado.</div>
        ) : filtered.map((b) => {
          const acc = b.account ? accountMap[b.account.trim().toLowerCase()] : undefined
          const hex = acc?.colors?.backgroundColorHexadecimal
          const toRgb = (h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]
          const rowBg = hex
            ? `rgba(${toRgb(hex).join(',')},${b.hasPay ? 0.07 : 0.15})`
            : b.hasPay ? 'rgba(34,197,94,0.06)' : 'var(--bg-2)'
          const cardBorder = hex
            ? `rgba(${toRgb(hex).join(',')},0.5)`
            : b.hasPay ? 'rgba(34,197,94,0.3)' : 'var(--border-1)'
          const leftBar = hex ?? (b.hasPay ? '#22c55e' : 'var(--border-2)')

          return (
            <div key={b.id} className="rounded-xl overflow-hidden"
              style={{ background: rowBg, border: `1px solid ${cardBorder}`, borderLeft: `3px solid ${leftBar}` }}>
              {/* Linha 1: Nome + Valor + Status */}
              <div className="flex items-start justify-between px-4 pt-3 pb-2">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="font-medium text-sm truncate" style={{ color: b.hasPay ? 'var(--text-3)' : 'var(--text-1)' }}>
                    {b.name}
                  </p>
                  {showDetails && b.additionalMessage && (
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-3)' }}>{b.additionalMessage}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="font-mono font-semibold text-sm" style={{ color: b.hasPay ? 'var(--text-3)' : 'var(--red)' }}>
                    {formatCurrency(b.value, b.country)}
                  </span>
                  {b.hasPay
                    ? <span className="badge-paid"><CheckCircle2 size={10} />Pago</span>
                    : <span className="badge-pending"><AlertCircle size={10} />Pendente</span>}
                </div>
              </div>

              {/* Linha 2: Conta + País + Vencimento */}
              <div className="flex items-center gap-3 px-4 pb-2 flex-wrap">
                {acc && hex ? (
                  <span className="inline-flex items-center gap-1 text-xs"
                    style={{ color: 'var(--text-2)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: hex, display: 'inline-block' }} />
                    {b.account}
                  </span>
                ) : b.account ? (
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>{b.account}</span>
                ) : null}
                {b.country && (
                  <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-3)' }}>
                    {normalizeCountry(b.country) === 'Espanha' ? <FlagEspanha size={12} /> : <FlagBrasil size={12} />}
                    {normalizeCountry(b.country)}
                  </span>
                )}
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                  Venc. {formatDate(b.dueDate)}
                </span>
                {b.purchaseDate && (
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                    Compra {formatDate(b.purchaseDate)}
                  </span>
                )}
                {b.hasPay && b.payDay && (
                  <span className="text-xs" style={{ color: 'var(--green-400)' }}>
                    Pago {formatDate(b.payDay)}
                  </span>
                )}
              </div>

              {/* Linha 3: Ações */}
              <div className="flex items-center gap-1 px-3 pb-3 border-t pt-2"
                style={{ borderColor: 'var(--border-1)' }}>
                {!b.hasPay && (
                  <button type="button" title="Pagar"
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: 'var(--green-dim)', color: 'var(--green-400)' }}
                    onClick={() => setPayTarget(b)}>
                    <CircleDollarSign size={14} /> Pagar
                  </button>
                )}
                <button type="button" title="Histórico"
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}
                  onClick={() => setHistoryTarget(b)}>
                  <History size={14} /> Histórico
                </button>
                <button type="button" title="Editar"
                  className="flex items-center justify-center p-1.5 rounded-lg transition-colors"
                  style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}
                  onClick={() => setEditTarget(b)}>
                  <Pencil size={15} />
                </button>
                <button type="button" title="Excluir"
                  className="flex items-center justify-center p-1.5 rounded-lg transition-colors"
                  style={{ background: 'var(--red-dim)', color: 'var(--red)' }}
                  onClick={() => setDeleteTarget(b)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabela desktop */}
      <div className="hidden sm:block">
            {/* Table */}
      <Table
        headers={['', 'Nome', 'País', 'Conta', 'Categoria', 'Valor', 'Vencimento', 'Dt. Compra', 'Pago em', 'Status', 'Ações']}
        loading={loading}
        empty={!loading && filtered.length === 0}
      >
        {filtered.map((b) => {
          const acc = b.account ? accountMap[b.account.trim().toLowerCase()] : undefined
          const hex = acc?.colors?.backgroundColorHexadecimal
          const rowBg = hex ? hex : b.hasPay ? 'rgba(34,197,94,0.08)' : 'var(--bg-2)'
          const borderColor = hex ? hex : 'transparent'
          const country = normalizeCountry(b.country)

          return (
            <TRow key={b.id} bg={rowBg}>
              {/* Barra colorida lateral */}
              <td style={{ width: 4, padding: 0 }}>
                <div style={{ width: 4, minHeight: 44, height: '100%', background: borderColor, borderRadius: '2px 0 0 2px' }} />
              </td>

              <Td>
                <div>
                  <p className="font-medium" style={{ color: b.hasPay ? 'var(--text-3)' : 'var(--text-1)' }}>
                    {b.name}
                  </p>
                  {showDetails && b.additionalMessage && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{b.additionalMessage}</p>
                  )}
                </div>
              </Td>

              {/* País */}
              <Td>
                {b.country ? (
                  <div className="flex items-center gap-1.5">
                    {normalizeCountry(b.country) === 'Espanha'
                      ? <FlagEspanha size={16} />
                      : <FlagBrasil size={16} />}
                    <span className="text-xs" style={{ color: 'var(--text-2)' }}>{normalizeCountry(b.country)}</span>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-3)' }}>—</span>
                )}
              </Td>

              <Td className="text-xs">
                {acc && hex ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      background: `${hex}22`,
                      border: `1px solid ${hex}66`,
                      color: b.hasPay ? 'var(--text-3)' : 'var(--text-2)',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: hex, display: 'inline-block', flexShrink: 0 }} />
                    {b.account}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-3)' }}>{b.account ?? '—'}</span>
                )}
              </Td>

              <Td className="text-xs">{b.category ?? '—'}</Td>
              <Td>
                <span className="font-mono text-sm" style={{ color: b.hasPay ? 'var(--text-3)' : 'var(--red)' }}>
                  {formatCurrency(b.value, b.country)}
                </span>
              </Td>
              <Td className="text-xs">{formatDate(b.dueDate)}</Td>
              <Td className="text-xs">{formatDate(b.purchaseDate)}</Td>
              <Td className="text-xs">{formatDate(b.payDay)}</Td>
              <Td>
                {b.hasPay
                  ? <span className="badge-paid"><CheckCircle2 size={10} />Pago</span>
                  : <span className="badge-pending"><AlertCircle size={10} />Pendente</span>}
              </Td>
              <Td>
                <div className="flex items-center gap-1">
                  {!b.hasPay && (
                    <button
                      title="Marcar como pago"
                      className="p-1.5 rounded-md transition-colors hover:bg-[var(--green-dim)]"
                      style={{ color: 'var(--green-400)' }}
                      onClick={() => setPayTarget(b)}
                    >
                      <CircleDollarSign size={15} />
                    </button>
                  )}
                  <button title="Histórico" className="p-1.5 rounded-md transition-colors hover:bg-[var(--blue-dim)]" style={{ color: 'var(--blue)' }} onClick={() => setHistoryTarget(b)}>
                    <History size={15} />
                  </button>
                  <button title="Editar" className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-4)]" style={{ color: 'var(--text-3)' }} onClick={() => setEditTarget(b)}>
                    <Pencil size={15} />
                  </button>
                  <button title="Excluir" className="p-1.5 rounded-md transition-colors hover:bg-[var(--red-dim)]" style={{ color: 'var(--text-3)' }} onClick={() => setDeleteTarget(b)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </Td>
            </TRow>
          )
        })}
      </Table>
      </div>

      {/* Modals */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nova Conta a Pagar" size="lg">
        <BillToPayForm onSuccess={() => { setCreateOpen(false); load() }} onCancel={() => setCreateOpen(false)} />
      </Modal>
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar Conta a Pagar" size="lg">
        {editTarget && <BillToPayForm initial={editTarget} onSuccess={() => { setEditTarget(null); load() }} onCancel={() => setEditTarget(null)} />}
      </Modal>
      {payTarget && (
        <PayBillModal
          bill={payTarget}
          onClose={() => setPayTarget(null)}
          onSuccess={() => { setPayTarget(null); load() }}
        />
      )}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir Conta" size="sm">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Deseja excluir <strong style={{ color: 'var(--text-1)' }}>{deleteTarget.name}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Spinner size={16} /> : <Trash2 size={16} />} Excluir
              </button>
            </div>
          </div>
        )}
      </Modal>
      {/* History Modal */}
      {historyTarget && (
        <BillToPayHistory bill={historyTarget} onClose={() => setHistoryTarget(null)} onRefreshParent={load} />
      )}
    </div>
  )
}
