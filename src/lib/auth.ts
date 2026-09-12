// Autenticação real contra a API — antes disso era um usuário fixo comparado
// no navegador (nunca chegava a ir pro backend); agora login/cadastro/Google
// devolvem um token JWT de verdade da API, usado em toda chamada autenticada
// (ver requestAuth em src/lib/api.ts).

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://api.financeiro.arielgiacomini.com.br'

export const SESSION_KEY = 'finance_auth'

export interface Session {
  token: string
  expiresAt: number
  userId: string
  email?: string
  name?: string
}

export class AuthError extends Error {}

// Decodifica só o payload do JWT pra ler o "sub" (id do usuário) — não valida
// assinatura no cliente, isso é sempre responsabilidade do backend a cada
// chamada autenticada.
function decodeJwtSub(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.sub === 'string' ? json.sub : null
  } catch {
    return null
  }
}

// Chaves locais que são só espelho de algo que mora no backend (config de
// carteira, cache de contas/categorias offline, histórico de sugestão) —
// seguro limpar a cada novo login, porque tudo isso volta sozinho na próxima
// sincronização. NÃO inclui a fila de lançamentos pendentes offline (dado
// real do usuário que ainda não chegou no servidor — ver offlineQueue.ts,
// que precisa ser esvaziada ou avisada antes do logout, nunca apagada calada)
// nem preferências puramente visuais (tamanho de fonte, sidebar recolhida),
// que não vazam dado nenhum mesmo se ficarem de um usuário pro outro.
const LOCAL_MIRROR_KEYS = [
  'finance_wallet',
  'finance_plr_config',
  'finance_stale_alert_config',
  'finance_chart_milestones',
  'finance_chart_milestone_style',
  'finance_despesa_mes_config',
  'finance_despesa_ver_registros_config',
  'finance_contas_pagar_sort_config',
  'finance_contas_receber_sort_config',
  'finance_contas_pagar_columns_config',
  'finance_contas_pagar_account_style_config',
  'finance_quick_bill_config',
  'finance_cached_accounts',
  'finance_cached_categories_billtopay',
  'finance_category_history_cache',
]

/** Limpa o cache local de dados do usuário anterior antes de iniciar uma sessão nova. */
function clearLocalMirrors() {
  for (const key of LOCAL_MIRROR_KEYS) {
    try { localStorage.removeItem(key) } catch {}
  }
}

function buildSession(token: string, expiresInSeconds: number, extra?: { email?: string; name?: string }): Session {
  const userId = decodeJwtSub(token)
  if (!userId) throw new AuthError('Token de autenticação inválido (sem identificador de usuário).')
  return {
    token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
    userId,
    email: extra?.email,
    name: extra?.name,
  }
}

async function parseAuthError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    const out = data?.output as { validations?: Record<string, string>; errors?: Record<string, string>; message?: string } | undefined
    const msgs = [
      ...(out?.validations ? Object.values(out.validations) : []),
      ...(out?.errors ? Object.values(out.errors) : []),
    ]
    if (msgs.length) return msgs.join(' ')
    if (out?.message) return out.message
    if (data?.error_description) return String(data.error_description)
  } catch {}
  if (res.status === 400 || res.status === 401) return 'E-mail ou senha incorretos.'
  return `Falha na autenticação (${res.status}).`
}

/** Login com e-mail e senha — grant_type "password" no endpoint OAuth2 da API. */
export async function login(email: string, password: string): Promise<Session> {
  const res = await fetch(`${BASE_URL}/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', username: email, password }).toString(),
  })
  if (!res.ok) throw new AuthError(await parseAuthError(res))
  const data = await res.json()
  const session = buildSession(data.access_token, data.expires_in ?? 3600, { email })
  saveSession(session)
  clearLocalMirrors()
  return session
}

/** Cadastro de conta nova — a API já devolve um token, login automático. */
export async function register(email: string, name: string, password: string): Promise<Session> {
  const res = await fetch(`${BASE_URL}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, password }),
  })
  if (!res.ok) throw new AuthError(await parseAuthError(res))
  const data = await res.json()
  const token = data.accessToken ?? data.access_token
  if (!token) throw new AuthError(data?.output?.message ?? 'Não foi possível concluir o cadastro.')
  const session = buildSession(token, data.expiresInSeconds ?? data.expires_in ?? 3600, {
    email: data?.output?.data?.email ?? email,
    name: data?.output?.data?.name ?? name,
  })
  saveSession(session)
  clearLocalMirrors()
  return session
}

/** Login com Google — troca o idToken do Google Identity Services pelo token da API. */
export async function loginWithGoogle(idToken: string): Promise<Session> {
  const res = await fetch(`${BASE_URL}/v1/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!res.ok) throw new AuthError(await parseAuthError(res))
  const data = await res.json()
  const token = data.accessToken ?? data.access_token
  if (!token) throw new AuthError(data?.output?.message ?? 'Não foi possível entrar com o Google.')
  const session = buildSession(token, data.expiresInSeconds ?? data.expires_in ?? 3600, {
    email: data?.output?.data?.email,
    name: data?.output?.data?.name,
  })
  saveSession(session)
  clearLocalMirrors()
  return session
}

// localStorage (não sessionStorage) de propósito: num PWA instalado, o sistema
// operacional mata o processo do app quando ele fica em segundo plano, e
// sessionStorage some junto — fazendo pedir login de novo a cada abertura,
// mesmo dentro da validade do token. localStorage sobrevive a isso.
export function getSession(): Session | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session: Session = JSON.parse(raw)
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function isAuthenticated(): boolean {
  return getSession() !== null
}
