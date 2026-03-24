// company-os/dashboard/components/CompanyOSHeader.tsx
// Header for the Company OS dashboard — shows app name, live URL, confidence score badge

import { type FC } from 'react'

interface CompanyOSHeaderProps {
  appName: string
  deployUrl?: string
  confidenceScore?: number
  launchGatePassed?: boolean
}

function getScoreBand(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: 'EXCEPTIONAL', color: '#15803d', bg: '#dcfce7' }
  if (score >= 80) return { label: 'STRONG', color: '#365314', bg: '#c8f060' }
  if (score >= 70) return { label: 'GOOD', color: '#713f12', bg: '#fef3c7' }
  if (score >= 60) return { label: 'ADEQUATE', color: '#7c2d12', bg: '#ffedd5' }
  return { label: 'NEEDS WORK', color: '#7f1d1d', bg: '#fee2e2' }
}

export const CompanyOSHeader: FC<CompanyOSHeaderProps> = ({
  appName,
  deployUrl,
  confidenceScore,
  launchGatePassed,
}) => {
  const band = confidenceScore != null ? getScoreBand(confidenceScore) : null

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 28px',
        borderBottom: '1px solid rgba(14,13,11,0.10)',
        background: '#f2efe8',
        gap: '16px',
        flexWrap: 'wrap',
      }}
    >
      {/* Left: App name + live URL */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: launchGatePassed ? '#22c55e' : '#94a3b8',
            flexShrink: 0,
          }}
          title={launchGatePassed ? 'Launch gate passed' : 'Launch gate pending'}
        />
        <h1
          style={{
            fontFamily: '"Playfair Display", serif',
            fontSize: '20px',
            fontWeight: 700,
            color: '#0e0d0b',
            margin: 0,
          }}
        >
          {appName}
        </h1>
        {deployUrl && (
          <a
            href={deployUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: '"DM Mono", monospace',
              fontSize: '12px',
              color: '#6b6862',
              textDecoration: 'none',
              padding: '3px 8px',
              border: '1px solid rgba(14,13,11,0.15)',
              borderRadius: '4px',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLAnchorElement).style.color = '#0e0d0b'
              ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(14,13,11,0.4)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLAnchorElement).style.color = '#6b6862'
              ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(14,13,11,0.15)'
            }}
          >
            ↗ Live app
          </a>
        )}
      </div>

      {/* Right: Confidence score badge */}
      {confidenceScore != null && band && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontFamily: '"DM Mono", monospace',
              fontSize: '11px',
              color: '#6b6862',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Confidence
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '100px',
              background: band.bg,
              border: `1px solid ${band.color}22`,
            }}
          >
            <span
              style={{
                fontFamily: '"DM Mono", monospace',
                fontSize: '14px',
                fontWeight: 700,
                color: band.color,
              }}
            >
              {confidenceScore}
            </span>
            <span
              style={{
                fontFamily: '"DM Mono", monospace',
                fontSize: '10px',
                fontWeight: 600,
                color: band.color,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {band.label}
            </span>
          </div>
        </div>
      )}
    </header>
  )
}

export default CompanyOSHeader
