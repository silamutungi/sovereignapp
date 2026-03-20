// api/health.ts — Vercel Serverless Function
//
// GET /api/health
// Returns: { status: 'ok', timestamp, version }
//
// Used by uptime monitors and CI smoke tests.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function handler(_req: any, res: any): void {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  })
}
