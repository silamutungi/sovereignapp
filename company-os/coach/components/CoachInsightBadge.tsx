import { useEffect, useState, type FC } from 'react'

interface Props {
  unreadCount: number
  hasUrgent: boolean
}

const CoachInsightBadge: FC<Props> = ({ unreadCount, hasUrgent }) => {
  const [pulse, setPulse] = useState(false)

  // Trigger pulse animation when hasUrgent changes to true
  useEffect(() => {
    if (!hasUrgent) {
      setPulse(false)
      return
    }
    setPulse(true)
  }, [hasUrgent])

  if (unreadCount === 0) return null

  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <span
      aria-label={`${unreadCount} unread coach insight${unreadCount === 1 ? '' : 's'}${hasUrgent ? ', urgent' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '20px',
        height: '20px',
        padding: '0 0.375rem',
        borderRadius: '999px',
        background: hasUrgent ? '#dc2626' : '#0e0d0b',
        color: '#fff',
        fontSize: '0.7rem',
        fontWeight: 700,
        fontFamily: 'DM Mono, monospace',
        lineHeight: 1,
        position: 'relative',
        animation: pulse ? 'coach-badge-pulse 1.5s ease-in-out 3' : 'none',
      }}
    >
      {/* Pulse ring — only when urgent */}
      {hasUrgent && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '-4px',
            borderRadius: '999px',
            border: '2px solid #dc2626',
            opacity: 0,
            animation: pulse ? 'coach-badge-ring 1.5s ease-out 3' : 'none',
          }}
        />
      )}

      <style>{`
        @keyframes coach-badge-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes coach-badge-ring {
          0% { opacity: 0.8; transform: scale(0.8); }
          100% { opacity: 0; transform: scale(1.6); }
        }
      `}</style>

      {displayCount}
    </span>
  )
}

export default CoachInsightBadge
