'use client'

import { useEffect, useState } from 'react'
import { accountsApi } from '@/lib/api'
import type { Account } from '@/types'
import { PageHeader, Spinner, Empty } from '@/components/ui'
import { CreditCard, Building2, CheckCircle2, XCircle } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'

function ContasPageInner() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    accountsApi.searchAll()
      .then((res) => setAccounts(res.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    )
  }

  const creditCards = accounts.filter((a) => a.isCreditCard)
  const bankAccounts = accounts.filter((a) => !a.isCreditCard)

  return (
    <div className="space-y-8 animate-slide-up">
      <PageHeader
        title="Contas Bancárias"
        subtitle="Suas contas cadastradas na API"
      />

      {accounts.length === 0 && <Empty message="Nenhuma conta encontrada na API." />}

      {bankAccounts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-2)' }}>
            <Building2 size={15} /> Contas bancárias ({bankAccounts.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {bankAccounts.map((a) => (
              <AccountCard key={a.id} account={a} />
            ))}
          </div>
        </section>
      )}

      {creditCards.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-2)' }}>
            <CreditCard size={15} /> Cartões de crédito ({creditCards.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {creditCards.map((a) => (
              <AccountCard key={a.id} account={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function AccountCard({ account: a }: { account: Account }) {
  const bg = a.colors?.backgroundColorHexadecimal ?? '#161616'
  const fg = a.colors?.fonteColorHexadecimal ?? '#f5f5f5'

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4 border"
      style={{
        background: bg === '#FFFFFF' ? 'var(--bg-2)' : bg,
        color: fg === '#000000' ? 'var(--text-1)' : fg,
        borderColor: 'var(--border-1)',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {a.isCreditCard ? <CreditCard size={18} /> : <Building2 size={18} />}
          <span className="font-semibold text-sm">{a.name}</span>
        </div>
        {a.enable
          ? <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--green-400)' }}><CheckCircle2 size={12} />Ativa</span>
          : <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--red)' }}><XCircle size={12} />Inativa</span>}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs opacity-80">
        {a.dueDate && (
          <div>
            <p className="opacity-60 mb-0.5">Vencimento</p>
            <p className="font-medium">Dia {a.dueDate}</p>
          </div>
        )}
        {a.closingDay && (
          <div>
            <p className="opacity-60 mb-0.5">Fechamento</p>
            <p className="font-medium">Dia {a.closingDay}</p>
          </div>
        )}
        {a.accountAgency && (
          <div>
            <p className="opacity-60 mb-0.5">Agência</p>
            <p className="font-medium">{a.accountAgency}</p>
          </div>
        )}
        {a.accountNumber && (
          <div>
            <p className="opacity-60 mb-0.5">Conta</p>
            <p className="font-medium">{a.accountNumber}{a.accountDigit ? `-${a.accountDigit}` : ''}</p>
          </div>
        )}
        {a.cardNumber && (
          <div>
            <p className="opacity-60 mb-0.5">Cartão</p>
            <p className="font-medium">•••• {a.cardNumber}</p>
          </div>
        )}
        {a.commissionPercentage && (
          <div>
            <p className="opacity-60 mb-0.5">Comissão</p>
            <p className="font-medium">{a.commissionPercentage}%</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ContasPage() {
  return <AppLayout><ContasPageInner /></AppLayout>
}
