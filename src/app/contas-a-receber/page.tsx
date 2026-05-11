'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { cashReceivableApi, accountsApi } from '@/lib/api'
import { formatCurrency, formatDate, formatYearMonth, currentYearMonth } from '@/lib/utils'
import type { CashReceivable, Account } from '@/types'
import { Modal, PageHeader, Table, Td, TRow, Spinner } from '@/components/ui'
import { YearMonthSelector } from '@/components/ui/YearMonthSelector'
import { CountryTabs, normalizeCountry } from '@/components/ui/CountryTabs'
import type { CountryFilter } from '@/components/ui/CountryTabs'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'
import { CashReceivableForm } from '@/components/forms/CashReceivableForm'
import { CashReceivableHistory } from '@/components/ui/CashReceivableHistory'
import { ReceiveModal } from '@/components/ui/ReceiveModal'
import { SummaryCards } from '@/components/ui/SummaryCards'
import { Plus, CheckCircle2, Pencil, Trash2, Clock, CircleDollarSign, History, ChevronDown, ChevronUp } from 'lucide-react'

function sortReceivables(data: CashReceivable[]): CashReceivable[] {
  return [...data].sort((a, b) => {
    const dueDiff = new Date(a.dueDate ?? '').getTime() - new Date(b.dueDate ?? '').getTime()
    if (dueDiff !== 0) return dueDiff
    return (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR', { sensitivity: 'base' })
  })
}

function hexToRowBg(hex: string): string {
  return hex || 'transparent'
}

export default function ContasAReceberPage() {
  const [ym, setYm] = useState(currentYearMonth())
  const [items, setItems] = useState<CashReceivable[]>([])
  const [accountMap, setAccountMap] = useState<Record<string, Account>>({})
  const [loading, setLoading] = useState(true)
  const [countryFilter, setCountryFilter] = useState<CountryFilter>('Todos')

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CashReceivable | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CashReceivable | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [historyTarget, setHistoryTarget] = useState<CashReceivable | null>(null)
  const [receiveTarget, setReceiveTarget] = useState<CashReceivable | null>(null)
  const [showDetails, setShowDetails] = useState(false)

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
      const res = await cashReceivableApi.search({ yearMonth: ym, showDetails: true })
      setItems(sortReceivables(res.output?.data ?? []))
    } finally {
      setLoading(false)
    }
  }, [ym])

  useEffect(() => { load() }, [load])

  const countryCounts = useMemo(() => {
    const counts = { Todos: items.length, Brasil: 0, Espanha: 0 } as Record<CountryFilter, number>
    for (const r of items) {
      const gc = normalizeCountry(r.country) === 'Espanha' ? 'Espanha' : 'Brasil'
      counts[gc]++
    }
    return counts
  }, [items])

  const filtered = useMemo(() => {
    if (countryFilter === 'Todos') return items
    const getCountry = (country?: string | null) => normalizeCountry(country) === 'Espanha' ? 'Espanha' : 'Brasil'
    return items.filter((r) => getCountry(r.country) === countryFilter)
  }, [items, countryFilter])

  const byCountry = (country: string) => items.filter(r => normalizeCountry(r.country) === country)
  const sumValues = (arr: typeof items) => arr.reduce((s, r) => s + r.value, 0)

  const totalValue    = filtered.reduce((s, r) => s + r.value, 0)
  const totalReceived = filtered.filter((r) => r.hasReceived).reduce((s, r) => s + r.value, 0)
  const totalPending  = totalValue - totalReceived

  const brasilItems   = byCountry('Brasil')
  const espanhaItems  = byCountry('Espanha')
  const summaryBrasil  = { total: sumValues(brasilItems),  positive: sumValues(brasilItems.filter(r => r.hasReceived)),  pending: sumValues(brasilItems.filter(r => !r.hasReceived))  }
  const summaryEspanha = { total: sumValues(espanhaItems), positive: sumValues(espanhaItems.filter(r => r.hasReceived)), pending: sumValues(espanhaItems.filter(r => !r.hasReceived)) }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await cashReceivableApi.delete({ id: [deleteTarget.id] })
      setDeleteTarget(null)
      await load()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Contas a Receber"
        subtitle={formatYearMonth(ym)}
        action={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <YearMonthSelector value={ym} onChange={setYm} />
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> Nova entrada
            </button>
          </div>
        }
      />

      {/* Summary */}
      <SummaryCards
        countryFilter={countryFilter}
        brasil={summaryBrasil}
        espanha={summaryEspanha}
        labels={{ total: 'Total previsto', positive: 'Recebido', pending: 'Aguardando' }}
      />

      {/* Country tabs + options */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <CountryTabs value={countryFilter} onChange={setCountryFilter} counts={countryCounts} />
        <div className="flex items-center gap-2">
          <button
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showDetails ? 'border-[var(--green-border)] text-[var(--green-400)] bg-[var(--green-dim)]' : 'border-[var(--border-1)] text-[var(--text-3)]'}`}
            onClick={() => setShowDetails(v => !v)}
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
        ) : filtered.map((r) => {
          const acc = r.account ? accountMap[r.account.trim().toLowerCase()] : undefined
          const hex = acc?.colors?.backgroundColorHexadecimal
          const toRgb = (h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]
          const rowBg = hex
            ? `rgba(${toRgb(hex).join(',')},${r.hasReceived ? 0.07 : 0.15})`
            : r.hasReceived ? 'rgba(34,197,94,0.06)' : 'var(--bg-2)'
          const cardBorder = hex
            ? `rgba(${toRgb(hex).join(',')},0.5)`
            : r.hasReceived ? 'rgba(34,197,94,0.3)' : 'var(--border-1)'
          const leftBar = hex ?? (r.hasReceived ? '#22c55e' : 'var(--border-2)')

          return (
            <div key={r.id} className="rounded-xl overflow-hidden"
              style={{ background: rowBg, border: `1px solid ${cardBorder}`, borderLeft: `3px solid ${leftBar}` }}>
              {/* Linha 1: Nome + Valor + Status */}
              <div className="flex items-start justify-between px-4 pt-3 pb-2">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="font-medium text-sm truncate" style={{ color: r.hasReceived ? 'var(--text-3)' : 'var(--text-1)' }}>
                    {r.name}
                  </p>
                  {showDetails && r.additionalMessage && (
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-3)' }}>{r.additionalMessage}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="font-mono font-semibold text-sm" style={{ color: r.hasReceived ? 'var(--text-3)' : 'var(--green-400)' }}>
                    {formatCurrency(r.value, r.country)}
                  </span>
                  {r.manipulatedValue !== r.value && (
                    <span className="font-mono text-xs" style={{ color: 'var(--amber)' }}>
                      saldo {formatCurrency(r.manipulatedValue, r.country)}
                    </span>
                  )}
                  {r.hasReceived
                    ? <span className="badge-paid"><CheckCircle2 size={10} />Recebido</span>
                    : <span className="badge-pending"><Clock size={10} />Aguardando</span>}
                </div>
              </div>

              {/* Linha 2: Conta + País + Vencimento */}
              <div className="flex items-center gap-3 px-4 pb-2 flex-wrap">
                {acc && hex ? (
                  <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-2)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: hex, display: 'inline-block' }} />
                    {r.account}
                  </span>
                ) : r.account ? (
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>{r.account}</span>
                ) : null}
                {r.country && (
                  <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-3)' }}>
                    {normalizeCountry(r.country) === 'Espanha' ? <FlagEspanha size={12} /> : <FlagBrasil size={12} />}
                    {normalizeCountry(r.country)}
                  </span>
                )}
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                  Venc. {formatDate(r.dueDate)}
                </span>
                {r.hasReceived && r.dateReceived && (
                  <span className="text-xs" style={{ color: 'var(--green-400)' }}>
                    Recebido {formatDate(r.dateReceived)}
                  </span>
                )}
              </div>

              {/* Linha 3: Ações */}
              <div className="flex items-center gap-1 px-3 pb-3 border-t pt-2"
                style={{ borderColor: 'var(--border-1)' }}>
                {!r.hasReceived && (
                  <button type="button" title="Receber"
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: 'var(--green-dim)', color: 'var(--green-400)' }}
                    onClick={() => setReceiveTarget(r)}>
                    <CircleDollarSign size={14} /> Receber
                  </button>
                )}
                <button type="button" title="Histórico"
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}
                  onClick={() => setHistoryTarget(r)}>
                  <History size={14} /> Histórico
                </button>
                <button type="button" title="Editar"
                  className="flex items-center justify-center p-1.5 rounded-lg transition-colors"
                  style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}
                  onClick={() => setEditTarget(r)}>
                  <Pencil size={15} />
                </button>
                <button type="button" title="Excluir"
                  className="flex items-center justify-center p-1.5 rounded-lg transition-colors"
                  style={{ background: 'var(--red-dim)', color: 'var(--red)' }}
                  onClick={() => setDeleteTarget(r)}>
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
        headers={['', 'Nome', 'País', 'Conta', 'Categoria', 'Valor', 'Saldo', 'Vencimento', 'Recebido em', 'Status', 'Ações']}
        loading={loading}
        empty={!loading && filtered.length === 0}
      >
        {filtered.map((r) => {
          const acc = r.account ? accountMap[r.account.trim().toLowerCase()] : undefined
          const hex = acc?.colors?.backgroundColorHexadecimal
          const rowBg = hex ? hexToRowBg(hex) : 'var(--bg-2)'
          const borderColor = hex ? hex : 'transparent'
          const country = normalizeCountry(r.country)

          return (
            <TRow key={r.id} bg={rowBg}>
              <td style={{ width: 4, padding: 0 }}>
                <div style={{ width: 4, minHeight: 44, height: '100%', background: borderColor, borderRadius: '2px 0 0 2px' }} />
              </td>

              <Td>
                <div>
                  <p className="font-medium" style={{ color: r.hasReceived ? 'var(--text-3)' : 'var(--text-1)' }}>
                    {r.name}
                  </p>
                  {showDetails && r.additionalMessage && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{r.additionalMessage}</p>
                  )}
                </div>
              </Td>

              {/* País */}
              <Td>
                {r.country ? (
                  <div className="flex items-center gap-1.5">
                    {normalizeCountry(r.country) === 'Espanha'
                      ? <FlagEspanha size={16} />
                      : <FlagBrasil size={16} />}
                    <span className="text-xs" style={{ color: 'var(--text-2)' }}>{normalizeCountry(r.country)}</span>
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
                      color: r.hasReceived ? 'var(--text-3)' : 'var(--text-2)',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: hex, display: 'inline-block', flexShrink: 0 }} />
                    {r.account}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-3)' }}>{r.account ?? '—'}</span>
                )}
              </Td>

              <Td className="text-xs">{r.category ?? '—'}</Td>
              <Td>
                <span className="font-mono text-sm" style={{ color: r.hasReceived ? 'var(--text-3)' : 'var(--green-400)' }}>
                  {formatCurrency(r.value, r.country)}
                </span>
              </Td>
              <Td>
                <span className="font-mono text-sm" style={{ color: r.manipulatedValue < r.value ? 'var(--amber)' : 'var(--text-2)' }}>
                  {formatCurrency(r.manipulatedValue, r.country)}
                </span>
              </Td>
              <Td className="text-xs">{formatDate(r.dueDate)}</Td>
              <Td className="text-xs">{formatDate(r.dateReceived)}</Td>
              <Td>
                {r.hasReceived
                  ? <span className="badge-paid"><CheckCircle2 size={10} />Recebido</span>
                  : <span className="badge-pending"><Clock size={10} />Aguardando</span>}
              </Td>
              <Td>
                <div className="flex items-center gap-1">
                  {!r.hasReceived && (
                    <button title="Registrar recebimento" className="p-1.5 rounded-md transition-colors hover:bg-[var(--green-dim)]" style={{ color: 'var(--green-400)' }} onClick={() => setReceiveTarget(r)}>
                      <CircleDollarSign size={15} />
                    </button>
                  )}
                  <button title="Histórico" className="p-1.5 rounded-md transition-colors hover:bg-[var(--blue-dim)]" style={{ color: 'var(--blue)' }} onClick={() => setHistoryTarget(r)}>
                    <History size={15} />
                  </button>
                  <button title="Editar" className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-4)]" style={{ color: 'var(--text-3)' }} onClick={() => setEditTarget(r)}>
                    <Pencil size={15} />
                  </button>
                  <button title="Excluir" className="p-1.5 rounded-md transition-colors hover:bg-[var(--red-dim)]" style={{ color: 'var(--text-3)' }} onClick={() => setDeleteTarget(r)}>
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
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nova Conta a Receber" size="lg">
        <CashReceivableForm onSuccess={() => { setCreateOpen(false); load() }} onCancel={() => setCreateOpen(false)} />
      </Modal>
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar Conta a Receber" size="lg">
        {editTarget && <CashReceivableForm initial={editTarget} onSuccess={() => { setEditTarget(null); load() }} onCancel={() => setEditTarget(null)} />}
      </Modal>
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir Registro" size="sm">
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
      {/* History Drawer */}
      {historyTarget && (
        <CashReceivableHistory item={historyTarget} onClose={() => setHistoryTarget(null)} onRefreshParent={load} />
      )}

      {/* Receive Modal */}
      {receiveTarget && (
        <ReceiveModal item={receiveTarget} onClose={() => setReceiveTarget(null)} onSuccess={() => { setReceiveTarget(null); load() }} />
      )}
    </div>
  )
}


