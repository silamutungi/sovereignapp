// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { code, redirect_uri, code_verifier } = req.body
  if (!code || !redirect_uri) return res.status(400).json({ error: 'Missing code or redirect_uri' })

  const clientId = process.env.VISILA_CLI_VERCEL_CLIENT_ID
  const clientSecret = process.env.VISILA_CLI_VERCEL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Vercel OAuth not configured' })
  }

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri,
    ...(code_verifier ? { code_verifier } : {})
  })

  const response = await fetch('https://api.vercel.com/v2/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })

  const data = await response.json() as Record<string, string>

  if (!response.ok) {
    return res.status(400).json({ error: data.error ?? 'Token exchange failed' })
  }

  return res.status(200).json({ access_token: data.access_token })
}
