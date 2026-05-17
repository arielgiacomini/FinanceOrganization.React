'use client'

import { AppLayout } from '@/components/layout/AppLayout'
import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui'
import {
  getFrequences, getRegistrationTypes,
  saveFrequences, saveRegistrationTypes,
  DEFAULT_FREQUENCES, DEFAULT_REGISTRATION_TYPES,
} from '@/lib/utils'
import { Plus, Trash2, GripVertical, RotateCcw, Save, CreditCard, ChevronRight, TrendingUp, Edit2, Check } from 'lucide-react'
import { walletApi } from '@/lib/api'
import type { WalletRecord } from '@/lib/api'
import { YearMonthSelector } from '@/components/ui/YearMonthSelector'
import { currentYearMonth } from '@/lib/utils'
import Link from 'next/link'

interface EditableListProps {
  title: string
  subtitle: string
  items: string[]
  onChange: (items: string[]) => void
  onReset: () => void
}

function EditableList({ title, subtitle, items, onChange, onReset }: EditableListProps) {
  const [newItem, setNewItem] = useState('')

  function add() {
    const v = newItem.trim()
    if (!v || items.includes(v)) return
    onChange([...items, v])
    setNewItem('')
  }

  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx))
  }

  function moveUp(idx: number) {
    if (idx === 0) return
    const next = [...items]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(next)
  }

  function moveDown(idx: number) {
    if (idx === items.length - 1) return
    const next = [...items]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onChange(next)
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{title}</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{subtitle}</p>
        </div>
        <button type="button" onClick={onReset}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors hover:bg-[var(--bg-4)]"
          style={{ color: 'var(--text-3)' }}>
          <RotateCcw size={12} /> Restaurar padrão
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg group"
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
            {/* Reordenar */}
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <button type="button" onClick={() => moveUp(idx)} disabled={idx === 0}
                className="p-0.5 rounded disabled:opacity-20 hover:bg-[var(--bg-4)]"
                style={{ color: 'var(--text-3)' }}>
                <GripVertical size={14} className="rotate-90" />
              </button>
            </div>

            <span className="flex-1 text-sm" style={{ color: 'var(--text-1)' }}>{item}</span>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button type="button" onClick={() => moveUp(idx)} disabled={idx === 0}
                className="text-xs px-1.5 py-0.5 rounded disabled:opacity-30"
                style={{ color: 'var(--text-3)' }}>↑</button>
              <button type="button" onClick={() => moveDown(idx)} disabled={idx === items.length - 1}
                className="text-xs px-1.5 py-0.5 rounded disabled:opacity-30"
                style={{ color: 'var(--text-3)' }}>↓</button>
              <button type="button" onClick={() => remove(idx)}
                className="p-1 rounded transition-colors hover:bg-[var(--red-dim)]"
                style={{ color: 'var(--red)' }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-center py-4" style={{ color: 'var(--text-3)' }}>
            Nenhuma opção cadastrada.
          </p>
        )}
      </div>

      {/* Adicionar */}
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Nova opção..."
        />
        <button type="button" onClick={add} className="btn-primary px-3">
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

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

