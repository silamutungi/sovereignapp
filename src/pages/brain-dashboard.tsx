import { useState, useEffect, type FC } from 'react'

interface Lesson {
  id: string
  category: string
  problem: string
  solution: string
  build_count: number
  created_at: string
}

interface BrainStats {
  lessons_count: number
  patterns_count: number
  builds_tracked: number
  trend?: string
}

const CATEGORY_COLOR: Record<string, string> = {
  generation: '#3B6D11',
  deployment: '#3B6D11',
  database:   '#3B6D11',
  oauth:      '#3B6D11',
  env_vars:   '#c0392b',
  ux:         '#3B6D11',
  agent:      '#3B6D11',
  general:    '#6b6862',
}

const BrainDashboard: FC = () => {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [stats, setStats] = useState<BrainStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('all')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/lessons')
        if (!res.ok) throw new Error('Failed to load lessons')
        const data = await res.json()
        setLessons(data.lessons || data || [])
        setStats(data.stats || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load brain data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const categories = ['all', ...new Set(lessons.map(l => l.category))]
  const filtered = activeCategory === 'all' ? lessons : lessons.filter(l => l.category === activeCategory)

  if (loading) {
    return (
      <>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        <div style={{ minHeight: '100vh', background: '#f2efe8', padding: '48px 32px', fontFamily: 'DM Mono, Courier New, monospace' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ height: '28px', background: '#d8d4ca', width: '220px', marginBottom: '40px', animation: 'pulse 1.4s infinite' }} />
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: '72px', background: '#d8d4ca', marginBottom: '8px', animation: 'pulse 1.4s infinite' }} />
            ))}
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f2efe8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, Courier New, monospace' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#c0392b', fontSize: '13px', marginBottom: '16px' }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', background: '#0e0d0b', color: '#f2efe8', border: 'none', cursor: 'pointer', font: '13px/1 DM Mono, Courier New, monospace', borderRadius: '4px' }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f2efe8', fontFamily: 'DM Mono, Courier New, monospace' }}>

      {/* Top bar */}
      <div style={{ background: '#0e0d0b', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/dashboard" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '20px', fontWeight: 400, color: '#f2efe8', textDecoration: 'none' }}>
          Visila<span style={{ color: '#FF1F6E' }}>.</span>
        </a>
        <a href="/dashboard" style={{ font: '11px/1 DM Mono, Courier New, monospace', color: '#6b6862', textDecoration: 'none' }}>
          ← Dashboard
        </a>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 32px 80px' }}>

        {/* Header */}
        <p style={{ font: '11px/1 DM Mono, Courier New, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b6862', margin: '0 0 10px' }}>
          Knowledge system
        </p>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '36px', fontWeight: 400, color: '#0e0d0b', margin: '0 0 32px', lineHeight: 1.15 }}>
          Visila Brain
        </h1>

        {/* Stats row */}
        <div style={{ display: 'flex', borderBottom: '1px solid #d8d4ca', marginBottom: '40px' }}>
          {[
            { label: 'Lessons', value: lessons.length },
            { label: 'Patterns', value: stats?.patterns_count ?? 0 },
            { label: 'Builds tracked', value: stats?.builds_tracked ?? 0 },
            { label: 'Trend', value: stats?.trend ?? 'stable' },
          ].map((stat, i, arr) => (
            <div
              key={stat.label}
              style={{
                paddingRight: i < arr.length - 1 ? '32px' : 0,
                marginRight: i < arr.length - 1 ? '32px' : 0,
                borderRight: i < arr.length - 1 ? '1px solid #d8d4ca' : 'none',
                paddingBottom: '24px',
              }}
            >
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '28px', color: '#0e0d0b' }}>
                {stat.value}
              </div>
              <div style={{ font: '11px/1 DM Mono, Courier New, monospace', textTransform: 'uppercase', color: '#6b6862', marginTop: '4px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '5px 12px',
                borderRadius: '100px',
                border: '1px solid',
                borderColor: activeCategory === cat ? '#0e0d0b' : '#d8d4ca',
                background: activeCategory === cat ? '#0e0d0b' : 'transparent',
                color: activeCategory === cat ? '#f2efe8' : '#6b6862',
                cursor: 'pointer',
                font: '11px/1 DM Mono, Courier New, monospace',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Lessons list */}
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <p style={{ font: '13px/1.6 DM Mono, Courier New, monospace', color: '#6b6862', margin: 0 }}>
              No lessons yet. The brain learns from every build.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#d8d4ca', border: '1px solid #d8d4ca' }}>
            {filtered.map(lesson => (
              <div
                key={lesson.id}
                style={{
                  background: '#f2efe8',
                  borderLeft: `3px solid ${CATEGORY_COLOR[lesson.category] ?? '#6b6862'}`,
                  padding: '20px 24px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{
                    font: '10px/1 DM Mono, Courier New, monospace',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: CATEGORY_COLOR[lesson.category] ?? '#6b6862',
                  }}>
                    {lesson.category}
                  </span>
                  {lesson.build_count > 0 && (
                    <span style={{ font: '11px/1 DM Mono, Courier New, monospace', color: '#6b6862' }}>
                      {lesson.build_count}× builds
                    </span>
                  )}
                </div>
                <p style={{ margin: '0 0 6px', font: '13px/1.5 DM Mono, Courier New, monospace', color: '#0e0d0b' }}>
                  {lesson.problem}
                </p>
                {lesson.solution && (
                  <p style={{ margin: 0, font: '12px/1.5 DM Mono, Courier New, monospace', color: '#6b6862' }}>
                    → {lesson.solution}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default BrainDashboard
