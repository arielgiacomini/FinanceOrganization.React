'use client'

import { useEffect, useState, useMemo } from 'react'
import { dashboardApi, walletApi } from '@/lib/api'
import type { MonthlyCashflowItem } from '@/lib/api'
import {
  loadPlrName,
  loadSaldoFinalYm,
  loadGraficoMesAnoInicial,
  loadValeCategoria,
  loadNomeGrupoEspanha,
  loadContasBancariasTotal,
  loadContasBancariasEspanha,
  loadGruposNomes,
  loadInvestimentoTotal,
  loadInvestimentoBoxes,
  loadContasBancariasBoxes,
  loadNomeGrupoInvestimento,
  transferBetweenBoxes,
} from '@/lib/wallet'
import { Modal, Spinner } from '@/components/ui'
import { FlagBrasil, FlagEspanha, FlagGlobe } from '@/components/ui/Flags'
import { ChevronDown, ChevronUp, AlertTriangle, ArrowRight } from 'lucide-react'
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface ChartPoint {
  yearMonth: string
  label: string
  despesaEspanha: number
  investAcumEspanha: number | null
  saldoBrasil: number
  despesaBrasil: number
}

type ChartSize = 'compact' | 'normal' | 'large'
const CHART_SIZE_KEY = 'finance_chart_size'
const FONT_SIZES: Record<ChartSize, { tick: number; axisLabel: number; dataLabel: number; refLabel: number }> = {
  compact: { tick: 10, axisLabel: 11, dataLabel: 10, refLabel: 11 },
  normal:  { tick: 12, axisLabel: 13, dataLabel: 11, refLabel: 12 },
  large:   { tick: 14, axisLabel: 15, dataLabel: 13, refLabel: 14 },
}

const MONTHS: Record<string, number> = {
  Janeiro: 0, Fevereiro: 1, Março: 2, Abril: 3, Maio: 4, Junho: 5,
  Julho: 6, Agosto: 7, Setembro: 8, Outubro: 9, Novembro: 10, Dezembro: 11,
}

function ymToNum(ym: string): number {
  const [m, y] = ym.split('/')
  return parseInt(y) * 12 + (MONTHS[m] ?? 0)
}

function shortLabel(ym: string): string {
  const [m, y] = ym.split('/')
  return `${m.slice(0, 3)}/${y.slice(2)}`
}

function formatEur(v: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
}
function formatBrl(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
}





function numToYm(n: number): string {
  const year = Math.floor(n / 12)
  const month = n % 12
  const monthName = Object.keys(MONTHS).find(k => MONTHS[k] === month)!
  return `${monthName}/${year}`
}

interface CalcSnapshot {
  plrName: string
  plrTotal: number
  contasBancariasTotal: number
  saldoFinal: number
  saldoFinalYm: string
  valeRefeicaoTotal: number
  contasBancariasEspanha: number
  nomeGrupoEspanha: string
  gruposEncontrados: string[]
  despesaEspanhaTotal: number
}

interface AdjustInfo {
  saldoNegativo: number
  investimentoBrl: number
  deficit: number
  mesAno: string
  grupoInvestimento: string
}

