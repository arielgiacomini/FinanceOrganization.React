/**
 * Funções utilitárias para leitura das configurações da Carteira e do Gráfico
 * salvas no localStorage. Centralizadas aqui para evitar exports em page files
 * (que causam erros de build no Next.js).
 */

const WALLET_KEY = 'finance_wallet'
const PLR_CONFIG_KEY = 'finance_plr_config'

// ─── Wallet ───────────────────────────────────────────────────────────────────

function readWallet(): { groups: Array<{ label: string; boxes: Array<{ value: string; currency: string }> }> } {
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
