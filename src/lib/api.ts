import type {
  BillToPay,
  CashReceivable,
  PayOutput,
  SearchBillToPayViewModel,
  CreateBillToPayViewModel,
  EditBillToPayViewModel,
  PayBillToPayViewModel,
  DeleteBillToPayViewModel,
  DisableBillToPayViewModel,
  SearchCashReceivableViewModel,
  CreateCashReceivableViewModel,
  EditCashReceivableViewModel,
  DeleteCashReceivableViewModel,
  SearchCategoryViewModel,
  SearchMonthlyAverageAnalysisViewModel,
  SearchBillToPayOutput,
  SearchCashReceivableOutput,
  SearchAccountOutput,
  SearchMonthlyAverageAnalysisOutput,
  RecordsAwaitingOutput,
} from '@/types'
import { getSession, clearSession } from '@/lib/auth'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://api.financeiro.arielgiacomini.com.br'

/**
 * Erro de conectividade (fetch nem chegou a ter resposta — sem internet, DNS,
 * conexão recusada). Distinto de erros de validação/negócio (que têm resposta
 * do servidor) — usado pra decidir com segurança quando algo pode ir pra fila
 * offline em vez de ser mostrado como falha real ao usuário.
 */
export class NetworkError extends Error {}

function normalizeResponse(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(normalizeResponse)
  if (obj && typeof obj === 'object') {
    const normalized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      normalized[key.charAt(0).toLowerCase() + key.slice(1)] = normalizeResponse(value)
    }
    return normalized
  }
  return obj
}

async function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    const isCors = err instanceof TypeError
    throw new NetworkError(
      isCors
        ? `Erro de CORS: a API bloqueou ${method} ${path}. Adicione AllowAnyMethod() no CORS da API C#.`
        : `Erro de rede: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  handleAuthStatus(res)

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Erro ${res.status} em ${method} ${path}: ${text}`)
  }

  const text = await res.text()
  if (!text) return {} as T
  const parsed = JSON.parse(text)
  return normalizeResponse(parsed) as T
}

/** Sessão inválida ou expirada — ver tratamento do 401 em `handleAuthStatus()`. */
export class AuthSessionError extends Error {}

/** Trial encerrado / sem assinatura ativa (HTTP 402, TrialGateFilter da API). */
export class TrialExpiredError extends Error {}

// 401: sessão inválida/expirada no servidor (mesmo que o relógio local ainda
// ache que não). 402: TrialGateFilter — trial acabou ou não tem assinatura
// ativa. Os dois cortam o fluxo normal e mandam pra fora da área logada, em
// vez de aparecer como "erro" numa tela qualquer — compartilhado entre
// `request()` e os dois endpoints que fazem fetch manual (searchByRegistration).
function handleAuthStatus(res: Response): void {
  if (res.status === 401) {
    clearSession()
    if (typeof window !== 'undefined') window.location.href = '/login/'
    throw new AuthSessionError('Sessão expirada. Faça login novamente.')
  }
  if (res.status === 402) {
    if (typeof window !== 'undefined') window.location.href = '/assinatura/'
    throw new TrialExpiredError('Período de teste encerrado.')
  }
}

async function requestAuth<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const session = getSession()
  if (!session) {
    if (typeof window !== 'undefined') window.location.href = '/login/'
    throw new AuthSessionError('Nenhuma sessão ativa.')
  }
  const result = await request<T>(path, method, body, {
    Authorization: `Bearer ${session.token}`,
    ...extraHeaders,
  })

  // Verifica output.status da API (0 = Success) — usado nos endpoints de Account
  const out = (result as Record<string, unknown>)?.output as Record<string, unknown> | undefined
  if (out && typeof out.status === 'number' && out.status !== 0) {
    const validations = out.validations as Record<string, string> | undefined
    const errors      = out.errors      as Record<string, string> | undefined
    const msgs = [
      ...(validations ? Object.values(validations) : []),
      ...(errors      ? Object.values(errors)      : []),
    ]
    throw new Error(msgs.length ? msgs.join(' ') : String(out.message ?? 'Erro desconhecido.'))
  }

  return result
}

