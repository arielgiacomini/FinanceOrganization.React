// Service Worker do app inteiro — dois objetivos:
// 1) Cache "network-first" pra permitir abrir telas offline (ex: Lançamento
//    Rápido via Atalho do iOS sem internet).
// 2) Dar pro app um jeito de perceber quando existe uma versão mais nova
//    publicada, pra avisar o usuário em vez de ele ficar preso numa versão
//    antiga até desinstalar e reinstalar o PWA.
//
// Registrado com scope "/" (src/components/ServiceWorkerRegistration.tsx),
// então cobre todas as telas — mas continua sem nenhuma lógica de negócio
// aqui, só cache e o ciclo de vida padrão do Service Worker.
//
// IMPORTANTE: o navegador só percebe que existe uma versão nova deste
// arquivo (e dispara install/activate/controllerchange, que é o que avisa o
// usuário) quando o CONTEÚDO do sw.js muda byte a byte. Por isso o
// CACHE_NAME abaixo precisa acompanhar o APP_VERSION (src/lib/version.ts) a
// cada entrega — sem isso o aviso de nova versão nunca dispara, mesmo com o
// resto do app atualizado.
const CACHE_NAME = 'finance-app-shell-v401'

self.addEventListener('install', () => {
  // Ativa a versão nova imediatamente, sem esperar as abas antigas fecharem —
  // é o que permite o app perceber a atualização (evento "controllerchange")
  // assim que o usuário reabre o PWA, em vez de só na próxima vez que abrir
  // literalmente do zero.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
      ),
    ])
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {})
        return response
      })
      // ignoreSearch: uma mesma página pode ser aberta com parâmetros de URL
      // diferentes (ex: /lancamento-rapido/?nome=...) — ignora isso ao procurar
      // no cache offline, senão só a variação exata cacheada antes bateria.
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  )
})
