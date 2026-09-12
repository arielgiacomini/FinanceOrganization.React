export function FlagBrasil({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="2" fill="#009c3b"/>
      <polygon points="1.5,0.15 2.85,1 1.5,1.85 0.15,1" fill="#FFDF00"/>
      <circle cx="1.5" cy="1" r="0.45" fill="#002776"/>
      <path d="M1.08,0.82 A0.45,0.45 0 0 1 1.92,0.82" stroke="white" strokeWidth="0.08" fill="none"/>
    </svg>
  )
}

export function FlagEspanha({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="2" fill="#c60b1e"/>
      <rect y="0.5" width="3" height="1" fill="#ffc400"/>
    </svg>
  )
}

export function FlagPortugal({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="2" fill="#ff0000"/>
      <rect width="1.2" height="2" fill="#046a38"/>
      <circle cx="1.2" cy="1" r="0.35" fill="#ffcc00" stroke="#ff0000" strokeWidth="0.05"/>
    </svg>
  )
}

export function FlagEstadosUnidos({ size = 18 }: { size?: number }) {
  const h = 2 / 13
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="2" fill="#fff"/>
      {[0, 2, 4, 6, 8, 10, 12].map(i => (
        <rect key={i} y={i * h} width="3" height={h} fill="#B22234" />
      ))}
      <rect width="1.2" height={h * 7} fill="#3C3B6E"/>
    </svg>
  )
}

export function FlagArgentina({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="2" fill="#fff"/>
      <rect width="3" height={2 / 3} fill="#75AADB"/>
      <rect y={4 / 3} width="3" height={2 / 3} fill="#75AADB"/>
      <circle cx="1.5" cy="1" r="0.28" fill="#F6B40E" stroke="#85340A" strokeWidth="0.03"/>
    </svg>
  )
}

export function FlagMexico({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="1" height="2" fill="#006847"/>
      <rect x="1" width="1" height="2" fill="#fff"/>
      <rect x="2" width="1" height="2" fill="#CE1126"/>
      <circle cx="1.5" cy="1" r="0.25" fill="#8B5A2B"/>
    </svg>
  )
}

export function FlagReinoUnido({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="2" fill="#00247d"/>
      <path d="M0,0 L3,2 M3,0 L0,2" stroke="#fff" strokeWidth="0.45"/>
      <path d="M0,0 L3,2 M3,0 L0,2" stroke="#cf142b" strokeWidth="0.18"/>
      <rect x="1.2" width="0.6" height="2" fill="#fff"/>
      <rect y="0.7" width="3" height="0.6" fill="#fff"/>
      <rect x="1.35" width="0.3" height="2" fill="#cf142b"/>
      <rect y="0.85" width="3" height="0.3" fill="#cf142b"/>
    </svg>
  )
}

export function FlagAlemanha({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height={2 / 3} fill="#000"/>
      <rect y={2 / 3} width="3" height={2 / 3} fill="#DD0000"/>
      <rect y={4 / 3} width="3" height={2 / 3} fill="#FFCE00"/>
    </svg>
  )
}

export function FlagFranca({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="1" height="2" fill="#0055A4"/>
      <rect x="1" width="1" height="2" fill="#fff"/>
      <rect x="2" width="1" height="2" fill="#EF4135"/>
    </svg>
  )
}

export function FlagItalia({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="1" height="2" fill="#009246"/>
      <rect x="1" width="1" height="2" fill="#fff"/>
      <rect x="2" width="1" height="2" fill="#CE2B37"/>
    </svg>
  )
}

export function FlagCanada({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="2" fill="#fff"/>
      <rect width="0.75" height="2" fill="#FF0000"/>
      <rect x="2.25" width="0.75" height="2" fill="#FF0000"/>
      <polygon points="1.5,0.55 1.62,0.85 1.95,0.85 1.68,1.02 1.78,1.35 1.5,1.15 1.22,1.35 1.32,1.02 1.05,0.85 1.38,0.85" fill="#FF0000"/>
    </svg>
  )
}

export function FlagChile({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="1" fill="#fff"/>
      <rect y="1" width="3" height="1" fill="#D52B1E"/>
      <rect width="1" height="1" fill="#0039A6"/>
      <polygon points="0.5,0.25 0.58,0.45 0.8,0.45 0.62,0.58 0.69,0.79 0.5,0.66 0.31,0.79 0.38,0.58 0.2,0.45 0.42,0.45" fill="#fff"/>
    </svg>
  )
}

