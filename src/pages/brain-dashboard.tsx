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

const CATEGORY_COLORS: Record<string, string> = {
  generation: '#22c55e',
  deployment: '#3b82f6',
  database: '#8b5cf6',
  oauth: '#f97316',
  env_vars: '#ef4444',
  ux: '#ec4899',
  agent: '#06b6d4',
  general: '#6b7280',
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
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ height: '2rem', background: '#e5e7eb', borderRadius: '4px', width: '300px', marginBottom: '2rem', animation: 'pulse 1.5s ease-in-out infinite' }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '80px', background: '#e5e7eb', borderRadius: '8px', marginBottom: '1rem', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <p style={{ color: '#ef4444', fontFamily: 'DM Mono, monospace' }}>{error}</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#c8f060', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'DM Mono, monospace' }}>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2.5rem', marginBottom: '0.5rem', color: '#0e0d0b' }}>
        Sovereign Brain
      </h1>
      <p style={{ color: '#6b6862', marginBottom: '2rem', fontSize: '0.9rem' }}>
        The knowledge system that makes every build smarter than the last.
      </p>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Lessons Recorded', value: lessons.length, icon: '📚' },
          { label: 'Patterns Learned', value: stats?.patterns_count || 0, icon: '🔄' },
          { label: 'Builds Analyzed', value: stats?.builds_tracked || 0, icon: '🏗️' },
          { label: 'Quality Trend', value: stats?.trend || 'stable', icon: stats?.trend === 'improving' ? '↑' : '→' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{stat.icon}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0e0d0b' }}>{stat.value}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b6862' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '999px',
              border: '1px solid',
              borderColor: activeCategory === cat ? '#0e0d0b' : '#e5e7eb',
              background: activeCategory === cat ? '#0e0d0b' : '#ffffff',
              color: activeCategory === cat ? '#f2efe8' : '#0e0d0b',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontFamily: 'DM Mono, monospace',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Lessons List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b6862' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🧠</div>
          <p>No lessons yet. The brain learns from every build.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(lesson => (
            <div
              key={lesson.id}
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderLeft: `3px solid ${CATEGORY_COLORS[lesson.category] || '#6b7280'}`,
                borderRadius: '6px',
                padding: '1rem 1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '999px',
                  background: CATEGORY_COLORS[lesson.category] || '#6b7280',
                  color: '#ffffff',
                  fontFamily: 'DM Mono, monospace',
                }}>
                  {lesson.category}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6b6862' }}>
                  {lesson.build_count}× builds
                </span>
              </div>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#0e0d0b', fontWeight: 500 }}>
                {lesson.problem}
              </p>
              {lesson.solution && (
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b6862' }}>
                  → {lesson.solution}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default BrainDashboard
