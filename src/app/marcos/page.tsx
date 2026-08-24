'use client'

import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader, Spinner } from '@/components/ui'
import { walletApi } from '@/lib/api'
import type { WalletRecord } from '@/lib/api'
import {
  loadChartMilestones, saveChartMilestonesLocal, mergeChartMilestoneRecords,
  loadChartMilestoneStyle, saveChartMilestoneStyleLocal,
  CHART_MILESTONE_STYLE_DEFAULT, CHART_MILESTONE_COLOR_OPTIONS,
} from '@/lib/wallet'
import type { ChartMilestone, ChartMilestoneStyle } from '@/lib/wallet'
import { Trash2, Pencil, Check } from 'lucide-react'

const PT_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
/** Ordena "Mês/Ano" cronologicamente — mesmo formato usado nos marcos do gráfico. */
function ymSortKey(ym: string): number {
  const [m, y] = ym.split('/')
  return parseInt(y) * 12 + PT_MONTHS.indexOf(m)
}

const FONT_SIZE_OPTIONS: { value: number; label: string }[] = [
  { value: 8,  label: 'Pequeno' },
  { value: 10, label: 'Médio' },
  { value: 13, label: 'Grande' },
]

function MarcosInner() {
  const [milestones, setMilestones] = useState<ChartMilestone[]>([])
  const [milestonesRecord, setMilestonesRecord] = useState<WalletRecord | null>(null)
  const [loading, setLoading] = useState(true)

  const [style, setStyle] = useState<ChartMilestoneStyle>(CHART_MILESTONE_STYLE_DEFAULT)
  const [styleRecord, setStyleRecord] = useState<WalletRecord | null>(null)

  const [editId, setEditId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIcon, setEditIcon] = useState('')

  useEffect(() => {
    setMilestones(loadChartMilestones())
    setStyle(loadChartMilestoneStyle())

    walletApi.search().then(res => {
      const records = res.output?.data ?? []

      // Junta marcos de eventuais registros duplicados da mesma chave — ver
      // comentário de mergeChartMilestoneRecords em lib/wallet.ts
      const { merged, canonical } = mergeChartMilestoneRecords(records)
      setMilestonesRecord(canonical ?? null)
      saveChartMilestonesLocal(merged)
      setMilestones(merged)

      const styleRec = records.find(r => r.walletKey === 'finance_chart_milestone_style')
      setStyleRecord(styleRec ?? null)
      if (styleRec?.walletValue) {
        try {
          const parsed = JSON.parse(styleRec.walletValue)
          saveChartMilestoneStyleLocal({
            fontSize: typeof parsed.fontSize === 'number' ? parsed.fontSize : CHART_MILESTONE_STYLE_DEFAULT.fontSize,
            color: parsed.color || CHART_MILESTONE_STYLE_DEFAULT.color,
          })
          setStyle(loadChartMilestoneStyle())
        } catch {}
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function persistMilestones(next: ChartMilestone[]) {
    setMilestones(next)
    saveChartMilestonesLocal(next)
    const val = JSON.stringify(next)
    try {
      const res = milestonesRecord
        ? await walletApi.edit(milestonesRecord.id, 'finance_chart_milestones', val, milestonesRecord.creationDate)
        : await walletApi.register('finance_chart_milestones', val)
      if (!milestonesRecord) {
        const newRec = (res as { output?: { data?: WalletRecord } })?.output?.data
        if (newRec) setMilestonesRecord(newRec)
      }
    } catch {}
  }

  async function persistStyle(next: ChartMilestoneStyle) {
    setStyle(next)
    saveChartMilestoneStyleLocal(next)
    const val = JSON.stringify(next)
    try {
      const res = styleRecord
        ? await walletApi.edit(styleRecord.id, 'finance_chart_milestone_style', val, styleRecord.creationDate)
        : await walletApi.register('finance_chart_milestone_style', val)
      if (!styleRecord) {
        const newRec = (res as { output?: { data?: WalletRecord } })?.output?.data
        if (newRec) setStyleRecord(newRec)
      }
    } catch {}
  }

  function startEdit(m: ChartMilestone) {
    setEditId(m.id)
    setEditTitle(m.title)
    setEditDescription(m.description ?? '')
    setEditIcon(m.icon ?? '')
  }

  function saveEdit() {
    if (!editId || !editTitle.trim()) return
    const next = milestones.map(m => m.id === editId
      ? { ...m, title: editTitle.trim(), description: editDescription.trim() || undefined, icon: editIcon.trim() || undefined }
      : m)
    persistMilestones(next)
    setEditId(null)
  }

  function deleteMilestone(id: string) {
    if (editId === id) setEditId(null)
    persistMilestones(milestones.filter(m => m.id !== id))
  }

  const sorted = [...milestones].sort((a, b) => ymSortKey(a.yearMonth) - ymSortKey(b.yearMonth))

  return (
    <div className="space-y-6 animate-slide-up max-w-3xl">
      <PageHeader
        title="Marcos"
        subtitle="Acontecimentos importantes marcados no gráfico Evolução Financeira, no Dashboard"
      />

      {/* Aparência no gráfico */}
      <div className="card p-5" style={{ border: '1px solid var(--border-1)' }}>
        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-1)' }}>Aparência no gráfico</p>
        <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>
          Como o nome do marco aparece ao lado do marcador no gráfico Evolução Financeira.
        </p>
        <div className="space-y-4">
          <div>
            <label className="label">Tamanho do texto</label>
            <div className="flex gap-2 mt-1.5">
              {FONT_SIZE_OPTIONS.map(opt => {
                const active = style.fontSize === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => persistStyle({ ...style, fontSize: opt.value })}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                    style={{
                      background: active ? 'var(--green-dim)' : 'var(--bg-3)',
                      borderColor: active ? 'var(--green-border)' : 'var(--border-1)',
                      color: active ? 'var(--green-400)' : 'var(--text-2)',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="label">Cor do marcador</label>
            <div className="flex gap-2 mt-1.5">
              {CHART_MILESTONE_COLOR_OPTIONS.map(c => {
                const active = style.color === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => persistStyle({ ...style, color: c })}
                    title={c}
                    className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                    style={{
                      background: c,
                      border: active ? '2px solid var(--text-1)' : '2px solid transparent',
                      boxShadow: active ? '0 0 0 2px var(--bg-2)' : undefined,
                    }}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Lista de marcos */}
      <div className="card overflow-hidden" style={{ border: '1px solid var(--border-1)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-3)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Todos os marcos</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            Novos marcos são criados clicando direto num ponto do gráfico Evolução Financeira, no Dashboard.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Spinner size={22} /></div>
        ) : sorted.length === 0 ? (
          <p className="text-xs text-center py-10" style={{ color: 'var(--text-3)' }}>Nenhum marco cadastrado ainda.</p>
        ) : (
          <div>
            {sorted.map(m => (
              <div key={m.id} className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-1)' }}>
                {editId === m.id ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        className="input text-sm text-center"
                        style={{ width: 52 }}
                        value={editIcon}
                        onChange={e => setEditIcon(e.target.value)}
                        placeholder="🏠"
                        maxLength={4}
                      />
                      <input
                        className="input flex-1 text-sm"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveEdit()}
                        placeholder="Título do marco"
                        autoFocus
                      />
                    </div>
                    <textarea
                      className="input w-full text-sm"
                      rows={2}
                      value={editDescription}
                      onChange={e => setEditDescription(e.target.value)}
                      placeholder="Descrição opcional"
                    />
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setEditId(null)} className="btn-secondary px-3 py-1.5 text-xs">
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={!editTitle.trim()}
                        className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1"
                        style={{ opacity: editTitle.trim() ? 1 : 0.5 }}
                      >
                        <Check size={13} /> Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{m.icon || '📌'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{m.title}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>
                          {m.yearMonth}
                        </span>
                      </div>
                      {m.description && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{m.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        title="Editar"
                        className="p-1.5 rounded-md transition-colors"
                        style={{ color: 'var(--text-3)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--blue)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMilestone(m.id)}
                        title="Excluir"
                        className="p-1.5 rounded-md transition-colors"
                        style={{ color: 'var(--text-3)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MarcosPage() {
  return <AppLayout><MarcosInner /></AppLayout>
}
