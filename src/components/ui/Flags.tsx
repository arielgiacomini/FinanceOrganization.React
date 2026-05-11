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
