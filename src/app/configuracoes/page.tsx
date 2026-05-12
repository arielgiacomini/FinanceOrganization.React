'use client'

import { AppLayout } from '@/components/layout/AppLayout'
import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui'
import {
  getFrequences, getRegistrationTypes,
  saveFrequences, saveRegistrationTypes,
  DEFAULT_FREQUENCES, DEFAULT_REGISTRATION_TYPES,
} from '@/lib/utils'
import { Plus, Trash2, GripVertical, RotateCcw, Save } from 'lucide-react'

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

function ConfiguracoesInner() {
  const [frequences, setFrequences] = useState<string[]>([])
  const [regTypes, setRegTypes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setFrequences(getFrequences())
    setRegTypes(getRegistrationTypes())
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
