'use client'

import { AppLayout } from '@/components/layout/AppLayout'
import { walletApi } from '@/lib/api'
import type { WalletRecord } from '@/lib/api'
import { useState, useEffect, useCallback } from 'react'
import { PageHeader, Spinner, Modal } from '@/components/ui'
import { billsToPayApi, cashReceivableApi } from '@/lib/api'
import { formatCurrency, currentYearMonth, formatYearMonth } from '@/lib/utils'
import { loadSaldoFinalYm } from '@/lib/wallet'
import { YearMonthSelector } from '@/components/ui/YearMonthSelector'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import {
  Plus, Trash2, Edit2, GripVertical,
  TrendingUp, TrendingDown, Wallet, RefreshCw, ChevronDown, ChevronRight,
} from 'lucide-react'

function FlagBR({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'inline-block', verticalAlign: 'middle', borderRadius: 2, flexShrink: 0 }}>
      <rect width="64" height="64" fill="#009739" />
      <polygon points="32,8 60,32 32,56 4,32" fill="#FEDD00" />
      <circle cx="32" cy="32" r="12" fill="#012169" />
      <path d="M20,32 Q32,26 44,32 Q32,38 20,32Z" fill="white" />
    </svg>
  )
}

function FlagES({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'inline-block', verticalAlign: 'middle', borderRadius: 2, flexShrink: 0 }}>
      <rect width="64" height="16" fill="#c60b1e" />
      <rect y="16" width="64" height="32" fill="#ffc400" />
      <rect y="48" width="64" height="16" fill="#c60b1e" />
    </svg>
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface WalletBox {
  id: string
  label: string
  value: string       // valor numérico como string
  currency: 'Brasil' | 'Espanha'
  color: string       // hex da caixinha
}

interface WalletGroup {
  id: string
  label: string
  collapsed: boolean
  boxes: WalletBox[]
}

interface WalletData {
  groups: WalletGroup[]
}

const STORAGE_KEY = 'finance_wallet'

const BOX_COLORS = [
  '#16a34a', '#2563eb', '#7c3aed', '#db2777',
  '#ea580c', '#0891b2', '#65a30d', '#d97706',
]

function genId() { return Math.random().toString(36).slice(2) }

function loadWalletFromStorage(): WalletData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  // Default inicial
  return {
    groups: [
      {
        id: genId(),
        label: 'Contas Bancárias',
        collapsed: false,
        boxes: [
          { id: genId(), label: 'Conta Itaú', value: '0', currency: 'Brasil', color: '#2563eb' },
        ],
      },
      {
        id: genId(),
        label: 'Investimentos',
        collapsed: false,
        boxes: [
          { id: genId(), label: 'Carteira XP', value: '0', currency: 'Brasil', color: '#16a34a' },
        ],
      },
    ],
  }
}

