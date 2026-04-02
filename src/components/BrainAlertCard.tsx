// src/components/BrainAlertCard.tsx — Brain Audit alert cards
//
// Renders audit failures that Brain caught but couldn't auto-fix.
// Displayed in the EditApp brain panel. Distinct from HintCards — these are problems.

interface BrainAlert {
  id: string
  check_name: string
  severity: 'info' | 'warning' | 'critical'
  details: { message?: string } | null
  auto_fixed: boolean
  created_at: string
}

const CHECK_LABELS: Record<string, string> = {
  checkMobileNav: 'Mobile navigation missing',
  checkRLS: 'Tables publicly accessible',
  checkHardcodedColors: 'Hardcoded brand colors detected',
  checkBranding: 'Old brand name in app',
  checkExposedSecrets: 'Possible secret exposed',
  checkBrokenNavLinks: 'Broken navigation links',
  checkAltText: 'Images missing descriptions',
  checkLogoHomeLink: "Logo doesn't link home",
}

const FIX_INSTRUCTIONS: Record<string, string> = {
  checkMobileNav:
    'Add a responsive mobile hamburger nav drawer to the site navigation component. Use a hamburger icon visible below md breakpoint, slide-in drawer with Paper background, Ink links, Flame active state. Closes on tap outside.',
  checkHardcodedColors:
    'Replace all hardcoded Visila brand hex values with CSS custom properties from src/index.css.',
  checkBranding:
    "Replace all user-facing 'Sovereign' brand references with 'Visila' in the UI.",
  checkAltText:
    'Add descriptive alt text to all images. Infer the description from surrounding context.',
  checkLogoHomeLink:
    "Wrap the app logo in the nav with a React Router Link to '/'.",
}

export default function BrainAlertCard({
  alert,
  onFix,
  onDismiss,
}: {
  alert: BrainAlert
  onFix: (instruction: string) => void
  onDismiss: (alertId: string) => void
}) {
  const title = CHECK_LABELS[alert.check_name] ?? alert.check_name
  const fixInstruction = FIX_INSTRUCTIONS[alert.check_name]
  const message = alert.details?.message ?? ''

  const isCritical = alert.severity === 'critical'
  const isWarning = alert.severity === 'warning'

  const borderColor = isCritical ? '#cc2244' : isWarning ? '#e8a020' : '#444'
  const labelColor = isCritical ? '#cc2244' : isWarning ? '#e8a020' : '#888'
  const bodyColor = isCritical ? '#f0a0a0' : isWarning ? '#e8c87a' : '#aaa'
  const actionBg = isCritical ? '#2a0e14' : isWarning ? '#1f1200' : '#1a1a1a'
  const bg = isCritical ? '#1a0a0e' : isWarning ? '#1f1200' : '#111'

  return (
    <div
      className="hint-fade"
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: 6,
        padding: '10px 12px',
        maxWidth: '92%',
      }}
    >
      <p
        style={{
          font: '9px/1 DM Mono, Courier New, monospace',
          color: labelColor,
          margin: '0 0 6px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {isCritical ? '⚠' : isWarning ? '◉' : 'ℹ'} BRAIN CAUGHT SOMETHING
      </p>
      <p
        style={{
          font: '12px/1.4 DM Mono, Courier New, monospace',
          color: '#e0ddd6',
          margin: '0 0 4px',
          fontWeight: 600,
        }}
      >
        {title}
      </p>
      {message && (
        <p
          style={{
            font: '11px/1.6 DM Mono, Courier New, monospace',
            color: bodyColor,
            margin: '0 0 10px',
          }}
        >
          {message}
        </p>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        {fixInstruction && (
          <button
            onClick={() => onFix(fixInstruction)}
            style={{
              background: actionBg,
              border: `1px solid ${borderColor}`,
              color: bodyColor,
              font: '10px/1 DM Mono, Courier New, monospace',
              padding: '5px 10px',
              cursor: 'pointer',
              borderRadius: 3,
            }}
          >
            Fix it now
          </button>
        )}
        <button
          onClick={() => onDismiss(alert.id)}
          style={{
            background: 'none',
            border: `1px solid ${borderColor}`,
            color: bodyColor,
            font: '10px/1 DM Mono, Courier New, monospace',
            padding: '5px 10px',
            cursor: 'pointer',
            borderRadius: 3,
            opacity: 0.6,
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

export type { BrainAlert }
