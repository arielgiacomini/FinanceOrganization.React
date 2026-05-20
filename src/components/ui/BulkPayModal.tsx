'use client'

import { useState, useMemo } from 'react'
import { billsToPayApi } from '@/lib/api'
import { currentYearMonth } from '@/lib/utils'
import type { Account } from '@/types'
import { Spinner } from '@/components/ui'
import { YearMonthSelector } from '@/components/ui/YearMonthSelector'
import { CreditCard, CheckCircle2, X } from 'lucide-react'

interface BulkPayModalProps {
  accountMap: Record<string, Account>
  onSuccess: () => void
  onClose: () => void
}

export function BulkPayModal({ accountMap, onSuccess, onClose }: BulkPayModalProps) {
  const [selectedAccount, setSelectedAccount] = useState('')
  const [yearMonth, setYearMonth] = useState(currentYearMonth())
  const [payDay, setPayDay] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [paidCount, setPaidCount] = useState(0)

  // Lista de contas filtradas por isCreditCard=true
  const creditCardAccounts = useMemo(() => {
    return Object.values(accountMap)
      .filter(acc => acc.isCreditCard && acc.enable)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [accountMap])

  const [confirmAdvance, setConfirmAdvance] = useState(false)
  const [validationMsg, setValidationMsg] = useState('')

  async function handlePay(advancePayment = false) {
    if (!selectedAccount) { setError('Selecione uma conta'); return }
    setError('')
    setLoading(true)
    try {
      const res = await billsToPayApi.pay({
        id: null,
        payDay,
        hasPay: true,
        lastChangeDate: new Date().toISOString(),
        yearMonth,
        account: selectedAccount,
        advancePayment,
      }) as any

      const output = res?.output
      const status = output?.status ?? 0

      if (status !== 0) {
        const validations: Record<string, string> = output?.validations ?? {}
        const errors: Record<string, string> = output?.errors ?? {}
        const msgs = [...Object.values(validations), ...Object.values(errors)]
        const msg = msgs.length > 0 ? msgs.join('\n') : output?.message ?? 'Erro desconhecido'

        // Se há validação (não erro crítico), oferece pagamento antecipado
        if (Object.keys(validations).length > 0) {
          setValidationMsg(msg)
          setConfirmAdvance(true)
        } else {
          setError(msg)
        }
        return
      }

      const count = output?.quantidade ?? 0
      setPaidCount(count)
      setDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao pagar contas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-3)' }}>
          <div className="flex items-center gap-2">
            <CreditCard size={16} style={{ color: 'var(--green-400)' }} />
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Pagar em Massa</h2>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-3)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 size={40} style={{ color: 'var(--green-400)' }} />
              <p className="font-semibold" style={{ color: 'var(--text-1)' }}>
                {paidCount} {paidCount === 1 ? 'conta paga' : 'contas pagas'} com sucesso!
              </p>
              <button className="btn-primary mt-2" onClick={() => { onSuccess(); onClose() }}>
                Fechar
              </button>
            </div>
          ) : (
            <>
              {/* Conta */}
              <div>
                <label className="label">Conta (Cartão de Crédito)</label>
                <select
                  className="input w-full"
                  value={selectedAccount}
                  onChange={e => setSelectedAccount(e.target.value)}
                >
                  <option value="">Selecione uma conta...</option>
                  {creditCardAccounts.map(acc => (
                    <option key={acc.id} value={acc.name}>{acc.name}</option>
                  ))}
                </select>
                {creditCardAccounts.length === 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                    Nenhuma conta de cartão de crédito encontrada.
                  </p>
                )}
              </div>

              {/* Mês/Ano */}
              <div>
                <label className="label">Mês/Ano</label>
                <YearMonthSelector value={yearMonth} onChange={setYearMonth} />
              </div>

              {/* Data de pagamento */}
              <div>
                <label className="label">Data de Pagamento</label>
                <input
                  type="date"
                  className="input w-full"
                  value={payDay}
                  onChange={e => setPayDay(e.target.value)}
                />
              </div>

              {error && (
                <div className="px-3 py-2 rounded-lg text-xs space-y-1" style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.3)' }}>
                  {error.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              )}

              {/* Popup de confirmação de pagamento antecipado */}
              {confirmAdvance && (
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.4)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--amber)' }}>⚠ Atenção</p>
                  {validationMsg.split('\n').map((line, i) => (
                    <p key={i} className="text-xs" style={{ color: 'var(--text-2)' }}>{line}</p>
                  ))}
                  <p className="text-xs font-medium pt-1" style={{ color: 'var(--text-1)' }}>
                    Deseja pagar mesmo assim?
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="btn-secondary flex-1 text-xs"
                      onClick={() => setConfirmAdvance(false)}
                      disabled={loading}
                    >
                      Não, cancelar
                    </button>
                    <button
                      className="btn-primary flex-1 text-xs flex items-center justify-center gap-1.5"
                      onClick={() => { setConfirmAdvance(false); handlePay(true) }}
                      disabled={loading}
                    >
                      {loading ? <Spinner size={12} /> : null}
                      Sim, pagar assim mesmo
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button className="btn-secondary flex-1" onClick={onClose} disabled={loading}>
                  Cancelar
                </button>
                <button className="btn-primary flex-1 flex items-center justify-center gap-2" onClick={() => handlePay(false)} disabled={loading || confirmAdvance}>
                  {loading ? <Spinner size={14} /> : <CreditCard size={14} />}
                  {loading ? 'Pagando...' : 'Pagar em Massa'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
