'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Check } from 'lucide-react'

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000

function isEditingSomething(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
}

/**
 * Registra o Service Worker do app inteiro (public/sw.js) e avisa o usuário
 * quando percebe que uma versão mais nova está pronta — sem isso, um PWA
 * instalado costuma "grudar" numa versão antiga até ser desinstalado e
 * reinstalado (o cache do WKWebView no iOS é bem mais agressivo que o de uma
 * aba comum do Safari).
 *
 * A troca é aplicada sozinha assim que não houver risco de derrubar algo que
 * o usuário esteja digitando (nenhum input/textarea focado) — o aviso fica
 * visível como confirmação, com um botão pra quem quiser aplicar na hora.
 *
 * Só registra em build de produção — em "next dev" o hash dos arquivos muda a
 * cada recompilação, e um Service Worker registrado ali fica "grudado"
 * servindo versões antigas em cache, atrapalhando o desenvolvimento local.
 */
export function AppServiceWorker() {
  const [updateReady, setUpdateReady] = useState(false)
  const regRef = useRef<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      // Auto-limpeza: remove qualquer Service Worker registrado em testes
      // anteriores, pra não ficar servindo versões antigas em cache durante
      // o desenvolvimento local.
      navigator.serviceWorker.getRegistrations()
        .then(regs => regs.forEach(reg => reg.unregister()))
        .catch(() => {})
      return
    }

    // Se a aba já estava sendo controlada por um Service Worker quando carregou,
    // uma troca de controller durante a sessão significa "versão nova assumiu".
    // Se NÃO estava sendo controlada ainda, a primeira ativação não conta como
    // atualização — é só o registro inicial, não tem nada "novo" pro usuário.
    const hadControllerAtLoad = !!navigator.serviceWorker.controller

    function handleControllerChange() {
      if (hadControllerAtLoad) setUpdateReady(true)
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(r => {
        regRef.current = r
        r.update().catch(() => {})
      })
      .catch(() => {})

    // Assim que o usuário reabre o app (a aba/PWA volta a ficar visível), força
    // uma checagem imediata por versão nova — é exatamente o momento em que
    // "ficar preso numa versão antiga" mais incomoda.
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') regRef.current?.update().catch(() => {})
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Reforça a checagem periodicamente pra quem deixa o app aberto sem
    // trocar de aba/tela por muito tempo.
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') regRef.current?.update().catch(() => {})
    }, UPDATE_CHECK_INTERVAL_MS)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!updateReady) return

    // Aplica sozinho assim que o usuário não estiver no meio de preencher
    // algo — evita derrubar um formulário aberto (ex: Contas a Pagar).
    const intervalId = window.setInterval(() => {
      if (!isEditingSomething()) {
        window.clearInterval(intervalId)
        window.location.reload()
      }
    }, 2000)

    return () => window.clearInterval(intervalId)
  }, [updateReady])

  if (!updateReady) return null

  return (
    <div
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-slide-up"
      style={{ background: 'var(--bg-3)', border: '1px solid var(--green-border)' }}
    >
      <RefreshCw size={16} style={{ color: 'var(--green-400)' }} className="flex-shrink-0" />
      <p className="text-sm flex-1" style={{ color: 'var(--text-1)' }}>Nova versão disponível — atualizando sozinho</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="btn-primary px-3 py-1.5 text-xs flex-shrink-0"
      >
        Atualizar agora
      </button>
    </div>
  )
}

type CheckStatus = 'idle' | 'checking' | 'up-to-date' | 'updated'

/**
 * Botão manual "Checar atualizações" — pra quem não quer esperar a checagem
 * automática (ex: acabou de ver que subiu uma versão nova e quer confirmar na
 * hora). Reaproveita o mesmo sinal de "versão nova assumiu" (evento
 * "controllerchange") que o aviso automático usa; se a checagem não encontrar
 * nada em alguns segundos, assume que já está na versão mais recente.
 */
export function CheckForUpdateButton({ className }: { className?: string }) {
  const [status, setStatus] = useState<CheckStatus>('idle')

  async function checkNow() {
    if (status === 'checking' || status === 'updated') return
    if (!('serviceWorker' in navigator)) return
    setStatus('checking')

    let settled = false
    function onControllerChange() {
      settled = true
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      setStatus('updated')
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) await reg.update()
    } catch {}

    // skipWaiting é imediato, mas a ativação ainda leva um instante — dá uma
    // folga antes de concluir que não tinha nada novo.
    window.setTimeout(() => {
      if (!settled) {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
        setStatus('up-to-date')
        window.setTimeout(() => setStatus('idle'), 3000)
      }
    }, 3000)
  }

  if (status === 'updated') {
    return (
      <button
        type="button"
        onClick={() => window.location.reload()}
        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full transition-colors ${className ?? ''}`}
        style={{ background: 'var(--green-dim)', color: 'var(--green-400)', border: '1px solid var(--green-border)' }}
      >
        <RefreshCw size={11} /> Atualizar agora
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={checkNow}
      disabled={status === 'checking'}
      title={status === 'up-to-date' ? 'Você já está na versão mais recente' : 'Checar se há uma versão nova'}
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors hover:bg-[var(--bg-4)] ${className ?? ''}`}
      style={{ color: status === 'up-to-date' ? 'var(--green-400)' : 'var(--text-3)', border: '1px solid var(--border-1)' }}
    >
      {status === 'checking' ? (
        <RefreshCw size={11} className="animate-spin" />
      ) : status === 'up-to-date' ? (
        <Check size={11} />
      ) : (
        <RefreshCw size={11} />
      )}
      {status === 'checking' ? 'Checando...' : status === 'up-to-date' ? 'Atualizado' : 'Checar atualizações'}
    </button>
  )
}
