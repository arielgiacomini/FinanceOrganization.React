// ─── Enums ────────────────────────────────────────────────────────────────────

export type AccountType = 'Conta a Pagar' | 'Conta a Receber'
export type Country = 'Brasil' | 'Espanha' | string
export type RegistrationStatus = 'AwaitRequestAPI' | 'Success' | 'Error'

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface Account {
  id: number
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
  creationDate: string
  lastChangeDate?: string
  isCreditCard: boolean
  colors?: AccountColor
}

export interface AccountColor {
  id: number
  accountId: number
  backgroundColorHexadecimal: string
  fonteColorHexadecimal: string
  enable: boolean
  creationDate: string
  lastChangeDate?: string
}

export interface BillToPay {
  id: string
  idBillToPayRegistration: number  // campo real da API
  account?: string
  name?: string
  category?: string
  value: number
  purchaseDate?: string
  dueDate: string
  yearMonth?: string
  frequence?: string
  registrationType?: string
  payDay?: string
  hasPay: boolean
  additionalMessage?: string
  country?: Country
  creationDate: string
  lastChangeDate?: string
}

export interface CashReceivable {
  id: string
  idCashReceivableRegistration: number
  name?: string
  account?: string
  frequence?: string
  registrationType?: string
  agreementDate?: string
  dueDate?: string
  yearMonth?: string
  category?: string
  value: number
  manipulatedValue: number
  dateReceived?: string
  hasReceived: boolean
  additionalMessage?: string
  country?: Country
  enabled?: boolean
  creationDate: string
  lastChangeDate?: string
}

// ─── ViewModels (request payloads) ───────────────────────────────────────────

export interface SearchBillToPayViewModel {
  id?: string[]
  idBillToPayRegistrations?: number[]
  yearMonth?: string
  showDetails?: boolean
}

export interface CreateBillToPayViewModel {
  name?: string
  account?: string
  frequence?: string
  registrationType?: string
  initialMonthYear?: string
  fynallyMonthYear?: string
  category?: string
  value: number
  purchaseDate?: string
  bestPayDay?: number
  additionalMessage?: string
  country?: string
  accountType?: AccountType
}

export interface EditBillToPayViewModel {
  id: string
  idBillToPayRegistration: number  // obrigatório pela API
  name?: string
  account?: string
  frequence?: string
  registrationType?: string
  category?: string
  value: number                // obrigatório pela API
  purchaseDate?: string
  dueDate: string              // obrigatório pela API
  yearMonth?: string
  payDay?: string
  hasPay: boolean              // obrigatório pela API
  lastChangeDate: string       // obrigatório pela API
  additionalMessage?: string
  country?: string
  bestPayDay?: number
}

export interface PayBillToPayViewModel {
  id: string
  payDay?: string
  hasPay: boolean
  lastChangeDate: string
  yearMonth?: string
  account?: string
  advancePayment: boolean
}

export interface PayOutput {
  output?: {
    validations?: Record<string, string>
    errors?: Record<string, string>
    status?: number
    message?: string
  }
}

export interface DeleteBillToPayViewModel {
  id: string[]  // API espera Guid[]
}

export interface DisableBillToPayViewModel {
  idBillToPayRegistration: number
}

export interface SearchCashReceivableViewModel {
  yearMonth?: string
  showDetails?: boolean
}

export interface CreateCashReceivableViewModel {
  name?: string
  account?: string
  frequence?: string
  registrationType?: string
  agreementDate?: string
  initialMonthYear?: string
  fynallyMonthYear?: string
  category?: string
  value: number
  bestReceivingDay: number
  additionalMessage?: string
  country?: string
  enabled?: boolean
  accountType?: AccountType
}

export interface EditCashReceivableViewModel {
  id: string
  idCashReceivableRegistration?: number
  name?: string
  account?: string
  frequence?: string
  registrationType?: string
  agreementDate?: string
  dueDate?: string
  yearMonth?: string
  category?: string
  value?: number
  manipulatedValue?: number
  dateReceived?: string
  hasReceived?: boolean
  additionalMessage?: string
  enabled?: boolean
  lastChangeDate?: string
  country?: string
  mustEditRegistrationAccount?: boolean
}

export interface DeleteCashReceivableViewModel {
  id: string[]  // API espera array
}

export interface SearchCategoryViewModel {
  accountType?: AccountType
  enable?: boolean
}

export interface SearchMonthlyAverageAnalysisViewModel {
  yearMonth?: string
}

// ─── API Outputs — shape real: { output: { data: [...], quantidade: N } } ─────

export interface MonthlyAverage {
  yearMonth: string
  totalValue: number
  averageValue: number
  count: number
}

export interface SearchBillToPayOutput {
  output?: { quantidade?: number; data?: BillToPay[] }  // lowercase (axios/fetch normalizes)
  Output?: { Quantidade?: number; Data?: BillToPay[] } // uppercase (raw API)
}

export interface SearchCashReceivableOutput {
  output?: { quantidade?: number; data?: CashReceivable[] }
  Output?: { Quantidade?: number; Data?: CashReceivable[] }
}

export interface SearchAccountOutput {
  data?: Account[]       // raiz: { Data: [...], Quantidade: N }
  quantidade?: number
}

export interface SearchMonthlyAverageAnalysisOutput {
  output?: { data?: MonthlyAverage[] }
  Output?: { Data?: MonthlyAverage[] }
}

export interface RecordsAwaitingOutput {
  output?: { count?: number; data?: BillToPay[] }
  Output?: { Count?: number; Data?: BillToPay[] }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export interface YearMonth {
  label: string   // "Maio / 2025"
  value: string   // "Maio/2025"
}
