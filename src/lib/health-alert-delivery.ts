/**
 * Health alert delivery — sends operational alerts via email and Slack
 * when /health endpoint returns 5xx errors.
 *
 * Integrations:
 * - Email: Pica Gmail passthrough API (same as order confirmations)
 * - Slack: Direct webhook URL (webhook integration, not MCP)
 *
 * Both channels are best-effort: a delivery failure is logged but does not
 * propagate up (monitoring code should never break the main request).
 */

const PICA_PASSTHROUGH_BASE = 'https://api.picaos.com/v1/passthrough'
const GMAIL_SEND_ACTION_ID = 'conn_mod_def::GJ3odhCpd3I::gujvYoneSk6NFWltse9bGg'

interface AlertMessage {
  failureCount: number
  statusCode: number
  errorMessage?: string
  alertId: string
  timestamp: string
}

/**
 * Send a health alert email to the ops/monitoring team
 */
export async function sendHealthAlertEmail(alert: AlertMessage): Promise<void> {
  try {
    const secret = process.env.PICA_SECRET
    const connectionKey = process.env.PICA_GMAIL_CONNECTION_KEY
    const alertEmail = process.env.HEALTH_ALERT_EMAIL

    // If any required config is missing, just log and return gracefully
    if (!secret) {
      console.warn('[health-alert-delivery] PICA_SECRET not configured — cannot send email alert')
      return
    }
    if (!connectionKey) {
      console.warn(
        '[health-alert-delivery] PICA_GMAIL_CONNECTION_KEY not configured — cannot send email alert'
      )
      return
    }
    if (!alertEmail) {
      console.warn('[health-alert-delivery] HEALTH_ALERT_EMAIL not configured — cannot send email alert')
      return
    }

    const subject = `🚨 Health Alert: /health returning ${alert.statusCode}`
    const html = generateHealthAlertHtml(alert)
    const raw = buildRawGmailMessage(alertEmail, subject, html)

    const resp = await fetch(`${PICA_PASSTHROUGH_BASE}/gmail/v1/users/me/messages/send`, {
      method: 'POST',
      headers: {
        'x-pica-secret': secret,
        'x-pica-connection-key': connectionKey,
        'x-pica-action-id': GMAIL_SEND_ACTION_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw, connectionKey }),
    })

    const bodyText = await resp.text()

    if (!resp.ok) {
      console.error(
        `[health-alert-delivery] Email send failed (HTTP ${resp.status}): ${bodyText.slice(0, 200)}`
      )
      return
    }

    console.log(`[health-alert-delivery] Health alert email sent to ${alertEmail}`)
  } catch (error) {
    console.error('[health-alert-delivery] Error sending email alert:', error)
    // Don't re-throw — monitoring should never break the request
  }
}

/**
 * Send a health alert to Slack (if webhook is configured)
 */
