'use client'

import { AppLayout } from '@/components/layout/AppLayout'
import { useEffect, useState, useCallback, useMemo, useRef, Fragment } from 'react'
import { billsToPayApi, accountsApi, cashReceivableApi, walletApi } from '@/lib/api'
import { formatCurrency, formatDate, formatYearMonth, currentYearMonth, DEFAULT_SALDO_CONTAS } from '@/lib/utils'
import {
  loadSaldoFinalYm, loadContasPagarSortCol, loadContasPagarSortDir,
  loadContasPagarColumnsOrder, loadContasPagarColumnsHidden, loadContasPagarAccountStyle,
} from '@/lib/wallet'
import type { ContasPagarSortCol, ContasPagarColumnKey, ContasPagarAccountStyle } from '@/lib/wallet'
import type { BillToPay, Account } from '@/types'
import { Modal, PageHeader, Table, Td, TRow, Spinner } from '@/components/ui'
import { YearMonthSelector } from '@/components/ui/YearMonthSelector'
import { CountryTabs, normalizeCountry } from '@/components/ui/CountryTabs'
import type { CountryFilter } from '@/components/ui/CountryTabs'
import { FlagBrasil, FlagEspanha } from '@/components/ui/Flags'
import { CategoryFilter, matchesCategory } from '@/components/ui/CategoryFilter'
import { BillToPayForm } from '@/components/forms/BillToPayForm'
import { QuickBillToPayForm } from '@/components/forms/QuickBillToPayForm'
import type { QuickBillPrefill, BillToPayQuickValues } from '@/components/forms/QuickBillToPayForm'
import { PayBillModal } from '@/components/ui/PayBillModal'
import { BulkPayModal } from '@/components/ui/BulkPayModal'
import { BillToPayHistory } from '@/components/ui/BillToPayHistory'
import { SummaryCards } from '@/components/ui/SummaryCards'
import {
  Plus, CheckCircle2, Pencil, Trash2,
  ChevronDown, ChevronUp, AlertCircle, History, CircleDollarSign, CreditCard,
  Search, X, Square, SquareCheck, ReceiptText,
} from 'lucide-react'

/** Dias corridos entre a data de compra e hoje (0 = hoje, 1 = ontem, 2 = anteontem...). */
function purchaseDateDiffDays(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const datePart = dateStr.split('T')[0]   // garante só "YYYY-MM-DD" mesmo se vier ISO completo
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(datePart + 'T12:00:00'); d.setHours(0, 0, 0, 0)
  if (isNaN(d.getTime())) return null
  return Math.round((today.getTime() - d.getTime()) / 86_400_000)
}

const FILTERS_COLLAPSED_KEY = 'finance_contas_pagar_filters_collapsed'

const DAY_FILTERS = ['Todos', 'Hoje', 'Ontem', 'Anteontem'] as const
type DayFilter = typeof DAY_FILTERS[number]
// "Todos" não tem pill própria — reaproveita o Todos do filtro de status.
const DAY_FILTER_OPTIONS = ['Hoje', 'Ontem', 'Anteontem'] as const
const DAY_FILTER_DIFF: Record<Exclude<DayFilter, 'Todos'>, number> = { Hoje: 0, Ontem: 1, Anteontem: 2 }

// Todas as colunas de dados da tabela desktop são configuráveis (visibilidade + ordem)
// em Configurações — só o checkbox de seleção e "Ações" ficam fixos, por serem
// controles de interação e não informação.
const COLUMN_HEADER_DEFS: Record<ContasPagarColumnKey, { label: string; sortKey: ContasPagarSortCol }> = {
  name:         { label: 'Nome',       sortKey: 'name' },
  country:      { label: 'País',       sortKey: 'country' },
  account:      { label: 'Conta',      sortKey: 'account' },
  category:     { label: 'Categoria',  sortKey: 'category' },
  value:        { label: 'Valor',      sortKey: 'value' },
  dueDate:      { label: 'Vencimento', sortKey: 'dueDate' },
  purchaseDate: { label: 'Dt. Compra', sortKey: 'purchaseDate' },
  payDay:       { label: 'Pago em',    sortKey: 'payDay' },
  status:       { label: 'Status',     sortKey: 'status' },
}

// Aplicado a toda coluna que não seja Nome — `width: 1%` faz o navegador encolher
// a coluna ao conteúdo (não distribuir largura extra pra ela) e `whiteSpace: nowrap`
// evita quebra de linha, então toda a folga de espaço sobra pra coluna Nome.
const NOWRAP_TIGHT = { width: '1%', whiteSpace: 'nowrap' } as const

function purchaseDateTag(dateStr?: string | null): { label: string; color: string; bg: string; border: string } | null {
  const diff = purchaseDateDiffDays(dateStr)
  if (diff === 0) return { label: 'Hoje',      color: 'var(--amber)',  bg: 'var(--amber-dim)',   border: 'rgba(251,191,36,0.35)' }
  if (diff === 1) return { label: 'Ontem',     color: 'var(--blue)',   bg: 'var(--blue-dim)',    border: 'rgba(96,165,250,0.35)' }
  if (diff === 2) return { label: 'Anteontem', color: 'var(--text-2)', bg: 'var(--bg-4)',        border: 'var(--border-2)' }
  return null
}

