/**
 * Versão da aplicação — deve ser incrementada a cada entrega, junto com a
 * data de lançamento (usada para exibir a tag "NEW" por 7 dias).
 */
export const APP_VERSION = 'v333'
export const APP_VERSION_DATE = '2026-08-15'

export function isVersionNew(days = 7): boolean {
  const released = new Date(`${APP_VERSION_DATE}T00:00:00`).getTime()
  const diffMs = Date.now() - released
  return diffMs >= 0 && diffMs < days * 86_400_000
}