export async function sendHealthAlertSlack(alert: AlertMessage): Promise<void> {
  try {
    const slackWebhook = process.env.HEALTH_ALERT_SLACK_WEBHOOK

    // If webhook not configured, just return gracefully
    if (!slackWebhook) {
      console.debug('[health-alert-delivery] HEALTH_ALERT_SLACK_WEBHOOK not configured — skipping Slack alert')
      return
    }

    const payload = {
      text: `🚨 Health Alert: /health returning ${alert.statusCode}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 Health Alert',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Status Code:*\n${alert.statusCode}`,
            },
            {
              type: 'mrkdwn',
              text: `*Failures (5min):*\n${alert.failureCount}`,
            },
            {
              type: 'mrkdwn',
              text: `*Endpoint:*\n/health`,
            },
            {
              type: 'mrkdwn',
              text: `*Alert ID:*\n${alert.alertId.substring(0, 8)}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Error:* ${alert.errorMessage || '(no details)'}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `📅 ${alert.timestamp}`,
            },
          ],
        },
      ],
    }

    const resp = await fetch(slackWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      const bodyText = await resp.text()
      console.error(
        `[health-alert-delivery] Slack webhook failed (HTTP ${resp.status}): ${bodyText.slice(0, 200)}`
      )
      return
    }

    console.log('[health-alert-delivery] Health alert Slack message sent')
  } catch (error) {
    console.error('[health-alert-delivery] Error sending Slack alert:', error)
    // Don't re-throw — monitoring should never break the request
  }
}

/**
 * Generate HTML for health alert email
 */
function generateHealthAlertHtml(alert: AlertMessage): string {
  const statusColors: Record<number, { bg: string; text: string }> = {
    500: { bg: '#fee', text: '#c33' },
    502: { bg: '#fee', text: '#c33' },
    503: { bg: '#fee', text: '#c33' },
  }

  const color = statusColors[alert.statusCode] || { bg: '#fee', text: '#c33' }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Health Alert</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table style="width: 100%; max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <!-- Header -->
    <tr>
      <td style="padding: 32px; background: ${color.bg}; border-left: 4px solid ${color.text};">
        <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: ${color.text};">🚨 Health Alert</h1>
        <p style="margin: 8px 0 0 0; color: ${color.text}; opacity: 0.8;">The /health endpoint is reporting errors</p>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 32px;">
        <!-- Status Summary -->
        <div style="margin: 0 0 24px 0; padding: 20px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid ${color.text};">
          <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #333;">Summary</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 500;">Endpoint:</td>
              <td style="padding: 8px 0 8px 16px; color: #333; font-family: monospace;">/health</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 500;">Status Code:</td>
              <td style="padding: 8px 0 8px 16px; color: ${color.text}; font-weight: 600; font-family: monospace;">${alert.statusCode}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 500;">Failures (5 min):</td>
              <td style="padding: 8px 0 8px 16px; color: #333; font-family: monospace;">${alert.failureCount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 500;">Time:</td>
              <td style="padding: 8px 0 8px 16px; color: #333; font-family: monospace;">${alert.timestamp}</td>
            </tr>
          </table>
        </div>

        <!-- Error Details -->
        ${alert.errorMessage ? `
        <div style="margin: 24px 0; padding: 16px; background: #fff3cd; border-radius: 6px; border-left: 4px solid #ff6b6b;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #333;">Error Details</h3>
          <p style="margin: 0; color: #555; font-size: 13px; font-family: monospace; line-height: 1.5; word-break: break-all;">
            ${escapeHtml(alert.errorMessage)}
          </p>
        </div>
        ` : ''}

        <!-- Action Items -->
        <div style="margin: 24px 0; padding: 16px; background: #e7f5ff; border-radius: 6px; border-left: 4px solid #1971c2;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #1971c2;">Recommended Actions</h3>
          <ul style="margin: 0; padding-left: 20px; color: #333; font-size: 13px; line-height: 1.6;">
            <li>Check Supabase database connectivity and status</li>
            <li>Review recent deployment logs and changes</li>
            <li>Monitor for cascading failures in dependent services</li>
            <li>Check external API quotas and rate limits</li>
          </ul>
        </div>

        <!-- Reference -->
        <p style="margin: 24px 0 0 0; color: #666; font-size: 12px; line-height: 1.6;">
          <strong>Alert ID:</strong> <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">${escapeHtml(alert.alertId)}</code>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 24px; background: #f8f9fa; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
        <p style="margin: 0 0 8px 0;">Automated health alert from <strong>Swagger AI</strong></p>
        <p style="margin: 0; opacity: 0.7;">© 2026 Swagger AI. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

/**
 * Build a base64url-encoded RFC 2822 message for Gmail API
 */
function buildRawGmailMessage(to: string, subject: string, html: string): string {
  const safeTo = stripHeaderInjection(to)
  const safeSubject = stripHeaderInjection(subject)

  const message = [
    `To: ${safeTo}`,
    `Subject: ${encodeMimeSubject(safeSubject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    html,
  ].join('\r\n')

  return Buffer.from(message, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Remove CR/LF to prevent header injection
 */
function stripHeaderInjection(value: string): string {
  return value.replace(/[\r\n]+\s*/g, ' ').trim()
}

/**
 * MIME encoded-word for subjects with non-ASCII characters
 */
function encodeMimeSubject(subject: string): string {
  if (/^[\x00-\x7F]*$/.test(subject)) {
    return subject
  }
  return `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`
}

/**
 * Escape HTML to prevent XSS in email body
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}