export function FlagColombia({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="1" fill="#FCD116"/>
      <rect y="1" width="3" height="0.5" fill="#003893"/>
      <rect y="1.5" width="3" height="0.5" fill="#CE1126"/>
    </svg>
  )
}

export function FlagPeru({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="1" height="2" fill="#D91023"/>
      <rect x="1" width="1" height="2" fill="#fff"/>
      <rect x="2" width="1" height="2" fill="#D91023"/>
    </svg>
  )
}

export function FlagUruguai({ size = 18 }: { size?: number }) {
  const h = 2 / 9
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="2" fill="#fff"/>
      {[0, 2, 4, 6, 8].map(i => (
        <rect key={i} y={i * h} width="3" height={h} fill="#0038A8" />
      ))}
      <rect width="1.1" height={h * 5} fill="#fff"/>
      <circle cx="0.55" cy={h * 2.5} r="0.22" fill="#FCD116"/>
    </svg>
  )
}

export function FlagParaguai({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height={2 / 3} fill="#D52B1E"/>
      <rect y={2 / 3} width="3" height={2 / 3} fill="#fff"/>
      <rect y={4 / 3} width="3" height={2 / 3} fill="#0038A8"/>
      <circle cx="1.5" cy="1" r="0.22" fill="#FCD116" stroke="#D52B1E" strokeWidth="0.03"/>
    </svg>
  )
}

export function FlagBolivia({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height={2 / 3} fill="#D52B1E"/>
      <rect y={2 / 3} width="3" height={2 / 3} fill="#F9E300"/>
      <rect y={4 / 3} width="3" height={2 / 3} fill="#007934"/>
    </svg>
  )
}

export function FlagVenezuela({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height={2 / 3} fill="#FCD116"/>
      <rect y={2 / 3} width="3" height={2 / 3} fill="#0033A0"/>
      <rect y={4 / 3} width="3" height={2 / 3} fill="#CF142B"/>
      {[0, 1, 2, 3, 4].map(i => (
        <circle key={i} cx={1.15 + i * 0.175} cy="1" r="0.045" fill="#fff" />
      ))}
    </svg>
  )
}

export function FlagEquador({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="1" fill="#FFDD00"/>
      <rect y="1" width="3" height="0.5" fill="#034EA2"/>
      <rect y="1.5" width="3" height="0.5" fill="#ED1C24"/>
      <circle cx="1.5" cy="1" r="0.22" fill="#fff" stroke="#034EA2" strokeWidth="0.03"/>
    </svg>
  )
}

export function FlagSuica({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="2" fill="#D52B1E"/>
      <rect x="1.28" y="0.5" width="0.44" height="1" fill="#fff"/>
      <rect x="1" y="0.78" width="1" height="0.44" fill="#fff"/>
    </svg>
  )
}

export function FlagPaisesBaixos({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height={2 / 3} fill="#AE1C28"/>
      <rect y={2 / 3} width="3" height={2 / 3} fill="#fff"/>
      <rect y={4 / 3} width="3" height={2 / 3} fill="#21468B"/>
    </svg>
  )
}

export function FlagBelgica({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="1" height="2" fill="#000"/>
      <rect x="1" width="1" height="2" fill="#FAE042"/>
      <rect x="2" width="1" height="2" fill="#ED2939"/>
    </svg>
  )
}

export function FlagIrlanda({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="1" height="2" fill="#169B62"/>
      <rect x="1" width="1" height="2" fill="#fff"/>
      <rect x="2" width="1" height="2" fill="#FF883E"/>
    </svg>
  )
}

export function FlagSuecia({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="2" fill="#005293"/>
      <rect x="0.9" width="0.4" height="2" fill="#FECC02"/>
      <rect y="0.8" width="3" height="0.4" fill="#FECC02"/>
    </svg>
  )
}

export function FlagNoruega({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="2" fill="#EF2B2D"/>
      <rect x="0.78" width="0.64" height="2" fill="#fff"/>
      <rect y="0.68" width="3" height="0.64" fill="#fff"/>
      <rect x="0.9" width="0.4" height="2" fill="#002868"/>
      <rect y="0.8" width="3" height="0.4" fill="#002868"/>
    </svg>
  )
}