function ConfiguracoesInner() {
  const [frequences, setFrequences] = useState<string[]>([])
  const [regTypes, setRegTypes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)

  // Configurações do Gráfico
  const [plrName, setPlrName] = useState('')
  const [saldoFinalYm, setSaldoFinalYm] = useState('')
  const [valeCategoria, setValeCategoria] = useState('')
  const [nomeGrupoEspanha, setNomeGrupoEspanha] = useState('')
  const [chartSaved, setChartSaved] = useState(false)
  const [chartRecords, setChartRecords] = useState<WalletRecord[]>([])

  useEffect(() => {
    setFrequences(getFrequences())
    setRegTypes(getRegistrationTypes())
    // Carrega do localStorage imediatamente
    const c = loadPlrConfig()
    setPlrName(c.name ?? 'PLR - Ciclo 2 - 2025 de méritocracia (encerrando 2025)')
    setSaldoFinalYm(c.saldoFinalYm ?? '')
    setValeCategoria(c.valeCategoria ?? 'Vale Alimentação/Refeição')
    setNomeGrupoEspanha(c.nomeGrupoEspanha ?? 'Conta Bancária Espanha')
    // Sincroniza com backend
    walletApi.search().then(res => {
      const records = res.output?.data ?? []
      setChartRecords(records)
      const rec = records.find(r => r.walletKey === 'finance_plr_config')
      if (rec?.walletValue) {
        try {
          const parsed = JSON.parse(rec.walletValue)
          savePlrConfigAll(parsed)
          setPlrName(parsed.name ?? '')
          setSaldoFinalYm(parsed.saldoFinalYm ?? '')
          setValeCategoria(parsed.valeCategoria ?? '')
          setNomeGrupoEspanha(parsed.nomeGrupoEspanha ?? '')
        } catch {}
      }
    }).catch(() => { /* usa localStorage como fallback */ })
  }, [])

  function save() {
    saveFrequences(frequences)
    saveRegistrationTypes(regTypes)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6 animate-slide-up max-w-2xl">
      <PageHeader
        title="Configurações"
        subtitle="Gerencie as opções dos formulários de cadastro"
        action={
          <button onClick={save} className="btn-primary">
            <Save size={16} />
            {saved ? 'Salvo!' : 'Salvar alterações'}
          </button>
        }
      />

      <div
        className="rounded-lg px-4 py-3 text-xs"
        style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(96,165,250,0.2)' }}
      >
        As opções são salvas localmente no seu navegador e aplicadas em todos os formulários de cadastro e edição.
      </div>

      {/* Contas Bancárias */}
      <Link href="/contas"
        className="card px-5 py-4 flex items-center justify-between transition-colors hover:bg-[var(--bg-3)] cursor-pointer"
        style={{ textDecoration: 'none' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg-4)', color: 'var(--text-2)' }}>
            <CreditCard size={16} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Contas Bancárias</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Visualize suas contas e cartões cadastrados na API</p>
          </div>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--text-3)' }} />
      </Link>

      {/* Configurações do Gráfico */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-3)' }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} style={{ color: 'var(--green-400)' }} />
            <div>
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Configurações do Gráfico</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Parâmetros usados no gráfico de Evolução Financeira do Dashboard</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary px-3 flex items-center gap-2"
            onClick={() => {
              const data = { name: plrName, saldoFinalYm, valeCategoria, nomeGrupoEspanha }
              savePlrConfigAll(data)
              const existing = chartRecords.find(r => r.walletKey === 'finance_plr_config')
              walletApi.register('finance_plr_config', JSON.stringify(data), existing?.id)
                .catch(() => {})
              setChartSaved(true)
              setTimeout(() => setChartSaved(false), 2000)
            }}
          >
            {chartSaved ? <Check size={14} /> : <Edit2 size={14} />}
            {chartSaved ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Nome do PLR (empréstimo próximos meses)</label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
              Busca recebíveis com esse nome nos próximos 24 meses e soma à receita Brasil do gráfico.
            </p>
            <input className="input w-full" value={plrName} onChange={e => setPlrName(e.target.value)}
              placeholder="Ex: PLR - Ciclo 2 - 2025 de méritocracia (encerrando 2025)" />
          </div>
          <div>
            <label className="label">Mês/Ano do Saldo Final</label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
              Mês em que o Saldo Final da Carteira entra na Receita Brasil.
            </p>
            <YearMonthSelector value={saldoFinalYm || currentYearMonth()} onChange={setSaldoFinalYm} />
          </div>
          <div>
            <label className="label">Categoria do Vale Alimentação/Refeição</label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
              Categoria somada na Receita Brasil do mês configurado.
            </p>
            <input className="input w-full" value={valeCategoria} onChange={e => setValeCategoria(e.target.value)}
              placeholder="Ex: Vale Alimentação/Refeição" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Nome do grupo Conta Bancária Espanha</label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
              Nome exato do grupo na Carteira para calcular o acumulado de investimento Espanha.
            </p>
            <input className="input w-full" value={nomeGrupoEspanha} onChange={e => setNomeGrupoEspanha(e.target.value)}
              placeholder="Ex: Conta Bancária Espanha" />
          </div>
        </div>
      </div>

      <EditableList
        title="Frequências"
        subtitle="Opções disponíveis no campo Frequência dos formulários"
        items={frequences}
        onChange={setFrequences}
        onReset={() => setFrequences([...DEFAULT_FREQUENCES])}
      />

      <EditableList
        title="Tipos de Registro"
        subtitle="Opções disponíveis no campo Tipo de Registro dos formulários"
        items={regTypes}
        onChange={setRegTypes}
        onReset={() => setRegTypes([...DEFAULT_REGISTRATION_TYPES])}
      />
    </div>
  )
}

export default function ConfiguracoesPage() {
  return <AppLayout><ConfiguracoesInner /></AppLayout>
}
