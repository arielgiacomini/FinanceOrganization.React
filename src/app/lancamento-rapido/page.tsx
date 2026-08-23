'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { QuickBillToPayForm } from '@/components/forms/QuickBillToPayForm'
import { BillToPayForm } from '@/components/forms/BillToPayForm'
import type { QuickBillPrefill, BillToPayQuickValues } from '@/components/forms/QuickBillToPayForm'
import { AppVersionBadge } from '@/components/ui/AppVersionBadge'
import { Spinner } from '@/components/ui'
import { CheckCircle2, CloudOff, Plus } from 'lucide-react'

// Aceita vírgula ou ponto como separador decimal (o atalho externo pode mandar qualquer um).
function parseValorParam(raw: string | null): string | undefined {
  if (!raw) return undefined
  const num = parseFloat(raw.replace(',', '.'))
  return !isNaN(num) && num > 0 ? num.toFixed(2) : undefined
}

// Página standalone, sem AppLayout/AuthGuard — pensada para ser aberta direto
// (atalho na tela inicial do celular) logo após um gasto, sem precisar logar.
// Aceita parâmetros de URL pra pré-preencher: ?nome=...&valor=...&conta=...
function LancamentoRapidoInner() {
  const searchParams = useSearchParams()

  const urlPrefill = useMemo<BillToPayQuickValues | undefined>(() => {
    const name = searchParams.get('nome')?.trim() || undefined
    const value = parseValorParam(searchParams.get('valor'))
    const account = searchParams.get('conta')?.trim() || undefined
    if (!name && !value && !account) return undefined
    return { name, value, account }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [mode, setMode] = useState<'quick' | 'full'>('quick')
  const [fullPrefill, setFullPrefill] = useState<QuickBillPrefill | undefined>(undefined)
  const [quickPrefill, setQuickPrefill] = useState<BillToPayQuickValues | undefined>(urlPrefill)
  const [done, setDone] = useState<false | 'saved' | 'queued'>(false)

  // O Service Worker (cache offline + fila de sincronização) agora é registrado
  // globalmente pro app inteiro em src/components/ui/AppServiceWorker.tsx, com
  // scope "/" — cobre esta tela também, sem precisar de registro próprio aqui.

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
          {done === 'saved' ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 size={40} style={{ color: 'var(--green-400)', margin: '0 auto' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Lançamento cadastrado!</p>
              <button type="button" className="btn-primary mx-auto" onClick={resetAll}>
                <Plus size={16} /> Cadastrar outro
              </button>
            </div>
          ) : done === 'queued' ? (
            <div className="text-center py-6 space-y-3">
              <CloudOff size={40} style={{ color: 'var(--blue)', margin: '0 auto' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Salvo localmente!</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Sem conexão agora — será enviado sozinho assim que a internet voltar.</p>
              <button type="button" className="btn-primary mx-auto" onClick={resetAll}>
                <Plus size={16} /> Cadastrar outro
              </button>
            </div>
          ) : mode === 'quick' ? (
            <QuickBillToPayForm
              initialValues={quickPrefill}
              onSaved={() => {}}
              onDone={(queued) => setDone(queued ? 'queued' : 'saved')}
              onSwitchFull={(prefill) => { setFullPrefill(prefill); setMode('full') }}
              onCancel={resetAll}
            />
          ) : (
            <BillToPayForm
              prefill={fullPrefill}
              onSuccess={() => setDone('saved')}
              onCancel={resetAll}
              onSwitchQuick={(values) => { setQuickPrefill(values); setMode('quick') }}
            />
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5 mt-4">
          <AppVersionBadge />
        </div>
      </div>
    </div>
  )
}

export default function LancamentoRapidoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-0)' }}>
        <Spinner size={32} />
      </div>
    }>
      <LancamentoRapidoInner />
    </Suspense>
  )
}
