'use client'

import { AppLayout } from '@/components/layout/AppLayout'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { billsToPayApi, accountsApi } from '@/lib/api'
import { formatCurrency, formatDate, formatYearMonth, currentYearMonth } from '@/lib/utils'
import { loadSaldoFinalYm } from '@/lib/wallet'
import type { BillToPay, Account } from '@/types'
import { Modal, PageHeader, Table, Td, TRow, Spinner } from '@/components/ui'
import { YearMonthSelector } from '@/components/ui/YearMonthSelector'
import { CountryTabs, normalizeCountry } from '@/components/ui/CountryTabs'
import type { CountryFilter } from '@/components/ui/CountryTabs'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'
import { CategoryFilter, matchesCategory } from '@/components/ui/CategoryFilter'
import { BillToPayForm } from '@/components/forms/BillToPayForm'
import { PayBillModal } from '@/components/ui/PayBillModal'
import { BulkPayModal } from '@/components/ui/BulkPayModal'
import { BillToPayHistory } from '@/components/ui/BillToPayHistory'
import { SummaryCards } from '@/components/ui/SummaryCards'
import {
  Plus, CheckCircle2, Pencil, Trash2,
  ChevronDown, ChevronUp, AlertCircle, History, CircleDollarSign, CreditCard,
  Search, X, Square, SquareCheck, ReceiptText,
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

function ContasAPagarPageInner() {
  const [ym, setYm] = useState(currentYearMonth())
  const [configLoaded, setConfigLoaded] = useState(false)
  const [bills, setBills] = useState<BillToPay[]>([])
  const [accountMap, setAccountMap] = useState<Record<string, Account>>({})
  const [loading, setLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [countryFilter, setCountryFilter] = useState<CountryFilter>('Todos')
  const [accountFilter, setAccountFilter] = useState<string>('Todos')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Pago' | 'Pendente'>('Todos')
  const [catGroup, setCatGroup] = useState('')
  const [catSub, setCatSub] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<BillToPay | null>(null)
  const [payTarget, setPayTarget] = useState<BillToPay | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BillToPay | null>(null)
  const [historyTarget, setHistoryTarget] = useState<BillToPay | null>(null)
  const [relatedTarget, setRelatedTarget] = useState<BillToPay | null>(null)
  const [bulkPayOpen, setBulkPayOpen] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const [deleting, setDeleting] = useState(false)

  // Mede a altura do bloco de filtros sticky para fixar o cabeçalho da tabela logo abaixo dele
  const filtersRef = useRef<HTMLDivElement>(null)
  const [headerOffset, setHeaderOffset] = useState(0)
  useEffect(() => {
    const el = filtersRef.current
    if (!el) return
    const update = () => setHeaderOffset(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => { ro.disconnect(); window.removeEventListener('resize', update) }
  }, [])

  useEffect(() => {
    accountsApi.searchAll().then((res) => {
      const map: Record<string, Account> = {}
      for (const acc of res.data ?? []) {
        map[acc.name.trim().toLowerCase()] = acc
      }
      setAccountMap(map)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const configured = loadSaldoFinalYm()
    setYm(configured || currentYearMonth())
    setConfigLoaded(true)
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

  useEffect(() => { if (!configLoaded) return; load() }, [load, configLoaded])

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
    let result = bills
    if (countryFilter !== 'Todos') {
      const getCountry = (country?: string | null) => normalizeCountry(country) === 'Espanha' ? 'Espanha' : 'Brasil'
      result = result.filter(b => getCountry(b.country) === countryFilter)
    }
    if (accountFilter !== 'Todos') {
      result = result.filter(b => b.account === accountFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(b =>
        b.name?.toLowerCase().includes(q) ||
        b.additionalMessage?.toLowerCase().includes(q) ||
        b.category?.toLowerCase().includes(q)
      )
    }
    if (catGroup) {
      result = result.filter(b => matchesCategory(b.category, catGroup, catSub))
    }
    if (statusFilter !== 'Todos') {
      result = result.filter(b => statusFilter === 'Pago' ? b.hasPay : !b.hasPay)
    }
    return result
  }, [bills, countryFilter, accountFilter, search, catGroup, catSub, statusFilter])

  const byCountry = (country: string) => bills.filter(b => normalizeCountry(b.country) === country)
  const sumValues = (arr: typeof bills) => arr.reduce((s, b) => s + b.value, 0)

  const totalPaid    = filtered.filter((b) => b.hasPay).reduce((s, b) => s + b.value, 0)
  const totalPending = filtered.filter((b) => !b.hasPay).reduce((s, b) => s + b.value, 0)
  const total        = filtered.reduce((s, b) => s + b.value, 0)

  const brasilBills  = byCountry('Brasil')
  const espanhaBills = byCountry('Espanha')
  const summaryBrasil  = { total: sumValues(brasilBills),  positive: sumValues(brasilBills.filter(b => b.hasPay)),  pending: sumValues(brasilBills.filter(b => !b.hasPay))  }
  const summaryEspanha = { total: sumValues(espanhaBills), positive: sumValues(espanhaBills.filter(b => b.hasPay)), pending: sumValues(espanhaBills.filter(b => !b.hasPay)) }

  // Selection helpers
  const selectedItems = filtered.filter(b => !!selected[b.id])
  const allSelected   = filtered.length > 0 && filtered.every(b => !!selected[b.id])

  function toggleOne(id: string) {
    setSelected(prev => { const n = { ...prev }; n[id] ? delete n[id] : (n[id] = true); return n })
  }
  function toggleAll() {
    if (allSelected) {
      setSelected({})
    } else {
      const next: Record<string, boolean> = {}
      filtered.forEach(b => { next[b.id] = true })
      setSelected(next)
    }
  }

  // Contas únicas para filtro rápido
  const uniqueAccounts = useMemo(() => {
    const seen: Record<string, true> = {}
    const names: string[] = []
    for (const b of bills) {
      if (b.account && !seen[b.account]) {
        seen[b.account] = true
        names.push(b.account)
      }
    }
    return names.sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [bills])

  // Soma por conta (baseado nos dados filtrados por país)
  const accountSummary = useMemo(() => {
    const source = countryFilter === 'Todos' ? bills : filtered
    const map: Record<string, { total: number; pending: number; hex?: string; isCreditCard?: boolean; countries: Set<string> }> = {}
    for (const b of source) {
      const key = b.account ?? '—'
      if (!map[key]) {
        const acc = b.account ? accountMap[b.account.trim().toLowerCase()] : undefined
        map[key] = { total: 0, pending: 0, hex: acc?.colors?.backgroundColorHexadecimal, isCreditCard: acc?.isCreditCard, countries: new Set() }
      }
      map[key].total += b.value
      if (!b.hasPay) map[key].pending += b.value
      if (b.country) map[key].countries.add(b.country.trim())
    }
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total)
  }, [bills, filtered, countryFilter, accountMap])

  // Contas de cartão de crédito (isCreditCard=true no accountMap)
  const creditCardTotal = useMemo(() => {
    return bills
      .filter(b => {
        const acc = b.account ? accountMap[b.account.trim().toLowerCase()] : undefined
        return acc?.isCreditCard && !b.hasPay
      })
      .reduce((s, b) => s + b.value, 0)
  }, [bills, accountMap])


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
      {/* Cabeçalho fixo: header, summary e filtros permanecem visíveis no scroll */}
      <div
        ref={filtersRef}
        className="sm:sticky z-30 space-y-4 sm:pb-3"
        style={{ top: 0, background: 'var(--bg-1)', marginLeft: -2, marginRight: -2, paddingLeft: 2, paddingRight: 2 }}
      >
      <PageHeader
        title="Contas a Pagar"
        subtitle={formatYearMonth(ym)}
        action={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <YearMonthSelector value={ym} onChange={setYm} />
            <button className="btn-secondary flex items-center gap-1.5" onClick={() => setBulkPayOpen(true)}>
              <CreditCard size={15} /> Pagar em Massa
            </button>
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> Nova conta
            </button>
          </div>
        }
      />

      {/* Summary com resumo por conta embutido */}
      <SummaryCards
        countryFilter={countryFilter}
        brasil={summaryBrasil}
        espanha={summaryEspanha}
        labels={{ total: 'Total do mês', positive: 'Pago', pending: 'Pendente' }}
        accountSummary={accountSummary.map(([name, data]) => ({
          name,
          total: data.total,
          pending: data.pending,
          hex: data.hex,
          isCreditCard: data.isCreditCard,
          currency: data.countries.size === 1 && data.countries.has('Espanha') ? 'Espanha' : 'Brasil',
        }))}
      />

      {/* Bulk selection bar */}
      {Object.keys(selected).length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 rounded-xl" style={{ background: 'var(--bg-3)', border: '1px solid rgba(96,165,250,0.3)' }}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
              <span style={{ color: 'var(--green-400)', fontWeight: 700 }}>{Object.keys(selected).length}</span> selecionado(s)
            </span>
            {(() => {
              const brItems = selectedItems.filter(b => normalizeCountry(b.country) !== 'Espanha')
              const esItems = selectedItems.filter(b => normalizeCountry(b.country) === 'Espanha')
              const brTotal = brItems.reduce((s, b) => s + (b.value ?? 0), 0)
              const esTotal = esItems.reduce((s, b) => s + (b.value ?? 0), 0)
              const hasBoth = brItems.length > 0 && esItems.length > 0
              return (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'var(--text-3)' }}>
                  <span style={{ color: 'var(--border-2)' }}>·</span>
                  {brItems.length > 0 && (
                    <span className="flex items-center gap-1">
                      {hasBoth && <FlagBrasil size={12} />}
                      <span className="font-mono font-semibold" style={{ color: 'var(--red)' }}>{formatCurrency(brTotal, 'Brasil')}</span>
                    </span>
                  )}
                  {esItems.length > 0 && (
                    <span className="flex items-center gap-1">
                      {hasBoth && <><span style={{ color: 'var(--border-2)' }}>·</span><FlagEspanha size={12} /></>}
                      <span className="font-mono font-semibold" style={{ color: 'var(--red)' }}>{formatCurrency(esTotal, 'Espanha')}</span>
                    </span>
                  )}
                </div>
              )
            })()}
          </div>
          <button type="button" className="text-xs px-3 py-1 rounded-lg" style={{ color: 'var(--text-3)', border: '1px solid var(--border-1)' }} onClick={() => setSelected({})}>
            Limpar seleção
          </button>
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <CountryTabs value={countryFilter} onChange={setCountryFilter} counts={countryCounts} />
            {/* Status filter ao lado dos países */}
            <div className="flex items-center gap-1 ml-1 pl-2" style={{ borderLeft: '1px solid var(--border-1)' }}>
              {(['Todos', 'Pendente', 'Pago'] as const).map(s => {
                const active = statusFilter === s
                const activeColor = s === 'Pago' ? 'var(--green-400)' : s === 'Pendente' ? 'var(--amber)' : 'var(--blue)'
                const activeBg = s === 'Pago' ? 'var(--green-dim)' : s === 'Pendente' ? 'rgba(245,158,11,0.1)' : 'var(--blue-dim)'
                return (
                  <button key={s} type="button" onClick={() => setStatusFilter(s)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: active ? activeBg : 'var(--bg-3)',
                      color: active ? activeColor : 'var(--text-2)',
                      border: `1px solid ${active ? activeColor : 'var(--border-1)'}`,
                    }}>
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
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

        {/* Search input */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-3)' }} />
          <input
            type="text"
            className="input w-full pl-8 text-sm"
            placeholder="Filtrar por nome, categoria ou observação..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-3)' }}
              onClick={() => setSearch('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
        {/* Category filter */}
        <CategoryFilter
          categories={bills.map(b => b.category ?? '').filter(Boolean)}
          selectedGroup={catGroup}
          selectedSub={catSub}
          onGroupChange={setCatGroup}
          onSubChange={setCatSub}
        />

        {(search.trim() || catGroup) && (() => {
          const brItems = filtered.filter(b => normalizeCountry(b.country) !== 'Espanha')
          const esItems = filtered.filter(b => normalizeCountry(b.country) === 'Espanha')
          const brTotal = brItems.reduce((s, b) => s + (b.value ?? 0), 0)
          const esTotal = esItems.reduce((s, b) => s + (b.value ?? 0), 0)
          const brPending = brItems.filter(b => !b.hasPay).reduce((s, b) => s + (b.value ?? 0), 0)
          const esPending = esItems.filter(b => !b.hasPay).reduce((s, b) => s + (b.value ?? 0), 0)
          const hasBoth = brItems.length > 0 && esItems.length > 0
          return (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-3)' }}>
              <span><span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{filtered.length}</span> {filtered.length === 1 ? 'item' : 'itens'}</span>
              {brItems.length > 0 && (
                <>
                  <span style={{ color: 'var(--border-2)' }}>·</span>
                  {hasBoth && <FlagBrasil size={14} />}
                  <span>Total: <span className="font-mono font-semibold" style={{ color: 'var(--red)' }}>{formatCurrency(brTotal, 'Brasil')}</span></span>
                  <span>Pendente: <span className="font-mono font-semibold" style={{ color: 'var(--amber)' }}>{formatCurrency(brPending, 'Brasil')}</span></span>
                </>
              )}
              {esItems.length > 0 && (
                <>
                  <span style={{ color: 'var(--border-2)' }}>·</span>
                  {hasBoth && <FlagEspanha size={14} />}
                  <span>Total: <span className="font-mono font-semibold" style={{ color: 'var(--red)' }}>{formatCurrency(esTotal, 'Espanha')}</span></span>
                  <span>Pendente: <span className="font-mono font-semibold" style={{ color: 'var(--amber)' }}>{formatCurrency(esPending, 'Espanha')}</span></span>
                </>
              )}
            </div>
          )
        })()}

        {/* Quick account filter */}
        {uniqueAccounts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setAccountFilter('Todos')}
              className="text-xs px-3 py-1 rounded-full border transition-colors"
              style={{
                background: accountFilter === 'Todos' ? 'var(--bg-5)' : 'transparent',
                border: `1px solid ${accountFilter === 'Todos' ? 'var(--border-3)' : 'var(--border-1)'}`,
                color: accountFilter === 'Todos' ? 'var(--text-1)' : 'var(--text-3)',
              }}
            >
              Todas
            </button>
            {uniqueAccounts.map(acc => {
              const accData = accountMap[acc.trim().toLowerCase()]
              const hex = accData?.colors?.backgroundColorHexadecimal
              const active = accountFilter === acc
              const accBills = bills.filter(b => b.account === acc)
              const accTotal = accBills.reduce((s, b) => s + b.value, 0)
              const onlySpain = accBills.length > 0 && accBills.every(b => b.country?.trim() === 'Espanha')
              const accCurr = onlySpain ? 'Espanha' : 'Brasil'
              return (
                <button
                  key={acc}
                  type="button"
                  onClick={() => setAccountFilter(active ? 'Todos' : acc)}
                  className="text-xs px-3 py-1 rounded-full border transition-colors flex items-center gap-1.5"
                  style={{
                    background: active ? (hex ? `${hex}22` : 'var(--bg-5)') : 'transparent',
                    border: `1px solid ${active ? (hex ?? 'var(--border-3)') : 'var(--border-1)'}`,
                    color: active ? (hex ?? 'var(--text-1)') : 'var(--text-3)',
                  }}
                >
                  {hex && <span style={{ width: 6, height: 6, borderRadius: '50%', background: hex, display: 'inline-block', flexShrink: 0 }} />}
                  {acc}
                  <span className="font-mono ml-0.5" style={{ opacity: active ? 1 : 0.6 }}>
                    {formatCurrency(accTotal, accCurr)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      </div>{/* fim do cabeçalho sticky */}

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
          const rowBg = b.hasPay
            ? 'rgba(34,197,94,0.08)'
            : 'var(--bg-2)'
          const cardBorder = b.hasPay
            ? 'rgba(34,197,94,0.30)'
            : 'var(--border-1)'
          const leftBar = b.hasPay ? '#22c55e' : 'var(--border-2)'

          return (
            <div key={b.id} className="rounded-xl overflow-hidden transition-all"
              style={{
                background: !!selected[b.id] ? 'rgba(96,165,250,0.10)' : rowBg,
                border: `1px solid ${!!selected[b.id] ? 'rgba(96,165,250,0.4)' : cardBorder}`,
                borderLeft: `3px solid ${!!selected[b.id] ? 'var(--blue)' : leftBar}`,
                cursor: 'pointer',
              }}
              onClick={() => toggleOne(b.id)}>
              {/* Linha 1: Nome + Valor + Status */}
              <div className="flex items-start justify-between px-4 pt-3 pb-2">
                <div className="flex items-start gap-2 flex-1 min-w-0 pr-3">
                  <span style={{ color: !!selected[b.id] ? 'var(--blue)' : 'var(--text-3)', flexShrink: 0, marginTop: 2 }}>
                    {!!selected[b.id] ? <SquareCheck size={14} /> : <Square size={14} />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: b.hasPay ? 'var(--text-3)' : 'var(--text-1)' }}>
                      {b.name}
                    </p>
                    {showDetails && b.additionalMessage && (
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-3)' }}>{b.additionalMessage}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="font-mono font-semibold text-sm" style={{ color: b.hasPay ? 'var(--green-400)' : 'var(--red)' }}>
                    {formatCurrency(b.value, b.country)}
                  </span>
                  {b.hasPay
                    ? <span className="badge-paid"><CheckCircle2 size={10} />Pago</span>
                    : <span className="badge-pending"><AlertCircle size={10} />Pendente</span>}
                </div>
              </div>

              {/* Linha 2: Conta + País + Vencimento + Qtd Compras */}
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
                {(b.detailsQuantity ?? 0) > 0 && (
                  <button type="button"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(96,165,250,0.3)' }}
                    onClick={e => { e.stopPropagation(); setRelatedTarget(b) }}>
                    <ReceiptText size={11} /> {b.detailsQuantity} compra{(b.detailsQuantity ?? 0) > 1 ? 's' : ''}
                  </button>
                )}
              </div>

              {/* Linha 3: Ações */}
              <div className="flex items-center gap-1 px-3 pb-3 border-t pt-2"
                style={{ borderColor: 'var(--border-1)' }}>
                {!b.hasPay && (
                  <button type="button" title="Pagar"
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: 'var(--green-dim)', color: 'var(--green-400)' }}
                    onClick={e => { e.stopPropagation(); setPayTarget(b) }}>
                    <CircleDollarSign size={14} /> Pagar
                  </button>
                )}
                <button type="button" title="Histórico"
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}
                  onClick={e => { e.stopPropagation(); setHistoryTarget(b) }}>
                  <History size={14} /> Histórico
                </button>
                <button type="button" title="Editar"
                  className="flex items-center justify-center p-1.5 rounded-lg transition-colors"
                  style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}
                  onClick={e => { e.stopPropagation(); setEditTarget(b) }}>
                  <Pencil size={15} />
                </button>
                <button type="button" title="Excluir"
                  className="flex items-center justify-center p-1.5 rounded-lg transition-colors"
                  style={{ background: 'var(--red-dim)', color: 'var(--red)' }}
                  onClick={e => { e.stopPropagation(); setDeleteTarget(b) }}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabela desktop */}
      <div className="hidden sm:block">
      <Table
        headers={['', 'Nome', 'País', 'Qtd Compras', 'Conta', 'Categoria', 'Valor', 'Vencimento', 'Dt. Compra', 'Pago em', 'Status', 'Ações']}
        loading={loading}
        empty={!loading && filtered.length === 0}
        headerOffset={headerOffset}
      >
        {filtered.map((b) => {
          const acc = b.account ? accountMap[b.account.trim().toLowerCase()] : undefined
          const hex = acc?.colors?.backgroundColorHexadecimal
          const isRowSelected = !!selected[b.id]
          const bg = isRowSelected
            ? 'rgba(96,165,250,0.10)'
            : b.hasPay
              ? '#1b2e1d'
              : 'var(--bg-2)'

          return (
            <TRow key={b.id} bg={bg} onClick={() => toggleOne(b.id)} style={{ cursor: 'pointer', outline: isRowSelected ? '1px solid rgba(96,165,250,0.4)' : undefined }}>
              <Td>
                <button type="button" onClick={e => { e.stopPropagation(); toggleOne(b.id) }} style={{ color: isRowSelected ? 'var(--blue)' : 'var(--text-3)' }}>
                  {isRowSelected ? <SquareCheck size={15} /> : <Square size={15} />}
                </button>
              </Td>
              <Td>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-1)' }}>{b.name}</p>
                  {showDetails && b.additionalMessage && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{b.additionalMessage}</p>
                  )}
                </div>
              </Td>
              <Td>
                {b.country ? (
                  <div className="flex items-center gap-1.5">
                    {normalizeCountry(b.country) === 'Espanha' ? <FlagEspanha size={16} /> : <FlagBrasil size={16} />}
                    <span className="text-xs" style={{ color: 'var(--text-2)' }}>{normalizeCountry(b.country)}</span>
                  </div>
                ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
              </Td>
              <Td>
                {(b.detailsQuantity ?? 0) > 0 ? (
                  <button type="button" onClick={e => { e.stopPropagation(); setRelatedTarget(b) }}
                    title="Ver registros relacionados"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-colors"
                    style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(96,165,250,0.3)' }}>
                    <ReceiptText size={11} /> {b.detailsQuantity}
                  </button>
                ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
              </Td>
              <Td className="text-xs">
                {acc && hex ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: `${hex}22`, border: `1px solid ${hex}66`, color: 'var(--text-2)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: hex, display: 'inline-block', flexShrink: 0 }} />
                    {b.account}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-3)' }}>{b.account ?? '—'}</span>
                )}
              </Td>
              <Td className="text-xs">{b.category ?? '—'}</Td>
              <Td>
                <span className="font-mono text-sm" style={{ color: b.hasPay ? 'var(--green-400)' : 'var(--red)' }}>
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
                    <button title="Marcar como pago" className="p-1.5 rounded-md transition-colors hover:bg-[var(--green-dim)]" style={{ color: 'var(--green-400)' }}
                      onClick={e => { e.stopPropagation(); setPayTarget(b) }}>
                      <CircleDollarSign size={15} />
                    </button>
                  )}
                  <button title="Histórico" className="p-1.5 rounded-md transition-colors hover:bg-[var(--blue-dim)]" style={{ color: 'var(--blue)' }}
                    onClick={e => { e.stopPropagation(); setHistoryTarget(b) }}>
                    <History size={15} />
                  </button>
                  <button title="Editar" className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-4)]" style={{ color: 'var(--text-3)' }}
                    onClick={e => { e.stopPropagation(); setEditTarget(b) }}>
                    <Pencil size={15} />
                  </button>
                  <button title="Excluir" className="p-1.5 rounded-md transition-colors hover:bg-[var(--red-dim)]" style={{ color: 'var(--text-3)' }}
                    onClick={e => { e.stopPropagation(); setDeleteTarget(b) }}>
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
      {bulkPayOpen && (
        <BulkPayModal
          accountMap={accountMap}
          onClose={() => setBulkPayOpen(false)}
          onSuccess={() => { setBulkPayOpen(false); load() }}
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
      {/* Registros Relacionados Modal */}
      <Modal open={!!relatedTarget} onClose={() => setRelatedTarget(null)} title="Registros Relacionados" size="xl">
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
                  {[...(relatedTarget.details ?? [])].sort((a, b) => (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? '')).map(d => (
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
    </div>
  )
}

export default function ContasAPagarPage() {
  return <AppLayout><ContasAPagarPageInner /></AppLayout>
}
