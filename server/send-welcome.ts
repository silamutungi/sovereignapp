// server/send-welcome.ts
//
// Server-side only. Called by:
//   - vite.config.ts plugin middleware (npm run dev)
//   - api/send-welcome.ts Vercel serverless function (production)
//
// RESEND_API_KEY is loaded into process.env by vite.config.ts (loadEnv)
// and by Vercel's environment variable injection in production.

import { sendWelcomeEmail } from '../src/lib/provisioner'

export interface SendWelcomeParams {
  email: string
  projectName: string
  liveUrl: string
  repoUrl: string
}

export async function sendWelcome(params: SendWelcomeParams): Promise<{ success: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return { success: false, error: 'RESEND_API_KEY is not set' }
  }
  return sendWelcomeEmail(resendKey, params.email, params.projectName, params.liveUrl, params.repoUrl)
}
