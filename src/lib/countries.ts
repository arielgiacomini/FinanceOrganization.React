/**
 * Catálogo de países/moedas — base do país configurável (qualquer país da
 * lista, não só Brasil/Espanha). `code` é o nome do país em português e é o
 * mesmo valor gravado em BillToPay.country/CashReceivable.country — texto
 * livre, não uma sigla ISO, pra não quebrar nenhum dado já existente.
 */
export interface CountryCurrencyInfo {
  code: string
  /** Código ISO 4217, ex: "BRL". */
  currency: string
  /** Locale do Intl.NumberFormat, ex: "pt-BR". */
  locale: string
  /** Símbolo curto pra exibição rápida (ex: prefixo de um campo de valor) —
   *  a formatação "de verdade" (separadores, posição) sempre vem do
   *  Intl.NumberFormat via locale+currency, isso aqui é só o ícone visual. */
  symbol: string
  /** Emoji de bandeira — usado como ícone nos filtros/seletores de países
   *  além de Brasil/Espanha (que têm bandeira desenhada em SVG). Atenção:
   *  no Windows com fonte de emoji desatualizada, pode cair no fallback de
   *  texto ("BR") em vez de desenhar a bandeira — funciona bem em iOS/
   *  Android/macOS e Windows atualizado. */
  flag: string
}

export const COUNTRY_CATALOG: CountryCurrencyInfo[] = [
  { code: 'Brasil',          currency: 'BRL', locale: 'pt-BR', symbol: 'R$',  flag: '🇧🇷' },
  { code: 'Espanha',         currency: 'EUR', locale: 'es-ES', symbol: '€',   flag: '🇪🇸' },
  { code: 'Portugal',        currency: 'EUR', locale: 'pt-PT', symbol: '€',   flag: '🇵🇹' },
  { code: 'Estados Unidos',  currency: 'USD', locale: 'en-US', symbol: '$',   flag: '🇺🇸' },
  { code: 'Argentina',       currency: 'ARS', locale: 'es-AR', symbol: '$',   flag: '🇦🇷' },
  { code: 'México',          currency: 'MXN', locale: 'es-MX', symbol: '$',   flag: '🇲🇽' },
  { code: 'Reino Unido',     currency: 'GBP', locale: 'en-GB', symbol: '£',   flag: '🇬🇧' },
  { code: 'Alemanha',        currency: 'EUR', locale: 'de-DE', symbol: '€',   flag: '🇩🇪' },
  { code: 'França',          currency: 'EUR', locale: 'fr-FR', symbol: '€',   flag: '🇫🇷' },
  { code: 'Itália',          currency: 'EUR', locale: 'it-IT', symbol: '€',   flag: '🇮🇹' },
  { code: 'Canadá',          currency: 'CAD', locale: 'en-CA', symbol: '$',   flag: '🇨🇦' },
  { code: 'Chile',           currency: 'CLP', locale: 'es-CL', symbol: '$',   flag: '🇨🇱' },
  { code: 'Colômbia',        currency: 'COP', locale: 'es-CO', symbol: '$',   flag: '🇨🇴' },
  { code: 'Peru',            currency: 'PEN', locale: 'es-PE', symbol: 'S/',  flag: '🇵🇪' },
  { code: 'Uruguai',         currency: 'UYU', locale: 'es-UY', symbol: '$',   flag: '🇺🇾' },
  { code: 'Paraguai',        currency: 'PYG', locale: 'es-PY', symbol: '₲',   flag: '🇵🇾' },
  { code: 'Bolívia',         currency: 'BOB', locale: 'es-BO', symbol: 'Bs',  flag: '🇧🇴' },
  { code: 'Venezuela',       currency: 'VES', locale: 'es-VE', symbol: 'Bs',  flag: '🇻🇪' },
  { code: 'Equador',         currency: 'USD', locale: 'es-EC', symbol: '$',   flag: '🇪🇨' },
  { code: 'Suíça',           currency: 'CHF', locale: 'de-CH', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'Países Baixos',   currency: 'EUR', locale: 'nl-NL', symbol: '€',   flag: '🇳🇱' },
  { code: 'Bélgica',         currency: 'EUR', locale: 'fr-BE', symbol: '€',   flag: '🇧🇪' },
  { code: 'Irlanda',         currency: 'EUR', locale: 'en-IE', symbol: '€',   flag: '🇮🇪' },
  { code: 'Suécia',          currency: 'SEK', locale: 'sv-SE', symbol: 'kr',  flag: '🇸🇪' },
  { code: 'Noruega',         currency: 'NOK', locale: 'nb-NO', symbol: 'kr',  flag: '🇳🇴' },
  { code: 'Dinamarca',       currency: 'DKK', locale: 'da-DK', symbol: 'kr',  flag: '🇩🇰' },
  { code: 'Polônia',         currency: 'PLN', locale: 'pl-PL', symbol: 'zł',  flag: '🇵🇱' },
  { code: 'Japão',           currency: 'JPY', locale: 'ja-JP', symbol: '¥',   flag: '🇯🇵' },
  { code: 'China',           currency: 'CNY', locale: 'zh-CN', symbol: '¥',   flag: '🇨🇳' },
  { code: 'Austrália',       currency: 'AUD', locale: 'en-AU', symbol: '$',   flag: '🇦🇺' },
  { code: 'Nova Zelândia',   currency: 'NZD', locale: 'en-NZ', symbol: '$',   flag: '🇳🇿' },
  { code: 'Índia',           currency: 'INR', locale: 'en-IN', symbol: '₹',   flag: '🇮🇳' },
]

export function findCountryInfo(code?: string | null): CountryCurrencyInfo | undefined {
  const trimmed = code?.trim()
  return trimmed ? COUNTRY_CATALOG.find(c => c.code === trimmed) : undefined
}

/** Países usados antes de o usuário mexer em Configurações → Países — mantém
 *  o comportamento de quem já usa os dois sem precisar configurar nada. */
export const DEFAULT_ACTIVE_COUNTRY_CODES = ['Brasil', 'Espanha']

export interface CountryGroup<T> { code: string; items: T[] }

/** Agrupa uma lista por país, na ordem dos países ativos (`codes`) — usado
 *  pelos resumos/badges que hoje só sabiam somar Brasil e Espanha, agora
 *  generalizados pra qualquer quantidade de países cadastrados em
 *  Configurações. Item cujo país não bate com nenhum ativo fica de fora do
 *  agrupamento (mas continua contando no total geral "Todos" de cada tela). */
export function groupByCountry<T>(
  items: T[],
  getCountry: (item: T) => string | null | undefined,
  codes: string[],
): CountryGroup<T>[] {
  return codes
    .map(code => ({ code, items: items.filter(i => (getCountry(i) ?? '').trim() === code) }))
    .filter(g => g.items.length > 0)
}
