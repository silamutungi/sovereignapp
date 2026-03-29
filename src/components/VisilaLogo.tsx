// <VisilaLogo />                    — medium, dark, navbar
// <VisilaLogo size="sm" />          — small, 3-plane, tight navbar
// <VisilaLogo size="lg" />          — large, hero/marketing
// <VisilaLogo color="light" />      — light version, dark backgrounds

import type { CSSProperties } from 'react'

interface VisilaLogoProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'dark' | 'light'
  className?: string
  style?: CSSProperties
}

export default function VisilaLogo({
  size = 'md',
  color = 'dark',
  className,
  style,
}: VisilaLogoProps) {

  const inkColor   = color === 'dark' ? '#0e0d0b' : '#f2efe8'
  const paperColor = color === 'dark' ? '#f2efe8' : '#0e0d0b'

  const configs = {
    sm: {
      // 3 planes — navbar, tight spaces
      viewBox: '0 0 92 40',
      mark: (
        <g>
          <polygon points="0,2  18,37  13,2"  fill="#8B0040"/>
          <polygon points="13,2  18,37  23,2" fill="#FF1F6E"/>
          <polygon points="23,2  18,37  36,2" fill="#FF80AA"/>
          <line x1="18" y1="2" x2="18" y2="37"
            stroke={paperColor} strokeWidth="1.5"/>
        </g>
      ),
      wordmarkX: 44,
      wordmarkY: 28,
      fontSize: 26,
      width: 160,
      height: 40,
    },
    md: {
      // 4 planes — landing page nav, cards
      viewBox: '0 0 92 66',
      mark: (
        <g>
          <polygon points="0,2   22,2   36,64" fill="#8B0040"/>
          <polygon points="22,2  36,24  36,64" fill="#CC0055"/>
          <polygon points="36,24 50,2   36,64" fill="#FF1F6E"/>
          <polygon points="50,2  72,2   36,64" fill="#FF80AA"/>
          <line x1="36" y1="2" x2="36" y2="64"
            stroke={paperColor} strokeWidth="1.5"/>
          <line x1="22" y1="2" x2="36" y2="64"
            stroke={paperColor} strokeWidth="0.75" opacity="0.5"/>
          <line x1="50" y1="2" x2="36" y2="64"
            stroke={paperColor} strokeWidth="0.75" opacity="0.5"/>
        </g>
      ),
      wordmarkX: 84,
      wordmarkY: 46,
      fontSize: 34,
      width: 220,
      height: 66,
    },
    lg: {
      // 4 planes — hero, marketing, app icon
      viewBox: '0 0 120 130',
      mark: (
        <g>
          <polygon points="0,4   40,4   60,124" fill="#8B0040"/>
          <polygon points="40,4  60,44  60,124" fill="#CC0055"/>
          <polygon points="60,44 80,4   60,124" fill="#FF1F6E"/>
          <polygon points="80,4  120,4  60,124" fill="#FF80AA"/>
          <line x1="60" y1="4" x2="60" y2="124"
            stroke={paperColor} strokeWidth="2"/>
          <line x1="40" y1="4" x2="60" y2="124"
            stroke={paperColor} strokeWidth="1" opacity="0.4"/>
          <line x1="80" y1="4" x2="60" y2="124"
            stroke={paperColor} strokeWidth="1" opacity="0.4"/>
        </g>
      ),
      wordmarkX: 136,
      wordmarkY: 88,
      fontSize: 64,
      width: 420,
      height: 130,
    },
  }

  const cfg = configs[size]

  return (
    <svg
      width={cfg.width}
      height={cfg.height}
      viewBox={cfg.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Visila"
      role="img"
    >
      {cfg.mark}
      <text
        x={cfg.wordmarkX}
        y={cfg.wordmarkY}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize={cfg.fontSize}
        fontWeight={400}
        letterSpacing="-0.3"
        fill={inkColor}
      >
        Visila
        <tspan fill="#FF1F6E">.</tspan>
      </text>
    </svg>
  )
}