export function FlagDinamarca({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="2" fill="#C60C30"/>
      <rect x="0.9" width="0.4" height="2" fill="#fff"/>
      <rect y="0.8" width="3" height="0.4" fill="#fff"/>
    </svg>
  )
}

export function FlagPolonia({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="1" fill="#fff"/>
      <rect y="1" width="3" height="1" fill="#DC143C"/>
    </svg>
  )
}

export function FlagJapao({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="2" fill="#fff"/>
      <circle cx="1.5" cy="1" r="0.5" fill="#BC002D"/>
    </svg>
  )
}

export function FlagChina({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="2" fill="#DE2910"/>
      <polygon points="0.5,0.3 0.61,0.62 0.95,0.62 0.67,0.81 0.78,1.13 0.5,0.94 0.22,1.13 0.33,0.81 0.05,0.62 0.39,0.62" fill="#FFDE00"/>
      <circle cx="1.05" cy="0.25" r="0.06" fill="#FFDE00"/>
      <circle cx="1.2" cy="0.5" r="0.06" fill="#FFDE00"/>
      <circle cx="1.2" cy="0.8" r="0.06" fill="#FFDE00"/>
      <circle cx="1.05" cy="1.05" r="0.06" fill="#FFDE00"/>
    </svg>
  )
}

export function FlagAustralia({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="2" fill="#00247d"/>
      <path d="M0,0 L1.5,1 M1.5,0 L0,1" stroke="#fff" strokeWidth="0.22"/>
      <path d="M0,0 L1.5,1 M1.5,0 L0,1" stroke="#cf142b" strokeWidth="0.09"/>
      <rect x="0.62" width="0.26" height="1" fill="#fff"/>
      <rect y="0.37" width="1.5" height="0.26" fill="#fff"/>
      <rect x="0.68" width="0.14" height="1" fill="#cf142b"/>
      <rect y="0.43" width="1.5" height="0.14" fill="#cf142b"/>
      <circle cx="0.75" cy="1.55" r="0.09" fill="#fff"/>
      <circle cx="2.2" cy="0.4" r="0.06" fill="#fff"/>
      <circle cx="2.5" cy="0.75" r="0.06" fill="#fff"/>
      <circle cx="2.55" cy="1.25" r="0.06" fill="#fff"/>
      <circle cx="2.2" cy="1.55" r="0.06" fill="#fff"/>
      <circle cx="2.0" cy="1.0" r="0.04" fill="#fff"/>
    </svg>
  )
}

export function FlagNovaZelandia({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height="2" fill="#00247d"/>
      <path d="M0,0 L1.5,1 M1.5,0 L0,1" stroke="#fff" strokeWidth="0.22"/>
      <path d="M0,0 L1.5,1 M1.5,0 L0,1" stroke="#cf142b" strokeWidth="0.09"/>
      <rect x="0.62" width="0.26" height="1" fill="#fff"/>
      <rect y="0.37" width="1.5" height="0.26" fill="#fff"/>
      <rect x="0.68" width="0.14" height="1" fill="#cf142b"/>
      <rect y="0.43" width="1.5" height="0.14" fill="#cf142b"/>
      <circle cx="2.25" cy="0.4" r="0.09" fill="#cf142b" stroke="#fff" strokeWidth="0.03"/>
      <circle cx="2.55" cy="0.85" r="0.09" fill="#cf142b" stroke="#fff" strokeWidth="0.03"/>
      <circle cx="2.5" cy="1.3" r="0.09" fill="#cf142b" stroke="#fff" strokeWidth="0.03"/>
      <circle cx="2.15" cy="1.5" r="0.09" fill="#cf142b" stroke="#fff" strokeWidth="0.03"/>
    </svg>
  )
}

export function FlagIndia({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.667} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="3" height={2 / 3} fill="#FF9933"/>
      <rect y={2 / 3} width="3" height={2 / 3} fill="#fff"/>
      <rect y={4 / 3} width="3" height={2 / 3} fill="#138808"/>
      <circle cx="1.5" cy="1" r="0.18" fill="none" stroke="#000080" strokeWidth="0.03"/>
      <circle cx="1.5" cy="1" r="0.03" fill="#000080"/>
    </svg>
  )
}

