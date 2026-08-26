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
