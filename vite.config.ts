import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { generateAppSpec } from './server/generate'
import { sendWelcome } from './server/send-welcome'

// Serves /api/generate locally so `npm run dev` works without Vercel CLI.
// In production, api/generate.ts is the Vercel serverless function.
function sovereignApiPlugin(): Plugin {
  return {
    name: 'sovereign-api',
    configureServer(server) {
      server.middlewares.use('/api/send-welcome', (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        let body = ''
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        req.on('end', () => {
          void (async () => {
            try {
              const parsed = JSON.parse(body || '{}') as {
                email?: string
                projectName?: string
                liveUrl?: string
                repoUrl?: string
              }

              if (!parsed.email || !parsed.projectName) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: '`email` and `projectName` are required' }))
                return
              }

              const result = await sendWelcome({
                email: parsed.email,
                projectName: parsed.projectName,
                liveUrl: parsed.liveUrl ?? '',
                repoUrl: parsed.repoUrl ?? '',
              })

              if (!result.success) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: result.error }))
                return
              }

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: String(err) }))
            }
          })()
        })
      })

      server.middlewares.use('/api/generate', (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        let body = ''
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        req.on('end', () => {
          void (async () => {
            try {
              const parsed = JSON.parse(body || '{}') as { idea?: string }
              const idea = parsed.idea?.trim()

              if (!idea) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: '`idea` is required' }))
                return
              }

              const result = await generateAppSpec(idea)

              if (!result.success) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: result.error }))
                return
              }

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  appName: result.appName,
                  tagline: result.tagline,
                  primaryColor: result.primaryColor,
                  appType: result.appType,
                  template: result.template,
                }),
              )
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: String(err) }))
            }
          })()
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load ALL env vars (empty prefix = no filter) so server-side code can
  // access non-VITE_ keys like ANTHROPIC_API_KEY via process.env.
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    // sovereignApiPlugin is dev-only (configureServer middleware).
    // Exclude it from production builds to guarantee no dev code leaks through.
    plugins: [react(), ...(mode !== 'production' ? [sovereignApiPlugin()] : [])],
  }
})
