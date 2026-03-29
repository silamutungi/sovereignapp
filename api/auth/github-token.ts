// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { code, redirect_uri } = req.body
  if (!code || !redirect_uri) return res.status(400).json({ error: 'Missing code or redirect_uri' })

  const clientId = process.env.VISILA_CLI_GITHUB_CLIENT_ID
  const clientSecret = process.env.VISILA_CLI_GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'GitHub OAuth not configured' })
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri
    })
  })

  const data = await response.json() as Record<string, string>

  if (data.error) {
    return res.status(400).json({ error: data.error_description ?? data.error })
  }

  return res.status(200).json({ access_token: data.access_token })
}
