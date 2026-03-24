// agents/build/email-agent.js
// Takes product spec. Produces welcome email and magic link email HTML templates.
// Uses Resend-compatible HTML. Inline styles only.
// Returns: { templates: { welcome: string, magic_link: string } }

import { AgentBase } from '../../shared/agent-base-class.js'

// Brand tokens — mirror Sovereign's own email templates
const BRAND = {
  paper: '#f2efe8',
  ink: '#0e0d0b',
  green: '#c8f060',
  fontMono: 'DM Mono, Menlo, monospace',
  fontSerif: 'Playfair Display, Georgia, serif',
}

class EmailAgent extends AgentBase {
  constructor() {
    super({ name: 'email-agent', phase: 'build', version: '1.0.0' })
  }

  async run(context) {
    const { spec } = context

    if (!spec) {
      throw new Error('email-agent requires spec in context')
    }

    const appName = spec.name || 'Your App'
    const appUrl = spec.deploy_url || 'https://yourdomain.com'
    const primaryColor = spec.primaryColor || '#6366f1'

    this.log('info', 'Generating email templates', { app_name: appName })

    const welcome = this._buildWelcomeEmail(appName, appUrl, primaryColor, spec)
    const magic_link = this._buildMagicLinkEmail(appName, appUrl, primaryColor)

    this.log('info', 'Email templates generated', {
      welcome_length: welcome.length,
      magic_link_length: magic_link.length,
    })

    return { templates: { welcome, magic_link } }
  }

  _buildWelcomeEmail(appName, appUrl, primaryColor, spec) {
    const description = spec?.description || `${appName} is ready for you.`
    const supabaseUrl = 'https://supabase.com/dashboard'

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to ${appName}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.paper};font-family:${BRAND.fontMono};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.paper};padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND.ink};padding:32px 40px;">
              <p style="margin:0;font-family:${BRAND.fontSerif};font-size:28px;font-weight:700;color:#ffffff;">
                ${appName}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-family:${BRAND.fontSerif};font-size:24px;color:${BRAND.ink};">
                Your app is live.
              </h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3d3b37;">
                ${description}
              </p>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#3d3b37;">
                Click below to open your app and start using it.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:6px;background-color:${BRAND.ink};">
                    <a href="${appUrl}"
                       style="display:inline-block;padding:14px 28px;font-family:${BRAND.fontMono};font-size:14px;font-weight:600;color:${BRAND.green};text-decoration:none;letter-spacing:0.02em;">
                      Open ${appName} →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- One more step -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background-color:${BRAND.paper};border-radius:6px;padding:24px;border-left:4px solid ${BRAND.green};">
                <tr>
                  <td>
                    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${BRAND.ink};text-transform:uppercase;letter-spacing:0.08em;">
                      One more step
                    </p>
                    <p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#3d3b37;">
                      Connect your Supabase project to enable authentication and database features.
                    </p>
                    <a href="${supabaseUrl}"
                       style="font-size:14px;color:${BRAND.ink};font-weight:600;text-decoration:underline;">
                      Go to Supabase dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e8e4da;">
              <p style="margin:0;font-size:12px;color:#6b6862;line-height:1.5;">
                Built with <a href="https://sovereignapp.dev" style="color:#6b6862;">Sovereign</a>.
                You own this app completely — source code, domain, everything.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  }

  _buildMagicLinkEmail(appName, appUrl, primaryColor) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign in to ${appName}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.paper};font-family:${BRAND.fontMono};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.paper};padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND.ink};padding:32px 40px;">
              <p style="margin:0;font-family:${BRAND.fontSerif};font-size:28px;font-weight:700;color:#ffffff;">
                ${appName}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-family:${BRAND.fontSerif};font-size:24px;color:${BRAND.ink};">
                Your sign-in link.
              </h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3d3b37;">
                Click the button below to sign in to ${appName}. This link expires in 24 hours and can only be used once.
              </p>

              <!-- Magic link CTA -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="border-radius:6px;background-color:${BRAND.ink};">
                    <a href="{{MAGIC_LINK_URL}}"
                       style="display:inline-block;padding:14px 28px;font-family:${BRAND.fontMono};font-size:14px;font-weight:600;color:${BRAND.green};text-decoration:none;letter-spacing:0.02em;">
                      Sign in to ${appName} →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;line-height:1.5;color:#6b6862;">
                If you did not request this link, you can safely ignore this email.
                Your account is secure.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e8e4da;">
              <p style="margin:0;font-size:12px;color:#6b6862;line-height:1.5;">
                ${appName} &middot;
                <a href="${appUrl}" style="color:#6b6862;">Visit site</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  }

  async verify(output) {
    const { templates } = output

    for (const [key, html] of Object.entries(templates)) {
      // Must have no external stylesheets — inline only
      if (html.includes('<link rel="stylesheet"') || html.includes('<style>')) {
        this.logIssue({
          severity: 'high',
          message: `Email template "${key}" uses external/block styles — must be inline only`,
          file: `email-${key}`,
        })
      }
      // Must have lang="en"
      if (!html.includes('lang="en"')) {
        this.logIssue({
          severity: 'medium',
          message: `Email template "${key}" missing lang attribute on <html>`,
          file: `email-${key}`,
        })
      }
    }

    return output
  }
}

export default async function run(context) {
  return new EmailAgent().execute(context)
}