/** Chave de lançamento rápido (header X-Quick-Capture-Key) inválida ou revogada. */
export class QuickCaptureKeyError extends Error {}

// Variante de requestAuth para a chave de lançamento rápido — usada só nas 3 rotas
// liberadas no backend para o header X-Quick-Capture-Key (bills-to-pay/register,
// account/search-all, category/search). Não usa handleAuthStatus/getSession de
// propósito: essa tela não tem sessão nenhuma, então 401 aqui significa "chave
// inválida/revogada", não "sessão expirada" — não deve redirecionar pro /login/.
async function requestQuickCapture<T>(
  path: string,
  method: 'GET' | 'POST',
  quickCaptureKey: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Quick-Capture-Key': quickCaptureKey,
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    const isCors = err instanceof TypeError
    throw new NetworkError(
      isCors
        ? `Erro de CORS: a API bloqueou ${method} ${path}.`
        : `Erro de rede: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (res.status === 401 || res.status === 403) {
    throw new QuickCaptureKeyError('Chave de lançamento rápido inválida ou revogada.')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Erro ${res.status} em ${method} ${path}: ${text}`)
  }

  const text = await res.text()
  const result = (text ? normalizeResponse(JSON.parse(text)) : {}) as T

  const out = (result as Record<string, unknown>)?.output as Record<string, unknown> | undefined
  if (out && typeof out.status === 'number' && out.status !== 0) {
    const validations = out.validations as Record<string, string> | undefined
    const errors      = out.errors      as Record<string, string> | undefined
    const msgs = [
      ...(validations ? Object.values(validations) : []),
      ...(errors      ? Object.values(errors)      : []),
    ]
    throw new Error(msgs.length ? msgs.join(' ') : String(out.message ?? 'Erro desconhecido.'))
  }

  return result
}

// ─── Bills to Pay ─────────────────────────────────────────────────────────────

