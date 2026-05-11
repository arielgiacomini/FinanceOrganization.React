'use client'

import { useState } from 'react'
import { billsToPayApi } from '@/lib/api'
import { formatCurrency, formatYearMonth } from '@/lib/utils'
import type { BillToPay } from '@/types'
import { Modal, Spinner } from '@/components/ui'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

interface PayBillModalProps {
  bill: BillToPay
  onClose: () => void
  onSuccess: () => void
}

export function PayBillModal({ bill, onClose, onSuccess }: PayBillModalProps) {
  const [payDay, setPayDay] = useState(new Date().toISOString().slice(0, 10))
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')

  // Confirmação de adiantamento — código [34]
  const [advanceMessage, setAdvanceMessage] = useState('')
  const [awaitingAdvanceConfirm, setAwaitingAdvanceConfirm] = useState(false)

  async function sendPayment(advancePayment = false) {
    setPaying(true)
    setError('')
    try {
      const res = await billsToPayApi.pay({
        id: bill.id,
        payDay,
        hasPay: true,
        lastChangeDate: new Date().toISOString(),
        yearMonth: bill.yearMonth,
        account: bill.account,
        advancePayment,
      })

      const validations = res.output?.validations ?? {}
      const errors = res.output?.errors ?? {}

      // Código [34] = pagamento adiantado — pergunta se quer confirmar
      if (validations['[34]'] && Object.keys(validations).length === 1) {
        setAdvanceMessage(validations['[34]'])
        setAwaitingAdvanceConfirm(true)
        return
      }

      // Outros erros de validação
      const allValidations = { ...validations, ...errors }
      if (Object.keys(allValidations).length > 0) {
        const msg = Object.entries(allValidations)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')
        setError(msg)
        return
      }

      onSuccess()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar pagamento')
    } finally {
      setPaying(false)
    }
  }

  // Tela de confirmação de adiantamento
  if (awaitingAdvanceConfirm) {
    return (
      <Modal open onClose={onClose} title="Pagamento Adiantado" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg p-4"
            style={{ background: 'var(--amber-dim)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--amber)' }} />
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--amber)' }}>
                Validação de Conta a Pagar
              </p>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>{advanceMessage}</p>
              <p className="text-sm mt-2" style={{ color: 'var(--text-2)' }}>
                Deseja efetuar o pagamento mesmo assim?
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Não, cancelar
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={paying}
              onClick={() => { setAwaitingAdvanceConfirm(false); sendPayment(true) }}
            >
              {paying ? <Spinner size={16} /> : <CheckCircle2 size={16} />}
              Sim, confirmar pagamento
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title="Registrar Pagamento" size="sm">
      <div className="space-y-4">
        <div className="rounded-lg px-4 py-3" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}>
          <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>Conta</p>
          <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{bill.name}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
            {formatYearMonth(bill.yearMonth)} · {formatCurrency(bill.value, bill.country)}
          </p>
        </div>

        <div>
          <label className="label">Data do Pagamento</label>
          <input
            className="input"
            type="date"
            value={payDay}
            onChange={e => setPayDay(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-sm rounded-lg px-3 py-2 whitespace-pre-line"
            style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn-primary"
            disabled={paying}
            onClick={() => sendPayment(false)}
          >
            {paying ? <Spinner size={16} /> : <CheckCircle2 size={16} />}
            Confirmar pagamento
          </button>
        </div>
      </div>
    </Modal>
  )
}
