/**
 * Funções utilitárias para leitura das configurações da Carteira e do Gráfico
 * salvas no localStorage. Centralizadas aqui para evitar exports em page files
 * (que causam erros de build no Next.js).
 */

const WALLET_KEY = 'finance_wallet'
const PLR_CONFIG_KEY = 'finance_plr_config'
const STALE_ALERT_CONFIG_KEY = 'finance_stale_alert_config'

export const STALE_ALERT_DEFAULT_MENSAGEM =
  'Os dados desta tela podem estar desatualizados. Recomendamos atualizar a página para ver as informações mais recentes.'
export const STALE_ALERT_DEFAULT_INTERVALO_MINUTOS = 5

// ─── Wallet ───────────────────────────────────────────────────────────────────

export interface WalletBox {
  label: string
  value: string
  currency: string
}

export interface WalletGroup {
  id: string
  label: string
  collapsed: boolean
  boxes: WalletBox[]
}

function readWallet(): { groups: Array<{ label: string; boxes: Array<{ label: string; value: string; currency: string }> }> } {
  try {
    const raw = localStorage.getItem(WALLET_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { groups: [] }
}

export function loadContasBancariasTotal(): number {
  try {
    const wallet = readWallet()
    const nome = loadNomeGrupoContasBancarias().trim().toLowerCase()
    const group = wallet.groups.find(g => g.label.trim().toLowerCase() === nome)
    if (!group) return 0
    return group.boxes
      .filter(b => b.currency === 'Brasil')
      .reduce((s, b) => s + (parseFloat(b.value) || 0), 0)
  } catch { return 0 }
}

export function loadContasBancariasEspanha(nomeGrupo?: string): number {
  try {
    const wallet = readWallet()
    const nome = (nomeGrupo || loadNomeGrupoEspanha()).trim().toLowerCase()
    const group = wallet.groups.find(g => g.label.trim().toLowerCase() === nome)
    if (!group) return 0
    return group.boxes.reduce((s, b) => s + (parseFloat(b.value) || 0), 0)
  } catch { return 0 }
}

export function loadGruposNomes(): string[] {
  try {
    const wallet = readWallet()
    return wallet.groups.map(g => g.label ?? '')
  } catch { return [] }
}

// ─── PLR / Gráfico ────────────────────────────────────────────────────────────

function readPlrConfig(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PLR_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

export function loadPlrName(): string {
  return readPlrConfig().name ?? 'PLR - Ciclo 2 - 2025 de méritocracia (encerrando 2025)'
}

export function loadSaldoFinalYm(): string {
  return readPlrConfig().saldoFinalYm ?? ''
}

export function loadValeCategoria(): string {
  return readPlrConfig().valeCategoria ?? 'Vale Alimentação/Refeição'
}

export function loadNomeGrupoEspanha(): string {
  return readPlrConfig().nomeGrupoEspanha ?? 'Conta Bancária Espanha'
}

export function loadNomeGrupoInvestimento(): string {
  return readPlrConfig().nomeGrupoInvestimento ?? 'Investimentos'
}

export function loadNomeGrupoContasBancarias(): string {
  return readPlrConfig().nomeGrupoContasBancarias ?? 'Contas Bancárias'
}

export function loadInvestimentoAnosProjecao(): number {
  const v = parseInt(readPlrConfig().investimentoAnosProjecao)
  return !isNaN(v) && v > 0 ? v : 5
}

// ─── Marcos do gráfico (Evolução Financeira) ───────────────────────────────────

const CHART_MILESTONES_KEY = 'finance_chart_milestones'

export interface ChartMilestone {
  id: string
  /** Formato "Mês/Ano", ex: "Agosto/2026" — mesmo formato usado no eixo do gráfico. */
  yearMonth: string
  title: string
  description?: string
  /** Emoji opcional, ex: "🏠" — dá identidade visual sem precisar de sistema de categorias. */
  icon?: string
  createdAt: string
}

function readChartMilestones(): ChartMilestone[] {
  try {
    const raw = localStorage.getItem(CHART_MILESTONES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  return []
}

export function loadChartMilestones(): ChartMilestone[] {
  return readChartMilestones()
}

export function saveChartMilestonesLocal(milestones: ChartMilestone[]) {
  localStorage.setItem(CHART_MILESTONES_KEY, JSON.stringify(milestones))
}

/**
 * O backend às vezes acaba criando mais de um registro pra mesma walletKey
 * (cada tela que salva sem ter carregado o registro existente ainda cria um
 * novo em vez de editar) — resultado: `records.find(...)` pode pegar uma
 * cópia antiga/vazia e os marcos "somem". Essa função junta os marcos de
 * *todos* os registros duplicados (sem perder nenhum) e aponta qual registro
 * deve ser usado como alvo das próximas edições (o alterado mais recentemente).
 */
export function mergeChartMilestoneRecords<T extends { walletKey: string; walletValue: string; creationDate: string; lastChangeDate: string | null }>(
  records: T[],
): { merged: ChartMilestone[]; canonical: T | undefined } {
  const matches = records.filter(r => r.walletKey === CHART_MILESTONES_KEY)
  const recordTime = (r: T) => new Date(r.lastChangeDate || r.creationDate).getTime()

  // Processa do registro mais antigo pro mais novo — quando o mesmo marco (id)
  // aparece em mais de um duplicado com conteúdo diferente (ex: editado depois
  // que um duplicado já existia), a versão do registro mais recente sempre
  // vence por último no Map, em vez de depender da ordem que a API devolveu.
  const byId = new Map<string, ChartMilestone>()
  for (const rec of [...matches].sort((a, b) => recordTime(a) - recordTime(b))) {
    if (!rec.walletValue) continue
    try {
      const parsed = JSON.parse(rec.walletValue)
      if (Array.isArray(parsed)) {
        for (const m of parsed) if (m?.id) byId.set(m.id, m)
      }
    } catch {}
  }
  const canonical = matches.length > 0
    ? [...matches].sort((a, b) => recordTime(b) - recordTime(a))[0]
    : undefined
  return { merged: Array.from(byId.values()), canonical }
}

// ─── Marcos do gráfico — estilo visual (tamanho da fonte e cor) ────────────────

const CHART_MILESTONE_STYLE_KEY = 'finance_chart_milestone_style'

export interface ChartMilestoneStyle {
  fontSize: number
  color: string
}

export const CHART_MILESTONE_STYLE_DEFAULT: ChartMilestoneStyle = { fontSize: 9, color: '#a78bfa' }

export const CHART_MILESTONE_COLOR_OPTIONS = ['#a78bfa', '#60a5fa', '#4ade80', '#fbbf24', '#f87171', '#f5f5f5']

function readChartMilestoneStyle(): Partial<ChartMilestoneStyle> {
  try {
    const raw = localStorage.getItem(CHART_MILESTONE_STYLE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

export function loadChartMilestoneStyle(): ChartMilestoneStyle {
  const c = readChartMilestoneStyle()
  return {
    fontSize: typeof c.fontSize === 'number' && c.fontSize > 0 ? c.fontSize : CHART_MILESTONE_STYLE_DEFAULT.fontSize,
    color: c.color || CHART_MILESTONE_STYLE_DEFAULT.color,
  }
}

export function saveChartMilestoneStyleLocal(style: ChartMilestoneStyle) {
  localStorage.setItem(CHART_MILESTONE_STYLE_KEY, JSON.stringify(style))
}

// ─── Alerta de dados desatualizados ───────────────────────────────────────────

function readStaleAlertConfig(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STALE_ALERT_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

export function loadStaleAlertMensagem(): string {
  return readStaleAlertConfig().mensagem ?? STALE_ALERT_DEFAULT_MENSAGEM
}

export function loadStaleAlertIntervaloMinutos(): number {
  const v = parseInt(readStaleAlertConfig().intervaloMinutos)
  return !isNaN(v) && v > 0 ? v : STALE_ALERT_DEFAULT_INTERVALO_MINUTOS
}

export function loadStaleAlertAtivo(): boolean {
  return readStaleAlertConfig().ativo !== 'false'
}

// ─── Despesas por Mês/Ano — filtro padrão ─────────────────────────────────────

const DESPESA_MES_CONFIG_KEY = 'finance_despesa_mes_config'
export const DESPESA_MES_DEFAULT_CATEGORIA = 'Alimentação'

function readDespesaMesConfig(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DESPESA_MES_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

export function loadDespesaMesFiltrarAnoAtual(): boolean {
  return readDespesaMesConfig().filtrarAnoAtual !== 'false'
}

export function loadDespesaMesCategoriaPadrao(): string {
  return readDespesaMesConfig().categoriaPadrao ?? DESPESA_MES_DEFAULT_CATEGORIA
}

// ─── Contas a Pagar — ordenação padrão da tabela ───────────────────────────────

const CONTAS_PAGAR_SORT_CONFIG_KEY = 'finance_contas_pagar_sort_config'

export type ContasPagarSortCol =
  | 'default' | 'name' | 'country' | 'account' | 'category'
  | 'value' | 'dueDate' | 'purchaseDate' | 'payDay' | 'status'

export const CONTAS_PAGAR_SORT_COLUMNS: { value: ContasPagarSortCol; label: string }[] = [
  { value: 'default',      label: 'Padrão (pendente primeiro)' },
  { value: 'name',         label: 'Nome' },
  { value: 'country',      label: 'País' },
  { value: 'account',      label: 'Conta' },
  { value: 'category',     label: 'Categoria' },
  { value: 'value',        label: 'Valor' },
  { value: 'dueDate',      label: 'Vencimento' },
  { value: 'purchaseDate', label: 'Data de Compra' },
  { value: 'payDay',       label: 'Pago em' },
  { value: 'status',       label: 'Status' },
]

function readContasPagarSortConfig(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CONTAS_PAGAR_SORT_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

export function loadContasPagarSortCol(): ContasPagarSortCol {
  const v = readContasPagarSortConfig().sortCol
  return (CONTAS_PAGAR_SORT_COLUMNS.some(c => c.value === v) ? v : 'default') as ContasPagarSortCol
}

export function loadContasPagarSortDir(): 'asc' | 'desc' {
  return readContasPagarSortConfig().sortDir === 'desc' ? 'desc' : 'asc'
}

// ─── Contas a Receber — ordenação padrão da tabela ─────────────────────────────

const CONTAS_RECEBER_SORT_CONFIG_KEY = 'finance_contas_receber_sort_config'

export type ContasReceberSortCol =
  | 'default' | 'name' | 'country' | 'account' | 'category'
  | 'value' | 'saldo' | 'dueDate' | 'dateReceived' | 'status'

export const CONTAS_RECEBER_SORT_COLUMNS: { value: ContasReceberSortCol; label: string }[] = [
  { value: 'default',      label: 'Padrão (em aberto primeiro)' },
  { value: 'name',         label: 'Nome' },
  { value: 'country',      label: 'País' },
  { value: 'account',      label: 'Conta' },
  { value: 'category',     label: 'Categoria' },
  { value: 'value',        label: 'Valor' },
  { value: 'saldo',        label: 'Saldo' },
  { value: 'dueDate',      label: 'Vencimento' },
  { value: 'dateReceived', label: 'Recebido em' },
  { value: 'status',       label: 'Status' },
]

function readContasReceberSortConfig(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CONTAS_RECEBER_SORT_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

export function loadContasReceberSortCol(): ContasReceberSortCol {
  const v = readContasReceberSortConfig().sortCol
  return (CONTAS_RECEBER_SORT_COLUMNS.some(c => c.value === v) ? v : 'default') as ContasReceberSortCol
}

export function loadContasReceberSortDir(): 'asc' | 'desc' {
  return readContasReceberSortConfig().sortDir === 'desc' ? 'desc' : 'asc'
}

// ─── Contas a Pagar — colunas visíveis/ordem da tabela ─────────────────────────

const CONTAS_PAGAR_COLUMNS_CONFIG_KEY = 'finance_contas_pagar_columns_config'

/** Todas as colunas de dados da tabela — só o checkbox de seleção e "Ações" ficam
 *  de fora (são controles, não informação, e não fazem sentido esconder). */
export type ContasPagarColumnKey =
  | 'name' | 'country' | 'account' | 'category' | 'value' | 'dueDate' | 'purchaseDate' | 'payDay' | 'status'

export const CONTAS_PAGAR_COLUMNS: { value: ContasPagarColumnKey; label: string }[] = [
  { value: 'name',         label: 'Nome' },
  { value: 'country',      label: 'País' },
  { value: 'account',      label: 'Conta' },
  { value: 'category',     label: 'Categoria' },
  { value: 'value',        label: 'Valor' },
  { value: 'dueDate',      label: 'Vencimento' },
  { value: 'purchaseDate', label: 'Data de Compra' },
  { value: 'payDay',       label: 'Pago em' },
  { value: 'status',       label: 'Status' },
]

const CONTAS_PAGAR_COLUMNS_DEFAULT_ORDER: ContasPagarColumnKey[] = CONTAS_PAGAR_COLUMNS.map(c => c.value)

// País some por padrão (só some visível se o usuário decidir mostrar) — as demais
// colunas configuráveis começam visíveis.
const CONTAS_PAGAR_COLUMNS_DEFAULT_HIDDEN: ContasPagarColumnKey[] = ['country']

function readContasPagarColumnsConfig(): { order?: string[]; hidden?: string[] } {
  try {
    const raw = localStorage.getItem(CONTAS_PAGAR_COLUMNS_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

export function loadContasPagarColumnsOrder(): ContasPagarColumnKey[] {
  const saved = readContasPagarColumnsConfig().order
  if (!Array.isArray(saved)) return [...CONTAS_PAGAR_COLUMNS_DEFAULT_ORDER]
  const valid = saved.filter((v): v is ContasPagarColumnKey => CONTAS_PAGAR_COLUMNS_DEFAULT_ORDER.includes(v as ContasPagarColumnKey))
  // Colunas novas que ainda não existiam quando a config foi salva entram no fim.
  for (const v of CONTAS_PAGAR_COLUMNS_DEFAULT_ORDER) if (!valid.includes(v)) valid.push(v)
  return valid
}

export function loadContasPagarColumnsHidden(): Record<ContasPagarColumnKey, boolean> {
  const hiddenList = readContasPagarColumnsConfig().hidden
  const list = Array.isArray(hiddenList) ? hiddenList : CONTAS_PAGAR_COLUMNS_DEFAULT_HIDDEN
  const result = {} as Record<ContasPagarColumnKey, boolean>
  for (const col of CONTAS_PAGAR_COLUMNS_DEFAULT_ORDER) result[col] = list.includes(col)
  return result
}

// ─── Contas a Pagar — identidade visual por conta na tabela ────────────────────

const CONTAS_PAGAR_ACCOUNT_STYLE_CONFIG_KEY = 'finance_contas_pagar_account_style_config'

export type ContasPagarAccountStyle = 'none' | 'tint' | 'border' | 'dot'

export const CONTAS_PAGAR_ACCOUNT_STYLE_OPTIONS: { value: ContasPagarAccountStyle; label: string; description: string }[] = [
  { value: 'tint',   label: 'Fundo tingido',     description: 'Um leve tom da cor da conta por cima do fundo da linha inteira.' },
  { value: 'border', label: 'Borda esquerda',    description: 'Uma faixa colorida na borda esquerda de cada linha.' },
  { value: 'dot',    label: 'Bolinha no início', description: 'Uma bolinha colorida ao lado do checkbox de seleção.' },
  { value: 'none',   label: 'Nenhuma',           description: 'Sem destaque visual por conta na linha.' },
]

function readContasPagarAccountStyleConfig(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CONTAS_PAGAR_ACCOUNT_STYLE_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

export function loadContasPagarAccountStyle(): ContasPagarAccountStyle {
  const v = readContasPagarAccountStyleConfig().style
  return (CONTAS_PAGAR_ACCOUNT_STYLE_OPTIONS.some(o => o.value === v) ? v : 'tint') as ContasPagarAccountStyle
}

// ─── Cadastro Rápido — Contas a Pagar ──────────────────────────────────────────

const QUICK_BILL_CONFIG_KEY = 'finance_quick_bill_config'

export type QuickBillFieldKey =
  | 'account' | 'category' | 'country' | 'frequence' | 'registrationType' | 'additionalMessage'

export const QUICK_BILL_FIELDS: { value: QuickBillFieldKey; label: string }[] = [
  { value: 'account',           label: 'Conta' },
  { value: 'category',          label: 'Categoria' },
  { value: 'country',           label: 'País' },
  { value: 'frequence',         label: 'Frequência' },
  { value: 'registrationType',  label: 'Tipo de Registro' },
  { value: 'additionalMessage', label: 'Observação' },
]

// Por padrão só Conta e Categoria aparecem no cadastro rápido — os demais
// campos usam o valor padrão configurado sem perguntar ao usuário.
export const QUICK_BILL_ENABLED_DEFAULT: Record<QuickBillFieldKey, boolean> = {
  account: true,
  category: true,
  country: false,
  frequence: false,
  registrationType: false,
  additionalMessage: false,
}

export const QUICK_BILL_VALUE_DEFAULT: Record<QuickBillFieldKey, string> = {
  account: '',
  category: '',
  country: 'Brasil',
  frequence: 'Livre',
  registrationType: 'Compra Livre',
  additionalMessage: '',
}

function readQuickBillConfig(): Record<string, string> {
  try {
    const raw = localStorage.getItem(QUICK_BILL_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

export function loadQuickBillEnabledFields(): Record<QuickBillFieldKey, boolean> {
  const c = readQuickBillConfig()
  const result = { ...QUICK_BILL_ENABLED_DEFAULT }
  for (const f of QUICK_BILL_FIELDS) {
    const raw = c[`enabled_${f.value}`]
    if (raw === 'true' || raw === 'false') result[f.value] = raw === 'true'
  }
  return result
}

export function loadQuickBillDefaultValues(): Record<QuickBillFieldKey, string> {
  const c = readQuickBillConfig()
  const result = { ...QUICK_BILL_VALUE_DEFAULT }
  for (const f of QUICK_BILL_FIELDS) {
    const v = c[`default_${f.value}`]
    if (v !== undefined) result[f.value] = v
  }
  return result
}

export function loadInvestimentoTotal(): { brl: number; eur: number } {
  try {
    const wallet = readWallet()
    const nome = loadNomeGrupoInvestimento().trim().toLowerCase()
    const group = wallet.groups.find(g => g.label.trim().toLowerCase() === nome)
    if (!group) return { brl: 0, eur: 0 }
    const brl = group.boxes
      .filter(b => b.currency === 'Brasil')
      .reduce((s, b) => s + (parseFloat(b.value) || 0), 0)
    const eur = group.boxes
      .filter(b => b.currency === 'Espanha')
      .reduce((s, b) => s + (parseFloat(b.value) || 0), 0)
    return { brl, eur }
  } catch { return { brl: 0, eur: 0 } }
}

export function loadInvestimentoBoxes(): Array<{ label: string; value: number; currency: string }> {
  try {
    const wallet = readWallet()
    const nome = loadNomeGrupoInvestimento().trim().toLowerCase()
    const group = wallet.groups.find(g => g.label.trim().toLowerCase() === nome)
    if (!group) return []
    return group.boxes.map(b => ({
      label: b.label,
      value: parseFloat(b.value) || 0,
      currency: b.currency,
    }))
  } catch { return [] }
}

export function transferBetweenBoxes(
  fromGroupLabel: string,
  fromBoxLabel: string,
  toGroupLabel: string,
  toBoxLabel: string,
  amount: number,
): boolean {
  try {
    const raw = localStorage.getItem(WALLET_KEY)
    if (!raw) return false
    const wallet = JSON.parse(raw)

    const fromGroup = wallet.groups.find((g: any) => g.label.trim().toLowerCase() === fromGroupLabel.trim().toLowerCase())
    const toGroup = wallet.groups.find((g: any) => {
      const l = g.label.trim().toLowerCase()
      return l === toGroupLabel.trim().toLowerCase() || l === loadNomeGrupoContasBancarias().trim().toLowerCase()
    })
    if (!fromGroup || !toGroup) return false

    const fromBox = fromGroup.boxes.find((b: any) => b.label === fromBoxLabel)
    const toBox = toGroup.boxes.find((b: any) => b.label === toBoxLabel)
    if (!fromBox || !toBox) return false

    const fromVal = parseFloat(fromBox.value) || 0
    if (amount <= 0 || amount > fromVal) return false

    fromBox.value = (fromVal - amount).toFixed(2)
    toBox.value = ((parseFloat(toBox.value) || 0) + amount).toFixed(2)

    localStorage.setItem(WALLET_KEY, JSON.stringify(wallet))
    return true
  } catch { return false }
}

export function loadContasBancariasBoxes(): Array<{ label: string; value: number; currency: string }> {
  try {
    const wallet = readWallet()
    const nome = loadNomeGrupoContasBancarias().trim().toLowerCase()
    const group = wallet.groups.find(g => g.label.trim().toLowerCase() === nome)
    if (!group) return []
    return group.boxes.map(b => ({
      label: b.label,
      value: parseFloat(b.value) || 0,
      currency: b.currency,
    }))
  } catch { return [] }
}