function AdjustModal({ open, onClose, adjustInfo, onTransferDone }: {
  open: boolean
  onClose: () => void
  adjustInfo: AdjustInfo | null
  onTransferDone: () => void
}) {
  const [investBoxes, setInvestBoxes] = useState<Array<{ label: string; value: number; currency: string }>>([])
  const [contasBoxes, setContasBoxes] = useState<Array<{ label: string; value: number; currency: string }>>([])
  const [selectedFrom, setSelectedFrom] = useState<string | null>(null)
  const [selectedTo, setSelectedTo] = useState<string | null>(null)
  const [transferValue, setTransferValue] = useState('')
  const [grupoNome, setGrupoNome] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (open) {
      const invest = loadInvestimentoBoxes().filter(b => b.currency === 'Brasil' && b.value > 0)
      const contas = loadContasBancariasBoxes().filter(b => b.currency === 'Brasil')
      setInvestBoxes(invest)
      setContasBoxes(contas)
      setGrupoNome(loadNomeGrupoInvestimento())
      setSelectedFrom(invest.length === 1 ? invest[0].label : null)
      setSelectedTo(contas.length === 1 ? contas[0].label : null)
      setTransferValue(adjustInfo ? adjustInfo.deficit.toFixed(2) : '')
      setDone(false)
    }
  }, [open, adjustInfo])

  if (!adjustInfo) return null

  const fromBox = investBoxes.find(b => b.label === selectedFrom)
  const toBox = contasBoxes.find(b => b.label === selectedTo)
  const valor = parseFloat(transferValue) || 0
  const maxTransfer = fromBox ? Math.min(fromBox.value, adjustInfo.deficit) : 0
  const saldoAposTransfer = adjustInfo.saldoNegativo + valor
  const fromSaldoApos = fromBox ? fromBox.value - valor : 0
  const toSaldoApos = toBox ? toBox.value + valor : 0
  const valorValido = valor > 0 && fromBox && valor <= fromBox.value && !!selectedTo

  async function handleConfirm() {
    if (!valorValido || !selectedFrom || !selectedTo) return
    setSaving(true)
    try {
      const ok = transferBetweenBoxes(grupoNome, selectedFrom, 'Contas Bancárias', selectedTo, valor)
      if (!ok) { setSaving(false); return }
      const raw = localStorage.getItem('finance_wallet')
      if (raw) {
        try {
          const res = await walletApi.search()
          const records = res.output?.data ?? []
          const existing = records.find((r: any) => r.walletKey === 'finance_wallet')
          if (existing) {
            await walletApi.edit(existing.id, 'finance_wallet', raw, existing.creationDate)
          } else {
            await walletApi.register('finance_wallet', raw)
          }
        } catch {}
      }
      setDone(true)
      onTransferDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Ajustar Saldo com Investimentos" size="lg">
      <div className="space-y-5">

        {done && (
          <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(22,163,94,0.12)', border: '1px solid rgba(22,163,94,0.25)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--green-400)' }}>
              Transferência realizada com sucesso!
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>
              {formatBrl(valor)} movido de &quot;{selectedFrom}&quot; para &quot;{selectedTo}&quot;. O gráfico será atualizado.
            </p>
          </div>
        )}

        {/* Resumo da situação */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>Situação atual — {adjustInfo.mesAno}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Saldo Brasil</p>
              <p className="font-mono font-semibold text-sm" style={{ color: 'var(--red)' }}>
                {formatBrl(adjustInfo.saldoNegativo)}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Déficit</p>
              <p className="font-mono font-semibold text-sm" style={{ color: 'var(--amber)' }}>
                {formatBrl(adjustInfo.deficit)}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Investimentos disponíveis</p>
              <p className="font-mono font-semibold text-sm" style={{ color: 'var(--green-400)' }}>
                {formatBrl(adjustInfo.investimentoBrl)}
              </p>
            </div>
          </div>
        </div>

        {/* Origem — Investimentos */}
        {!done && <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
            De onde resgatar — {grupoNome}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {investBoxes.map(box => {
              const active = selectedFrom === box.label
              return (
                <button
                  key={box.label}
                  type="button"
                  onClick={() => setSelectedFrom(box.label)}
                  className="rounded-lg px-4 py-3 text-left transition-all"
                  style={{
                    background: active ? 'rgba(22,163,74,0.12)' : 'var(--bg-3)',
                    border: `1px solid ${active ? 'var(--green-400)' : 'var(--border-1)'}`,
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{box.label}</p>
                  <p className="font-mono font-semibold text-sm mt-1" style={{ color: 'var(--green-400)' }}>
                    {formatBrl(box.value)}
                  </p>
                </button>
              )
            })}
            {investBoxes.length === 0 && (
              <p className="text-xs py-3" style={{ color: 'var(--text-3)' }}>
                Nenhuma caixinha com saldo positivo em R$ encontrada.
              </p>
            )}
          </div>
        </div>}

        {/* Destino — Contas Bancárias */}
        {!done && <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
            Para onde direcionar — Contas Bancárias
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {contasBoxes.map(box => {
              const active = selectedTo === box.label
              return (
                <button
                  key={box.label}
                  type="button"
                  onClick={() => setSelectedTo(box.label)}
                  className="rounded-lg px-4 py-3 text-left transition-all"
                  style={{
                    background: active ? 'rgba(96,165,250,0.10)' : 'var(--bg-3)',
                    border: `1px solid ${active ? 'var(--blue)' : 'var(--border-1)'}`,
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{box.label}</p>
                  <p className="font-mono font-semibold text-sm mt-1" style={{ color: 'var(--blue)' }}>
                    {formatBrl(box.value)}
                  </p>
                </button>
              )
            })}
            {contasBoxes.length === 0 && (
              <p className="text-xs py-3" style={{ color: 'var(--text-3)' }}>
                Nenhuma conta bancária em R$ encontrada.
              </p>
            )}
          </div>
        </div>}

        {/* Valor da transferência */}
        {selectedFrom && selectedTo && !done && (
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-3)' }}>
              Valor a transferir
            </p>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <input
                  type="number"
                  className="input w-full font-mono"
                  value={transferValue}
                  onChange={e => setTransferValue(e.target.value)}
                  min={0}
                  max={fromBox?.value ?? 0}
                  step={0.01}
                  placeholder="0,00"
                />
              </div>
              <button
                type="button"
                onClick={() => setTransferValue(maxTransfer.toFixed(2))}
                className="px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: 'var(--bg-4)', color: 'var(--text-2)', border: '1px solid var(--border-1)' }}
              >
                Cobrir déficit ({formatBrl(maxTransfer)})
              </button>
            </div>

            {/* Simulação */}
            {valor > 0 && (
              <div className="space-y-2 pt-3" style={{ borderTop: '1px solid var(--border-1)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
                  Simulação do resultado
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>{selectedFrom}</p>
                    <p className="font-mono text-xs" style={{ color: 'var(--text-3)' }}>{formatBrl(fromBox?.value ?? 0)}</p>
                    <p className="font-mono font-semibold text-sm" style={{ color: fromSaldoApos >= 0 ? 'var(--green-400)' : 'var(--red)' }}>
                      {formatBrl(fromSaldoApos)}
                    </p>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--amber)' }}>
                      <ArrowRight size={16} />
                      <span className="font-mono font-semibold">{formatBrl(valor)}</span>
                    </div>
                  </div>
                  <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>{selectedTo}</p>
                    <p className="font-mono text-xs" style={{ color: 'var(--text-3)' }}>{formatBrl(toBox?.value ?? 0)}</p>
                    <p className="font-mono font-semibold text-sm" style={{ color: 'var(--blue)' }}>
                      {formatBrl(toSaldoApos)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-lg px-3 py-2" style={{
                  background: saldoAposTransfer >= 0 ? 'rgba(22,163,74,0.08)' : 'var(--red-dim)',
                  border: `1px solid ${saldoAposTransfer >= 0 ? 'rgba(22,163,74,0.25)' : 'rgba(248,113,113,0.25)'}`,
                }}>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                    Saldo Brasil após ajuste ({adjustInfo.mesAno})
                  </p>
                  <p className="font-mono font-bold text-base" style={{ color: saldoAposTransfer >= 0 ? 'var(--green-400)' : 'var(--red)' }}>
                    {formatBrl(saldoAposTransfer)}
                  </p>
                </div>

                {!valorValido && valor > 0 && fromBox && valor > fromBox.value && (
                  <p className="text-xs mt-1" style={{ color: 'var(--red)' }}>
                    O valor excede o saldo disponível em &quot;{selectedFrom}&quot;.
                  </p>
                )}
              </div>
            )}

            {/* Botão confirmar */}
            {valorValido && (
              <div className="mt-4 flex items-center justify-end gap-3">
                <button type="button" onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-medium"
                  style={{ color: 'var(--text-2)', background: 'var(--bg-4)', border: '1px solid var(--border-1)' }}>
                  Cancelar
                </button>
                <button type="button" onClick={handleConfirm} disabled={saving}
                  className="px-5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
                  style={{ background: 'var(--green-400)', color: '#fff', opacity: saving ? 0.6 : 1 }}>
                  {saving ? <Spinner size={14} /> : null}
                  {saving ? 'Salvando...' : 'Confirmar transferência'}
                </button>
              </div>
            )}
          </div>
        )}

        {done && (
          <div className="flex justify-end">
            <button type="button" onClick={onClose}
              className="px-5 py-2 rounded-lg text-xs font-semibold"
              style={{ background: 'var(--green-400)', color: '#fff' }}>
              Fechar
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

interface FinanceChartProps {
  monthsRange?: number
}

export function FinanceChart({ monthsRange = 12 }: FinanceChartProps) {
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [calcBase, setCalcBase] = useState<CalcSnapshot | null>(null)
  const [byMonthState, setByMonthState] = useState<Record<string, MonthlyCashflowItem[]>>({})
  const [calcOpen, setCalcOpen] = useState(false)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [configYm, setConfigYm] = useState<string>('')
  const [filterMode, setFilterMode] = useState<'next6' | 'last12' | 'custom'>('next6')
  const [selectedYearMonths, setSelectedYearMonths] = useState<Set<string>>(new Set())

  // Anos efetivamente selecionados pelo usuário no filtro Personalizar
  const customYearsForFetch = useMemo(() => {
    if (filterMode !== 'custom') return [] as number[]
    const years = new Set<number>()
    selectedYearMonths.forEach(key => years.add(parseInt(key.split('-')[0])))
    return Array.from(years).sort((a, b) => a - b)
  }, [filterMode, selectedYearMonths])

  // Só dispara nova busca quando o range relevante à API muda: entrar/sair de
  // "últimos 12 meses", ou mudar os anos selecionados em "Personalizar".
  // "Próximos 6 meses" sempre usa o mesmo range de busca padrão.
  const fetchRangeMode = filterMode === 'last12'
    ? 'last12'
    : filterMode === 'custom'
      ? `custom:${customYearsForFetch.join(',')}`
      : 'default'

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        // Sincroniza dados da Carteira do backend para o localStorage
        // (garante que o gráfico tenha os valores mesmo no primeiro acesso,
        // sem precisar abrir a tela Carteira antes)
        try {
          const res = await walletApi.search()
          const records = res.output?.data ?? []
          for (const rec of records) {
            if (rec.walletKey === 'finance_wallet' && rec.walletValue) {
              localStorage.setItem('finance_wallet', rec.walletValue)
            }
            if (rec.walletKey === 'finance_plr_config' && rec.walletValue) {
              localStorage.setItem('finance_plr_config', rec.walletValue)
            }
          }
        } catch { /* usa o que já houver no localStorage */ }

        if (cancelled) return

        const plrName = loadPlrName()
        const valeCategoria = loadValeCategoria()
        const saldoFinalYm = loadSaldoFinalYm()
        if (!cancelled) setConfigYm(saldoFinalYm)

        const now = new Date()
        const curYm = now.getFullYear() * 12 + now.getMonth()

        // Ponto de início (âncora do acumulado Espanha): saldoFinalYm configurado ou 3 meses atrás
        const sfYmStr = saldoFinalYm
        const startYm = sfYmStr ? ymToNum(sfYmStr) : curYm - 3
        // Range: até 5 anos a frente do ponto de início
        const endYm = startYm + 12 * 5

        // Anos/meses a buscar na API — depende do filtro de período ativo:
        // "Últimos 12 meses" pede exatamente os anos que compõem essa janela;
        // "Personalizar" pede exatamente os anos que o usuário selecionou em tela;
        // "Próximos 6 meses" (ou Personalizar sem seleção ainda) usa o range de projeção padrão.
        const yearsSet = new Set<number>()
        const monthsSet = new Set<number>()
        const monthNumsSet = new Set<number>()

        if (filterMode === 'last12') {
          const last12Start = curYm - 11
          for (let n = last12Start; n <= curYm; n++) {
            yearsSet.add(Math.floor(n / 12))
            monthsSet.add((n % 12) + 1) // backend usa 1-12
            monthNumsSet.add(n)
          }
        } else if (filterMode === 'custom' && customYearsForFetch.length > 0) {
          for (const y of customYearsForFetch) {
            yearsSet.add(y)
            for (let m = 0; m < 12; m++) {
              monthsSet.add(m + 1) // backend usa 1-12
              monthNumsSet.add(y * 12 + m)
            }
          }
        } else {
          for (let n = startYm; n <= endYm; n++) {
            yearsSet.add(Math.floor(n / 12))
            monthsSet.add((n % 12) + 1) // backend usa 1-12
            monthNumsSet.add(n)
          }
        }
        const years = Array.from(yearsSet).sort((a, b) => a - b)
        const months = Array.from(monthsSet).sort((a, b) => a - b)

        // ── Chamada única ao endpoint agregado ───────────────────────────────
        const cashflow = await dashboardApi.monthlyCashflow(years, months, valeCategoria, plrName)
          .catch(() => [] as MonthlyCashflowItem[])

        if (cancelled) return

        // ── Meses do gráfico ──────────────────────────────────────────────────
        // União do range buscado com os meses que a API efetivamente retornou.
        // Nunca inventamos meses que a API não trouxe — se não veio dado, o mês
        // simplesmente não aparece no gráfico.
        for (const item of cashflow) monthNumsSet.add(ymToNum(item.monthYear))
        const monthList = Array.from(monthNumsSet).sort((a, b) => a - b).map(numToYm)

        const isEs = (c?: string | null) => (c ?? '').trim().toLowerCase() === 'espanha'

        // ── PLR total = soma de todos os "type 4" do range (manipulatedValue) ─
        const plrTotal = cashflow
          .filter(i => i.type?.startsWith('4'))
          .reduce((s, i) => s + (i.manipulatedValue ?? 0), 0)

        // ── SALDO FINAL = Total Contas Bancárias − PLR total ─────────────────
        const contasBancariasTotal = loadContasBancariasTotal()
        const saldoFinal = contasBancariasTotal - plrTotal

        const nomeGrupoEspanha = loadNomeGrupoEspanha()
        const contasBancariasEspanha = loadContasBancariasEspanha()
        const gruposEncontrados = loadGruposNomes()

        // Agrupa os itens do cashflow por monthYear para cálculo rápido
        const byMonth: Record<string, MonthlyCashflowItem[]> = {}
        for (const item of cashflow) {
          if (!byMonth[item.monthYear]) byMonth[item.monthYear] = []
          byMonth[item.monthYear].push(item)
        }

        // Acumulado Espanha: começa com o saldo total do grupo e diminui conforme despesas
        let despesaEspanhaAcum = 0

        const points: ChartPoint[] = monthList.map((ym) => {
          const items = byMonth[ym] ?? []
          const nYm = ymToNum(ym)

          // Despesa Espanha exibida no gráfico = type 1 + Espanha, pagas ou não
          const despesaEspanhaExibicao = items
            .filter(i => i.type?.startsWith('1') && isEs(i.taxCountry))
            .reduce((s, i) => s + (i.value ?? 0), 0)

          // Despesa Espanha pendente — usada apenas na projeção do acumulado
          // (não pode contar despesas já pagas, senão duplicaria o desconto do saldo atual)
          const despesaEspanhaPendente = items
            .filter(i => i.type?.startsWith('1') && isEs(i.taxCountry) && i.hasPay === false)
            .reduce((s, i) => s + (i.value ?? 0), 0)

          // Acumulado só é calculado a partir da âncora (startYm) — meses anteriores
          // são histórico puro e não têm base conhecida para projetar o acumulado
          let investAcumEspanha: number | null = null
          if (nYm >= startYm) {
            despesaEspanhaAcum += despesaEspanhaPendente
            investAcumEspanha = contasBancariasEspanha - despesaEspanhaAcum
          }

          // Despesa Brasil exibida no gráfico = type 1 + Brasil, pagas ou não
          const despesaBRExibicao = items
            .filter(i => i.type?.startsWith('1') && !isEs(i.taxCountry))
            .reduce((s, i) => s + (i.value ?? 0), 0)

          // Despesa Brasil pendente — usada apenas no cálculo do Saldo Brasil (não altera)
          const despesaBRPendente = items
            .filter(i => i.type?.startsWith('1') && !isEs(i.taxCountry) && i.hasPay === false)
            .reduce((s, i) => s + (i.value ?? 0), 0)

          // Receita Brasil = type 2 + Brasil (manipulatedValue, todos hasReceivable)
          const receitaBR = items
            .filter(i => i.type?.startsWith('2') && !isEs(i.taxCountry))
            .reduce((s, i) => s + (i.manipulatedValue ?? 0), 0)

          const isConfiguredMonth = saldoFinalYm ? ym === saldoFinalYm : false

          // Vale Refeição = type 3 (manipulatedValue), só no mês configurado
          const valeRefeicaoBR = isConfiguredMonth
            ? items
                .filter(i => i.type?.startsWith('3') && !isEs(i.taxCountry))
                .reduce((s, i) => s + (i.manipulatedValue ?? 0), 0)
            : 0

          const saldoBrasil = (receitaBR + (isConfiguredMonth ? saldoFinal : 0) + valeRefeicaoBR) - despesaBRPendente

          const r2 = (n: number) => Math.round(n * 100) / 100
          return {
            yearMonth: ym,
            label: shortLabel(ym),
            despesaEspanha:    r2(despesaEspanhaExibicao),
            investAcumEspanha: investAcumEspanha === null ? null : r2(investAcumEspanha),
            saldoBrasil:       r2(saldoBrasil),
            despesaBrasil:     r2(despesaBRExibicao),
          }
        })

        // ── Snapshot para o painel de memória de cálculo ────────────────────
        const configuredItems = byMonth[saldoFinalYm] ?? []
        const valeRefeicaoTotal = configuredItems
          .filter(i => i.type?.startsWith('3') && !isEs(i.taxCountry))
          .reduce((s, i) => s + (i.manipulatedValue ?? 0), 0)

        const despesaEspanhaTotal = cashflow
          .filter(i => i.type?.startsWith('1') && isEs(i.taxCountry) && i.hasPay === false)
          .reduce((s, i) => s + (i.value ?? 0), 0)

        setCalcBase({ plrName, plrTotal, contasBancariasTotal, saldoFinal, saldoFinalYm, valeRefeicaoTotal, contasBancariasEspanha, nomeGrupoEspanha, gruposEncontrados, despesaEspanhaTotal })
        setByMonthState(byMonth)
        setData(points)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [monthsRange, reloadKey, fetchRangeMode])

  const [hiddenLines, setHiddenLines] = useState<Record<string, boolean>>({})
  const [countryFilter, setCountryFilter] = useState<'todos' | 'brasil' | 'espanha'>('todos')

  // Preferência de tamanho de fonte do gráfico — persiste em localStorage
  const [chartSize, setChartSize] = useState<ChartSize>('normal')
  useEffect(() => {
    const stored = localStorage.getItem(CHART_SIZE_KEY) as ChartSize | null
    if (stored && stored in FONT_SIZES) setChartSize(stored)
  }, [])

  // Filtra pontos conforme slicers — DEVE ficar antes de qualquer early return (regra de hooks)
  const filteredData = useMemo(() => {
    if (filterMode === 'next6') {
      const baseNum = configYm
        ? ymToNum(configYm)
        : new Date().getFullYear() * 12 + new Date().getMonth()
      return data.filter(d => {
        const n = ymToNum(d.yearMonth)
        return n >= baseNum && n < baseNum + 6
      })
    }
    if (filterMode === 'last12') {
      const nowNum = new Date().getFullYear() * 12 + new Date().getMonth()
      return data.filter(d => {
        const n = ymToNum(d.yearMonth)
        return n <= nowNum && n > nowNum - 12
      })
    }
    if (selectedYearMonths.size === 0) return data
    return data.filter(d => {
      const [mName, yStr] = d.yearMonth.split('/')
      const key = `${parseInt(yStr)}-${MONTHS[mName] ?? 0}`
      return selectedYearMonths.has(key)
    })
  }, [data, filterMode, selectedYearMonths, configYm])

  // Recalcula a memória de cálculo respeitando os filtros ativos
  const calc = useMemo(() => {
    if (!calcBase) return null
    const isEs = (c?: string | null) => (c ?? '').trim().toLowerCase() === 'espanha'
    const filteredYms = new Set(filteredData.map(d => d.yearMonth))

    const despesaEspanhaTotal = Object.entries(byMonthState)
      .filter(([ym]) => filteredYms.has(ym))
      .flatMap(([, items]) => items)
      .filter(i => i.type?.startsWith('1') && isEs(i.taxCountry) && i.hasPay === false)
      .reduce((s, i) => s + (i.value ?? 0), 0)

    const plrTotal = Object.entries(byMonthState)
      .filter(([ym]) => filteredYms.has(ym))
      .flatMap(([, items]) => items)
      .filter(i => i.type?.startsWith('4'))
      .reduce((s, i) => s + (i.manipulatedValue ?? 0), 0)

    const saldoFinal = calcBase.contasBancariasTotal - plrTotal

    const saldoFinalYmVisible = calcBase.saldoFinalYm && filteredYms.has(calcBase.saldoFinalYm)
    const valeRefeicaoTotal = saldoFinalYmVisible
      ? (byMonthState[calcBase.saldoFinalYm!] ?? [])
          .filter(i => i.type?.startsWith('3') && !isEs(i.taxCountry))
          .reduce((s, i) => s + (i.manipulatedValue ?? 0), 0)
      : 0

    return {
      ...calcBase,
      despesaEspanhaTotal,
      plrTotal,
      saldoFinal,
      valeRefeicaoTotal,
      saldoFinalYm: saldoFinalYmVisible ? calcBase.saldoFinalYm : null,
    }
  }, [calcBase, filteredData, byMonthState])

  const adjustInfo = useMemo(() => {
    if (!calcBase?.saldoFinalYm) return null
    const configuredPoint = data.find(d => d.yearMonth === calcBase.saldoFinalYm)
    const roundedSaldo = Math.round((configuredPoint?.saldoBrasil ?? 0) * 100) / 100
    if (!configuredPoint || roundedSaldo >= 0) return null
    const investimento = loadInvestimentoTotal()
    if (investimento.brl <= 0) return null
    return {
      saldoNegativo: configuredPoint.saldoBrasil,
      investimentoBrl: investimento.brl,
      deficit: Math.abs(configuredPoint.saldoBrasil),
      mesAno: calcBase.saldoFinalYm,
      grupoInvestimento: loadNomeGrupoInvestimento(),
    }
  }, [calcBase, data])

  // Detecta o primeiro mês em que o Acumulado Invest. Espanha fica negativo
  // Conta meses a partir do pico (último ponto antes de começar a descer)
  const espanhaZeroPin = useMemo(() => {
    const negIdx = filteredData.findIndex(d => (d.investAcumEspanha ?? 0) < 0)
    if (negIdx < 0) return null
    const negPoint = filteredData[negIdx]

    // Encontra o pico: último ponto estável antes de começar a descer
    let peakIdx = 0
    for (let i = 1; i < filteredData.length; i++) {
      if ((filteredData[i].investAcumEspanha ?? 0) >= (filteredData[peakIdx].investAcumEspanha ?? 0)) {
        peakIdx = i
      } else {
        break
      }
    }

    const peakNum = ymToNum(filteredData[peakIdx].yearMonth)
    const negNum = ymToNum(negPoint.yearMonth)
    const meses = Math.max(0, negNum - peakNum)

    return { label: negPoint.label, meses }
  }, [filteredData])

  // Anos ativos no modo custom (derivado de selectedYearMonths) — hook antes de early return
  const activeYears = useMemo(() => {
    const years = new Set<number>()
    selectedYearMonths.forEach(key => {
      const y = parseInt(key.split('-')[0])
      years.add(y)
    })
    return years
  }, [selectedYearMonths])

  if (loading) {
    return (
      <div className="card flex items-center justify-center" style={{ minHeight: 400 }}>
        <Spinner size={32} />
      </div>
    )
  }

  const fs = FONT_SIZES[chartSize]

  function handleSizeChange(size: ChartSize) {
    setChartSize(size)
    localStorage.setItem(CHART_SIZE_KEY, size)
  }

  // Anos disponíveis no filtro Personalizar: do "Mês/Ano inicial do gráfico"
  // configurado (Configurações → Gráfico) até o ano atual + 5. Independente
  // da âncora do Saldo Final, que segue controlando o acumulado/projeção.
  const currentYearForList = new Date().getFullYear()
  const graficoInicioYm = loadGraficoMesAnoInicial()
  const parsedStartYear = graficoInicioYm ? parseInt(graficoInicioYm.split('/')[1]) : NaN
  const startYearForList = !isNaN(parsedStartYear) ? parsedStartYear : 2018
  const availableYears = Array.from(
    { length: currentYearForList + 5 - startYearForList + 1 },
    (_, i) => startYearForList + i,
  )
  const MONTH_NAMES = Object.keys(MONTHS)

  function toggleYear(y: number) {
    setFilterMode('custom')
    setSelectedYearMonths(prev => {
      const next = new Set(prev)
      const hasAny = Array.from({ length: 12 }, (_, m) => `${y}-${m}`).some(k => next.has(k))
      if (hasAny) {
        for (let m = 0; m < 12; m++) next.delete(`${y}-${m}`)
        if (next.size === 0) return prev
      } else {
        for (let m = 0; m < 12; m++) next.add(`${y}-${m}`)
      }
      return next
    })
  }

  function toggleMonthForYear(y: number, m: number) {
    setSelectedYearMonths(prev => {
      const next = new Set(prev)
      const key = `${y}-${m}`
      next.has(key) ? next.delete(key) : next.add(key)
      if (next.size === 0) return prev
      return next
    })
  }

  function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload || !payload.length) return null
    return (
      <div
        className="rounded-lg px-3 py-2 text-xs"
        style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
      >
        <p className="font-semibold mb-1.5" style={{ color: 'var(--text-1)' }}>{label}</p>
        {payload.filter((p: any) => p.value != null).map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 my-0.5">
            <span style={{ width: 8, height: 8, background: p.color, borderRadius: '50%', display: 'inline-block' }} />
            <span style={{ color: 'var(--text-3)' }}>{p.name}:</span>
            <span className="font-mono font-medium" style={{ color: 'var(--text-1)' }}>
              {p.dataKey === 'saldoBrasil' || p.dataKey === 'despesaBrasil' ? formatBrl(p.value) : formatEur(p.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  function toggleLine(key: string) {
    setHiddenLines(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function CustomLabel({ x, y, value, dataKey }: any) {
    const rounded = Math.round((value ?? 0) * 100) / 100
    if (rounded === 0) return null
    const isBrl = dataKey === 'saldoBrasil' || dataKey === 'despesaBrasil'
    const label = isBrl ? formatBrl(value) : formatEur(value)
    return (
      <text x={x} y={Number(y) - 6} textAnchor="middle" fontSize={fs.dataLabel} fill={rounded < 0 ? '#dc2626' : '#9ca3af'}>
        {label}
      </text>
    )
  }

  const LINES = [
    { key: 'despesaEspanha',    name: 'Despesa Espanha (€)',          color: '#dc2626', country: 'espanha' as const },
    { key: 'investAcumEspanha', name: 'Acumulado Invest. Espanha (€)', color: '#3b82f6', country: 'espanha' as const },
    { key: 'saldoBrasil',       name: 'Saldo Brasil (R$)',             color: '#16a34a', country: 'brasil' as const },
    { key: 'despesaBrasil',     name: 'Despesa Brasil (R$)',           color: '#f87171', country: 'brasil' as const },
  ]

  // Visibilidade efetiva de uma linha: combina o toggle manual da legenda
  // com o filtro de país (Todos / Brasil / Espanha)
  function isLineVisible(key: string) {
    if (hiddenLines[key]) return false
    if (countryFilter === 'todos') return true
    const line = LINES.find(l => l.key === key)
    return line?.country === countryFilter
  }

  function CustomLegend() {
    return (
      <div className="flex flex-wrap justify-center gap-3 pt-3">
        {LINES.map(({ key, name, color, country }) => {
          const hidden = !isLineVisible(key)
          const disabledByCountry = countryFilter !== 'todos' && country !== countryFilter
          return (
            <button
              key={key}
              type="button"
              disabled={disabledByCountry}
              onClick={() => toggleLine(key)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-opacity"
              style={{
                background: 'var(--bg-3)',
                border: `1px solid ${hidden ? 'var(--border-1)' : color}`,
                opacity: hidden ? 0.4 : 1,
                cursor: disabledByCountry ? 'default' : 'pointer',
                color: 'var(--text-2)',
              }}
            >
              <span style={{ width: 10, height: 2, background: hidden ? 'var(--text-3)' : color, display: 'inline-block', borderRadius: 1 }} />
              {name}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="card p-4 lg:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
            Evolução Financeira
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            Despesa Espanha (€), Investimento Acumulado (€), Saldo Brasil (R$) e Despesa Brasil (R$) — {filterMode === 'next6' ? 'próximos 6 meses' : filterMode === 'last12' ? 'últimos 12 meses' : 'período personalizado'}
          </p>
        </div>
        {/* Toggle de tamanho de fonte */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {(['compact', 'normal', 'large'] as ChartSize[]).map((size, i) => {
            const active = chartSize === size
            const labelFontSize = [10, 13, 16][i]
            const titles = ['Compacto', 'Normal', 'Ampliado']
            return (
              <button
                key={size}
                type="button"
                title={titles[i]}
                onClick={() => handleSizeChange(size)}
                className="flex items-center justify-center w-8 h-7 rounded-md transition-all"
                style={{
                  background: active ? 'var(--bg-5)' : 'transparent',
                  border: `1px solid ${active ? 'var(--border-2)' : 'var(--border-1)'}`,
                  color: active ? 'var(--text-1)' : 'var(--text-3)',
                  fontSize: labelFontSize,
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                A
              </button>
            )
          })}
        </div>
      </div>

      {/* Filtro de país — restringe as linhas exibidas ao país selecionado */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {([
          { key: 'todos', label: 'Todos', Icon: FlagGlobe },
          { key: 'brasil', label: 'Brasil', Icon: FlagBrasil },
          { key: 'espanha', label: 'Espanha', Icon: FlagEspanha },
        ] as const).map(({ key, label, Icon }) => {
          const active = countryFilter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setCountryFilter(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: active ? 'var(--green-400)' : 'var(--bg-3)',
                color: active ? '#fff' : 'var(--text-2)',
                border: `1px solid ${active ? 'var(--green-400)' : 'var(--border-1)'}`,
              }}>
              <Icon size={14} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Alerta de saldo negativo com opção de ajuste via investimentos */}
      {adjustInfo && (
        <div
          className="mb-4 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
          style={{ background: 'var(--amber-dim)', border: '1px solid rgba(251,191,36,0.25)' }}
        >
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <AlertTriangle size={16} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
            <div className="text-xs" style={{ color: 'var(--text-2)' }}>
              <p className="font-semibold" style={{ color: 'var(--amber)' }}>
                Saldo Brasil negativo em {adjustInfo.mesAno}
              </p>
              <p className="mt-0.5">
                Déficit de <span className="font-mono font-semibold" style={{ color: 'var(--red)' }}>{formatBrl(adjustInfo.deficit)}</span>
                {' '}— você possui <span className="font-mono font-semibold" style={{ color: 'var(--green-400)' }}>{formatBrl(adjustInfo.investimentoBrl)}</span> em &quot;{adjustInfo.grupoInvestimento}&quot;.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAdjustModalOpen(true)}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
            style={{ background: 'var(--amber)', color: '#000', border: 'none' }}
          >
            Ajustar saldo
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Modal de ajuste */}
      <AdjustModal
        open={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        adjustInfo={adjustInfo}
        onTransferDone={() => setReloadKey(k => k + 1)}
      />

      <div style={{ width: '100%', height: 360 }}>
        <ResponsiveContainer>
          <ComposedChart data={filteredData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" opacity={0.4} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: fs.tick, fill: 'var(--text-3)' }}
              stroke="var(--border-2)"
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: fs.tick, fill: 'var(--text-3)' }}
              stroke="var(--border-2)"
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
              label={{ value: '€', angle: 0, position: 'insideTopLeft', fill: 'var(--text-3)', fontSize: fs.axisLabel }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: fs.tick, fill: 'var(--text-3)' }}
              stroke="var(--border-2)"
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
              label={{ value: 'R$', angle: 0, position: 'insideTopRight', fill: 'var(--text-3)', fontSize: fs.axisLabel }}
            />
            <Tooltip content={<CustomTooltip />} />

            {isLineVisible('despesaEspanha') && (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="despesaEspanha"
                name="Despesa Espanha (€)"
                fill="#dc2626"
                fillOpacity={0.4}
                stroke="#dc2626"
                strokeWidth={1.5}
                label={<CustomLabel dataKey="despesaEspanha" />}
              />
            )}
            {isLineVisible('investAcumEspanha') && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="investAcumEspanha"
                name="Acumulado Invest. Espanha (€)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                label={<CustomLabel dataKey="investAcumEspanha" />}
              />
            )}
            {isLineVisible('saldoBrasil') && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="saldoBrasil"
                name="Saldo Brasil (R$)"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                label={<CustomLabel dataKey="saldoBrasil" />}
              />
            )}
            {isLineVisible('despesaBrasil') && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="despesaBrasil"
                name="Despesa Brasil (R$)"
                stroke="#f87171"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                label={<CustomLabel dataKey="despesaBrasil" />}
              />
            )}

            {/* Linha vertical + label no topo: primeiro mês negativo Espanha */}
            {espanhaZeroPin && isLineVisible('investAcumEspanha') && (
              <ReferenceLine
                yAxisId="left"
                x={espanhaZeroPin.label}
                stroke="#dc2626"
                strokeDasharray="6 3"
                strokeOpacity={0.5}
                label={{
                  value: `${espanhaZeroPin.meses} ${espanhaZeroPin.meses === 1 ? 'mês' : 'meses'}`,
                  position: 'insideTopRight',
                  fill: '#dc2626',
                  fontSize: fs.refLabel,
                  fontWeight: 700,
                  offset: 4,
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Slicers — Filtros de período */}
      <div className="mt-4 space-y-3">
        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          <button type="button"
            onClick={() => setFilterMode('last12')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: filterMode === 'last12' ? 'var(--green-400)' : 'var(--bg-3)',
              color: filterMode === 'last12' ? '#fff' : 'var(--text-2)',
              border: `1px solid ${filterMode === 'last12' ? 'var(--green-400)' : 'var(--border-1)'}`,
            }}>
            Últimos 12 meses
          </button>
          <button type="button"
            onClick={() => setFilterMode('next6')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: filterMode === 'next6' ? 'var(--green-400)' : 'var(--bg-3)',
              color: filterMode === 'next6' ? '#fff' : 'var(--text-2)',
              border: `1px solid ${filterMode === 'next6' ? 'var(--green-400)' : 'var(--border-1)'}`,
            }}>
            Próximos 6 meses
          </button>
          <button type="button"
            onClick={() => {
              if (filterMode !== 'custom') {
                setFilterMode('custom')
                if (selectedYearMonths.size === 0) {
                  const now = new Date()
                  const initial = new Set<string>()
                  for (let m = 0; m < 12; m++) {
                    initial.add(`${now.getFullYear() - 1}-${m}`)
                    initial.add(`${now.getFullYear()}-${m}`)
                    initial.add(`${now.getFullYear() + 1}-${m}`)
                  }
                  setSelectedYearMonths(initial)
                }
              }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: filterMode === 'custom' ? 'var(--green-400)' : 'var(--bg-3)',
              color: filterMode === 'custom' ? '#fff' : 'var(--text-2)',
              border: `1px solid ${filterMode === 'custom' ? 'var(--green-400)' : 'var(--border-1)'}`,
            }}>
            Personalizar
          </button>
        </div>

        {/* Anos + Meses por ano */}
        {filterMode === 'custom' && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {availableYears.map(y => {
                const active = activeYears.has(y)
                return (
                  <button key={y} type="button" onClick={() => toggleYear(y)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: active ? 'var(--green-400)' : 'var(--bg-3)',
                      color: active ? '#fff' : 'var(--text-2)',
                      border: `1px solid ${active ? 'var(--green-400)' : 'var(--border-1)'}`,
                    }}>
                    {y}
                  </button>
                )
              })}
            </div>

            {/* Meses por ano selecionado */}
            {availableYears.filter(y => activeYears.has(y)).map(y => (
              <div key={y}>
                <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-3)', fontSize: 10 }}>
                  {y}
                </p>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: 12 }, (_, m) => {
                    const key = `${y}-${m}`
                    const active = selectedYearMonths.has(key)
                    const name = MONTH_NAMES[m]?.slice(0, 3) ?? ''
                    return (
                      <button key={key} type="button" onClick={() => toggleMonthForYear(y, m)}
                        className="px-2 py-1 rounded-md text-xs font-medium transition-all"
                        style={{
                          background: active ? 'var(--green-400)' : 'var(--bg-3)',
                          color: active ? '#fff' : 'var(--text-2)',
                          border: `1px solid ${active ? 'var(--green-400)' : 'var(--border-1)'}`,
                        }}>
                        {name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CustomLegend />
      {/* Memória de cálculo — colapsável, fechado por padrão */}
      {calc && (
        <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-1)' }}>
          {/* Header clicável */}
          <button
            type="button"
            onClick={() => setCalcOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-[var(--bg-4)]"
            style={{ background: 'var(--bg-3)', borderBottom: calcOpen ? '1px solid var(--border-1)' : 'none' }}
          >
            <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
              🧮 Memória de Cálculo
            </span>
            {calcOpen
              ? <ChevronUp size={14} style={{ color: 'var(--text-3)' }} />
              : <ChevronDown size={14} style={{ color: 'var(--text-3)' }} />}
          </button>

          {calcOpen && (
            <div className="p-4 space-y-4 text-xs" style={{ background: 'var(--bg-2)' }}>

              {/* Espanha */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
                  🇪🇸 Acumulado Espanha (€)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Saldo inicial</p>
                    <p className="font-mono font-semibold" style={{ color: calc.contasBancariasEspanha === 0 ? 'var(--red)' : 'var(--text-1)' }}>
                      {calc.contasBancariasEspanha === 0 ? '⚠ não encontrado' : formatEur(calc.contasBancariasEspanha)}
                    </p>
                  </div>
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Total despesas</p>
                    <p className="font-mono font-semibold" style={{ color: 'var(--red)' }}>
                      − {formatEur(calc.despesaEspanhaTotal)}
                    </p>
                  </div>
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid rgba(59,130,246,0.3)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Saldo projetado</p>
                    <p className="font-mono font-bold" style={{ color: Math.round((calc.contasBancariasEspanha - calc.despesaEspanhaTotal) * 100) / 100 >= 0 ? '#3b82f6' : 'var(--red)' }}>
                      = {formatEur(calc.contasBancariasEspanha - calc.despesaEspanhaTotal)}
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-1)' }} />

              {/* Brasil */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
                  🇧🇷 Saldo Brasil (R$)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Contas bancárias BR</p>
                    <p className="font-mono font-semibold" style={{ color: 'var(--text-1)' }}>
                      {formatBrl(calc.contasBancariasTotal)}
                    </p>
                  </div>
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>
                      PLR{calc.plrName ? ` — ${calc.plrName}` : ''}
                    </p>
                    <p className="font-mono font-semibold" style={{ color: 'var(--red)' }}>
                      − {formatBrl(calc.plrTotal)}
                    </p>
                  </div>
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid rgba(22,163,74,0.3)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>
                      Saldo Final{calc.saldoFinalYm ? ` (${calc.saldoFinalYm})` : ''}
                    </p>
                    <p className="font-mono font-bold" style={{ color: Math.round(calc.saldoFinal * 100) / 100 >= 0 ? 'var(--green-400)' : 'var(--red)' }}>
                      = {formatBrl(calc.saldoFinal)}
                    </p>
                  </div>
                </div>
                {calc.saldoFinalYm && calc.valeRefeicaoTotal > 0 && (
                  <div className="mt-2 rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>
                      Vale Alimentação/Refeição ({calc.saldoFinalYm})
                    </p>
                    <p className="font-mono font-semibold" style={{ color: 'var(--green-400)' }}>
                      + {formatBrl(calc.valeRefeicaoTotal)}
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  )
}
