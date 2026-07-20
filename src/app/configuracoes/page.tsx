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
  Pencil, Trash2,
} from 'lucide-react'
import { walletApi, accountsApi } from '@/lib/api'
import type { WalletRecord, RegisterAccountViewModel, EditAccountViewModel } from '@/lib/api'
import { YearMonthSelector } from '@/components/ui/YearMonthSelector'
import { currentYearMonth } from '@/lib/utils'

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
      }
      if (isCreditCard) {
        if (form.cardNumber)           payload.cardNumber           = form.cardNumber
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

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )

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

// ─── Tabs definition ──────────────────────────────────────────────────────────

type TabId = 'formularios' | 'contas' | 'grafico'

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: 'formularios', label: 'Formulários',   Icon: SlidersHorizontal },
  { id: 'contas',      label: 'Contas',         Icon: Building2         },
  { id: 'grafico',     label: 'Gráfico',        Icon: TrendingUp        },
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
  const [graficoMesAnoInicial,     setGraficoMesAnoInicial]     = useState('')
  const [valeCategoria,            setValeCategoria]            = useState('')
  const [nomeGrupoEspanha,         setNomeGrupoEspanha]         = useState('')
  const [nomeGrupoInvestimento,    setNomeGrupoInvestimento]    = useState('')
  const [investimentoAnosProjecao, setInvestimentoAnosProjecao] = useState('5')
  const [chartRecords,             setChartRecords]             = useState<WalletRecord[]>([])

  const [saved, setSaved] = useState(false)

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
    setGraficoMesAnoInicial(c.graficoMesAnoInicial ?? '')
    setValeCategoria(c.valeCategoria ?? 'Vale Alimentação/Refeição')
    setNomeGrupoEspanha(c.nomeGrupoEspanha ?? 'Conta Bancária Espanha')
    setNomeGrupoInvestimento(c.nomeGrupoInvestimento ?? 'Investimentos')
    setInvestimentoAnosProjecao(c.investimentoAnosProjecao ?? '5')

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
          setGraficoMesAnoInicial(p.graficoMesAnoInicial ?? '')
          setValeCategoria(p.valeCategoria ?? '')
          setNomeGrupoEspanha(p.nomeGrupoEspanha ?? '')
          setNomeGrupoInvestimento(p.nomeGrupoInvestimento ?? 'Investimentos')
          setInvestimentoAnosProjecao(p.investimentoAnosProjecao ?? '5')
        } catch {}
      }

      const saldoRec = records.find(r => r.walletKey === 'finance_saldo_contas')
      setSaldoContasRecord(saldoRec ?? null)
      if (saldoRec?.walletValue) {
        try { setSaldoContas(JSON.parse(saldoRec.walletValue)) } catch {}
      }
    }).catch(() => {})
  }, [])

  function save() {
    // Formulários → localStorage
    saveFrequences(frequences)
    saveRegistrationTypes(regTypes)

    // Saldo contas → API
    const saldoVal = JSON.stringify(saldoContas)
    const saldoPromise = saldoContasRecord
      ? walletApi.edit(saldoContasRecord.id, 'finance_saldo_contas', saldoVal, saldoContasRecord.creationDate)
      : walletApi.register('finance_saldo_contas', saldoVal)
    saldoPromise
      .then(res => {
        if (!saldoContasRecord) {
          const newRec = (res as { output?: { data?: WalletRecord } })?.output?.data
          if (newRec) setSaldoContasRecord(newRec)
        }
      })
      .catch(() => {})

    // Gráfico → localStorage + API
    const data = { name: plrName, saldoFinalYm, graficoMesAnoInicial, valeCategoria, nomeGrupoEspanha, nomeGrupoInvestimento, investimentoAnosProjecao }
    savePlrConfigAll(data)
    const existing = chartRecords.find(r => r.walletKey === 'finance_plr_config')
    const plrPromise = existing
      ? walletApi.edit(existing.id, 'finance_plr_config', JSON.stringify(data), existing.creationDate)
      : walletApi.register('finance_plr_config', JSON.stringify(data))
    plrPromise.catch(() => {})

    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="animate-slide-up space-y-6 max-w-3xl">
      <PageHeader
        title="Configurações"
        subtitle="Preferências e parâmetros da aplicação"
        action={
          <button onClick={save} className="btn-primary">
            {saved ? <Check size={15} /> : <Save size={15} />}
            {saved ? 'Salvo!' : 'Salvar'}
          </button>
        }
      />

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
                  <label className="label">Mês/Ano inicial do gráfico</label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
                    A partir de qual mês o filtro Personalizar do gráfico passa a listar os anos.
                  </p>
                  <YearMonthSelector value={graficoMesAnoInicial || currentYearMonth()} onChange={setGraficoMesAnoInicial} />
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

        </div>
      </div>
    </div>
  )
}

export default function ConfiguracoesPage() {
  return <AppLayout><ConfiguracoesInner /></AppLayout>
}
