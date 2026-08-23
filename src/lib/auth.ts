// Credenciais fixas no frontend — solução temporária até API ter autenticação
// Para alterar: mude as constantes abaixo e faça novo deploy

export const AUTH_USER     = 'ariel'
export const AUTH_PASSWORD = 'ariel'
export const SESSION_KEY   = 'finance_auth'
export const SESSION_TTL   = 1000 * 60 * 60 * 8 // 8 horas

export interface Session {
  token: string
  expiresAt: number
}

export function createSession(): Session {
  return {
    token: Math.random().toString(36).slice(2) + Date.now().toString(36),
    expiresAt: Date.now() + SESSION_TTL,
  }
}

// localStorage (não sessionStorage) de propósito: num PWA instalado, o sistema
// operacional mata o processo do app quando ele fica em segundo plano, e
// sessionStorage some junto — fazendo pedir login de novo a cada abertura,
// mesmo dentro das 8h de validade. localStorage sobrevive a isso.
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