function sortBillsDefault(data: BillToPay[]): BillToPay[] {
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

/** Ordena a lista pela coluna clicada pelo usuário (ou pelo padrão configurado). */
function sortBillsBy(data: BillToPay[], col: ContasPagarSortCol, dir: 'asc' | 'desc'): BillToPay[] {
  if (col === 'default') return sortBillsDefault(data)
  const d = dir === 'asc' ? 1 : -1
  const toTime = (v?: string | null) => v ? new Date(v).getTime() : 0
  return [...data].sort((a, b) => {
    switch (col) {
      case 'name':         return d * (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR')
      case 'country':      return d * (a.country ?? '').localeCompare(b.country ?? '', 'pt-BR')
      case 'account':      return d * (a.account ?? '').localeCompare(b.account ?? '', 'pt-BR')
      case 'category':     return d * (a.category ?? '').localeCompare(b.category ?? '', 'pt-BR')
      case 'value':        return d * (a.value - b.value)
      case 'dueDate':      return d * (toTime(a.dueDate) - toTime(b.dueDate))
      case 'purchaseDate': return d * (toTime(a.purchaseDate) - toTime(b.purchaseDate))
      case 'payDay':       return d * (toTime(a.payDay) - toTime(b.payDay))
      case 'status':       return d * ((a.hasPay ? 1 : 0) - (b.hasPay ? 1 : 0))
      default:             return 0
    }
  })
}

function ContasAPagarPageInner() {
  const [ym, setYm] = useState(currentYearMonth())
  const [configLoaded, setConfigLoaded] = useState(false)
  const [bills, setBills] = useState<BillToPay[]>([])
  const [accountMap, setAccountMap] = useState<Record<string, Account>>({})
  const [loading, setLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(FILTERS_COLLAPSED_KEY) === 'true') setFiltersCollapsed(true)
  }, [])

  function toggleFiltersCollapsed() {
    setFiltersCollapsed(v => {
      const next = !v
      localStorage.setItem(FILTERS_COLLAPSED_KEY, String(next))
      return next
    })
  }
  const [countryFilter, setCountryFilter] = useState<CountryFilter>('Todos')
  const [accountFilter, setAccountFilter] = useState<string>('Todos')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Pago' | 'Pendente'>('Todos')
  const [dayFilter, setDayFilter] = useState<DayFilter>('Todos')
  const [catPath, setCatPath] = useState<string[]>([])
  const [sortCol, setSortCol] = useState<ContasPagarSortCol>(() => loadContasPagarSortCol())
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => loadContasPagarSortDir())

  function handleSort(col: ContasPagarSortCol) {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  // Colunas visíveis/ordem da tabela desktop — configurável em Configurações
  const [columnsOrder] = useState<ContasPagarColumnKey[]>(() => loadContasPagarColumnsOrder())
  const [columnsHidden] = useState<Record<ContasPagarColumnKey, boolean>>(() => loadContasPagarColumnsHidden())
  const visibleColumns = columnsOrder.filter(k => !columnsHidden[k])
  const [accountStyle] = useState<ContasPagarAccountStyle>(() => loadContasPagarAccountStyle())

  // Clicar na linha expande/colapsa os detalhes completos daquela conta — a seleção
  // pra ações em massa continua só pelo checkbox (que já tem stopPropagation próprio).
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  function toggleExpanded(id: string) {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const [createOpen, setCreateOpen] = useState(false)
  const [createMode, setCreateMode] = useState<'quick' | 'full'>('quick')
  const [fullPrefill, setFullPrefill] = useState<QuickBillPrefill | undefined>(undefined)
  const [quickPrefill, setQuickPrefill] = useState<BillToPayQuickValues | undefined>(undefined)
  const [editTarget, setEditTarget] = useState<BillToPay | null>(null)
  const [payTarget, setPayTarget] = useState<BillToPay | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BillToPay | null>(null)
  const [historyTarget, setHistoryTarget] = useState<BillToPay | null>(null)
  const [relatedTarget, setRelatedTarget] = useState<BillToPay | null>(null)
  // Registros Relacionados: clicar na linha expande os detalhes completos daquele registro —
  // zera ao trocar de conta (ou fechar), pra não reabrir já com linhas de uma conta anterior expandidas
  const [expandedRelatedIds, setExpandedRelatedIds] = useState<Record<string, boolean>>({})
  useEffect(() => { setExpandedRelatedIds({}) }, [relatedTarget?.id])
  function toggleExpandedRelated(id: string) {
    setExpandedRelatedIds(prev => ({ ...prev, [id]: !prev[id] }))
  }
  const [bulkPayOpen, setBulkPayOpen] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const [deleting, setDeleting] = useState(false)

  // Saldo em Contas a Receber da conta selecionada
  const [saldoContas, setSaldoContas] = useState<string[]>([...DEFAULT_SALDO_CONTAS])
  const [accountSaldo, setAccountSaldo] = useState<number | null>(null)
  const [accountSaldoLoading, setAccountSaldoLoading] = useState(false)

  useEffect(() => {
    walletApi.search()
      .then(res => {
        const rec = res.output?.data?.find(r => r.walletKey === 'finance_saldo_contas')
        if (rec?.walletValue) {
          try { setSaldoContas(JSON.parse(rec.walletValue)) } catch {}
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const match = saldoContas.some(s => s.trim().toLowerCase() === accountFilter.trim().toLowerCase())
    if (!match) { setAccountSaldo(null); return }
    setAccountSaldoLoading(true)
    cashReceivableApi.search({ yearMonth: ym })
      .then(res => {
        const records = res.output?.data ?? []
        const saldo = records
          .filter(r => r.account?.trim().toLowerCase() === accountFilter.trim().toLowerCase() && !r.hasReceived)
          .reduce((s, r) => s + (r.manipulatedValue ?? 0), 0)
        setAccountSaldo(saldo)
      })
      .catch(() => setAccountSaldo(null))
      .finally(() => setAccountSaldoLoading(false))
  }, [accountFilter, ym, saldoContas])

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
      setBills(res.output?.data ?? [])
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
    if (catPath.length) {
      result = result.filter(b => matchesCategory(b.category, catPath))
    }
    if (statusFilter !== 'Todos') {
      result = result.filter(b => statusFilter === 'Pago' ? b.hasPay : !b.hasPay)
    }
    if (dayFilter !== 'Todos') {
      const target = DAY_FILTER_DIFF[dayFilter]
      result = result.filter(b => purchaseDateDiffDays(b.purchaseDate) === target)
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, countryFilter, accountFilter, search, catPath.join(':'), statusFilter, dayFilter])

  // Ordenação exibida na tabela — coluna clicada pelo usuário (ou o padrão configurado)
  const sortedFiltered = useMemo(
    () => sortBillsBy(filtered, sortCol, sortDir),
    [filtered, sortCol, sortDir]
  )

  // Valor gasto em cada dia (Hoje/Ontem/Anteontem), separado por país — exibido na própria pill do filtro
  const dayFilterTotals = useMemo(() => {
    const result: Record<typeof DAY_FILTER_OPTIONS[number], { brasil: number; espanha: number; hasBrasil: boolean; hasEspanha: boolean }> = {
      Hoje:      { brasil: 0, espanha: 0, hasBrasil: false, hasEspanha: false },
      Ontem:     { brasil: 0, espanha: 0, hasBrasil: false, hasEspanha: false },
      Anteontem: { brasil: 0, espanha: 0, hasBrasil: false, hasEspanha: false },
    }
    for (const b of bills) {
      const diff = purchaseDateDiffDays(b.purchaseDate)
      const key = diff === 0 ? 'Hoje' : diff === 1 ? 'Ontem' : diff === 2 ? 'Anteontem' : null
      if (!key) continue
      if (normalizeCountry(b.country) === 'Espanha') {
        result[key].espanha += b.value
        result[key].hasEspanha = true
      } else {
        result[key].brasil += b.value
        result[key].hasBrasil = true
      }
    }
    return result
  }, [bills])

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

  /** Célula de uma das colunas configuráveis (visíveis/ordem definidas em Configurações). */
  function renderConfigurableColumnCell(key: ContasPagarColumnKey, b: BillToPay) {
    switch (key) {
      case 'name':
        // Sem width/maxWidth de propósito: é a única coluna que deve crescer e ocupar
        // todo o espaço que sobrar — as demais ganham `width: 1%` (ver NOWRAP_TIGHT
        // abaixo), o que faz o navegador encolhê-las ao conteúdo e jogar toda folga
        // de largura pra cá.
        return (
          <Td key="name">
            <div className="min-w-0">
              {/* Nome truncado numa linha só (com tooltip) — nomes longos quebrando em
                  3-4 linhas deixavam as linhas da tabela muito altas e irregulares,
                  fazendo o cabeçalho sticky "cortar" no meio de uma linha durante o
                  scroll (mais visível quando a coluna fica mais estreita, ex: 100% de
                  zoom vs 80%). */}
              <p className="font-medium truncate" style={{ color: 'var(--text-1)' }} title={b.name}>{b.name}</p>
              {/* line-clamp (não truncate/nowrap) de propósito: texto com white-space:nowrap
                  conta como conteúdo "de linha inteira" pro cálculo de largura da tabela,
                  então uma observação longa forçava a coluna Nome (e a tabela toda) a
                  estourar a lateral. Com quebra de linha normal + clamp em 2 linhas, o
                  excesso cresce pra baixo em vez de empurrar a borda direita. */}
              {showDetails && b.additionalMessage && (
                <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-3)' }} title={b.additionalMessage}>{b.additionalMessage}</p>
              )}
              {/* Qtd Compras: link sutil abaixo do nome em vez de coluna própria */}
              {(b.detailsQuantity ?? 0) > 0 && (
                <button type="button" onClick={e => { e.stopPropagation(); setRelatedTarget(b) }}
                  className="inline-flex items-center gap-1 mt-0.5 truncate max-w-full"
                  style={{ color: 'var(--blue)', fontSize: 10 }}>
                  <ReceiptText size={9} /> {b.detailsQuantity} · {formatCurrency(b.detailsAmount ?? 0, b.country)}
                </button>
              )}
            </div>
          </Td>
        )
      case 'value':
        return (
          <Td key="value" style={NOWRAP_TIGHT}>
            <span className="font-mono text-sm" style={{ color: b.hasPay ? 'var(--green-400)' : 'var(--red)' }}>
              {formatCurrency(b.value, b.country)}
            </span>
          </Td>
        )
      case 'status':
        return (
          <Td key="status" style={NOWRAP_TIGHT}>
            <span title={b.hasPay ? 'Pago' : 'Pendente'} style={{ color: b.hasPay ? 'var(--green-400)' : 'var(--amber)', display: 'inline-flex' }}>
              {b.hasPay ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            </span>
          </Td>
        )
      case 'country':
        return (
          <Td key="country" className="text-xs" style={NOWRAP_TIGHT}>
            {b.country ? (
              <div className="flex items-center gap-1.5">
                {normalizeCountry(b.country) === 'Espanha' ? <FlagEspanha size={13} /> : <FlagBrasil size={13} />}
                <span style={{ color: 'var(--text-3)', fontSize: 11 }}>{normalizeCountry(b.country)}</span>
              </div>
            ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
          </Td>
        )
      case 'account': {
        const acc = b.account ? accountMap[b.account.trim().toLowerCase()] : undefined
        const hex = acc?.colors?.backgroundColorHexadecimal
        return (
          <Td key="account" style={{ ...NOWRAP_TIGHT, maxWidth: 160 }}>
            {b.account && hex ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium max-w-full"
                style={{ background: `${hex}22`, border: `1px solid ${hex}66`, color: 'var(--text-2)', fontSize: 10 }}
                title={b.account}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: hex, display: 'inline-block', flexShrink: 0 }} />
                <span className="truncate">{b.account}</span>
              </span>
            ) : (
              <span className="truncate block" style={{ color: 'var(--text-3)', fontSize: 10 }} title={b.account ?? undefined}>{b.account ?? '—'}</span>
            )}
          </Td>
        )
      }
      case 'category':
        return <Td key="category" className="text-xs truncate" style={{ ...NOWRAP_TIGHT, maxWidth: 180 }} title={b.category ?? undefined}>{b.category ?? '—'}</Td>
      case 'dueDate':
        return <Td key="dueDate" className="text-xs" style={NOWRAP_TIGHT}>{formatDate(b.dueDate)}</Td>
      case 'purchaseDate':
        return (
          <Td key="purchaseDate" className="text-xs" style={NOWRAP_TIGHT}>
            {b.purchaseDate ? (
              <span className="flex items-center gap-1.5">
                {formatDate(b.purchaseDate)}
                {(() => { const t = purchaseDateTag(b.purchaseDate); return t ? (
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ color: t.color, background: t.bg, border: `1px solid ${t.border}`, fontSize: 10 }}>
                    {t.label}
                  </span>
                ) : null })()}
              </span>
            ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
          </Td>
        )
      case 'payDay':
        return <Td key="payDay" className="text-xs" style={NOWRAP_TIGHT}>{formatDate(b.payDay)}</Td>
    }
  }

  const tableHeaders = [
    '',
    ...visibleColumns.map(k => ({ label: COLUMN_HEADER_DEFS[k].label, sortKey: COLUMN_HEADER_DEFS[k].sortKey })),
    'Ações',
  ]

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Cabeçalho fixo: header, summary e filtros permanecem visíveis no scroll.
          top responsivo: abaixo de lg ainda existe a barra mobile fixa (h-14) por cima,
          então o bloco precisa colar logo abaixo dela em vez de sob ela (top:0 sempre).
          -mt/pt cancelam o padding-top do <main> (AppLayout) só para este bloco: sem isso,
          o cabeçalho nasce ~32px abaixo do topo e "sobe" visivelmente nos primeiros pixels
          de scroll até grudar — com a margem negativa ele já nasce colado, sem esse deslize. */}
      <div
        ref={filtersRef}
        className="sm:sticky sm:top-14 lg:top-0 z-30 space-y-4 sm:pb-3 -mt-4 md:-mt-6 lg:-mt-8 pt-4 md:pt-6 lg:pt-8"
        style={{
          background: 'var(--bg-1)',
          marginLeft: -2, marginRight: -2, paddingLeft: 2, paddingRight: 2,
          boxShadow: '0 1px 0 var(--bg-1), 0 8px 16px -8px rgba(0,0,0,0.45)',
        }}
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
            <button className="btn-primary" onClick={() => { setCreateMode('quick'); setFullPrefill(undefined); setQuickPrefill(undefined); setCreateOpen(true) }}>
              <Plus size={16} /> Nova conta
            </button>
            <button
              type="button"
              title={filtersCollapsed ? 'Mostrar filtros' : 'Ocultar filtros'}
              className="btn-secondary flex items-center gap-1.5"
              onClick={toggleFiltersCollapsed}
            >
              {filtersCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
              Filtros
            </button>
          </div>
        }
      />

      {!filtersCollapsed && <>
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

      {/* Saldo disponível em Contas a Receber — aparece para contas configuradas em Configurações */}
      {saldoContas.some(s => s.trim().toLowerCase() === accountFilter.trim().toLowerCase()) && (accountSaldoLoading || accountSaldo !== null) && (
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'var(--green-dim)', border: '1px solid var(--green-border)' }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--green-400)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--green-400)' }}>
              Saldo disponível em Contas a Receber
            </span>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>· {accountFilter}</span>
          </div>
          <span className="ml-auto font-mono font-semibold text-sm" style={{ color: 'var(--green-400)' }}>
            {accountSaldoLoading
              ? <Spinner size={14} />
              : formatCurrency(accountSaldo ?? 0, 'Brasil')}
          </span>
        </div>
      )}

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
            {/* Status filter ao lado dos países — "Todos" também reseta o filtro de dia abaixo */}
            <div className="flex items-center gap-1 ml-1 pl-2" style={{ borderLeft: '1px solid var(--border-1)' }}>
              {(['Todos', 'Pendente', 'Pago'] as const).map(s => {
                const active = statusFilter === s
                const activeColor = s === 'Pago' ? 'var(--green-400)' : s === 'Pendente' ? 'var(--amber)' : 'var(--blue)'
                const activeBg = s === 'Pago' ? 'var(--green-dim)' : s === 'Pendente' ? 'rgba(245,158,11,0.1)' : 'var(--blue-dim)'
                return (
                  <button key={s} type="button" onClick={() => { setStatusFilter(s); if (s === 'Todos') setDayFilter('Todos') }}
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
            {/* Filtro por dia da compra (Hoje/Ontem/Anteontem) — o "Todos" acima também limpa este filtro */}
            <div className="flex items-center gap-1.5 ml-1 pl-2" style={{ borderLeft: '1px solid var(--border-1)' }}>
              {DAY_FILTER_OPTIONS.map(d => {
                const active = dayFilter === d
                const activeColor = d === 'Hoje' ? 'var(--amber)' : d === 'Ontem' ? 'var(--blue)' : 'var(--text-2)'
                const activeBg = d === 'Hoje' ? 'rgba(245,158,11,0.1)' : d === 'Ontem' ? 'var(--blue-dim)' : 'var(--bg-4)'
                const t = dayFilterTotals[d]
                const hasBoth = t.hasBrasil && t.hasEspanha
                return (
                  <button key={d} type="button" onClick={() => setDayFilter(active ? 'Todos' : d)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: active ? activeBg : 'var(--bg-3)',
                      color: active ? activeColor : 'var(--text-2)',
                      border: `1px solid ${active ? activeColor : 'var(--border-1)'}`,
                    }}>
                    {d}
                    {(t.hasBrasil || t.hasEspanha) && (
                      <span className="font-mono" style={{ opacity: active ? 1 : 0.7 }}>
                        {t.hasBrasil && (
                          <span className="inline-flex items-center gap-1">
                            <FlagBrasil size={11} />
                            {formatCurrency(t.brasil, 'Brasil')}
                          </span>
                        )}
                        {hasBoth && <span style={{ margin: '0 3px' }}>·</span>}
                        {t.hasEspanha && (
                          <span className="inline-flex items-center gap-1">
                            <FlagEspanha size={11} />
                            {formatCurrency(t.espanha, 'Espanha')}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Category filter */}
        <CategoryFilter
          categories={bills.map(b => b.category ?? '').filter(Boolean)}
          selectedPath={catPath}
          onPathChange={setCatPath}
        />

        {(search.trim() || catPath.length > 0) && (() => {
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
                <div key={acc} className="flex flex-col items-start gap-1">
                  <button
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
                  {active && saldoContas.some(s => s.trim().toLowerCase() === acc.trim().toLowerCase()) && (accountSaldoLoading || accountSaldo !== null) && (
                    <span
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full"
                      style={{ background: 'var(--green-dim)', color: 'var(--green-400)', border: '1px solid var(--green-border)' }}
                    >
                      {accountSaldoLoading
                        ? <><Spinner size={10} /> Saldo disponível atual...</>
                        : <>Saldo disponível atual:<span className="font-mono font-semibold">{formatCurrency(accountSaldo ?? 0, 'Brasil')}</span></>}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Search input — sempre o último filtro da barra */}
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
      </div>
      </>}
      </div>{/* fim do cabeçalho sticky */}

      {/* Barra da tabela — mostrar detalhes / seleção em massa / contagem, com linha sutil separando dos filtros acima */}
      <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--border-1)' }}>
        <button
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showDetails ? 'border-[var(--green-border)] text-[var(--green-400)] bg-[var(--green-dim)]' : 'border-[var(--border-1)] text-[var(--text-3)]'}`}
          onClick={() => setShowDetails((v) => !v)}
        >
          {showDetails ? <ChevronUp size={12} className="inline mr-1" /> : <ChevronDown size={12} className="inline mr-1" />}
          {showDetails ? 'Ocultar detalhes' : 'Mostrar detalhes'}
        </button>
        {filtered.length > 0 && (
          <button
            type="button"
            className="text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5"
            style={{
              borderColor: allSelected ? 'rgba(96,165,250,0.4)' : 'var(--border-1)',
              color: allSelected ? 'var(--blue)' : 'var(--text-3)',
              background: allSelected ? 'var(--blue-dim)' : 'transparent',
            }}
            onClick={toggleAll}
          >
            {allSelected ? <SquareCheck size={12} /> : <Square size={12} />}
            {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
        )}
        <span className="text-xs" style={{ color: 'var(--text-3)' }}>{filtered.length} registros</span>
      </div>

      {/* Ordenação — só no mobile (no desktop já dá pra clicar no cabeçalho da coluna).
          Deixa escolher Vencimento ou Data de Compra + mais recente/antigo primeiro,
          pra não precisar rolar a tela toda procurando um registro específico. */}
      <div className="flex items-center gap-2 sm:hidden">
        <select
          className="input text-xs py-1.5 flex-1"
          value={sortCol === 'dueDate' || sortCol === 'purchaseDate' ? sortCol : 'default'}
          onChange={e => {
            const col = e.target.value as ContasPagarSortCol
            setSortCol(col)
            if (col !== 'default') setSortDir('desc')
          }}
        >
          <option value="default">Ordenar por: Padrão</option>
          <option value="dueDate">Vencimento</option>
          <option value="purchaseDate">Data de Compra</option>
        </select>
        {(sortCol === 'dueDate' || sortCol === 'purchaseDate') && (
          <select
            className="input text-xs py-1.5 flex-1"
            value={sortDir}
            onChange={e => setSortDir(e.target.value as 'asc' | 'desc')}
          >
            <option value="desc">Mais recente primeiro</option>
            <option value="asc">Mais antigo primeiro</option>
          </select>
        )}
      </div>

      {/* Desktop: tabela | Mobile: cards */}

      {/* Cards mobile */}
      <div className="flex flex-col gap-3 sm:hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        ) : sortedFiltered.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--text-3)' }}>Nenhum registro encontrado.</div>
        ) : sortedFiltered.map((b) => {
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
                {b.category && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ color: 'var(--text-2)', background: 'var(--bg-4)', border: '1px solid var(--border-1)' }}>
                    {b.category}
                  </span>
                )}
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
                  <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
                    Compra {formatDate(b.purchaseDate)}
                    {(() => { const t = purchaseDateTag(b.purchaseDate); return t ? (
                      <span className="px-1.5 py-0.5 rounded-full font-medium"
                        style={{ color: t.color, background: t.bg, border: `1px solid ${t.border}`, fontSize: 10 }}>
                        {t.label}
                      </span>
                    ) : null })()}
                  </span>
                )}
                {b.hasPay && b.payDay && (
                  <span className="text-xs" style={{ color: 'var(--green-400)' }}>
                    Pago {formatDate(b.payDay)}
                  </span>
                )}
                {(b.detailsQuantity ?? 0) > 0 && (
                  <button type="button"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
                    style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(96,165,250,0.3)' }}
                    onClick={e => { e.stopPropagation(); setRelatedTarget(b) }}>
                    <ReceiptText size={11} /> {b.detailsQuantity} compra{(b.detailsQuantity ?? 0) > 1 ? 's' : ''} · {formatCurrency(b.detailsAmount ?? 0, b.country)}
                  </button>
                )}
              </div>

              {/* Linha 3: Ações — Editar antes de Histórico, pra facilitar a edição no mobile */}
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
                <button type="button" title="Editar"
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'var(--bg-4)', color: 'var(--text-2)' }}
                  onClick={e => { e.stopPropagation(); setEditTarget(b) }}>
                  <Pencil size={14} /> Editar
                </button>
                <button type="button" title="Histórico"
                  className="flex items-center justify-center p-1.5 rounded-lg transition-colors"
                  style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}
                  onClick={e => { e.stopPropagation(); setHistoryTarget(b) }}>
                  <History size={15} />
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
        headers={tableHeaders}
        loading={loading}
        empty={!loading && filtered.length === 0}
        headerOffset={headerOffset}
        sortCol={sortCol}
        sortDir={sortDir}
        onSort={(key) => handleSort(key as ContasPagarSortCol)}
      >
        {sortedFiltered.map((b) => {
          const isRowSelected = !!selected[b.id]
          const isExpanded = !!expandedRows[b.id]
          const bg = isRowSelected
            ? 'rgba(96,165,250,0.10)'
            : b.hasPay
              ? '#1b2e1d'
              : 'var(--bg-2)'
          // Identidade visual por conta — configurável em Configurações (4 modos):
          // "tint" tinge o fundo da linha inteira, "border" desenha uma faixa na borda
          // esquerda (só na 1ª célula, que é onde o navegador de fato pinta em tabelas
          // com border-collapse: separate), "dot" é uma bolinha ao lado do checkbox,
          // "none" desliga. Nenhum dos três compete com o verde de pago/azul de
          // selecionado, que continuam vindo de `bg`.
          const rowAcc = b.account ? accountMap[b.account.trim().toLowerCase()] : undefined
          const rowHex = rowAcc?.colors?.backgroundColorHexadecimal
          const tint = accountStyle === 'tint' && rowHex ? `${rowHex}12` : undefined
          const firstCellBoxShadow = accountStyle === 'border' && rowHex
            ? `inset 3px 0 0 ${rowHex}, inset 0 -1px 0 var(--border-1)`
            : undefined

          return (
            <Fragment key={b.id}>
              {/* Clicar na linha expande/colapsa os detalhes — selecionar continua só pelo checkbox */}
              <TRow bg={bg} tint={tint} onClick={() => toggleExpanded(b.id)} style={{ cursor: 'pointer', outline: isRowSelected ? '1px solid rgba(96,165,250,0.4)' : undefined }}>
                {/* Checkbox de seleção + chevron indicando expandir/colapsar — os únicos
                    elementos fixos ao lado de "Ações", já que Nome/Valor/Status agora
                    também são colunas configuráveis (podem sumir ou mudar de ordem). */}
                <Td style={firstCellBoxShadow ? { ...NOWRAP_TIGHT, boxShadow: firstCellBoxShadow } : NOWRAP_TIGHT}>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={e => { e.stopPropagation(); toggleOne(b.id) }} style={{ color: isRowSelected ? 'var(--blue)' : 'var(--text-3)' }}>
                      {isRowSelected ? <SquareCheck size={15} /> : <Square size={15} />}
                    </button>
                    {accountStyle === 'dot' && rowHex && (
                      <span title={b.account ?? undefined} style={{ width: 7, height: 7, borderRadius: '50%', background: rowHex, display: 'inline-block', flexShrink: 0 }} />
                    )}
                    <span style={{ color: 'var(--text-3)' }}>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </span>
                  </div>
                </Td>
                {visibleColumns.map(key => renderConfigurableColumnCell(key, b))}
                <Td style={NOWRAP_TIGHT}>
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
              {/* Linha expandida — detalhe completo, independente das colunas configuradas como visíveis */}
              {isExpanded && (
                <TRow bg={bg} tint={tint}>
                  <Td colSpan={tableHeaders.length}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs py-1">
                      <div><span style={{ color: 'var(--text-3)' }}>País: </span><span style={{ color: 'var(--text-2)' }}>{b.country ? normalizeCountry(b.country) : '—'}</span></div>
                      <div><span style={{ color: 'var(--text-3)' }}>Conta: </span><span style={{ color: 'var(--text-2)' }}>{b.account ?? '—'}</span></div>
                      <div><span style={{ color: 'var(--text-3)' }}>Categoria: </span><span style={{ color: 'var(--text-2)' }}>{b.category ?? '—'}</span></div>
                      <div><span style={{ color: 'var(--text-3)' }}>Vencimento: </span><span style={{ color: 'var(--text-2)' }}>{formatDate(b.dueDate)}</span></div>
                      <div><span style={{ color: 'var(--text-3)' }}>Dt. Compra: </span><span style={{ color: 'var(--text-2)' }}>{b.purchaseDate ? formatDate(b.purchaseDate) : '—'}</span></div>
                      <div><span style={{ color: 'var(--text-3)' }}>Pago em: </span><span style={{ color: 'var(--text-2)' }}>{b.hasPay ? formatDate(b.payDay) : '—'}</span></div>
                      <div><span style={{ color: 'var(--text-3)' }}>Status: </span><span style={{ color: b.hasPay ? 'var(--green-400)' : 'var(--amber)' }}>{b.hasPay ? 'Pago' : 'Pendente'}</span></div>
                      {(b.detailsQuantity ?? 0) > 0 && (
                        <div>
                          <span style={{ color: 'var(--text-3)' }}>Compras: </span>
                          <button type="button" onClick={e => { e.stopPropagation(); setRelatedTarget(b) }} style={{ color: 'var(--blue)' }}>
                            {b.detailsQuantity} · {formatCurrency(b.detailsAmount ?? 0, b.country)}
                          </button>
                        </div>
                      )}
                      {b.additionalMessage && (
                        <div className="col-span-full"><span style={{ color: 'var(--text-3)' }}>Observação: </span><span style={{ color: 'var(--text-2)' }}>{b.additionalMessage}</span></div>
                      )}
                    </div>
                  </Td>
                </TRow>
              )}
            </Fragment>
          )
        })}
      </Table>
      </div>

      {/* Modals */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={createMode === 'quick' ? 'Nova Conta a Pagar — Cadastro Rápido' : 'Nova Conta a Pagar — Formulário Completo'}
        size={createMode === 'quick' ? 'md' : 'lg'}
      >
        {createMode === 'quick' ? (
          <QuickBillToPayForm
            initialValues={quickPrefill}
            onSaved={load}
            onDone={() => setCreateOpen(false)}
            onSwitchFull={(prefill) => { setFullPrefill(prefill); setCreateMode('full') }}
            onCancel={() => setCreateOpen(false)}
          />
        ) : (
          <BillToPayForm
            prefill={fullPrefill}
            onSuccess={() => { setCreateOpen(false); load() }}
            onCancel={() => setCreateOpen(false)}
            onSwitchQuick={(values) => { setQuickPrefill(values); setCreateMode('quick') }}
          />
        )}
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
        {relatedTarget && (() => {
          const sortedDetails = [...(relatedTarget.details ?? [])].sort((a, b) => (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? ''))
          // Soma por conta — só faz sentido mostrar se os registros vierem de mais de uma conta
          const accountTotals = new Map<string, number>()
          for (const d of sortedDetails) {
            const key = d.account ?? '—'
            accountTotals.set(key, (accountTotals.get(key) ?? 0) + (d.value ?? 0))
          }
          return (
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
              {/* Soma por conta — só aparece quando os registros vêm de mais de uma conta */}
              {accountTotals.size > 1 && (
                <div className="flex flex-wrap items-center gap-2 w-full pt-2" style={{ borderTop: '1px solid var(--border-1)' }}>
                  {Array.from(accountTotals.entries()).map(([account, total]) => (
                    <span key={account} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                      style={{ background: 'var(--bg-4)', border: '1px solid var(--border-1)', color: 'var(--text-2)' }}>
                      {account}
                      <span className="font-mono font-semibold" style={{ color: 'var(--text-1)' }}>{formatCurrency(total, relatedTarget.country)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-1)' }}>
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse', background: 'var(--bg-1)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-1)' }}>
                    {['', 'Descrição', 'Valor', 'Data de Compra', 'Status'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-3)', background: 'var(--bg-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedDetails.map(d => {
                    const isExpanded = !!expandedRelatedIds[d.id]
                    return (
                      <Fragment key={d.id}>
                        {/* Clicar na linha expande/colapsa os detalhes completos — mesmo padrão da tabela de Contas a Pagar */}
                        <TRow onClick={() => toggleExpandedRelated(d.id)} style={{ cursor: 'pointer' }}>
                          <Td style={{ width: 24 }}>
                            <span style={{ color: 'var(--text-3)' }}>
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </span>
                          </Td>
                          <Td className="text-xs"><span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{d.name ?? '—'}</span></Td>
                          <Td><span className="font-mono text-xs font-semibold" style={{ color: 'var(--green-400)' }}>{formatCurrency(d.value, d.country)}</span></Td>
                          <Td className="text-xs">{formatDate(d.purchaseDate)}</Td>
                          <Td>
                            <span title={d.hasPay ? 'Pago' : 'Pendente'} style={{ color: d.hasPay ? 'var(--green-400)' : 'var(--amber)', display: 'inline-flex' }}>
                              {d.hasPay ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                            </span>
                          </Td>
                        </TRow>
                        {isExpanded && (
                          <TRow>
                            <Td colSpan={5}>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs py-1">
                                <div><span style={{ color: 'var(--text-3)' }}>Conta: </span><span style={{ color: 'var(--text-2)' }}>{d.account ?? '—'}</span></div>
                                <div><span style={{ color: 'var(--text-3)' }}>Categoria: </span><span style={{ color: 'var(--text-2)' }}>{d.category ?? '—'}</span></div>
                                <div><span style={{ color: 'var(--text-3)' }}>Status: </span><span style={{ color: d.hasPay ? 'var(--green-400)' : 'var(--amber)' }}>{d.hasPay ? 'Pago' : 'Pendente'}</span></div>
                                {d.additionalMessage && (
                                  <div className="col-span-full"><span style={{ color: 'var(--text-3)' }}>Observação: </span><span style={{ color: 'var(--text-2)' }}>{d.additionalMessage}</span></div>
                                )}
                              </div>
                            </Td>
                          </TRow>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )
        })()}
      </Modal>
    </div>
  )
}

export default function ContasAPagarPage() {
  return <AppLayout><ContasAPagarPageInner /></AppLayout>
}
