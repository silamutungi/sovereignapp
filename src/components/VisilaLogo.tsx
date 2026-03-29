// <VisilaLogo />                 — medium, dark, default
// <VisilaLogo size="sm" />       — navbar, 3 planes
// <VisilaLogo size="lg" />       — hero, marketing
// <VisilaLogo color="light" />   — on dark backgrounds

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

  // Mark geometry — 4 planes, no crease lines, edges meet cleanly
  // Tonal progression: #8B0040 → #CC0055 → #FF1F6E → #FF80AA
  // Planes share edges exactly — no gap, no drawn line between them

  const marks = {
    sm: (
      // 3 planes — navbar, tight spaces, under 48px tall
      // Left outer + merged inner + right outer
      <g>
        <polygon points="0,2  13,2  18,37"  fill="#8B0040"/>
        <polygon points="13,2 18,2  18,37"  fill="#FF1F6E"/>
        <polygon points="18,2 36,2  18,37"  fill="#FF80AA"/>
      </g>
    ),
    md: (
      // 4 planes — landing page nav, standard use
      <g>
        <polygon points="0,2   22,2  36,64" fill="#8B0040"/>
        <polygon points="22,2  36,2  36,64" fill="#CC0055"/>
        <polygon points="36,2  50,2  36,64" fill="#FF1F6E"/>
        <polygon points="50,2  72,2  36,64" fill="#FF80AA"/>
      </g>
    ),
    lg: (
      // 4 planes — hero, marketing, app icon
      <g>
        <polygon points="0,4   40,4  60,124" fill="#8B0040"/>
        <polygon points="40,4  60,4  60,124" fill="#CC0055"/>
        <polygon points="60,4  80,4  60,124" fill="#FF1F6E"/>
        <polygon points="80,4  120,4 60,124" fill="#FF80AA"/>
      </g>
    ),
  }

  const configs = {
    sm: { viewBox: '0 0 36 40',   width: 140, height: 40,  wordmarkX: 44,  wordmarkY: 28, fontSize: 26 },
    md: { viewBox: '0 0 72 66',   width: 210, height: 66,  wordmarkX: 84,  wordmarkY: 48, fontSize: 34 },
    lg: { viewBox: '0 0 120 130', width: 400, height: 130, wordmarkX: 136, wordmarkY: 90, fontSize: 64 },
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
      style={{ overflow: 'visible', ...style }}
      aria-label="Visila"
      role="img"
    >
      {marks[size]}
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
