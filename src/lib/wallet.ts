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
    const group = wallet.groups.find(g =>
      g.label.trim().toLowerCase() === 'contas bancárias' ||
      g.label.trim().toLowerCase() === 'contas bancarias'
    )
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

export function loadGraficoMesAnoInicial(): string {
  return readPlrConfig().graficoMesAnoInicial ?? ''
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

export function loadInvestimentoAnosProjecao(): number {
  const v = parseInt(readPlrConfig().investimentoAnosProjecao)
  return !isNaN(v) && v > 0 ? v : 5
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
      return l === toGroupLabel.trim().toLowerCase() || l === 'contas bancárias' || l === 'contas bancarias'
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
    const group = wallet.groups.find(g =>
      g.label.trim().toLowerCase() === 'contas bancárias' ||
      g.label.trim().toLowerCase() === 'contas bancarias'
    )
    if (!group) return []
    return group.boxes.map(b => ({
      label: b.label,
      value: parseFloat(b.value) || 0,
      currency: b.currency,
    }))
  } catch { return [] }
}
