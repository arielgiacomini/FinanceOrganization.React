/**
 * Fila local de lançamentos de Contas a Pagar criados sem internet — guarda a
 * intenção no navegador (localStorage) e tenta reenviar sozinha pra API quando
 * a conexão voltar. Não depende de nenhuma tela específica pra existir.
 */

import { billsToPayApi, NetworkError } from '@/lib/api'

const QUEUE_KEY = 'finance_billtopay_pending_queue'

export interface PendingBill {
  id: string
  createdAt: string
  // Resumo só pra exibir na fila sem precisar decodificar o vm inteiro.
  name: string
  value: number
  purchaseDate: string | null
  // Payload real reenviado pra API quando sincronizar.
  vm: Record<string, unknown>
  // Preenchido só quando um reenvio falha por um motivo que NÃO é falta de
  // conexão (ex: validação) — fica visível pro usuário decidir o que fazer.
  lastError?: string
}

function readQueue(): PendingBill[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function writeQueue(items: PendingBill[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items)) } catch {}
}

export function getPendingQueue(): PendingBill[] {
  return readQueue()
}

export function enqueueBill(vm: Record<string, unknown>): PendingBill {
  const item: PendingBill = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    name: String(vm.name ?? ''),
    value: Number(vm.value ?? 0),
    purchaseDate: (vm.purchaseDate as string | null | undefined) ?? null,
    vm,
  }
  const items = readQueue()
  items.push(item)
  writeQueue(items)
  return item
}

export function removeFromQueue(id: string) {
  writeQueue(readQueue().filter(i => i.id !== id))
}

// A validação de duplicidade do backend (nome + data de compra + valor + mês/ano
// + observação iguais) devolve o código [32] — nesse caso o lançamento já existe
// no servidor (provavelmente de uma tentativa anterior que teve a resposta
// perdida), então é seguro remover da fila em vez de mostrar como falha.
function isDuplicateError(message: string): boolean {
  return message.includes('[32]')
}

export interface SyncResult {
  synced: number
  failed: number
  stillOffline: boolean
}

let syncing = false

/**
 * Tenta enviar a fila pendente pra API, em ordem — para no primeiro item que
 * ainda falhar por falta de conexão (o resto fica pra próxima tentativa).
 * `onItemSettled` é chamado depois de cada item processado, pra quem estiver
 * de olho (UI) atualizar a lista sem esperar a fila inteira terminar.
 */
export async function syncPendingQueue(onItemSettled?: () => void): Promise<SyncResult> {
  if (syncing) return { synced: 0, failed: 0, stillOffline: false }
  syncing = true
  let synced = 0
  let failed = 0
  let stillOffline = false

  try {
    const items = readQueue()
    for (const item of items) {
      try {
        await billsToPayApi.create(item.vm as never)
        removeFromQueue(item.id)
        synced++
      } catch (err) {
        if (err instanceof NetworkError) {
          stillOffline = true
          onItemSettled?.()
          break
        }
        const message = err instanceof Error ? err.message : String(err)
        if (isDuplicateError(message)) {
          removeFromQueue(item.id)
          synced++
        } else {
          const current = readQueue()
          const idx = current.findIndex(i => i.id === item.id)
          if (idx !== -1) { current[idx] = { ...current[idx], lastError: message }; writeQueue(current) }
          failed++
        }
      }
      onItemSettled?.()
    }
  } finally {
    syncing = false
  }

  return { synced, failed, stillOffline }
}
