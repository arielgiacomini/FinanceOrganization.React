'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { billsToPayApi, walletApi } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { loadStaleAlertMensagem, loadStaleAlertIntervaloMinutos, loadStaleAlertAtivo } from '@/lib/wallet'
import type { BillToPay } from '@/types'
import { Modal } from '@/components/ui'
import { BillToPayForm } from '@/components/forms/BillToPayForm'
import { AlertTriangle, ChevronDown, ChevronUp, Pencil, RefreshCw, RotateCw } from 'lucide-react'

// Intervalo de verificação (ms). No app desktop era configurável via appsettings;
// aqui fica fixo em 5s para não sobrecarregar a API com chamadas frequentes.
const POLL_INTERVAL_MS = 5_000

export function RecordsAwaitingAlert() {
  const [items, setItems] = useState<BillToPay[]>([])
  const [pollCount, setPollCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [editTarget, setEditTarget] = useState<BillToPay | null>(null)

  // Popup "dados desatualizados" — aparece quando o alerta acima some (contagem
  // volta a zero após ter tido itens pendentes) e se repete a cada N minutos
  // enquanto o usuário não atualizar a página.
  const [showStalePopup, setShowStalePopup] = useState(false)
  const [staleMensagem, setStaleMensagem] = useState(() => loadStaleAlertMensagem())
  const prevCountRef = useRef<number | null>(null)
  const staleIntervalMinRef = useRef(loadStaleAlertIntervaloMinutos())
  const staleAtivoRef = useRef(loadStaleAlertAtivo())
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearStaleTimer = useCallback(() => {
    if (staleTimerRef.current) {
      clearInterval(staleTimerRef.current)
      staleTimerRef.current = null
    }
  }, [])

  const scheduleStaleReminder = useCallback(() => {
    clearStaleTimer()
    if (!staleAtivoRef.current) return
    staleTimerRef.current = setInterval(() => {
      setShowStalePopup(true)
    }, staleIntervalMinRef.current * 60_000)
  }, [clearStaleTimer])

  // Sincroniza a configuração do popup (mensagem + intervalo) do backend
  useEffect(() => {
    walletApi.search().then(res => {
      const records = res.output?.data ?? []
      const rec = records.find(r => r.walletKey === 'finance_stale_alert_config')
      if (rec?.walletValue) {
        localStorage.setItem('finance_stale_alert_config', rec.walletValue)
        setStaleMensagem(loadStaleAlertMensagem())
        staleIntervalMinRef.current = loadStaleAlertIntervaloMinutos()
        staleAtivoRef.current = loadStaleAlertAtivo()
        if (!staleAtivoRef.current) { clearStaleTimer(); setShowStalePopup(false) }
      }
    }).catch(() => { /* usa o que já houver no localStorage */ })
  }, [clearStaleTimer])

  const check = useCallback(async () => {
    setLoading(true)
    try {
      const res = await billsToPayApi.recordsAwaiting()
      const data = res.output?.data ?? res.Output?.Data ?? []
      const newCount = data.length

      if (staleAtivoRef.current && prevCountRef.current !== null && prevCountRef.current > 0 && newCount === 0) {
        // O alerta acabou de sumir do cabeçalho — a tela pode ter ficado desatualizada
        setShowStalePopup(true)
        scheduleStaleReminder()
      } else if (newCount > 0) {
        // Voltou a ter pendências reais — o lembrete de "atualizar" perde o sentido
        clearStaleTimer()
        setShowStalePopup(false)
      }
      prevCountRef.current = newCount

      setItems(data)
    } catch {
      // Silencioso: uma falha na verificação não deve atrapalhar o uso do app.
    } finally {
      setLoading(false)
      setPollCount(c => c + 1)
    }
  }, [scheduleStaleReminder, clearStaleTimer])

  useEffect(() => {
    check()
    const id = setInterval(check, POLL_INTERVAL_MS)
    return () => { clearInterval(id); clearStaleTimer() }
  }, [check, clearStaleTimer])

  function handleRefreshNow() {
    window.location.reload()
  }

  function handleDismissStale() {
    setShowStalePopup(false)
    scheduleStaleReminder()
  }

  return (
    <>
      {items.length > 0 && (
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

      <Modal open={showStalePopup} onClose={handleDismissStale} title="Dados podem estar desatualizados" size="sm">
        <div className="space-y-5">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>{staleMensagem}</p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleDismissStale}
              className="px-4 py-2 rounded-lg text-xs font-medium"
              style={{ color: 'var(--text-2)', background: 'var(--bg-4)', border: '1px solid var(--border-1)' }}
            >
              Agora não
            </button>
            <button
              type="button"
              onClick={handleRefreshNow}
              className="px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2"
              style={{ background: 'var(--green-400)', color: '#fff' }}
            >
              <RotateCw size={14} />
              Atualizar agora
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