function saveWalletToStorage(data: WalletData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// ─── Inline editable label ───────────────────────────────────────────────────

function EditableLabel({ value, onSave, className, style }: {
  value: string
  onSave: (v: string) => void
  className?: string
  style?: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() {
    if (draft.trim()) onSave(draft.trim())
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="bg-transparent border-b outline-none text-sm font-medium"
        style={{ color: 'var(--text-1)', borderColor: 'var(--green-400)', ...style }}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      />
    )
  }
  return (
    <span
      className={`cursor-pointer hover:opacity-70 transition-opacity ${className}`}
      style={style}
      onClick={() => { setDraft(value); setEditing(true) }}
      title="Clique para editar"
    >
      {value}
    </span>
  )
}

// ─── Box Card (somente leitura — toda ação fica dentro do modal de edição) ────

function BoxCard({ box, dragging, dragOverActive, onClick, onDragStart, onDragOver, onDrop, onDragEnd }: {
  box: WalletBox
  dragging: boolean
  dragOverActive: boolean
  onClick: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  // `draggable` só fica ativo enquanto o usuário segura a alça (GripVertical) —
  // deixar o card inteiro sempre "draggable" faz o navegador às vezes interpretar
  // um clique normal como o início de um arraste (mousedown + micro-movimento) e
  // engolir o evento de click, exigindo um segundo toque pra abrir o modal.
  const [dragEnabled, setDragEnabled] = useState(false)

  return (
    <div
      draggable={dragEnabled}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={() => { setDragEnabled(false); onDragEnd() }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      title="Toque para editar"
      className="rounded-xl p-4 flex flex-col gap-3 relative group cursor-pointer transition-all"
      style={{
        background: `${box.color}18`,
        border: `1px solid ${dragOverActive ? box.color : `${box.color}44`}`,
        borderLeft: `3px solid ${box.color}`,
        opacity: dragging ? 0.4 : 1,
        outline: dragOverActive ? `2px dashed ${box.color}` : 'none',
        outlineOffset: 2,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: box.color }} />
          <span className="font-medium text-sm truncate" style={{ color: 'var(--text-1)' }}>{box.label}</span>
        </div>
        <span
          className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-3)' }}
          title="Arraste pra reordenar"
          onMouseDown={e => { e.stopPropagation(); setDragEnabled(true) }}
          onMouseUp={() => setDragEnabled(false)}
          onClick={e => e.stopPropagation()}
        >
          <Edit2 size={12} />
          <GripVertical size={14} style={{ cursor: 'grab' }} />
        </span>
      </div>

      <span className="text-xs font-medium inline-flex items-center gap-1.5"
        style={{ color: box.currency === 'Espanha' ? 'var(--amber)' : 'var(--text-3)' }}>
        {box.currency === 'Espanha' ? <><FlagES size={12} /> Espanha</> : <><FlagBR size={12} /> Brasil</>}
      </span>

      <p className="font-mono font-bold" style={{ fontSize: 20, color: 'var(--text-1)' }}>
        {formatCurrency(parseFloat(box.value) || 0, box.currency)}
      </p>
    </div>
  )
}

// ─── Box Edit Modal — único lugar onde a caixinha pode ser alterada ou excluída

function BoxEditModal({ box, onSave, onDelete, onClose }: {
  box: WalletBox | null
  onSave: (b: WalletBox) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('0')
  const [currency, setCurrency] = useState<'Brasil' | 'Espanha'>('Brasil')
  const [color, setColor] = useState(BOX_COLORS[0])
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    if (!box) return
    setLabel(box.label)
    setValue(box.value)
    setCurrency(box.currency)
    setColor(box.color)
    setConfirmingDelete(false)
  }, [box])

  if (!box) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!box || !label.trim()) return
    onSave({ ...box, label: label.trim(), value, currency, color })
  }

  return (
    <Modal open={!!box} onClose={onClose} title="Editar caixinha" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nome</label>
          <input
            className="input"
            value={label}
            onChange={e => setLabel(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">Moeda</label>
          <div className="flex gap-2">
            {(['Brasil', 'Espanha'] as const).map(c => (
              <button key={c} type="button"
                onClick={() => setCurrency(c)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center justify-center gap-1.5"
                style={{
                  background: currency === c ? `${color}22` : 'var(--bg-3)',
                  color: currency === c ? color : 'var(--text-3)',
                  border: `1px solid ${currency === c ? `${color}66` : 'var(--border-1)'}`,
                }}>
                {c === 'Brasil' ? <><FlagBR size={15} /> Real (R$)</> : <><FlagES size={15} /> Euro (€)</>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Valor</label>
          <CurrencyInput value={value} country={currency} onChange={setValue} autoFocus />
        </div>

        <div>
          <label className="label">Cor</label>
          <div className="flex flex-wrap gap-2">
            {BOX_COLORS.map(c => (
              <button key={c} type="button"
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{ background: c, borderColor: c === color ? 'var(--text-1)' : 'transparent' }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-3" style={{ borderTop: '1px solid var(--border-1)' }}>
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: 'var(--red)' }}>Excluir de vez?</span>
              <button type="button" onClick={onDelete}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'var(--red)', color: '#fff' }}>
                Sim, excluir
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)}
                className="px-2.5 py-1.5 rounded-lg text-xs"
                style={{ color: 'var(--text-3)' }}>
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1.5 text-xs font-medium"
              style={{ color: 'var(--red)' }}>
              <Trash2 size={13} /> Excluir caixinha
            </button>
          )}
          {!confirmingDelete && (
            <button type="submit" className="btn-primary px-4">
              Salvar
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}

// ─── Group ───────────────────────────────────────────────────────────────────

function GroupSection({ group, onUpdate, onDelete, onAddBox }: {
  group: WalletGroup
  onUpdate: (g: WalletGroup) => void
  onDelete: () => void
  onAddBox: () => void
}) {
  const [editingBox, setEditingBox] = useState<WalletBox | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const total = group.boxes.reduce((s, b) => {
    const v = parseFloat(b.value) || 0
    return s + (b.currency === 'Espanha' ? 0 : v) // soma BRL direto
  }, 0)
  const totalEur = group.boxes.reduce((s, b) => {
    return s + (b.currency === 'Espanha' ? parseFloat(b.value) || 0 : 0)
  }, 0)

  function reorderBoxes(from: number, to: number) {
    if (from === to) return
    const boxes = [...group.boxes]
    const [moved] = boxes.splice(from, 1)
    boxes.splice(to, 0, moved)
    onUpdate({ ...group, boxes })
  }

  function handleSaveBox(updated: WalletBox) {
    onUpdate({ ...group, boxes: group.boxes.map(b => b.id === updated.id ? updated : b) })
    setEditingBox(null)
  }

  function handleDeleteBox() {
    if (!editingBox) return
    onUpdate({ ...group, boxes: group.boxes.filter(b => b.id !== editingBox.id) })
    setEditingBox(null)
  }

  return (
    <div className="card overflow-hidden">
      {/* Group header */}
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-1)', background: 'var(--bg-3)' }}>
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => onUpdate({ ...group, collapsed: !group.collapsed })}
            style={{ color: 'var(--text-3)' }}>
            {group.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
          <EditableLabel
            value={group.label}
            onSave={label => onUpdate({ ...group, label })}
            className="font-semibold text-sm"
            style={{ color: 'var(--text-1)' }}
          />
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <span className="text-xs font-mono font-semibold" style={{ color: 'var(--green-400)' }}>
              {formatCurrency(total, 'Brasil')}
            </span>
          )}
          {totalEur > 0 && (
            <span className="text-xs font-mono font-semibold" style={{ color: 'var(--amber)' }}>
              {formatCurrency(totalEur, 'Espanha')}
            </span>
          )}
          <button type="button" onClick={onDelete}
            className="p-1 rounded hover:bg-[var(--red-dim)] transition-colors"
            style={{ color: 'var(--text-3)' }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Boxes */}
      {!group.collapsed && (
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {group.boxes.map((box, idx) => (
              <BoxCard
                key={box.id}
                box={box}
                dragging={dragIndex === idx}
                dragOverActive={overIndex === idx && dragIndex !== null && dragIndex !== idx}
                onClick={() => setEditingBox(box)}
                onDragStart={() => setDragIndex(idx)}
                onDragOver={e => { e.preventDefault(); setOverIndex(idx) }}
                onDrop={() => {
                  if (dragIndex !== null) reorderBoxes(dragIndex, idx)
                  setDragIndex(null); setOverIndex(null)
                }}
                onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
              />
            ))}
            {/* Add box button */}
            <button type="button" onClick={onAddBox}
              className="rounded-xl p-4 flex flex-col items-center justify-center gap-2 min-h-[120px] transition-colors border-2 border-dashed hover:border-[var(--green-border)] hover:bg-[var(--green-dim)]"
              style={{ borderColor: 'var(--border-2)', color: 'var(--text-3)' }}>
              <Plus size={20} />
              <span className="text-xs">Nova caixinha</span>
            </button>
          </div>
        </div>
      )}

      <BoxEditModal
        box={editingBox}
        onSave={handleSaveBox}
        onDelete={handleDeleteBox}
        onClose={() => setEditingBox(null)}
      />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function CarteiraInner() {
  const [wallet, setWallet] = useState<WalletData>({ groups: [] })
  const [ym, setYm] = useState(currentYearMonth())
  const [configLoaded, setConfigLoaded] = useState(false)
  const [pendingBills, setPendingBills] = useState(0)
  const [pendingReceivables, setPendingReceivables] = useState(0)
  const [loadingAPI, setLoadingAPI] = useState(false)
  const [saved, setSaved] = useState(false)

  const [walletRecords, setWalletRecords] = useState<WalletRecord[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')

  useEffect(() => {
    const configured = loadSaldoFinalYm()
    setYm(configured || currentYearMonth())
    setConfigLoaded(true)
  }, [])

  useEffect(() => {
    // Carrega localStorage imediatamente (sem travar UI)
    setWallet(loadWalletFromStorage())
    // Sincroniza com backend
    walletApi.search().then(res => {
      const records = res.output?.data ?? []
      setWalletRecords(records)
      const rec = records.find(r => r.walletKey === 'finance_wallet')
      if (rec?.walletValue) {
        try {
          const parsed = JSON.parse(rec.walletValue)
          setWallet(parsed)
          localStorage.setItem(STORAGE_KEY, rec.walletValue)
        } catch {}
      }
    }).catch(() => { /* usa localStorage como fallback */ })
  }, [])

  const fetchAPI = useCallback(async () => {
    setLoadingAPI(true)
    try {
      const [bills, rec] = await Promise.all([
        billsToPayApi.search({ yearMonth: ym, showDetails: false }),
        cashReceivableApi.search({ yearMonth: ym, showDetails: false }),
      ])
      const pending = (bills.output?.data ?? [])
        .filter(b => !b.hasPay && b.country !== 'Espanha')
        .reduce((s, b) => s + b.value, 0)
      const pendingRec = (rec.output?.data ?? [])
        .filter(r => !r.hasReceived && r.country !== 'Espanha')
        .reduce((s, r) => s + r.value, 0)
      setPendingBills(pending)
      setPendingReceivables(pendingRec)
    } finally {
      setLoadingAPI(false)
    }
  }, [ym])

  useEffect(() => { if (!configLoaded) return; fetchAPI() }, [fetchAPI, configLoaded])

  function updateWallet(next: WalletData) {
    setWallet(next)
    saveWalletToStorage(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    // Persiste no backend
    const existing = walletRecords.find(r => r.walletKey === 'finance_wallet')
    setSyncing(true)
    setSyncError('')
    const savePromise = existing
      ? walletApi.edit(existing.id, 'finance_wallet', JSON.stringify(next), existing.creationDate)
      : walletApi.register('finance_wallet', JSON.stringify(next))
    savePromise
      .then(() => setSyncing(false))
      .catch(() => { setSyncing(false); setSyncError('Falha ao salvar no servidor') })
  }

  function updateGroup(id: string, updated: WalletGroup) {
    updateWallet({ groups: wallet.groups.map(g => g.id === id ? updated : g) })
  }

  function deleteGroup(id: string) {
    updateWallet({ groups: wallet.groups.filter(g => g.id !== id) })
  }

  function addGroup() {
    const g: WalletGroup = {
      id: genId(), label: 'Novo Grupo', collapsed: false,
      boxes: [{ id: genId(), label: 'Nova caixinha', value: '0', currency: 'Brasil', color: BOX_COLORS[0] }],
    }
    updateWallet({ groups: [...wallet.groups, g] })
  }

  function addBox(groupId: string) {
    updateWallet({
      groups: wallet.groups.map(g => g.id !== groupId ? g : {
        ...g,
        boxes: [...g.boxes, { id: genId(), label: 'Nova caixinha', value: '0', currency: 'Brasil', color: BOX_COLORS[g.boxes.length % BOX_COLORS.length] }],
      }),
    })
  }

  // Totais globais (só BRL)
  const totalBRL = wallet.groups.flatMap(g => g.boxes)
    .filter(b => b.currency === 'Brasil')
    .reduce((s, b) => s + (parseFloat(b.value) || 0), 0)

  const totalEUR = wallet.groups.flatMap(g => g.boxes)
    .filter(b => b.currency === 'Espanha')
    .reduce((s, b) => s + (parseFloat(b.value) || 0), 0)

  const saldoFinal = totalBRL - pendingBills + pendingReceivables

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Carteira"
        subtitle={syncing ? '💾 Salvando no servidor...' : syncError ? `⚠ ${syncError}` : 'Saldos e projeção financeira'}
        action={
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs" style={{ color: 'var(--green-400)' }}>✓ Salvo</span>}
            <YearMonthSelector value={ym} onChange={setYm} />
            <button type="button" onClick={fetchAPI} disabled={loadingAPI}
              className="btn-secondary px-3" title="Atualizar dados da API">
              {loadingAPI ? <Spinner size={15} /> : <RefreshCw size={15} />}
            </button>
          </div>
        }
      />

      {/* Resumo global */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Wallet size={14} />,       label: 'Total em caixa (R$)',     value: formatCurrency(totalBRL, 'Brasil'),          color: 'var(--text-1)',    accent: 'var(--border-1)'        },
          { icon: <Wallet size={14} />,       label: 'Total em caixa (€)',      value: formatCurrency(totalEUR, 'Espanha'),         color: 'var(--amber)',     accent: 'rgba(251,191,36,0.2)'   },
          { icon: <TrendingDown size={14} />, label: `A pagar (${formatYearMonth(ym)})`, value: formatCurrency(pendingBills, 'Brasil'),     color: 'var(--red)',       accent: 'var(--red-dim)'         },
          { icon: <TrendingUp size={14} />,   label: 'Saldo Final Projetado',   value: formatCurrency(saldoFinal, 'Brasil'),        color: saldoFinal >= 0 ? 'var(--green-400)' : 'var(--red)', accent: saldoFinal >= 0 ? 'var(--green-dim)' : 'var(--red-dim)' },
        ].map(({ icon, label, value, color, accent }) => (
          <div key={label} className="card px-4 py-3" style={{ borderColor: accent }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-3)' }}>
              {icon}
              <span className="text-xs">{label}</span>
            </div>
            <p className="text-base font-semibold font-mono" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Fórmula do saldo */}
      <div className="rounded-xl px-5 py-3 flex flex-wrap items-center gap-2 text-sm"
        style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
        <span style={{ color: 'var(--text-3)' }}>Saldo Final =</span>
        <span className="font-mono font-semibold" style={{ color: 'var(--text-1)' }}>{formatCurrency(totalBRL, 'Brasil')}</span>
        <span style={{ color: 'var(--text-3)' }}>−</span>
        <span className="font-mono font-semibold" style={{ color: 'var(--red)' }}>{formatCurrency(pendingBills, 'Brasil')}</span>
        <span style={{ color: 'var(--text-3)' }}>(a pagar)</span>
        <span style={{ color: 'var(--text-3)' }}>+</span>
        <span className="font-mono font-semibold" style={{ color: 'var(--green-400)' }}>{formatCurrency(pendingReceivables, 'Brasil')}</span>
        <span style={{ color: 'var(--text-3)' }}>(a receber)</span>
        <span style={{ color: 'var(--text-3)' }}>=</span>
        <span className="font-mono font-bold text-base" style={{ color: saldoFinal >= 0 ? 'var(--green-400)' : 'var(--red)' }}>
          {formatCurrency(saldoFinal, 'Brasil')}
        </span>
        {loadingAPI && <Spinner size={14} />}
      </div>

      {/* Groups */}
      {wallet.groups.map(group => (
        <GroupSection
          key={group.id}
          group={group}
          onUpdate={updated => updateGroup(group.id, updated)}
          onDelete={() => deleteGroup(group.id)}
          onAddBox={() => addBox(group.id)}
        />
      ))}

      {/* Add group */}
      <button type="button" onClick={addGroup}
        className="w-full rounded-xl py-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors border-2 border-dashed hover:border-[var(--green-border)] hover:bg-[var(--green-dim)] hover:text-[var(--green-400)]"
        style={{ borderColor: 'var(--border-2)', color: 'var(--text-3)' }}>
        <Plus size={18} />
        Adicionar novo grupo
      </button>
    </div>
  )
}

export default function CarteiraPage() {
  return <AppLayout><CarteiraInner /></AppLayout>
}