export const billsToPayApi = {
  search: (vm: SearchBillToPayViewModel) =>
    requestAuth<SearchBillToPayOutput>('/v1/bills-to-pay/search', 'POST', vm),

  // Serializa manualmente para garantir Int32 + inclui Bearer token
  searchByRegistration: async (id: number) => {
    const intId = Math.trunc(Number(id))
    if (isNaN(intId) || intId <= 0) throw new Error(`ID inválido para histórico: "${id}" (tipo: ${typeof id})`)
    const session = getSession()
    if (!session) {
      if (typeof window !== 'undefined') window.location.href = '/login/'
      throw new AuthSessionError('Nenhuma sessão ativa.')
    }
    const body = `{"idBillToPayRegistrations":[${intId}],"showDetails":true}`
    const res = await fetch(`${BASE_URL}/v1/bills-to-pay/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body,
    })
    handleAuthStatus(res)
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`Erro ${res.status} em POST /v1/bills-to-pay/search: ${text}`)
    }
    const text = await res.text()
    return (text ? normalizeResponse(JSON.parse(text)) : {}) as SearchBillToPayOutput
  },

  create: (vm: CreateBillToPayViewModel) =>
    requestAuth<{ output?: unknown }>('/v1/bills-to-pay/register', 'POST', vm),

  // Mesma rota de create(), mas autenticada via chave de lançamento rápido
  // (header X-Quick-Capture-Key) em vez de sessão logada — ver src/app/lancamento-rapido.
  createQuickCapture: (vm: CreateBillToPayViewModel, quickCaptureKey: string) =>
    requestQuickCapture<{ output?: unknown }>('/v1/bills-to-pay/register', 'POST', quickCaptureKey, vm),

  edit: (vm: EditBillToPayViewModel) =>
    requestAuth<{ output?: unknown }>('/v1/bills-to-pay/edit', 'PUT', vm),

  editBasket: (vms: EditBillToPayViewModel[]) =>
    requestAuth<{ output?: unknown }>('/v1/bills-to-pay/edit-basket', 'PUT', vms),

  pay: (vm: PayBillToPayViewModel) =>
    requestAuth<PayOutput>('/v1/bills-to-pay/pay', 'PATCH', vm),

  delete: (vm: DeleteBillToPayViewModel) =>
    requestAuth<{ output?: unknown }>('/v1/bills-to-pay/delete', 'DELETE', vm),

  disable: (vm: DisableBillToPayViewModel) =>
    requestAuth<{ output?: unknown }>('/v1/bills-to-pay/disable-registration', 'DELETE', vm),

  monthlyAverage: (vm: SearchMonthlyAverageAnalysisViewModel) =>
    requestAuth<SearchMonthlyAverageAnalysisOutput>('/v1/bills-to-pay/SearchMonthlyAverageAnalysis', 'POST', vm),

  recordsAwaiting: () =>
    requestAuth<RecordsAwaitingOutput>('/v1/bills-to-pay/records-awaiting-complete-registration', 'GET'),
}

// ─── Cash Receivable ──────────────────────────────────────────────────────────

export const cashReceivableApi = {
  search: (vm: SearchCashReceivableViewModel) =>
    requestAuth<SearchCashReceivableOutput>('/v1/cash-receivable/search', 'POST', vm),

  create: (vm: CreateCashReceivableViewModel) =>
    requestAuth<{ output?: unknown }>('/v1/cash-receivable/register', 'POST', vm),

  edit: (vm: EditCashReceivableViewModel) =>
    requestAuth<{ output?: unknown }>('/v1/cash-receivable/edit', 'PUT', vm),

  editBasket: (vms: EditCashReceivableViewModel[]) =>
    requestAuth<{ output?: unknown }>('/v1/cash-receivable/edit-basket', 'PUT', vms),

  delete: (vm: DeleteCashReceivableViewModel) =>
    requestAuth<{ output?: unknown }>('/v1/cash-receivable/delete', 'DELETE', vm),

  disable: (id: number) =>
    requestAuth<{ output?: unknown }>('/v1/cash-receivable/disable-registration', 'DELETE', { idCashReceivableRegistration: id }),

  searchByRegistration: async (id: number) => {
    const intId = Math.trunc(Number(id))
    const session = getSession()
    if (!session) {
      if (typeof window !== 'undefined') window.location.href = '/login/'
      throw new AuthSessionError('Nenhuma sessão ativa.')
    }
    const body = `{"idCashReceivableRegistrations":[${intId}],"showDetails":true}`
    const res = await fetch(`${BASE_URL}/v1/cash-receivable/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body,
    })
    handleAuthStatus(res)
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`Erro ${res.status}: ${text}`)
    }
    const text = await res.text()
    return (text ? normalizeResponse(JSON.parse(text)) : {}) as SearchCashReceivableOutput
  },

  receive: (vm: { id: string; dateReceived: string }) =>
    requestAuth<{ output?: { message?: string; status?: number } }>('/v1/cash-receivable/receive', 'PATCH', vm),
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export interface AccountColorsViewModel {
  backgroundColorHexadecimal: string
  fonteColorHexadecimal: string
}

export interface RegisterAccountViewModel {
  name: string
  dueDate?: number
  closingDay?: number
  considerPaid?: boolean
  accountAgency?: string
  accountNumber?: string
  accountDigit?: string
  // Sempre enviar (mesmo string vazia) em POST /v1/account/register — a API
  // responde 500 quando esse campo vem ausente/null nesse endpoint, mesmo
  // para conta bancária (que nunca usa cartão). PUT /v1/account/edit não tem
  // esse problema, mas manter sempre presente por segurança/consistência.
  cardNumber?: string
  commissionPercentage?: number
  enable: boolean
  isCreditCard?: boolean
  colors?: AccountColorsViewModel
}

export interface EditAccountViewModel extends RegisterAccountViewModel {
  id: number
}

export const accountsApi = {
  searchAll: () =>
    requestAuth<SearchAccountOutput>('/v1/account/search-all', 'GET'),

  // Mesma rota de searchAll(), autenticada via chave de lançamento rápido — só
  // pra popular o dropdown de contas na tela de lançamento rápido sem sessão logada.
  searchAllQuickCapture: (quickCaptureKey: string) =>
    requestQuickCapture<SearchAccountOutput>('/v1/account/search-all', 'GET', quickCaptureKey),

  register: (vm: RegisterAccountViewModel) =>
    requestAuth<unknown>('/v1/account/register', 'POST', vm),

  edit: (vm: EditAccountViewModel) =>
    requestAuth<unknown>('/v1/account/edit', 'PUT', vm),

  delete: (id: number) =>
    requestAuth<unknown>('/v1/account/delete', 'DELETE', { id }),
}

