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

/**
 * Normaliza a resposta da API para lowercase consistente.
 * A API pode retornar { Output: { Data: [] } } ou { output: { data: [] } }
 */
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

// ─── Bills to Pay ─────────────────────────────────────────────────────────────

export const billsToPayApi = {
  search: (vm: SearchBillToPayViewModel) =>
    request<SearchBillToPayOutput>('/v1/bills-to-pay/search', 'POST', vm),

  // Busca por registro — serializa manualmente para garantir Int32
  searchByRegistration: async (id: number) => {
    const intId = Math.trunc(Number(id))
    console.log('[searchByRegistration] id recebido:', id, '| tipo:', typeof id, '| intId:', intId)
    if (isNaN(intId) || intId <= 0) throw new Error(`ID inválido para histórico: "${id}" (tipo: ${typeof id})`)
    const body = `{"idBillToPayRegistrations":[${intId}],"showDetails":true}`
    const res = await fetch(`${BASE_URL}/v1/bills-to-pay/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    request<{ output?: unknown }>('/v1/bills-to-pay/register', 'POST', vm),

  edit: (vm: EditBillToPayViewModel) =>
    request<{ output?: unknown }>('/v1/bills-to-pay/edit', 'PUT', vm),

  editBasket: (vms: EditBillToPayViewModel[]) =>
    request<{ output?: unknown }>('/v1/bills-to-pay/edit-basket', 'PUT', vms),

  pay: (vm: PayBillToPayViewModel) =>
    request<PayOutput>('/v1/bills-to-pay/pay', 'PATCH', vm),

  delete: (vm: DeleteBillToPayViewModel) =>
    request<{ output?: unknown }>('/v1/bills-to-pay/delete', 'DELETE', vm),

  disable: (vm: DisableBillToPayViewModel) =>
    request<{ output?: unknown }>('/v1/bills-to-pay/disable-registration', 'DELETE', vm),

  monthlyAverage: (vm: SearchMonthlyAverageAnalysisViewModel) =>
    request<SearchMonthlyAverageAnalysisOutput>('/v1/bills-to-pay/SearchMonthlyAverageAnalysis', 'POST', vm),

  recordsAwaiting: () =>
    request<RecordsAwaitingOutput>('/v1/bills-to-pay/records-awaiting-complete-registration', 'GET'),
}

// ─── Cash Receivable ──────────────────────────────────────────────────────────

export const cashReceivableApi = {
  search: (vm: SearchCashReceivableViewModel) =>
    request<SearchCashReceivableOutput>('/v1/cash-receivable/search', 'POST', vm),

  create: (vm: CreateCashReceivableViewModel) =>
    request<{ output?: unknown }>('/v1/cash-receivable/register', 'POST', vm),

  edit: (vm: EditCashReceivableViewModel) =>
    request<{ output?: unknown }>('/v1/cash-receivable/edit', 'PUT', vm),

  editBasket: (vms: EditCashReceivableViewModel[]) =>
    request<{ output?: unknown }>('/v1/cash-receivable/edit-basket', 'PUT', vms),

  delete: (vm: DeleteCashReceivableViewModel) =>
    request<{ output?: unknown }>('/v1/cash-receivable/delete', 'DELETE', vm),

  disable: (id: number) =>
    request<{ output?: unknown }>('/v1/cash-receivable/disable-registration', 'DELETE', { idCashReceivableRegistration: id }),

  searchByRegistration: async (id: number) => {
    const intId = Math.trunc(Number(id))
    const body = `{"idCashReceivableRegistrations":[${intId}],"showDetails":true}`
    const res = await fetch(`${BASE_URL}/v1/cash-receivable/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`Erro ${res.status}: ${text}`)
    }
    const text = await res.text()
    return (text ? normalizeResponse(JSON.parse(text)) : {}) as SearchCashReceivableOutput
  },

  receive: (vm: { id: string; dateReceived: string; hasReceived: boolean; lastChangeDate: string; yearMonth?: string; account?: string }) =>
    request<{ output?: unknown }>('/v1/cash-receivable/receive', 'PATCH', vm),
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export const accountsApi = {
  searchAll: () =>
    request<SearchAccountOutput>('/v1/account/search-all', 'GET'),
}

// ─── Date ────────────────────────────────────────────────────────────────────

export interface SearchDateMonthYearOutput {
  monthYears?: string[]
  MonthYears?: string[]
}

export const dateApi = {
  // startYear via header, endYear via query string, ambos são anos inteiros
  monthYearAll: (startYear = 2020, endYear = 2030) =>
    request<SearchDateMonthYearOutput>(
      `/v1/date/month-year-all?endYear=${endYear}`,
      'GET',
      undefined,
      { startYear: String(startYear) }
    ),
}

// ─── Categories ───────────────────────────────────────────────────────────────

export const categoriesApi = {
  search: (vm: SearchCategoryViewModel) =>
    request<string[]>('/v1/category/search' + (vm.enable !== undefined ? `?enable=${vm.enable}` : ''), 'GET', undefined, {
      accountType: vm.accountType ?? '',
    }),
}
