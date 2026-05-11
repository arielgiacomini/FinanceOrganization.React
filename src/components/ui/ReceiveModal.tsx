'use client'

import { useState } from 'react'
import { cashReceivableApi } from '@/lib/api'
import { formatCurrency, formatYearMonth } from '@/lib/utils'
import type { CashReceivable } from '@/types'
import { Modal, Spinner } from '@/components/ui'
import { CheckCircle2 } from 'lucide-react'

interface ReceiveModalProps {
  item: CashReceivable
  onClose: () => void
  onSuccess: () => void
}

export function ReceiveModal({ item, onClose, onSuccess }: ReceiveModalProps) {
  const [receiveDay, setReceiveDay] = useState(new Date().toISOString().slice(0, 10))
  const [receiving, setReceiving] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    setReceiving(true)
    setError('')
    try {
      await cashReceivableApi.receive({
        id: item.id,
        dateReceived: receiveDay,
        hasReceived: true,
        lastChangeDate: new Date().toISOString(),
        yearMonth: item.yearMonth,
        account: item.account,
      })
      onSuccess()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar recebimento')
    } finally {
      setReceiving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Registrar Recebimento" size="sm">
      <div className="space-y-4">
        <div className="rounded-lg px-4 py-3" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
          <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>Conta</p>
          <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{item.name}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
            {formatYearMonth(item.yearMonth)} · {formatCurrency(item.value, item.country)}
          </p>
        </div>
        <div>
          <label className="label">Data do Recebimento</label>
          <input className="input" type="date" value={receiveDay} onChange={e => setReceiveDay(e.target.value)} />
        </div>
        {error && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>{error}</p>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-primary" disabled={receiving} onClick={confirm}>
            {receiving ? <Spinner size={16} /> : <CheckCircle2 size={16} />}
            Confirmar recebimento
          </button>
        </div>
      </div>
    </Modal>
  )
}