// ─── Date ────────────────────────────────────────────────────────────────────

export interface SearchDateMonthYearOutput {
  monthYears?: string[]
  MonthYears?: string[]
}

export const dateApi = {
  // startYear via header, endYear via query string
  monthYearAll: (startYear = 2020, endYear = 2030) =>
    requestAuth<SearchDateMonthYearOutput>(
      `/v1/date/month-year-all?endYear=${endYear}`,
      'GET',
      undefined,
      { startYear: String(startYear) },
    ),
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DailyExpenseRecord {
  type: string
  account: string
  category: string
  date: string
  day: number
  month: string
  dayWeek: string
  weekend: boolean
  holiday: boolean
  taxCountry: string
  monthYear: string
  quantity: number
  value: number
  manipulatedValue: number
  hasPay: boolean
  /** Opcional: nem toda versão da API ainda traz esse campo nesse endpoint. */
  registrationType?: string
}

export interface MonthlyCashflowItem {
  type: string
  date: string
  taxCountry: string
  monthYear: string
  quantity: number
  value: number
  manipulatedValue: number
  hasPay: boolean | null
  hasReceivable: boolean | null
}

export const dashboardApi = {
  monthlyCashflow: (years: number[], months: number[], foodVoucher: string, loanNextMonths: string) => {
    const params = new URLSearchParams({
      years: years.join(','),
      months: months.join(','),
      foodVoucher,
      loanNextMonths,
    })
    return requestAuth<MonthlyCashflowItem[]>(
      `/v1/dashboard/monthly-cashflow-billtopay-cashreceivable?${params.toString()}`,
      'GET',
    )
  },

  dailyExpenseByCategoryAccount: (months: number[], years: number[] | null, category?: string) => {
    const params = new URLSearchParams({ months: months.join(',') })
    if (years !== null) params.set('years', years.join(','))
    if (category) params.set('category', category)
    return requestAuth<DailyExpenseRecord[]>(
      `/v1/dashboard/daily-expense-category-account-date?${params}`,
      'GET',
    )
  },
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export interface WalletRecord {
  id: string
  walletKey: string
  walletValue: string
  creationDate: string
  lastChangeDate: string | null
}

export interface WalletSearchOutput {
  output?: {
    quantidade?: number
    data?: WalletRecord[]
    message?: string
  }
}

export interface WalletRegisterOutput {
  output?: {
    message?: string
    status?: number
  }
}

export const walletApi = {
  search: () =>
    requestAuth<WalletSearchOutput>('/v1/wallet/search', 'POST', {}),

  register: (walletKey: string, walletValue: string) =>
    requestAuth<WalletRegisterOutput>('/v1/wallet/register', 'POST', {
      id: crypto.randomUUID(),
      walletKey,
      walletValue,
      creationDate: new Date().toISOString(),
    }),

  edit: (id: string, walletKey: string, walletValue: string, creationDate: string) =>
    requestAuth<WalletRegisterOutput>('/v1/wallet/edit', 'PUT', {
      id,
      walletKey,
      walletValue,
      creationDate,
      lastChangeDate: new Date().toISOString(),
    }),
}

// ─── Categories ───────────────────────────────────────────────────────────────

export const categoriesApi = {
  search: (vm: SearchCategoryViewModel) =>
    requestAuth<string[]>(
      '/v1/category/search' + (vm.enable !== undefined ? `?enable=${vm.enable}` : ''),
      'GET',
      undefined,
      { accountType: vm.accountType ?? '' },
    ),

  // Mesma rota de search(), autenticada via chave de lançamento rápido.
  searchQuickCapture: (vm: SearchCategoryViewModel, quickCaptureKey: string) =>
    requestQuickCapture<string[]>(
      '/v1/category/search' + (vm.enable !== undefined ? `?enable=${vm.enable}` : ''),
      'GET',
      quickCaptureKey,
      undefined,
      { accountType: vm.accountType ?? '' },
    ),
}
