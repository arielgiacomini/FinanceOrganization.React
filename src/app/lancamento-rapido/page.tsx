'use client'

import { useState } from 'react'
import { QuickBillToPayForm } from '@/components/forms/QuickBillToPayForm'
import { BillToPayForm } from '@/components/forms/BillToPayForm'
import type { QuickBillPrefill, BillToPayQuickValues } from '@/components/forms/QuickBillToPayForm'
import { AppVersionBadge } from '@/components/ui/AppVersionBadge'
import { CheckCircle2, Plus } from 'lucide-react'

// Página standalone, sem AppLayout/AuthGuard — pensada para ser aberta direto
// (atalho na tela inicial do celular) logo após um gasto, sem precisar logar.
export default function LancamentoRapidoPage() {
  const [mode, setMode] = useState<'quick' | 'full'>('quick')
  const [fullPrefill, setFullPrefill] = useState<QuickBillPrefill | undefined>(undefined)
  const [quickPrefill, setQuickPrefill] = useState<BillToPayQuickValues | undefined>(undefined)
  const [done, setDone] = useState(false)

  function resetAll() {
    setDone(false)
    setMode('quick')
    setFullPrefill(undefined)
    setQuickPrefill(undefined)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-0)' }}>
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-black font-bold text-2xl mx-auto mb-3"
            style={{ background: 'var(--green-500)' }}>F</div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-1)' }}>Lançamento Rápido</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Nova conta a pagar — sem precisar entrar no sistema</p>
        </div>

        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
          {done ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 size={40} style={{ color: 'var(--green-400)', margin: '0 auto' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Lançamento cadastrado!</p>
              <button type="button" className="btn-primary mx-auto" onClick={resetAll}>
                <Plus size={16} /> Cadastrar outro
              </button>
            </div>
          ) : mode === 'quick' ? (
            <QuickBillToPayForm
              initialValues={quickPrefill}
              onSaved={() => {}}
              onDone={() => setDone(true)}
              onSwitchFull={(prefill) => { setFullPrefill(prefill); setMode('full') }}
              onCancel={resetAll}
            />
          ) : (
            <BillToPayForm
              prefill={fullPrefill}
              onSuccess={() => setDone(true)}
              onCancel={resetAll}
              onSwitchQuick={(values) => { setQuickPrefill(values); setMode('quick') }}
            />
          )}
        </div>

        <div className="flex justify-center mt-4">
          <AppVersionBadge />
        </div>
      </div>
    </div>
  )
}
