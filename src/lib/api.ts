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

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://api.financeiro.arielgiacomini.com.br'

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
    throw new Error(
      isCors
        ? `Erro de CORS: a API bloqueou ${method} ${path}. Adicione AllowAnyMethod() no CORS da API C#.`
        : `Erro de rede: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Erro ${res.status} em ${method} ${path}: ${text}`)
  }

  const text = await res.text()
  if (!text) return {} as T
  const parsed = JSON.parse(text)
  return normalizeResponse(parsed) as T
}

// ─── API token ────────────────────────────────────────────────────────────────

const API_CLIENT_ID     = process.env.NEXT_PUBLIC_API_CLIENT_ID     ?? ''
const API_CLIENT_SECRET = process.env.NEXT_PUBLIC_API_CLIENT_SECRET ?? ''

let _apiToken: string | null = null
let _apiTokenExpiry = 0

async function getApiToken(): Promise<string> {
  const now = Date.now()
  if (_apiToken && now < _apiTokenExpiry - 60_000) return _apiToken

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: API_CLIENT_ID,
    client_secret: API_CLIENT_SECRET,
  })

  let res: Response
  try {
    res = await fetch(`${BASE_URL}/v1/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } catch (err) {
    throw new Error(`Erro de rede ao autenticar: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!res.ok) throw new Error(`Falha na autenticação (${res.status}).`)

  const data = await res.json()
  _apiToken = data.access_token as string
  _apiTokenExpiry = now + ((data.expires_in as number) ?? 3600) * 1000
  return _apiToken
}

async function requestAuth<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const token = await getApiToken()
  const result = await request<T>(path, method, body, {
    Authorization: `Bearer ${token}`,
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

// ─── Bills to Pay ─────────────────────────────────────────────────────────────

export const billsToPayApi = {
  search: (vm: SearchBillToPayViewModel) =>
    requestAuth<SearchBillToPayOutput>('/v1/bills-to-pay/search', 'POST', vm),

  // Serializa manualmente para garantir Int32 + inclui Bearer token
  searchByRegistration: async (id: number) => {
    const intId = Math.trunc(Number(id))
    console.log('[searchByRegistration] id recebido:', id, '| tipo:', typeof id, '| intId:', intId)
    if (isNaN(intId) || intId <= 0) throw new Error(`ID inválido para histórico: "${id}" (tipo: ${typeof id})`)
    const token = await getApiToken()
    const body = `{"idBillToPayRegistrations":[${intId}],"showDetails":true}`
    const res = await fetch(`${BASE_URL}/v1/bills-to-pay/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`Erro ${res.status} em POST /v1/bills-to-pay/search: ${text}`)
    }
    const text = await res.text()
    return (text ? normalizeResponse(JSON.parse(text)) : {}) as SearchBillToPayOutput
  },

  create: (vm: CreateBillToPayViewModel) =>
    requestAuth<{ output?: unknown }>('/v1/bills-to-pay/register', 'POST', vm),

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
    const token = await getApiToken()
    const body = `{"idCashReceivableRegistrations":[${intId}],"showDetails":true}`
    const res = await fetch(`${BASE_URL}/v1/cash-receivable/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body,
    })
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
  cardNumber?: string
  commissionPercentage?: number
  enable: boolean
  colors?: AccountColorsViewModel
}

export interface EditAccountViewModel extends RegisterAccountViewModel {
  id: number
}

export const accountsApi = {
  searchAll: () =>
    requestAuth<SearchAccountOutput>('/v1/account/search-all', 'GET'),

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
}
