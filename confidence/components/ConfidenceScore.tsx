import { useEffect, useState, type FC } from 'react'

interface Props {
  score: number
  band: string
  showDimensions?: boolean
}

const BAND_COLORS: Record<string, string> = {
  EXCEPTIONAL: '#22c55e', STRONG: '#84cc16', GOOD: '#eab308',
  ADEQUATE: '#f97316', NEEDS_IMPROVEMENT: '#ef4444', CRITICAL: '#dc2626',
}

const ConfidenceScore: FC<Props> = ({ score, band, showDimensions = false }) => {
  const [displayed, setDisplayed] = useState(0)
  const color = BAND_COLORS[band] || '#6b6862'

  useEffect(() => {
    let current = 0
    const step = score / 40
    const timer = setInterval(() => {
      current = Math.min(current + step, score)
      setDisplayed(Math.round(current))
      if (current >= score) clearInterval(timer)
    }, 25)
    return () => clearInterval(timer)
  }, [score])

  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <div style={{ fontSize: '4rem', fontWeight: 700, color, fontFamily: 'Playfair Display, serif' }}>
        {displayed}
        <span style={{ fontSize: '2rem', color: '#6b6862' }}>/100</span>
      </div>
      <div style={{ fontSize: '1.25rem', color, fontFamily: 'DM Mono, monospace', marginTop: '0.5rem' }}>{band}</div>
      <div style={{ background: '#e5e7eb', borderRadius: '999px', height: '8px', margin: '1rem auto', maxWidth: '200px' }}>
        <div style={{ background: color, borderRadius: '999px', height: '8px', width: `${displayed}%`, transition: 'width 0.05s' }} />
      </div>
      {showDimensions && (
        <p style={{ fontSize: '0.875rem', color: '#6b6862', fontFamily: 'DM Mono, monospace', marginTop: '0.5rem' }}>
          Expand dimensions below for a full breakdown
        </p>
      )}
    </div>
  )
}

export default ConfidenceScore
