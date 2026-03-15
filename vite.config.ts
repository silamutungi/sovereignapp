import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { generateAppSpec } from './server/generate'

// Serves /api/generate locally so `npm run dev` works without Vercel CLI.
// In production, api/generate.ts is the Vercel serverless function.
function sovereignApiPlugin(): Plugin {
  return {
    name: 'sovereign-api',
    configureServer(server) {
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

export default defineConfig({
  plugins: [react(), sovereignApiPlugin()],
})