// Bandeira Brasil/Espanha via emoji (par de "regional indicator") — no Windows,
// o Segoe UI Emoji não tem os glifos de bandeira e cai no fallback "BR"/"ES" em
// texto em vez de desenhar a bandeira (funciona normal no iOS/Android). Como o
// ícone de um marco pode ser digitado como emoji de bandeira, detecta esses dois
// casos específicos (os únicos países do app) e desenha com as mesmas <FlagBrasil>/
// <FlagEspanha> usadas no resto do app, em vez de depender da fonte do sistema.
const FLAG_EMOJI_BRASIL = String.fromCodePoint(0x1F1E7, 0x1F1F7)  // 🇧🇷
const FLAG_EMOJI_ESPANHA = String.fromCodePoint(0x1F1EA, 0x1F1F8) // 🇪🇸

export function flagEmojiIcon(icon: string | undefined, size = 16): React.JSX.Element | null {
  if (icon === FLAG_EMOJI_BRASIL) return <FlagBrasil size={size} />
  if (icon === FLAG_EMOJI_ESPANHA) return <FlagEspanha size={size} />
  return null
}

/** Ícone de um marco: mostra a bandeira desenhada (BR/ES) se for esse o emoji, senão o texto normal (emoji ou 📌 padrão). */
export function MilestoneIcon({ icon, size = 16 }: { icon?: string; size?: number }) {
  const flag = flagEmojiIcon(icon, size)
  if (flag) return flag
  return <span style={{ fontSize: size, lineHeight: 1 }}>{icon || '📌'}</span>
}

/** Um componente de bandeira desenhada (SVG) por país do catálogo — evita
 *  depender de fonte de emoji do sistema (que no Windows não desenha bandeira
 *  nenhuma, só o código do país em texto). */
const COUNTRY_FLAG_COMPONENTS: Record<string, React.ComponentType<{ size?: number }>> = {
  Brasil: FlagBrasil,
  Espanha: FlagEspanha,
  Portugal: FlagPortugal,
  'Estados Unidos': FlagEstadosUnidos,
  Argentina: FlagArgentina,
  'México': FlagMexico,
  'Reino Unido': FlagReinoUnido,
  Alemanha: FlagAlemanha,
  'França': FlagFranca,
  'Itália': FlagItalia,
  'Canadá': FlagCanada,
  Chile: FlagChile,
  'Colômbia': FlagColombia,
  Peru: FlagPeru,
  Uruguai: FlagUruguai,
  Paraguai: FlagParaguai,
  'Bolívia': FlagBolivia,
  Venezuela: FlagVenezuela,
  Equador: FlagEquador,
  'Suíça': FlagSuica,
  'Países Baixos': FlagPaisesBaixos,
  'Bélgica': FlagBelgica,
  Irlanda: FlagIrlanda,
  'Suécia': FlagSuecia,
  Noruega: FlagNoruega,
  Dinamarca: FlagDinamarca,
  'Polônia': FlagPolonia,
  'Japão': FlagJapao,
  China: FlagChina,
  'Austrália': FlagAustralia,
  'Nova Zelândia': FlagNovaZelandia,
  'Índia': FlagIndia,
}

/** Bandeira de qualquer país do catálogo (src/lib/countries.ts) — sempre um SVG
 *  desenhado à mão, nunca emoji (evita o problema de fonte de bandeira no
 *  Windows). Usado em toda tela que mostra o país de um registro/filtro. */
export function CountryFlag({ code, size = 16 }: { code?: string | null; size?: number }) {
  const trimmed = code?.trim()
  const Flag = trimmed ? COUNTRY_FLAG_COMPONENTS[trimmed] : undefined
  if (Flag) return <Flag size={size} />
  return <FlagGlobe size={size} />
}

export function FlagGlobe({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" stroke="#4ade80" strokeWidth="1.5"/>
      <ellipse cx="12" cy="12" rx="4" ry="9" stroke="#4ade80" strokeWidth="1.5"/>
      <line x1="3" y1="12" x2="21" y2="12" stroke="#4ade80" strokeWidth="1.5"/>
      <line x1="4.5" y1="7" x2="19.5" y2="7" stroke="#4ade80" strokeWidth="1"/>
      <line x1="4.5" y1="17" x2="19.5" y2="17" stroke="#4ade80" strokeWidth="1"/>
    </svg>
  )
}
