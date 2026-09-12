'use client'

import { AppLayout } from '@/components/layout/AppLayout'
import { useState, useEffect, useRef } from 'react'
import { PageHeader, Spinner, Modal } from '@/components/ui'
import type { Account } from '@/types'
import {
  getFrequences, getRegistrationTypes,
  saveFrequences, saveRegistrationTypes,
  DEFAULT_FREQUENCES, DEFAULT_REGISTRATION_TYPES, DEFAULT_SALDO_CONTAS,
} from '@/lib/utils'
import {
  Plus, RotateCcw, Save, CreditCard,
  TrendingUp, Check, X, SlidersHorizontal, Building2,
  Pencil, Trash2, Bell, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Globe,
} from 'lucide-react'
import { walletApi, accountsApi, categoriesApi } from '@/lib/api'
import type { WalletRecord, RegisterAccountViewModel, EditAccountViewModel } from '@/lib/api'
import { YearMonthSelector } from '@/components/ui/YearMonthSelector'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { currentYearMonth } from '@/lib/utils'
import {
  STALE_ALERT_DEFAULT_MENSAGEM, STALE_ALERT_DEFAULT_INTERVALO_MINUTOS,
  DESPESA_MES_DEFAULT_CATEGORIA, DESPESA_MES_DEFAULT_COR_PROJETADO,
  CONTAS_PAGAR_SORT_COLUMNS, CONTAS_RECEBER_SORT_COLUMNS,
  QUICK_BILL_FIELDS, QUICK_BILL_ENABLED_DEFAULT, QUICK_BILL_VALUE_DEFAULT,
  loadQuickBillEnabledFields, loadQuickBillDefaultValues,
  CONTAS_PAGAR_COLUMNS, loadContasPagarColumnsOrder, loadContasPagarColumnsHidden,
  CONTAS_PAGAR_ACCOUNT_STYLE_OPTIONS, loadContasPagarAccountStyle,
  DESPESA_VER_REGISTROS_FIELDS, loadDespesaVerRegistrosOrder, loadDespesaVerRegistrosHidden,
  COUNTRY_CATALOG, loadUserCountryCodes, loadDefaultCountryCode, saveUserCountriesConfigLocal,
} from '@/lib/wallet'
import type {
  ContasPagarSortCol, ContasReceberSortCol, QuickBillFieldKey, ContasPagarColumnKey, ContasPagarAccountStyle,
  DespesaVerRegistrosFieldKey, CountryCurrencyInfo,
} from '@/lib/wallet'
import { CountryFlag } from '@/components/ui/Flags'

// ─── Chip list ────────────────────────────────────────────────────────────────

interface ChipListProps {
  items: string[]
  onChange: (items: string[]) => void
  onReset: () => void
  options?: string[]        // quando fornecido → <select>; caso contrário → input livre
  emptyLabel?: string
}

