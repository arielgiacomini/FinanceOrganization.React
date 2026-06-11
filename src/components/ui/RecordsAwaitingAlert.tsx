'use client'

import { useCallback, useEffect, useState } from 'react'
import { billsToPayApi } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BillToPay } from '@/types'
import { Modal } from '@/components/ui'
import { BillToPayForm } from '@/components/forms/BillToPayForm'
import { AlertTriangle, ChevronDown, ChevronUp, Pencil, RefreshCw } from 'lucide-react'

// Intervalo de verificação (ms). No app desktop era configurável via appsettings;
// aqui fica fixo em 5s para não sobrecarregar a API com chamadas frequentes.
const POLL_INTERVAL_MS = 5_000

export function RecordsAwaitingAlert() {
  const [items, setItems] = useState<BillToPay[]>([])
  const [pollCount, setPollCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [editTarget, setEditTarget] = useState<BillToPay | null>(null)

  const check = useCallback(async () => {
    setLoading(true)
    try {
      const res = await billsToPayApi.recordsAwaiting()
      const data = res.output?.data ?? res.Output?.Data ?? []
      setItems(data)
    } catch {
      // Silencioso: uma falha na verificação não deve atrapalhar o uso do app.
    } finally {
      setLoading(false)
      setPollCount(c => c + 1)
    }
  }, [])

  useEffect(() => {
    check()
    const id = setInterval(check, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [check])

  if (items.length === 0) return null

  return (
    <div className="rounded-xl mb-4 sm:mb-6 overflow-hidden" style={{ background: 'var(--amber-dim)', border: '1px solid rgba(251,191,36,0.3)' }}>
      <button type="button" onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle size={18} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--amber)' }}>
              Existem {items.length} {items.length === 1 ? 'item' : 'itens'} para finalizar o cadastro
            </p>
            <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
              A cada {POLL_INTERVAL_MS / 1000}s é efetuada uma consulta · verificado {pollCount}x até o momento
              {loading && <RefreshCw size={10} className="animate-spin" />}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-1 border-t" style={{ borderColor: 'rgba(251,191,36,0.2)' }}>
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium" style={{ color: 'var(--text-1)' }}>{item.name ?? '—'}</p>
                <p className="truncate" style={{ color: 'var(--text-3)' }}>{item.account ?? '—'} · {formatDate(item.dueDate)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-mono" style={{ color: 'var(--text-2)' }}>{formatCurrency(item.value, item.country)}</span>
                <button type="button" title="Completar cadastro" className="p-1.5 rounded-md hover:bg-[var(--bg-3)]" style={{ color: 'var(--amber)' }} onClick={() => setEditTarget(item)}>
                  <Pencil size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Completar Cadastro" size="lg">
        {editTarget && (
          <BillToPayForm
            initial={editTarget}
            onSuccess={() => { setEditTarget(null); check() }}
            onCancel={() => setEditTarget(null)}
          />
        )}
      </Modal>
    </div>
  )
}