function ChipList({ items, onChange, onReset, options, emptyLabel = 'Nenhuma opção cadastrada.' }: ChipListProps) {
  const [newItem, setNewItem] = useState('')

  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx))
  }

  function add(value?: string) {
    const v = (value ?? newItem).trim()
    if (!v) return
    if (items.some(i => i.toLowerCase() === v.toLowerCase())) return
    onChange([...items, v])
    setNewItem('')
  }

  const available = options?.filter(
    o => !items.some(i => i.toLowerCase() === o.toLowerCase())
  ) ?? []

  return (
    <div className="space-y-3">
      {/* Chips */}
      <div className="flex flex-wrap gap-2 min-h-[2rem]">
        {items.length === 0 && (
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>{emptyLabel}</span>
        )}
        {items.map((item, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
            style={{
              background: 'var(--bg-4)',
              color: 'var(--text-1)',
              border: '1px solid var(--border-2)',
            }}
          >
            {item}
            <button
              type="button"
              onClick={() => remove(idx)}
              className="flex-shrink-0 rounded-full p-0.5 transition-colors"
              style={{ color: 'var(--text-3)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>

      {/* Add */}
      <div className="flex gap-2">
        {options !== undefined ? (
          available.length > 0 ? (
            <select
              className="input flex-1 text-sm"
              value=""
              onChange={e => { if (e.target.value) add(e.target.value) }}
            >
              <option value="" disabled>Selecionar conta...</option>
              {available.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <p className="text-xs py-1" style={{ color: 'var(--text-3)' }}>
              Todas as contas já adicionadas.
            </p>
          )
        ) : (
          <>
            <input
              className="input flex-1 text-sm"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
              placeholder="Nova opção..."
            />
            <button type="button" onClick={() => add()} className="btn-primary px-3">
              <Plus size={15} />
            </button>
          </>
        )}
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1.5 text-xs transition-colors"
        style={{ color: 'var(--text-3)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-2)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
      >
        <RotateCcw size={11} /> Restaurar padrão
      </button>
    </div>
  )
}

// ─── Section block ────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{title}</p>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── Color picker field ───────────────────────────────────────────────────────

function ColorPickerField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const validForPicker = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#ffffff'

  return (
    <div className="space-y-1.5">
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          title="Abrir seletor de cor"
          onClick={() => ref.current?.click()}
          className="w-9 h-9 rounded-lg flex-shrink-0 transition-transform hover:scale-105"
          style={{
            background: validForPicker,
            border: '2px solid var(--border-2)',
            boxShadow: '0 0 0 1px var(--border-1)',
          }}
        />
        <input
          ref={ref}
          type="color"
          value={validForPicker}
          onChange={e => onChange(e.target.value.toUpperCase())}
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
        />
        <input
          className="input flex-1 font-mono text-sm"
          value={value}
          onChange={e => onChange(e.target.value.toUpperCase())}
          placeholder="#FFFFFF"
          maxLength={7}
        />
      </div>
    </div>
  )
}

// ─── Account form modal (create + edit) ──────────────────────────────────────

const EMPTY_FORM: RegisterAccountViewModel = {
  name: '',
  enable: true,
  dueDate: undefined,
  closingDay: undefined,
  considerPaid: false,
  accountAgency: '',
  accountNumber: '',
  accountDigit: '',
  cardNumber: '',
  commissionPercentage: undefined,
  colors: undefined,
}

// Precisa ficar fora de AccountFormModal: um componente definido dentro do
// corpo de outro é recriado (nova identidade) a cada render, então o React
// desmonta/remonta os inputs a cada tecla digitada — e como o campo Nome tem
// autoFocus, o cursor "pulava" de volta pra ele a cada letra digitada em
// qualquer outro campo (Agência, Número, etc).
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        className="w-9 h-5 rounded-full relative transition-colors"
        style={{ background: on ? 'var(--green-500)' : 'var(--bg-5)' }}
        onClick={onToggle}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
          style={{
            background: 'var(--text-1)',
            transform: on ? 'translateX(1.1rem)' : 'translateX(0.125rem)',
          }}
        />
      </div>
      <span className="text-sm" style={{ color: 'var(--text-2)' }}>{label}</span>
    </label>
  )
}

function AccountFormModal({
  account,
  onClose,
  onSaved,
}: {
  account?: Account
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!account

  const [form, setForm] = useState<RegisterAccountViewModel>(() => {
    if (!account) return { ...EMPTY_FORM }
    return {
      name:                account.name,
      enable:              account.enable,
      considerPaid:        account.considerPaid ?? false,
      dueDate:             account.dueDate,
      closingDay:          account.closingDay,
      accountAgency:       account.accountAgency ?? '',
      accountNumber:       account.accountNumber ?? '',
      accountDigit:        account.accountDigit ?? '',
      cardNumber:          account.cardNumber ?? '',
      commissionPercentage: account.commissionPercentage,
      colors: account.colors
        ? {
            backgroundColorHexadecimal: account.colors.backgroundColorHexadecimal,
            fonteColorHexadecimal:      account.colors.fonteColorHexadecimal,
          }
        : undefined,
    }
  })

  const [isCreditCard, setIsCreditCard] = useState(account?.isCreditCard ?? false)
  const [hasColors, setHasColors] = useState(!!account?.colors)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof RegisterAccountViewModel>(key: K, value: RegisterAccountViewModel[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function toggleColors(on: boolean) {
    setHasColors(on)
    if (!on) set('colors', undefined)
    else set('colors', { backgroundColorHexadecimal: '#FFFFFF', fonteColorHexadecimal: '#000000' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nome é obrigatório.'); return }
    if (hasColors && form.colors) {
      const { backgroundColorHexadecimal: bg, fonteColorHexadecimal: fg } = form.colors
      if (!bg.match(/^#[0-9A-Fa-f]{3,6}$/) || !fg.match(/^#[0-9A-Fa-f]{3,6}$/)) {
        setError('Cores devem estar no formato hexadecimal, ex: #FF5500.'); return
      }
    }
    setSaving(true)
    setError('')
    try {
      const payload: RegisterAccountViewModel = {
        name:         form.name.trim(),
        enable:       form.enable,
        considerPaid: form.considerPaid,
        colors:       hasColors ? form.colors : undefined,
        isCreditCard,
        // Sempre presente (nunca ausente/undefined) — ver comentário no tipo
        // RegisterAccountViewModel: a API quebra com 500 ao cadastrar uma
        // conta bancária porque esse campo nunca era enviado nesse caso.
        cardNumber: isCreditCard ? (form.cardNumber ?? '') : '',
      }
      if (isCreditCard) {
        if (form.dueDate)              payload.dueDate              = Number(form.dueDate)
        if (form.closingDay)           payload.closingDay           = Number(form.closingDay)
        if (form.commissionPercentage) payload.commissionPercentage = Number(form.commissionPercentage)
      } else {
        if (form.accountAgency) payload.accountAgency = form.accountAgency
        if (form.accountNumber) payload.accountNumber = form.accountNumber
        if (form.accountDigit)  payload.accountDigit  = form.accountDigit
      }

      if (isEdit) {
        const editPayload: EditAccountViewModel = { ...payload, id: account!.id }
        await accountsApi.edit(editPayload)
      } else {
        await accountsApi.register(payload)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Erro ao ${isEdit ? 'editar' : 'cadastrar'} conta.`)
    } finally {
      setSaving(false)
    }
  }

  const typeLabel = isCreditCard ? 'Cartão de Crédito' : 'Conta Bancária'

  return (
    <Modal open title={isEdit ? `Editar — ${account!.name}` : `Nova conta — ${typeLabel}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Tipo (somente em criação) */}
        {!isEdit && (
          <div
            className="flex rounded-lg p-1 gap-1"
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}
          >
            {[
              { label: 'Conta Bancária',    icon: Building2,  value: false },
              { label: 'Cartão de Crédito', icon: CreditCard, value: true  },
            ].map(({ label, icon: Icon, value }) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setIsCreditCard(value)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all"
                style={isCreditCard === value ? {
                  background: 'var(--bg-5)',
                  color: 'var(--text-1)',
                  border: '1px solid var(--border-2)',
                } : {
                  color: 'var(--text-3)',
                  border: '1px solid transparent',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Nome */}
        <Field label="Nome *">
          <input
            className="input w-full"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Ex: Nubank, Itaú Corrente…"
            autoFocus
          />
        </Field>

        {/* Campos por tipo */}
        {isCreditCard ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Número do cartão (últimos dígitos)">
              <input
                className="input w-full"
                value={form.cardNumber ?? ''}
                onChange={e => set('cardNumber', e.target.value)}
                placeholder="Ex: 1234"
                maxLength={8}
              />
            </Field>
            <Field label="Dia de vencimento">
              <input
                className="input w-full"
                type="number" min={1} max={31}
                value={form.dueDate ?? ''}
                onChange={e => set('dueDate', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Ex: 10"
              />
            </Field>
            <Field label="Dia de fechamento">
              <input
                className="input w-full"
                type="number" min={1} max={31}
                value={form.closingDay ?? ''}
                onChange={e => set('closingDay', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Ex: 3"
              />
            </Field>
            <Field label="Comissão (%)">
              <input
                className="input w-full"
                type="number" min={0} step={0.01}
                value={form.commissionPercentage ?? ''}
                onChange={e => set('commissionPercentage', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Ex: 1.5"
              />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Agência">
              <input
                className="input w-full"
                value={form.accountAgency ?? ''}
                onChange={e => set('accountAgency', e.target.value)}
                placeholder="Ex: 0001"
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Field label="Número da conta">
                  <input
                    className="input w-full"
                    value={form.accountNumber ?? ''}
                    onChange={e => set('accountNumber', e.target.value)}
                    placeholder="Ex: 123456"
                  />
                </Field>
              </div>
              <Field label="Dígito">
                <input
                  className="input w-full"
                  value={form.accountDigit ?? ''}
                  onChange={e => set('accountDigit', e.target.value)}
                  placeholder="0"
                  maxLength={2}
                />
              </Field>
            </div>
          </div>
        )}

        {/* Toggles */}
        <div className="flex flex-wrap gap-4 pt-1">
          <Toggle on={!!form.enable}       onToggle={() => set('enable', !form.enable)}             label="Conta ativa" />
          <Toggle on={!!form.considerPaid} onToggle={() => set('considerPaid', !form.considerPaid)} label="Considerar como pago" />
        </div>

        {/* Cores (opcional) */}
        <div className="space-y-4" style={{ borderTop: '1px solid var(--border-1)', paddingTop: '1rem' }}>
          <Toggle on={hasColors} onToggle={() => toggleColors(!hasColors)} label="Definir cores personalizadas" />
          {hasColors && form.colors && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <ColorPickerField
                  label="Cor de fundo"
                  value={form.colors.backgroundColorHexadecimal}
                  onChange={v => set('colors', { ...form.colors!, backgroundColorHexadecimal: v })}
                />
                <ColorPickerField
                  label="Cor do texto"
                  value={form.colors.fonteColorHexadecimal}
                  onChange={v => set('colors', { ...form.colors!, fonteColorHexadecimal: v })}
                />
              </div>
              {/* Preview */}
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>Preview:</span>
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                  style={{
                    background: form.colors.backgroundColorHexadecimal,
                    color: form.colors.fonteColorHexadecimal,
                    border: '1px solid var(--border-1)',
                  }}
                >
                  {form.name || 'Nome da conta'}
                </span>
              </div>
            </>
          )}
        </div>

        {error && (
          <p className="text-xs px-3 py-2 rounded-lg"
            style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Spinner size={14} /> : <Check size={14} />}
            {saving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Cadastrar conta'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Account row ─────────────────────────────────────────────────────────────

function AccountRow({
  account: a,
  onEdit,
  onDelete,
}: {
  account: Account
  onEdit: (a: Account) => void
  onDelete: (a: Account) => void
}) {
  const dot = a.colors?.backgroundColorHexadecimal
  const isWhite = dot?.toUpperCase() === '#FFFFFF' || dot?.toUpperCase() === '#FFF'

  const detail = a.isCreditCard
    ? (a.cardNumber ? `•••• ${a.cardNumber}` : null)
    : (a.accountAgency && a.accountNumber
        ? `Ag. ${a.accountAgency} · Cc. ${a.accountNumber}${a.accountDigit ? `-${a.accountDigit}` : ''}`
        : null)

  const duePart = a.dueDate ? `Venc. dia ${a.dueDate}` : null

  return (
    <div
      className="group flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid var(--border-1)' }}
    >
      {/* Color dot */}
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: isWhite ? 'var(--bg-5)' : (dot ?? 'var(--bg-5)'), border: isWhite ? '1px solid var(--border-2)' : undefined }}
      />

      {/* Name */}
      <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>
        {a.name}
      </span>

      {/* Detail (agency/card) — hidden on mobile */}
      {detail && (
        <span className="hidden sm:block text-xs font-mono" style={{ color: 'var(--text-3)' }}>
          {detail}
        </span>
      )}

      {/* Due day */}
      {duePart && (
        <span className="hidden md:block text-xs" style={{ color: 'var(--text-3)' }}>
          {duePart}
        </span>
      )}

      {/* Status */}
      <span
        className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
        style={{
          background: a.enable ? 'var(--green-dim)' : 'var(--red-dim)',
          color:      a.enable ? 'var(--green-400)' : 'var(--red)',
        }}
      >
        {a.enable ? 'Ativa' : 'Inativa'}
      </span>

      {/* Type icon */}
      <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>
        {a.isCreditCard ? <CreditCard size={13} /> : <Building2 size={13} />}
      </span>

      {/* Action buttons — visíveis ao hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          type="button"
          onClick={() => onEdit(a)}
          title="Editar"
          className="p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--blue)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(a)}
          title="Excluir"
          className="p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── PLR config localStorage ──────────────────────────────────────────────────

const PLR_CONFIG_KEY = 'finance_plr_config'

function loadPlrConfig() {
  try {
    const raw = localStorage.getItem(PLR_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

function savePlrConfigAll(data: Record<string, string>) {
  localStorage.setItem(PLR_CONFIG_KEY, JSON.stringify(data))
}

// ─── Alerta de dados desatualizados — localStorage ────────────────────────────

const STALE_ALERT_CONFIG_KEY = 'finance_stale_alert_config'

function loadStaleAlertConfigLocal(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STALE_ALERT_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

function saveStaleAlertConfigLocal(data: Record<string, string>) {
  localStorage.setItem(STALE_ALERT_CONFIG_KEY, JSON.stringify(data))
}

// ─── Despesas por Mês/Ano — filtro padrão — localStorage ──────────────────────

const DESPESA_MES_CONFIG_KEY = 'finance_despesa_mes_config'

function loadDespesaMesConfigLocal(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DESPESA_MES_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

function saveDespesaMesConfigLocal(data: Record<string, string>) {
  localStorage.setItem(DESPESA_MES_CONFIG_KEY, JSON.stringify(data))
}

// ─── Contas a Pagar — ordenação padrão da tabela — localStorage ───────────────

const CONTAS_PAGAR_SORT_CONFIG_KEY = 'finance_contas_pagar_sort_config'

function loadContasPagarSortConfigLocal(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CONTAS_PAGAR_SORT_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

function saveContasPagarSortConfigLocal(data: Record<string, string>) {
  localStorage.setItem(CONTAS_PAGAR_SORT_CONFIG_KEY, JSON.stringify(data))
}

// ─── Contas a Receber — ordenação padrão da tabela — localStorage ─────────────

const CONTAS_RECEBER_SORT_CONFIG_KEY = 'finance_contas_receber_sort_config'

function loadContasReceberSortConfigLocal(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CONTAS_RECEBER_SORT_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

function saveContasReceberSortConfigLocal(data: Record<string, string>) {
  localStorage.setItem(CONTAS_RECEBER_SORT_CONFIG_KEY, JSON.stringify(data))
}

// ─── Contas a Pagar — colunas visíveis/ordem da tabela — localStorage ─────────

const CONTAS_PAGAR_COLUMNS_CONFIG_KEY = 'finance_contas_pagar_columns_config'

function saveContasPagarColumnsConfigLocal(order: string[], hidden: string[]) {
  localStorage.setItem(CONTAS_PAGAR_COLUMNS_CONFIG_KEY, JSON.stringify({ order, hidden }))
}

// ─── Despesas por Mês/Ano — "Ver registros" — campos do painel expandido — localStorage ──

const DESPESA_VER_REGISTROS_CONFIG_KEY = 'finance_despesa_ver_registros_config'

function saveDespesaVerRegistrosConfigLocal(order: string[], hidden: string[]) {
  localStorage.setItem(DESPESA_VER_REGISTROS_CONFIG_KEY, JSON.stringify({ order, hidden }))
}

// ─── Contas a Pagar — identidade visual por conta na tabela — localStorage ────

const CONTAS_PAGAR_ACCOUNT_STYLE_CONFIG_KEY = 'finance_contas_pagar_account_style_config'

function saveContasPagarAccountStyleConfigLocal(style: string) {
  localStorage.setItem(CONTAS_PAGAR_ACCOUNT_STYLE_CONFIG_KEY, JSON.stringify({ style }))
}

// ─── Cadastro Rápido — Contas a Pagar — localStorage ───────────────────────────

const QUICK_BILL_CONFIG_KEY = 'finance_quick_bill_config'

function loadQuickBillConfigLocal(): Record<string, string> {
  try {
    const raw = localStorage.getItem(QUICK_BILL_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

function saveQuickBillConfigLocal(data: Record<string, string>) {
  localStorage.setItem(QUICK_BILL_CONFIG_KEY, JSON.stringify(data))
}

// ─── Tabs definition ──────────────────────────────────────────────────────────

type TabId = 'formularios' | 'contas' | 'paises' | 'grafico' | 'alertas' | 'ordenacao'

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: 'formularios',     label: 'Formulários',              Icon: SlidersHorizontal },
  { id: 'contas',          label: 'Contas',                    Icon: Building2         },
  { id: 'paises',          label: 'Países',                    Icon: Globe             },
  { id: 'grafico',         label: 'Gráfico',                   Icon: TrendingUp        },
  { id: 'alertas',         label: 'Alertas',                   Icon: Bell              },
  { id: 'ordenacao',       label: 'Contas a Pagar/Receber',     Icon: ArrowUpDown       },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

function ConfiguracoesInner() {
  const [activeTab, setActiveTab] = useState<TabId>('formularios')

  const [frequences, setFrequences] = useState<string[]>([])
  const [regTypes,   setRegTypes]   = useState<string[]>([])

  const [saldoContas,       setSaldoContas]       = useState<string[]>([...DEFAULT_SALDO_CONTAS])
  const [saldoContasRecord, setSaldoContasRecord] = useState<WalletRecord | null>(null)
  const [accounts,          setAccounts]          = useState<Account[]>([])
  const [accountsLoading,   setAccountsLoading]   = useState(false)
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([])
  const [registerOpen,      setRegisterOpen]      = useState(false)
  const [editTarget,        setEditTarget]        = useState<Account | null>(null)
  const [deleteTarget,      setDeleteTarget]      = useState<Account | null>(null)
  const [deleteLoading,     setDeleteLoading]     = useState(false)
  const [deleteError,       setDeleteError]       = useState('')
  const [showInactive,      setShowInactive]      = useState(false)

  const [plrName,                  setPlrName]                  = useState('')
  const [saldoFinalYm,             setSaldoFinalYm]             = useState('')
  const [valeCategoria,            setValeCategoria]            = useState('')
  const [nomeGrupoEspanha,         setNomeGrupoEspanha]         = useState('')
  const [nomeGrupoInvestimento,    setNomeGrupoInvestimento]    = useState('')
  const [nomeGrupoContasBancarias, setNomeGrupoContasBancarias] = useState('')
  const [investimentoAnosProjecao, setInvestimentoAnosProjecao] = useState('5')
  const [chartRecords,             setChartRecords]             = useState<WalletRecord[]>([])

  const [staleAlertAtivo,            setStaleAlertAtivo]            = useState(true)
  const [staleAlertMensagem,         setStaleAlertMensagem]         = useState(STALE_ALERT_DEFAULT_MENSAGEM)
  const [staleAlertIntervaloMinutos, setStaleAlertIntervaloMinutos] = useState(String(STALE_ALERT_DEFAULT_INTERVALO_MINUTOS))
  const [staleAlertRecord,           setStaleAlertRecord]           = useState<WalletRecord | null>(null)

  const [despesaMesFiltrarAnoAtual,  setDespesaMesFiltrarAnoAtual]  = useState(true)
  const [despesaMesCategoriaPadrao,  setDespesaMesCategoriaPadrao]  = useState(DESPESA_MES_DEFAULT_CATEGORIA)
  const [despesaMesCorProjetado,     setDespesaMesCorProjetado]     = useState(DESPESA_MES_DEFAULT_COR_PROJETADO)
  const [despesaMesRecord,           setDespesaMesRecord]           = useState<WalletRecord | null>(null)

  const [contasPagarSortCol,         setContasPagarSortCol]         = useState<ContasPagarSortCol>('default')
  const [contasPagarSortDir,         setContasPagarSortDir]         = useState<'asc' | 'desc'>('asc')
  const [contasPagarSortRecord,      setContasPagarSortRecord]      = useState<WalletRecord | null>(null)

  const [contasReceberSortCol,       setContasReceberSortCol]       = useState<ContasReceberSortCol>('default')
  const [contasReceberSortDir,       setContasReceberSortDir]       = useState<'asc' | 'desc'>('asc')
  const [contasReceberSortRecord,    setContasReceberSortRecord]    = useState<WalletRecord | null>(null)

  const [contasPagarColumnsOrder,  setContasPagarColumnsOrder]  = useState<ContasPagarColumnKey[]>(CONTAS_PAGAR_COLUMNS.map(c => c.value))
  const [contasPagarColumnsHidden, setContasPagarColumnsHidden] = useState<Record<ContasPagarColumnKey, boolean>>({} as Record<ContasPagarColumnKey, boolean>)

  const [despesaVerRegistrosOrder,  setDespesaVerRegistrosOrder]  = useState<DespesaVerRegistrosFieldKey[]>(DESPESA_VER_REGISTROS_FIELDS.map(f => f.value))
  const [despesaVerRegistrosHidden, setDespesaVerRegistrosHidden] = useState<Record<DespesaVerRegistrosFieldKey, boolean>>({} as Record<DespesaVerRegistrosFieldKey, boolean>)
  const [despesaVerRegistrosRecord, setDespesaVerRegistrosRecord] = useState<WalletRecord | null>(null)
  const [contasPagarColumnsRecord, setContasPagarColumnsRecord] = useState<WalletRecord | null>(null)

  const [contasPagarAccountStyle,       setContasPagarAccountStyle]       = useState<ContasPagarAccountStyle>('tint')
  const [contasPagarAccountStyleRecord, setContasPagarAccountStyleRecord] = useState<WalletRecord | null>(null)

  const [activeCountryCodes,      setActiveCountryCodes]      = useState<string[]>(['Brasil', 'Espanha'])
  const [defaultCountryCode,      setDefaultCountryCode]      = useState('Brasil')
  const [newCountryCode,          setNewCountryCode]          = useState('')
  const [userCountriesRecord,     setUserCountriesRecord]     = useState<WalletRecord | null>(null)

  const [quickBillEnabled, setQuickBillEnabled] = useState<Record<QuickBillFieldKey, boolean>>({ ...QUICK_BILL_ENABLED_DEFAULT })
  const [quickBillDefaults, setQuickBillDefaults] = useState<Record<QuickBillFieldKey, string>>({ ...QUICK_BILL_VALUE_DEFAULT, country: '' })
  const [quickBillRecord, setQuickBillRecord] = useState<WalletRecord | null>(null)
  const [quickBillCategories, setQuickBillCategories] = useState<string[]>([])

  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError('')
    try {
      await accountsApi.delete(deleteTarget.id)
      setDeleteTarget(null)
      loadAccounts()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir conta.')
    } finally {
      setDeleteLoading(false)
    }
  }

  function loadAccounts() {
    setAccountsLoading(true)
    accountsApi.searchAll().then(res => {
      const accs: Account[] = res.data ?? []
      setAccounts(accs)
      setAvailableAccounts(accs.map(a => a.name).sort())
    }).catch(() => {}).finally(() => setAccountsLoading(false))
  }

  useEffect(() => {
    setFrequences(getFrequences())
    setRegTypes(getRegistrationTypes())

    loadAccounts()

    const c = loadPlrConfig()
    setPlrName(c.name ?? 'PLR - Ciclo 2 - 2025 de méritocracia (encerrando 2025)')
    setSaldoFinalYm(c.saldoFinalYm ?? '')
    setValeCategoria(c.valeCategoria ?? 'Vale Alimentação/Refeição')
    setNomeGrupoEspanha(c.nomeGrupoEspanha ?? 'Conta Bancária Espanha')
    setNomeGrupoInvestimento(c.nomeGrupoInvestimento ?? 'Investimentos')
    setNomeGrupoContasBancarias(c.nomeGrupoContasBancarias ?? 'Contas Bancárias')
    setInvestimentoAnosProjecao(c.investimentoAnosProjecao ?? '5')

    const sa = loadStaleAlertConfigLocal()
    setStaleAlertAtivo(sa.ativo !== 'false')
    setStaleAlertMensagem(sa.mensagem ?? STALE_ALERT_DEFAULT_MENSAGEM)
    setStaleAlertIntervaloMinutos(sa.intervaloMinutos ?? String(STALE_ALERT_DEFAULT_INTERVALO_MINUTOS))

    const dm = loadDespesaMesConfigLocal()
    setDespesaMesFiltrarAnoAtual(dm.filtrarAnoAtual !== 'false')
    setDespesaMesCategoriaPadrao(dm.categoriaPadrao ?? DESPESA_MES_DEFAULT_CATEGORIA)
    setDespesaMesCorProjetado(dm.corProjetado ?? DESPESA_MES_DEFAULT_COR_PROJETADO)

    const cp = loadContasPagarSortConfigLocal()
    setContasPagarSortCol((CONTAS_PAGAR_SORT_COLUMNS.some(c => c.value === cp.sortCol) ? cp.sortCol : 'default') as ContasPagarSortCol)
    setContasPagarSortDir(cp.sortDir === 'desc' ? 'desc' : 'asc')

    const cr = loadContasReceberSortConfigLocal()
    setContasReceberSortCol((CONTAS_RECEBER_SORT_COLUMNS.some(c => c.value === cr.sortCol) ? cr.sortCol : 'default') as ContasReceberSortCol)
    setContasReceberSortDir(cr.sortDir === 'desc' ? 'desc' : 'asc')

    setQuickBillEnabled(loadQuickBillEnabledFields())
    setQuickBillDefaults(loadQuickBillDefaultValues())

    setContasPagarColumnsOrder(loadContasPagarColumnsOrder())
    setContasPagarColumnsHidden(loadContasPagarColumnsHidden())

    setDespesaVerRegistrosOrder(loadDespesaVerRegistrosOrder())
    setDespesaVerRegistrosHidden(loadDespesaVerRegistrosHidden())

    setContasPagarAccountStyle(loadContasPagarAccountStyle())

    setActiveCountryCodes(loadUserCountryCodes())
    setDefaultCountryCode(loadDefaultCountryCode())

    categoriesApi.search({ accountType: 'Conta a Pagar', enable: true }).then(cats => setQuickBillCategories(cats ?? [])).catch(() => {})

    walletApi.search().then(res => {
      const records = res.output?.data ?? []
      setChartRecords(records)

      const plrRec = records.find(r => r.walletKey === 'finance_plr_config')
      if (plrRec?.walletValue) {
        try {
          const p = JSON.parse(plrRec.walletValue)
          savePlrConfigAll(p)
          setPlrName(p.name ?? '')
          setSaldoFinalYm(p.saldoFinalYm ?? '')
          setValeCategoria(p.valeCategoria ?? '')
          setNomeGrupoEspanha(p.nomeGrupoEspanha ?? '')
          setNomeGrupoInvestimento(p.nomeGrupoInvestimento ?? 'Investimentos')
          setNomeGrupoContasBancarias(p.nomeGrupoContasBancarias ?? 'Contas Bancárias')
          setInvestimentoAnosProjecao(p.investimentoAnosProjecao ?? '5')
        } catch {}
      }

      const saldoRec = records.find(r => r.walletKey === 'finance_saldo_contas')
      setSaldoContasRecord(saldoRec ?? null)
      if (saldoRec?.walletValue) {
        try { setSaldoContas(JSON.parse(saldoRec.walletValue)) } catch {}
      }

      const staleRec = records.find(r => r.walletKey === 'finance_stale_alert_config')
      setStaleAlertRecord(staleRec ?? null)
      if (staleRec?.walletValue) {
        try {
          const s = JSON.parse(staleRec.walletValue)
          saveStaleAlertConfigLocal(s)
          setStaleAlertAtivo(s.ativo !== 'false')
          setStaleAlertMensagem(s.mensagem ?? STALE_ALERT_DEFAULT_MENSAGEM)
          setStaleAlertIntervaloMinutos(s.intervaloMinutos ?? String(STALE_ALERT_DEFAULT_INTERVALO_MINUTOS))
        } catch {}
      }

      const despesaMesRec = records.find(r => r.walletKey === 'finance_despesa_mes_config')
      setDespesaMesRecord(despesaMesRec ?? null)
      if (despesaMesRec?.walletValue) {
        try {
          const d = JSON.parse(despesaMesRec.walletValue)
          saveDespesaMesConfigLocal(d)
          setDespesaMesFiltrarAnoAtual(d.filtrarAnoAtual !== 'false')
          setDespesaMesCategoriaPadrao(d.categoriaPadrao ?? DESPESA_MES_DEFAULT_CATEGORIA)
          setDespesaMesCorProjetado(d.corProjetado ?? DESPESA_MES_DEFAULT_COR_PROJETADO)
        } catch {}
      }

      const contasPagarSortRec = records.find(r => r.walletKey === 'finance_contas_pagar_sort_config')
      setContasPagarSortRecord(contasPagarSortRec ?? null)
      if (contasPagarSortRec?.walletValue) {
        try {
          const c = JSON.parse(contasPagarSortRec.walletValue)
          saveContasPagarSortConfigLocal(c)
          setContasPagarSortCol((CONTAS_PAGAR_SORT_COLUMNS.some(x => x.value === c.sortCol) ? c.sortCol : 'default') as ContasPagarSortCol)
          setContasPagarSortDir(c.sortDir === 'desc' ? 'desc' : 'asc')
        } catch {}
      }

      const contasReceberSortRec = records.find(r => r.walletKey === 'finance_contas_receber_sort_config')
      setContasReceberSortRecord(contasReceberSortRec ?? null)
      if (contasReceberSortRec?.walletValue) {
        try {
          const c = JSON.parse(contasReceberSortRec.walletValue)
          saveContasReceberSortConfigLocal(c)
          setContasReceberSortCol((CONTAS_RECEBER_SORT_COLUMNS.some(x => x.value === c.sortCol) ? c.sortCol : 'default') as ContasReceberSortCol)
          setContasReceberSortDir(c.sortDir === 'desc' ? 'desc' : 'asc')
        } catch {}
      }

      const contasPagarColumnsRec = records.find(r => r.walletKey === 'finance_contas_pagar_columns_config')
      setContasPagarColumnsRecord(contasPagarColumnsRec ?? null)
      if (contasPagarColumnsRec?.walletValue) {
        try {
          const c = JSON.parse(contasPagarColumnsRec.walletValue)
          saveContasPagarColumnsConfigLocal(c.order ?? [], c.hidden ?? [])
          setContasPagarColumnsOrder(loadContasPagarColumnsOrder())
          setContasPagarColumnsHidden(loadContasPagarColumnsHidden())
        } catch {}
      }

      const despesaVerRegistrosRec = records.find(r => r.walletKey === 'finance_despesa_ver_registros_config')
      setDespesaVerRegistrosRecord(despesaVerRegistrosRec ?? null)
      if (despesaVerRegistrosRec?.walletValue) {
        try {
          const c = JSON.parse(despesaVerRegistrosRec.walletValue)
          saveDespesaVerRegistrosConfigLocal(c.order ?? [], c.hidden ?? [])
          setDespesaVerRegistrosOrder(loadDespesaVerRegistrosOrder())
          setDespesaVerRegistrosHidden(loadDespesaVerRegistrosHidden())
        } catch {}
      }

      const contasPagarAccountStyleRec = records.find(r => r.walletKey === 'finance_contas_pagar_account_style_config')
      setContasPagarAccountStyleRecord(contasPagarAccountStyleRec ?? null)
      if (contasPagarAccountStyleRec?.walletValue) {
        try {
          const c = JSON.parse(contasPagarAccountStyleRec.walletValue)
          saveContasPagarAccountStyleConfigLocal(c.style ?? '')
          setContasPagarAccountStyle(loadContasPagarAccountStyle())
        } catch {}
      }

      const userCountriesRec = records.find(r => r.walletKey === 'finance_user_countries_config')
      setUserCountriesRecord(userCountriesRec ?? null)
      if (userCountriesRec?.walletValue) {
        try {
          const c = JSON.parse(userCountriesRec.walletValue)
          // Aceita o formato antigo (v389–v391: só uma lista de países ativos,
          // sem padrão separado) e migra sozinho pro formato novo.
          const codes: string[] = Array.isArray(c.codes) && c.codes.length > 0
            ? c.codes
            : Array.isArray(c.countries) ? c.countries.map((x: { code: string }) => x.code) : []
          if (codes.length > 0) {
            const defaultCode = codes.includes(c.defaultCode) ? c.defaultCode : codes[0]
            saveUserCountriesConfigLocal(codes, defaultCode)
            setActiveCountryCodes(loadUserCountryCodes())
            setDefaultCountryCode(loadDefaultCountryCode())
          }
        } catch {}
      }

      const quickBillRec = records.find(r => r.walletKey === 'finance_quick_bill_config')
      setQuickBillRecord(quickBillRec ?? null)
      if (quickBillRec?.walletValue) {
        try {
          const q = JSON.parse(quickBillRec.walletValue)
          saveQuickBillConfigLocal(q)
          const enabled = { ...QUICK_BILL_ENABLED_DEFAULT }
          const vals: Record<QuickBillFieldKey, string> = { ...QUICK_BILL_VALUE_DEFAULT, country: '' }
          for (const f of QUICK_BILL_FIELDS) {
            const rawEnabled = q[`enabled_${f.value}`]
            if (rawEnabled === 'true' || rawEnabled === 'false') enabled[f.value] = rawEnabled === 'true'
            if (f.value === 'country') continue
            const rawVal = q[`default_${f.value}`]
            if (rawVal !== undefined) vals[f.value] = rawVal
          }
          setQuickBillEnabled(enabled)
          setQuickBillDefaults(vals)
        } catch {}
      }

    }).catch(() => {})
  }, [])

  async function save() {
    // Formulários → localStorage (síncrono, não precisa de rede)
    saveFrequences(frequences)
    saveRegistrationTypes(regTypes)

    setSaving(true)
    setSaveError(null)

    // Cada entrada dispara sua chamada à API e é rastreada individualmente —
    // se alguma falhar, o usuário fica sabendo exatamente qual (em vez do
    // botão sempre mostrar "Salvo!" mesmo quando a sincronização falha).
    const tasks: { label: string; promise: Promise<unknown> }[] = []

    // Saldo contas → API
    const saldoVal = JSON.stringify(saldoContas)
    tasks.push({
      label: 'Saldo Disponível em Contas a Pagar',
      promise: (saldoContasRecord
        ? walletApi.edit(saldoContasRecord.id, 'finance_saldo_contas', saldoVal, saldoContasRecord.creationDate)
        : walletApi.register('finance_saldo_contas', saldoVal)
      ).then(res => {
        if (!saldoContasRecord) {
          const newRec = (res as { output?: { data?: WalletRecord } })?.output?.data
          if (newRec) setSaldoContasRecord(newRec)
        }
      }),
    })

    // Gráfico → localStorage + API
    const data = { name: plrName, saldoFinalYm, valeCategoria, nomeGrupoEspanha, nomeGrupoInvestimento, nomeGrupoContasBancarias, investimentoAnosProjecao }
    savePlrConfigAll(data)
    const existing = chartRecords.find(r => r.walletKey === 'finance_plr_config')
    tasks.push({
      label: 'Gráfico (Nome do PLR e demais campos)',
      promise: existing
        ? walletApi.edit(existing.id, 'finance_plr_config', JSON.stringify(data), existing.creationDate)
        : walletApi.register('finance_plr_config', JSON.stringify(data)),
    })

    // Alerta de dados desatualizados → localStorage + API
    const staleData = { ativo: String(staleAlertAtivo), mensagem: staleAlertMensagem, intervaloMinutos: staleAlertIntervaloMinutos }
    saveStaleAlertConfigLocal(staleData)
    const staleVal = JSON.stringify(staleData)
    tasks.push({
      label: 'Alerta de dados desatualizados',
      promise: (staleAlertRecord
        ? walletApi.edit(staleAlertRecord.id, 'finance_stale_alert_config', staleVal, staleAlertRecord.creationDate)
        : walletApi.register('finance_stale_alert_config', staleVal)
      ).then(res => {
        if (!staleAlertRecord) {
          const newRec = (res as { output?: { data?: WalletRecord } })?.output?.data
          if (newRec) setStaleAlertRecord(newRec)
        }
      }),
    })

    // Despesas por Mês/Ano — filtro padrão → localStorage + API
    const despesaMesData = { filtrarAnoAtual: String(despesaMesFiltrarAnoAtual), categoriaPadrao: despesaMesCategoriaPadrao, corProjetado: despesaMesCorProjetado }
    saveDespesaMesConfigLocal(despesaMesData)
    const despesaMesVal = JSON.stringify(despesaMesData)
    tasks.push({
      label: 'Despesas por Mês/Ano',
      promise: (despesaMesRecord
        ? walletApi.edit(despesaMesRecord.id, 'finance_despesa_mes_config', despesaMesVal, despesaMesRecord.creationDate)
        : walletApi.register('finance_despesa_mes_config', despesaMesVal)
      ).then(res => {
        if (!despesaMesRecord) {
          const newRec = (res as { output?: { data?: WalletRecord } })?.output?.data
          if (newRec) setDespesaMesRecord(newRec)
        }
      }),
    })

    // Contas a Pagar — ordenação padrão da tabela → localStorage + API
    const contasPagarSortData = { sortCol: contasPagarSortCol, sortDir: contasPagarSortDir }
    saveContasPagarSortConfigLocal(contasPagarSortData)
    const contasPagarSortVal = JSON.stringify(contasPagarSortData)
    tasks.push({
      label: 'Ordenação — Contas a Pagar',
      promise: (contasPagarSortRecord
        ? walletApi.edit(contasPagarSortRecord.id, 'finance_contas_pagar_sort_config', contasPagarSortVal, contasPagarSortRecord.creationDate)
        : walletApi.register('finance_contas_pagar_sort_config', contasPagarSortVal)
      ).then(res => {
        if (!contasPagarSortRecord) {
          const newRec = (res as { output?: { data?: WalletRecord } })?.output?.data
          if (newRec) setContasPagarSortRecord(newRec)
        }
      }),
    })

    // Contas a Receber — ordenação padrão da tabela → localStorage + API
    const contasReceberSortData = { sortCol: contasReceberSortCol, sortDir: contasReceberSortDir }
    saveContasReceberSortConfigLocal(contasReceberSortData)
    const contasReceberSortVal = JSON.stringify(contasReceberSortData)
    tasks.push({
      label: 'Ordenação — Contas a Receber',
      promise: (contasReceberSortRecord
        ? walletApi.edit(contasReceberSortRecord.id, 'finance_contas_receber_sort_config', contasReceberSortVal, contasReceberSortRecord.creationDate)
        : walletApi.register('finance_contas_receber_sort_config', contasReceberSortVal)
      ).then(res => {
        if (!contasReceberSortRecord) {
          const newRec = (res as { output?: { data?: WalletRecord } })?.output?.data
          if (newRec) setContasReceberSortRecord(newRec)
        }
      }),
    })

    // Contas a Pagar — colunas visíveis/ordem da tabela → localStorage + API
    const hiddenColumnsList = CONTAS_PAGAR_COLUMNS.map(c => c.value).filter(v => contasPagarColumnsHidden[v])
    saveContasPagarColumnsConfigLocal(contasPagarColumnsOrder, hiddenColumnsList)
    const contasPagarColumnsVal = JSON.stringify({ order: contasPagarColumnsOrder, hidden: hiddenColumnsList })
    tasks.push({
      label: 'Colunas da tabela — Contas a Pagar',
      promise: (contasPagarColumnsRecord
        ? walletApi.edit(contasPagarColumnsRecord.id, 'finance_contas_pagar_columns_config', contasPagarColumnsVal, contasPagarColumnsRecord.creationDate)
        : walletApi.register('finance_contas_pagar_columns_config', contasPagarColumnsVal)
      ).then(res => {
        if (!contasPagarColumnsRecord) {
          const newRec = (res as { output?: { data?: WalletRecord } })?.output?.data
          if (newRec) setContasPagarColumnsRecord(newRec)
        }
      }),
    })

    // Despesas por Mês/Ano — campos do painel expandido do "Ver registros" → localStorage + API
    const hiddenVerRegistrosList = DESPESA_VER_REGISTROS_FIELDS.map(f => f.value).filter(v => despesaVerRegistrosHidden[v])
    saveDespesaVerRegistrosConfigLocal(despesaVerRegistrosOrder, hiddenVerRegistrosList)
    const despesaVerRegistrosVal = JSON.stringify({ order: despesaVerRegistrosOrder, hidden: hiddenVerRegistrosList })
    tasks.push({
      label: 'Campos do "Ver registros" — Despesas por Mês/Ano',
      promise: (despesaVerRegistrosRecord
        ? walletApi.edit(despesaVerRegistrosRecord.id, 'finance_despesa_ver_registros_config', despesaVerRegistrosVal, despesaVerRegistrosRecord.creationDate)
        : walletApi.register('finance_despesa_ver_registros_config', despesaVerRegistrosVal)
      ).then(res => {
        if (!despesaVerRegistrosRecord) {
          const newRec = (res as { output?: { data?: WalletRecord } })?.output?.data
          if (newRec) setDespesaVerRegistrosRecord(newRec)
        }
      }),
    })

    // Contas a Pagar — identidade visual por conta na tabela → localStorage + API
    saveContasPagarAccountStyleConfigLocal(contasPagarAccountStyle)
    const contasPagarAccountStyleVal = JSON.stringify({ style: contasPagarAccountStyle })
    tasks.push({
      label: 'Identidade visual por conta — Contas a Pagar',
      promise: (contasPagarAccountStyleRecord
        ? walletApi.edit(contasPagarAccountStyleRecord.id, 'finance_contas_pagar_account_style_config', contasPagarAccountStyleVal, contasPagarAccountStyleRecord.creationDate)
        : walletApi.register('finance_contas_pagar_account_style_config', contasPagarAccountStyleVal)
      ).then(res => {
        if (!contasPagarAccountStyleRecord) {
          const newRec = (res as { output?: { data?: WalletRecord } })?.output?.data
          if (newRec) setContasPagarAccountStyleRecord(newRec)
        }
      }),
    })

    // Países usados pelo usuário → localStorage + API
    saveUserCountriesConfigLocal(activeCountryCodes, defaultCountryCode)
    const userCountriesVal = JSON.stringify({ codes: activeCountryCodes, defaultCode: defaultCountryCode })
    tasks.push({
      label: 'Países',
      promise: (userCountriesRecord
        ? walletApi.edit(userCountriesRecord.id, 'finance_user_countries_config', userCountriesVal, userCountriesRecord.creationDate)
        : walletApi.register('finance_user_countries_config', userCountriesVal)
      ).then(res => {
        if (!userCountriesRecord) {
          const newRec = (res as { output?: { data?: WalletRecord } })?.output?.data
          if (newRec) setUserCountriesRecord(newRec)
        }
      }),
    })

    // Cadastro Rápido — Contas a Pagar → localStorage + API
    const quickBillData: Record<string, string> = {}
    for (const f of QUICK_BILL_FIELDS) {
      quickBillData[`enabled_${f.value}`] = String(quickBillEnabled[f.value])
      // País não tem valor padrão próprio — segue sempre o país padrão global.
      if (f.value === 'country') continue
      quickBillData[`default_${f.value}`] = quickBillDefaults[f.value] ?? ''
    }
    saveQuickBillConfigLocal(quickBillData)
    const quickBillVal = JSON.stringify(quickBillData)
    tasks.push({
      label: 'Cadastro Rápido — Contas a Pagar',
      promise: (quickBillRecord
        ? walletApi.edit(quickBillRecord.id, 'finance_quick_bill_config', quickBillVal, quickBillRecord.creationDate)
        : walletApi.register('finance_quick_bill_config', quickBillVal)
      ).then(res => {
        if (!quickBillRecord) {
          const newRec = (res as { output?: { data?: WalletRecord } })?.output?.data
          if (newRec) setQuickBillRecord(newRec)
        }
      }),
    })

    const results = await Promise.allSettled(tasks.map(t => t.promise))
    const failed = tasks.filter((_, i) => results[i].status === 'rejected').map(t => t.label)

    setSaving(false)
    if (failed.length > 0) {
      setSaveError(`Não sincronizou com o servidor: ${failed.join(', ')}. Os valores ficaram salvos só neste navegador — tente salvar de novo.`)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  function setQuickDefault(key: QuickBillFieldKey, value: string) {
    setQuickBillDefaults(q => ({ ...q, [key]: value }))
  }

  function renderQuickDefaultInput(key: QuickBillFieldKey) {
    const val = quickBillDefaults[key]
    switch (key) {
      case 'account':
        return (
          <select className="input w-full text-sm" value={val} onChange={e => setQuickDefault(key, e.target.value)}>
            <option value="">Selecione...</option>
            {accounts.filter(a => a.enable).map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
        )
      case 'category':
        return <SearchableSelect value={val} options={quickBillCategories} onChange={v => setQuickDefault(key, v)} />
      case 'country':
        return (
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Segue o país padrão definido na aba <strong>Países</strong>
          </p>
        )
      case 'frequence':
        return (
          <select className="input w-full text-sm" value={val} onChange={e => setQuickDefault(key, e.target.value)}>
            {frequences.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        )
      case 'registrationType':
        return (
          <select className="input w-full text-sm" value={val} onChange={e => setQuickDefault(key, e.target.value)}>
            {regTypes.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )
      case 'additionalMessage':
        return (
          <input className="input w-full text-sm" value={val} onChange={e => setQuickDefault(key, e.target.value)}
            placeholder="Observação padrão (opcional)" />
        )
    }
  }

  function moveContasPagarColumn(index: number, dir: -1 | 1) {
    setContasPagarColumnsOrder(order => {
      const target = index + dir
      if (target < 0 || target >= order.length) return order
      const next = [...order]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function toggleContasPagarColumnHidden(key: ContasPagarColumnKey) {
    setContasPagarColumnsHidden(h => ({ ...h, [key]: !h[key] }))
  }

  function moveDespesaVerRegistrosField(index: number, dir: -1 | 1) {
    setDespesaVerRegistrosOrder(order => {
      const target = index + dir
      if (target < 0 || target >= order.length) return order
      const next = [...order]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function toggleDespesaVerRegistrosFieldHidden(key: DespesaVerRegistrosFieldKey) {
    setDespesaVerRegistrosHidden(h => ({ ...h, [key]: !h[key] }))
  }

  function addCountry() {
    const code = newCountryCode
    if (!code || activeCountryCodes.includes(code)) return
    setActiveCountryCodes(codes => [...codes, code])
    setNewCountryCode('')
  }

  // Nunca deixa remover o último país — sempre precisa sobrar pelo menos um,
  // senão nenhum formulário de cadastro teria o que oferecer.
  function removeCountry(code: string) {
    setActiveCountryCodes(codes => {
      if (codes.length === 1) return codes
      const next = codes.filter(c => c !== code)
      if (defaultCountryCode === code) setDefaultCountryCode(next[0])
      return next
    })
  }

  return (
    <div className="animate-slide-up space-y-6 max-w-3xl">
      <PageHeader
        title="Configurações"
        subtitle="Preferências e parâmetros da aplicação"
        action={
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? <Spinner size={15} /> : saved ? <Check size={15} /> : saveError ? <AlertTriangle size={15} /> : <Save size={15} />}
            {saving ? 'Salvando…' : saved ? 'Salvo!' : saveError ? 'Falhou — tentar de novo' : 'Salvar'}
          </button>
        }
      />

      {saveError && (
        <div className="flex items-start gap-2.5 rounded-xl px-4 py-3" style={{ background: 'var(--red-dim)', border: '1px solid rgba(248,113,113,0.3)' }}>
          <AlertTriangle size={15} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs" style={{ color: 'var(--text-2)' }}>{saveError}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Sidebar nav (desktop) ── */}
        <aside className="hidden lg:flex flex-col gap-0.5 w-48 flex-shrink-0 pt-1">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
                style={active ? {
                  background: 'var(--green-dim)',
                  color: 'var(--green-400)',
                  border: '1px solid var(--green-border)',
                } : {
                  color: 'var(--text-2)',
                  background: 'transparent',
                  border: '1px solid transparent',
                }}
              >
                <Icon size={15} className="flex-shrink-0" />
                {label}
              </button>
            )
          })}
        </aside>

        {/* ── Top tabs (mobile) ── */}
        <div
          className="flex lg:hidden"
          style={{ borderBottom: '1px solid var(--border-1)' }}
        >
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors"
                style={{
                  color: active ? 'var(--green-400)' : 'var(--text-3)',
                  borderBottom: active ? '2px solid var(--green-400)' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            )
          })}
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Formulários */}
          {activeTab === 'formularios' && (
            <>
              <div
                className="card p-5"
                style={{ border: '1px solid var(--border-1)' }}
              >
                <Section
                  title="Frequências"
                  subtitle="Opções do campo Frequência nos formulários de cadastro"
                >
                  <ChipList
                    items={frequences}
                    onChange={setFrequences}
                    onReset={() => setFrequences([...DEFAULT_FREQUENCES])}
                  />
                </Section>
              </div>

              <div
                className="card p-5"
                style={{ border: '1px solid var(--border-1)' }}
              >
                <Section
                  title="Tipos de Registro"
                  subtitle="Opções do campo Tipo de Registro nos formulários de cadastro"
                >
                  <ChipList
                    items={regTypes}
                    onChange={setRegTypes}
                    onReset={() => setRegTypes([...DEFAULT_REGISTRATION_TYPES])}
                  />
                </Section>
              </div>

              <div className="card p-5" style={{ border: '1px solid var(--border-1)' }}>
                <Section
                  title="Cadastro Rápido — Contas a Pagar"
                  subtitle="Campos que aparecem no formulário simplificado ao clicar em 'Nova conta'. Campos desligados não são perguntados — usam o valor padrão definido abaixo."
                >
                  <div>
                    {QUICK_BILL_FIELDS.map(f => {
                      const on = quickBillEnabled[f.value]
                      return (
                        <div
                          key={f.value}
                          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3"
                          style={{ borderBottom: '1px solid var(--border-1)' }}
                        >
                          <label className="flex items-center gap-2 cursor-pointer select-none sm:w-52 flex-shrink-0">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={e => setQuickBillEnabled(q => ({ ...q, [f.value]: e.target.checked }))}
                              className="w-4 h-4 rounded accent-green-500"
                            />
                            <span className="text-sm font-medium" style={{ color: on ? 'var(--text-1)' : 'var(--text-2)' }}>
                              {f.label}
                            </span>
                          </label>
                          <div className="flex-1 min-w-0">
                            {on ? (
                              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                                Aparece no cadastro rápido
                              </span>
                            ) : (
                              <div className="max-w-xs">
                                <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Valor padrão usado</p>
                                {renderQuickDefaultInput(f.value)}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              </div>
            </>
          )}

          {/* Contas */}
          {activeTab === 'contas' && (
            <>
              {/* Saldo disponível — primeiro para não sumir atrás da lista */}
              <div className="card p-5" style={{ border: '1px solid var(--border-1)' }}>
                <Section
                  title="Saldo Disponível em Contas a Pagar"
                  subtitle="O saldo dessas contas em Contas a Receber será exibido na tela de Contas a Pagar"
                >
                  <ChipList
                    items={saldoContas}
                    onChange={setSaldoContas}
                    onReset={() => setSaldoContas([...DEFAULT_SALDO_CONTAS])}
                    options={availableAccounts}
                    emptyLabel="Nenhuma conta selecionada."
                  />
                </Section>
              </div>

              {/* Lista de contas */}
              <div className="card overflow-hidden" style={{ border: '1px solid var(--border-1)' }}>
                <div
                  className="px-4 py-3 flex flex-wrap items-center gap-3"
                  style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-3)' }}
                >
                  <Building2 size={14} style={{ color: 'var(--text-2)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                    Contas cadastradas
                  </span>
                  {!accountsLoading && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-mono"
                      style={{ background: 'var(--bg-5)', color: 'var(--text-3)' }}>
                      {accounts.filter(a => a.enable).length} ativas
                      {accounts.filter(a => !a.enable).length > 0 && (
                        <> · {accounts.filter(a => !a.enable).length} inativas</>
                      )}
                    </span>
                  )}
                  {/* Checkbox mostrar inativas */}
                  {!accountsLoading && accounts.some(a => !a.enable) && (
                    <label className="flex items-center gap-1.5 cursor-pointer select-none ml-auto"
                      style={{ color: 'var(--text-3)' }}>
                      <input
                        type="checkbox"
                        checked={showInactive}
                        onChange={e => setShowInactive(e.target.checked)}
                        className="accent-[var(--green-500)] w-3.5 h-3.5"
                      />
                      <span className="text-xs">Mostrar inativas</span>
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => setRegisterOpen(true)}
                    className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"
                    style={!accounts.some(a => !a.enable) ? { marginLeft: 'auto' } : undefined}
                  >
                    <Plus size={13} /> Nova conta
                  </button>
                </div>

                {accountsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Spinner size={22} />
                  </div>
                ) : accounts.length === 0 ? (
                  <p className="text-xs text-center py-8" style={{ color: 'var(--text-3)' }}>
                    Nenhuma conta encontrada.
                  </p>
                ) : (
                  (() => {
                    const visible = accounts.filter(a => showInactive || a.enable)
                    const cards   = visible.filter(a => a.isCreditCard)
                    const banks   = visible.filter(a => !a.isCreditCard)
                    return (
                      <div>
                        {/* Cartões de Crédito — primeiro */}
                        {cards.length > 0 && (
                          <>
                            <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border-1)' }}>
                              <span className="text-xs font-medium uppercase tracking-wider"
                                style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>
                                Cartões de Crédito
                              </span>
                            </div>
                            {cards.map(a => (
                              <AccountRow
                                key={a.id}
                                account={a}
                                onEdit={setEditTarget}
                                onDelete={setDeleteTarget}
                              />
                            ))}
                          </>
                        )}
                        {/* Contas bancárias */}
                        {banks.length > 0 && (
                          <>
                            <div className="px-4 py-2"
                              style={{ borderTop: cards.length > 0 ? '1px solid var(--border-1)' : undefined, borderBottom: '1px solid var(--border-1)' }}>
                              <span className="text-xs font-medium uppercase tracking-wider"
                                style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>
                                Contas Bancárias
                              </span>
                            </div>
                            {banks.map(a => (
                              <AccountRow
                                key={a.id}
                                account={a}
                                onEdit={setEditTarget}
                                onDelete={setDeleteTarget}
                              />
                            ))}
                          </>
                        )}
                        {visible.length === 0 && (
                          <p className="text-xs text-center py-8" style={{ color: 'var(--text-3)' }}>
                            Nenhuma conta ativa encontrada.
                          </p>
                        )}
                      </div>
                    )
                  })()
                )}
              </div>

              {registerOpen && (
                <AccountFormModal
                  onClose={() => setRegisterOpen(false)}
                  onSaved={loadAccounts}
                />
              )}

              {editTarget && (
                <AccountFormModal
                  account={editTarget}
                  onClose={() => setEditTarget(null)}
                  onSaved={() => { setEditTarget(null); loadAccounts() }}
                />
              )}

              {deleteTarget && (
                <Modal
                  open
                  title="Excluir conta"
                  onClose={() => { setDeleteTarget(null); setDeleteError('') }}
                >
                  <div className="space-y-4">
                    <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                      Tem certeza que deseja excluir a conta{' '}
                      <strong style={{ color: 'var(--text-1)' }}>{deleteTarget.name}</strong>?
                      Esta ação não pode ser desfeita.
                    </p>
                    {deleteError && (
                      <p className="text-xs px-3 py-2 rounded-lg"
                        style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
                        {deleteError}
                      </p>
                    )}
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => { setDeleteTarget(null); setDeleteError('') }}
                        className="btn-secondary"
                        disabled={deleteLoading}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleteLoading}
                        className="btn-primary"
                        style={{ background: 'var(--red)', borderColor: 'var(--red)' }}
                      >
                        {deleteLoading ? <Spinner size={14} /> : <Trash2 size={14} />}
                        {deleteLoading ? 'Excluindo…' : 'Excluir'}
                      </button>
                    </div>
                  </div>
                </Modal>
              )}
            </>
          )}

          {/* Países */}
          {activeTab === 'paises' && (
            <div className="card p-5" style={{ border: '1px solid var(--border-1)' }}>
              <Section
                title="Países"
                subtitle="Quais países você usa e qual é o padrão. O padrão vem pré-selecionado ao cadastrar algo novo, mas dá pra escolher qualquer outro da lista nesse lançamento. Remover um país não apaga nem esconde nada que já existe: registros antigos continuam visíveis e filtráveis normalmente."
              >
                <div className="flex gap-2 mb-4">
                  <select
                    className="input flex-1"
                    value={newCountryCode}
                    onChange={e => setNewCountryCode(e.target.value)}
                  >
                    <option value="">Adicionar país...</option>
                    {COUNTRY_CATALOG.filter((c: CountryCurrencyInfo) => !activeCountryCodes.includes(c.code)).map((c: CountryCurrencyInfo) => (
                      <option key={c.code} value={c.code}>{c.code} — {c.currency}</option>
                    ))}
                  </select>
                  <button type="button" onClick={addCountry} disabled={!newCountryCode} className="btn-secondary flex-shrink-0 disabled:opacity-40">
                    <Plus size={15} /> Adicionar
                  </button>
                </div>

                <div className="space-y-2">
                  {activeCountryCodes.map(code => {
                    const info = COUNTRY_CATALOG.find((c: CountryCurrencyInfo) => c.code === code)
                    const isDefault = defaultCountryCode === code
                    const isOnlyOne = activeCountryCodes.length === 1
                    return (
                      <div
                        key={code}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg"
                        style={{
                          background: isDefault ? 'var(--green-dim)' : 'var(--bg-3)',
                          border: `1px solid ${isDefault ? 'var(--green-border)' : 'var(--border-1)'}`,
                        }}
                      >
                        <CountryFlag code={code} size={18} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{code}</span>
                          {info && <span className="text-xs ml-2" style={{ color: 'var(--text-3)' }}>{info.currency}</span>}
                        </div>
                        {isDefault ? (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0" style={{ color: 'var(--green-400)' }}>
                            Padrão
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDefaultCountryCode(code)}
                            className="text-xs px-2.5 py-1 rounded-full border flex-shrink-0 transition-colors hover:bg-[var(--bg-4)]"
                            style={{ borderColor: 'var(--border-1)', color: 'var(--text-3)' }}
                          >
                            Definir como padrão
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeCountry(code)}
                          disabled={isOnlyOne}
                          title={isOnlyOne ? 'Precisa manter pelo menos um país' : 'Remover'}
                          className="p-1.5 rounded-md flex-shrink-0 transition-colors hover:bg-[var(--red-dim)] disabled:opacity-30 disabled:hover:bg-transparent"
                          style={{ color: 'var(--text-3)' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </Section>
            </div>
          )}

          {/* Gráfico */}
          {activeTab === 'grafico' && (
            <div
              className="card overflow-hidden"
              style={{ border: '1px solid var(--border-1)' }}
            >
              <div
                className="px-5 py-4"
                style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-3)' }}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp size={15} style={{ color: 'var(--green-400)' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                      Evolução Financeira
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                      Parâmetros usados no gráfico do Dashboard
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="label">Nome do PLR</label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
                    Busca recebíveis com esse nome nos próximos 24 meses e soma à receita Brasil.
                  </p>
                  <input
                    className="input w-full"
                    value={plrName}
                    onChange={e => setPlrName(e.target.value)}
                    placeholder="Ex: PLR - Ciclo 2 - 2025 de méritocracia"
                  />
                </div>

                <div>
                  <label className="label">Mês/Ano do Saldo Final</label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
                    Mês em que o Saldo Final da Carteira entra na receita Brasil.
                  </p>
                  <YearMonthSelector value={saldoFinalYm || currentYearMonth()} onChange={setSaldoFinalYm} />
                </div>

                <div>
                  <label className="label">Categoria Vale Alimentação/Refeição</label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
                    Categoria somada na receita Brasil do mês configurado.
                  </p>
                  <input
                    className="input w-full"
                    value={valeCategoria}
                    onChange={e => setValeCategoria(e.target.value)}
                    placeholder="Ex: Vale Alimentação/Refeição"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label">Grupo Conta Bancária Espanha</label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
                    Nome exato do grupo na Carteira para o acumulado de investimento Espanha.
                  </p>
                  <input
                    className="input w-full"
                    value={nomeGrupoEspanha}
                    onChange={e => setNomeGrupoEspanha(e.target.value)}
                    placeholder="Ex: Conta Bancária Espanha"
                  />
                </div>

                <div>
                  <label className="label">Grupo de Investimentos</label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
                    Nome do grupo na Carteira para a projeção de investimentos.
                  </p>
                  <input
                    className="input w-full"
                    value={nomeGrupoInvestimento}
                    onChange={e => setNomeGrupoInvestimento(e.target.value)}
                    placeholder="Ex: Investimentos"
                  />
                </div>

                <div>
                  <label className="label">Grupo Contas Bancárias</label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
                    Nome do grupo na Carteira usado no Saldo Final do gráfico e no destino de transferências entre caixinhas.
                  </p>
                  <input
                    className="input w-full"
                    value={nomeGrupoContasBancarias}
                    onChange={e => setNomeGrupoContasBancarias(e.target.value)}
                    placeholder="Ex: Contas Bancárias"
                  />
                </div>

                <div>
                  <label className="label">Anos de projeção</label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
                    Quantos anos à frente projetar o valor dos investimentos (1–10).
                  </p>
                  <input
                    className="input w-full"
                    type="number"
                    min={1}
                    max={10}
                    value={investimentoAnosProjecao}
                    onChange={e => setInvestimentoAnosProjecao(e.target.value)}
                    placeholder="5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Despesas por Mês/Ano */}
          {activeTab === 'grafico' && (
            <div
              className="card overflow-hidden"
              style={{ border: '1px solid var(--border-1)' }}
            >
              <div
                className="px-5 py-4"
                style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-3)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={15} style={{ color: 'var(--green-400)' }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                        Despesas por Mês/Ano
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                        Filtro padrão aplicado ao abrir esse gráfico no Dashboard
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={despesaMesFiltrarAnoAtual}
                      onChange={e => setDespesaMesFiltrarAnoAtual(e.target.checked)}
                      className="w-4 h-4 rounded accent-green-500"
                    />
                    <span className="text-xs font-medium" style={{ color: despesaMesFiltrarAnoAtual ? 'var(--green-400)' : 'var(--text-3)' }}>
                      Filtrar ano atual
                    </span>
                  </label>
                </div>
              </div>

              <div className="p-5 space-y-5">
                <div>
                  <label className="label">Categoria padrão</label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
                    Categoria pré-selecionada ao abrir o gráfico. Deixe em branco para não filtrar nenhuma.
                  </p>
                  <input
                    className="input w-full"
                    value={despesaMesCategoriaPadrao}
                    onChange={e => setDespesaMesCategoriaPadrao(e.target.value)}
                    placeholder={DESPESA_MES_DEFAULT_CATEGORIA}
                  />
                </div>
                <div>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
                    Cor usada para destacar gastos projetados (conta/fatura fixa ainda não paga) nas colunas e nos cards de resumo do gráfico.
                  </p>
                  <ColorPickerField
                    label="Cor do projetado"
                    value={despesaMesCorProjetado}
                    onChange={setDespesaMesCorProjetado}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Despesas por Mês/Ano — campos do painel expandido do "Ver registros" */}
          {activeTab === 'grafico' && (
            <div className="card p-5" style={{ border: '1px solid var(--border-1)' }}>
              <Section
                title='Campos do "Ver registros" — Despesas por Mês/Ano'
                subtitle='A linha principal (Descrição/Valor/Data de Compra/Status/Ações) é fixa, igual ao modal "Registros Relacionados" de Contas a Pagar. Escolha quais campos extras aparecem ao clicar numa linha para expandi-la, e em que ordem.'
              >
                <div>
                  {despesaVerRegistrosOrder.map((key, idx) => {
                    const field = DESPESA_VER_REGISTROS_FIELDS.find(f => f.value === key)
                    if (!field) return null
                    const hidden = !!despesaVerRegistrosHidden[key]
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-3 py-2.5"
                        style={{ borderBottom: idx < despesaVerRegistrosOrder.length - 1 ? '1px solid var(--border-1)' : undefined }}
                      >
                        <div className="flex flex-col flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => moveDespesaVerRegistrosField(idx, -1)}
                            disabled={idx === 0}
                            className="p-0.5 rounded disabled:opacity-20"
                            style={{ color: 'var(--text-3)' }}
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveDespesaVerRegistrosField(idx, 1)}
                            disabled={idx === despesaVerRegistrosOrder.length - 1}
                            className="p-0.5 rounded disabled:opacity-20"
                            style={{ color: 'var(--text-3)' }}
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
                          <input
                            type="checkbox"
                            checked={!hidden}
                            onChange={() => toggleDespesaVerRegistrosFieldHidden(key)}
                            className="w-4 h-4 rounded accent-green-500"
                          />
                          <span className="text-sm font-medium" style={{ color: hidden ? 'var(--text-3)' : 'var(--text-1)' }}>
                            {field.label}
                          </span>
                        </label>
                      </div>
                    )
                  })}
                </div>
              </Section>
            </div>
          )}

          {/* Alertas */}
          {activeTab === 'alertas' && (
            <div
              className="card overflow-hidden"
              style={{ border: '1px solid var(--border-1)' }}
            >
              <div
                className="px-5 py-4"
                style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-3)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Bell size={15} style={{ color: 'var(--green-400)' }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                        Dados desatualizados
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                        Pop-up exibido quando o alerta de "registros pendentes de cadastro" some do topo da tela
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={staleAlertAtivo}
                      onChange={e => setStaleAlertAtivo(e.target.checked)}
                      className="w-4 h-4 rounded accent-green-500"
                    />
                    <span className="text-xs font-medium" style={{ color: staleAlertAtivo ? 'var(--green-400)' : 'var(--text-3)' }}>
                      {staleAlertAtivo ? 'Ativado' : 'Desativado'}
                    </span>
                  </label>
                </div>
              </div>

              <div
                className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5"
                style={{ opacity: staleAlertAtivo ? 1 : 0.5, pointerEvents: staleAlertAtivo ? 'auto' : 'none' }}
              >
                <div className="sm:col-span-2">
                  <label className="label">Mensagem do pop-up</label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
                    Texto exibido pedindo para o usuário atualizar a tela.
                  </p>
                  <textarea
                    className="input w-full"
                    rows={3}
                    value={staleAlertMensagem}
                    onChange={e => setStaleAlertMensagem(e.target.value)}
                    placeholder={STALE_ALERT_DEFAULT_MENSAGEM}
                    disabled={!staleAlertAtivo}
                  />
                </div>

                <div>
                  <label className="label">Repetir a cada (minutos)</label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
                    Se o usuário optar por não atualizar agora, o pop-up volta a aparecer após esse intervalo.
                  </p>
                  <input
                    className="input w-full"
                    type="number"
                    min={1}
                    max={120}
                    value={staleAlertIntervaloMinutos}
                    onChange={e => setStaleAlertIntervaloMinutos(e.target.value)}
                    placeholder={String(STALE_ALERT_DEFAULT_INTERVALO_MINUTOS)}
                    disabled={!staleAlertAtivo}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Contas a Pagar/Receber — ordenação padrão das tabelas */}
          {activeTab === 'ordenacao' && (
            <>
              <div className="card p-5" style={{ border: '1px solid var(--border-1)' }}>
                <Section
                  title="Ordenação da tabela — Contas a Pagar"
                  subtitle="Ordem aplicada por padrão ao abrir a tela. O usuário ainda pode clicar em qualquer coluna da tabela para reordenar naquela sessão."
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Coluna</label>
                      <select
                        className="input w-full"
                        value={contasPagarSortCol}
                        onChange={e => setContasPagarSortCol(e.target.value as ContasPagarSortCol)}
                      >
                        {CONTAS_PAGAR_SORT_COLUMNS.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    {contasPagarSortCol !== 'default' && (
                      <div>
                        <label className="label">Direção</label>
                        <select
                          className="input w-full"
                          value={contasPagarSortDir}
                          onChange={e => setContasPagarSortDir(e.target.value as 'asc' | 'desc')}
                        >
                          <option value="asc">Crescente</option>
                          <option value="desc">Decrescente</option>
                        </select>
                      </div>
                    )}
                  </div>
                </Section>
              </div>

              <div className="card p-5" style={{ border: '1px solid var(--border-1)' }}>
                <Section
                  title="Ordenação da tabela — Contas a Receber"
                  subtitle="Ordem aplicada por padrão ao abrir a tela. O usuário ainda pode clicar em qualquer coluna da tabela para reordenar naquela sessão."
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Coluna</label>
                      <select
                        className="input w-full"
                        value={contasReceberSortCol}
                        onChange={e => setContasReceberSortCol(e.target.value as ContasReceberSortCol)}
                      >
                        {CONTAS_RECEBER_SORT_COLUMNS.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    {contasReceberSortCol !== 'default' && (
                      <div>
                        <label className="label">Direção</label>
                        <select
                          className="input w-full"
                          value={contasReceberSortDir}
                          onChange={e => setContasReceberSortDir(e.target.value as 'asc' | 'desc')}
                        >
                          <option value="asc">Crescente</option>
                          <option value="desc">Decrescente</option>
                        </select>
                      </div>
                    )}
                  </div>
                </Section>
              </div>

              <div className="card p-5" style={{ border: '1px solid var(--border-1)' }}>
                <Section
                  title="Identidade visual por conta — Contas a Pagar"
                  subtitle="Como destacar visualmente de qual conta é cada linha da tabela, sem precisar ler a coluna Conta."
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CONTAS_PAGAR_ACCOUNT_STYLE_OPTIONS.map(opt => {
                      const active = contasPagarAccountStyle === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setContasPagarAccountStyle(opt.value)}
                          className="text-left p-3 rounded-lg transition-all"
                          style={{
                            background: active ? 'var(--green-dim)' : 'var(--bg-3)',
                            border: `1px solid ${active ? 'var(--green-border)' : 'var(--border-1)'}`,
                          }}
                        >
                          <p className="text-sm font-medium" style={{ color: active ? 'var(--green-400)' : 'var(--text-1)' }}>
                            {opt.label}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                            {opt.description}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </Section>
              </div>

              <div className="card p-5" style={{ border: '1px solid var(--border-1)' }}>
                <Section
                  title="Colunas da tabela — Contas a Pagar"
                  subtitle="Escolha quais colunas mostrar na tabela e em que ordem — use as setas para reordenar. A coluna de seleção e a de Ações não entram aqui, por não serem informação."
                >
                  <div>
                    {contasPagarColumnsOrder.map((key, idx) => {
                      const col = CONTAS_PAGAR_COLUMNS.find(c => c.value === key)
                      if (!col) return null
                      const hidden = !!contasPagarColumnsHidden[key]
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-3 py-2.5"
                          style={{ borderBottom: idx < contasPagarColumnsOrder.length - 1 ? '1px solid var(--border-1)' : undefined }}
                        >
                          <div className="flex flex-col flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => moveContasPagarColumn(idx, -1)}
                              disabled={idx === 0}
                              className="p-0.5 rounded disabled:opacity-20"
                              style={{ color: 'var(--text-3)' }}
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveContasPagarColumn(idx, 1)}
                              disabled={idx === contasPagarColumnsOrder.length - 1}
                              className="p-0.5 rounded disabled:opacity-20"
                              style={{ color: 'var(--text-3)' }}
                            >
                              <ArrowDown size={13} />
                            </button>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
                            <input
                              type="checkbox"
                              checked={!hidden}
                              onChange={() => toggleContasPagarColumnHidden(key)}
                              className="w-4 h-4 rounded accent-green-500"
                            />
                            <span className="text-sm font-medium" style={{ color: hidden ? 'var(--text-3)' : 'var(--text-1)' }}>
                              {col.label}
                            </span>
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

export default function ConfiguracoesPage() {
  return <AppLayout><ConfiguracoesInner /></AppLayout>
}
