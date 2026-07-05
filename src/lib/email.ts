import { supabase } from '@/lib/supabase'

/**
 * Email notification service
 *
 * Sends transactional emails for:
 * - Order confirmations (immediately after purchase)
 * - Fulfillment updates (when Printify starts production)
 * - Shipment updates (when order ships, arrives)
 *
 * Logs all sent notifications to the database for audit/retry purposes.
 */

interface OrderItem {
  productName: string
  quantity: number
  unitPrice: number
}

interface OrderConfirmationData {
  orderId?: string | null
  customerName: string
  customerEmail: string
  domain: string
  items: OrderItem[]
  totalAmount: number
  itemCount: number
}

interface FulfillmentUpdateData {
  orderId?: string | null
  customerEmail: string
  customerName: string
  status: 'confirmed' | 'in_progress' | 'shipped' | 'delivered'
  trackingCarrier?: string
  trackingNumber?: string
  trackingUrl?: string
}

/**
 * Send an order confirmation email
 */
export async function sendOrderConfirmation(
  data: OrderConfirmationData
): Promise<{ success: boolean; error?: string }> {
  try {
    const subject = `Order Confirmation - ${data.domain}`
    const html = generateOrderConfirmationHtml(data)

    // Log the notification to database
    const { data: notifResult, error: notifError } = await supabase
      .from('email_notifications')
      .insert({
        order_id: data.orderId || null,
        recipient_email: data.customerEmail,
        notification_type: 'order_confirmation',
        status: 'pending',
        subject,
      })
      .select('id')
      .single()

    if (notifError || !notifResult) {
      console.error('[Email Service] Failed to log notification:', notifError)
      return { success: false, error: 'Failed to log notification' }
    }

    // Send the email
    const sendResult = await sendEmail(
      data.customerEmail,
      subject,
      html,
      data.customerName
    )

    if (!sendResult.success) {
      // Mark as failed in database
      await supabase
        .from('email_notifications')
        .update({
          status: 'failed',
          failed_reason: sendResult.error,
          updated_at: new Date().toISOString(),
        })
        .eq('id', notifResult.id)

      return { success: false, error: sendResult.error }
    }

    // Mark as sent in database
    await supabase
      .from('email_notifications')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        provider_message_id: sendResult.messageId ?? null,
      })
      .eq('id', notifResult.id)

    return { success: true }
  } catch (error) {
    console.error('[Email Service] Error sending order confirmation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send a fulfillment status update email
 */
export async function sendFulfillmentUpdate(
  data: FulfillmentUpdateData
): Promise<{ success: boolean; error?: string }> {
  try {
    const subject = generateFulfillmentSubject(data.status)
    const html = generateFulfillmentUpdateHtml(data)

    // Log the notification to database
    const { data: notifResult, error: notifError } = await supabase
      .from('email_notifications')
      .insert({
        order_id: data.orderId || null,
        recipient_email: data.customerEmail,
        notification_type: 'fulfillment_update',
        status: 'pending',
        subject,
      })
      .select('id')
      .single()

    if (notifError || !notifResult) {
      console.error('[Email Service] Failed to log notification:', notifError)
      return { success: false, error: 'Failed to log notification' }
    }

    // Send the email
    const sendResult = await sendEmail(
      data.customerEmail,
      subject,
      html,
      data.customerName
    )

    if (!sendResult.success) {
      // Mark as failed in database
      await supabase
        .from('email_notifications')
        .update({
          status: 'failed',
          failed_reason: sendResult.error,
          updated_at: new Date().toISOString(),
        })
        .eq('id', notifResult.id)

      return { success: false, error: sendResult.error }
    }

    // Mark as sent in database
    await supabase
      .from('email_notifications')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        provider_message_id: sendResult.messageId ?? null,
      })
      .eq('id', notifResult.id)

    return { success: true }
  } catch (error) {
    console.error('[Email Service] Error sending fulfillment update:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Pica passthrough base URL. Fixed, public — not a secret, so it is a literal
// constant rather than an env var (avoids an unnecessary @@NEEDS_ENV flag).
const PICA_PASSTHROUGH_BASE = 'https://api.picaos.com/v1/passthrough'

// Pica's stable action id for "Send a User's Gmail Message" (gmail platform).
// This identifies the action to Pica's router; it is not a credential.
const GMAIL_SEND_ACTION_ID = 'conn_mod_def::GJ3odhCpd3I::gujvYoneSk6NFWltse9bGg'

/**
 * Internal: Send email via the connected Gmail account, through Pica's HTTP
 * passthrough API.
 *
 * Requires two credentials:
 *  - PICA_SECRET               — Pica account secret (provisioned)
 *  - PICA_GMAIL_CONNECTION_KEY — identifies which connected Gmail mailbox to
 *                                send through (per-connection, not provisioned yet)
 *
 * If either is missing, or the Pica call itself fails, this returns
 * success:false with the REAL reason — it never fakes a "sent" result.
 */
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  displayName?: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const result = await sendEmailViaPica(to, subject, html, displayName)

    if (!result.success) {
      console.warn(
        `[Email Service] NOT sent — ${result.error} (to: ${to}, subject: "${subject}")`
      )
    } else {
      console.log(
        `[Email Service] Sent via Pica Gmail: ${to} (subject: "${subject}", messageId: ${result.messageId})`
      )
    }

    return result
  } catch (error) {
    console.error('[Email Service] Error sending email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send a real email through Gmail via Pica's HTTP passthrough API.
 *
 * This is a plain `fetch` call — no MCP tool imports. App code (Next.js API
 * routes / serverless functions) cannot invoke MCP tools at runtime; those
 * only exist inside an agent session. Pica's passthrough REST API is the
 * real integration surface for production code.
 *
 * Passthrough contract (mirrors Pica's own action metadata for
 * gmail.users.messages.send):
 *   POST {PICA_PASSTHROUGH_BASE}/gmail/v1/users/me/messages/send
 *   headers: x-pica-secret, x-pica-connection-key, x-pica-action-id
 *   body: { raw: <base64url RFC2822 message>, connectionKey }
 */
async function sendEmailViaPica(
  to: string,
  subject: string,
  html: string,
  displayName?: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const secret = process.env.PICA_SECRET
  const connectionKey = process.env.PICA_GMAIL_CONNECTION_KEY

  if (!secret) {
    return { success: false, error: 'PICA_SECRET is not configured — cannot authenticate to Pica' }
  }
  if (!connectionKey) {
    return {
      success: false,
      error:
        'PICA_GMAIL_CONNECTION_KEY is not configured — no Gmail mailbox is connected to send through',
    }
  }

  const raw = buildRawGmailMessage(to, subject, html, displayName)

  let resp: Response
  try {
    resp = await fetch(`${PICA_PASSTHROUGH_BASE}/gmail/v1/users/me/messages/send`, {
      method: 'POST',
      headers: {
        'x-pica-secret': secret,
        'x-pica-connection-key': connectionKey,
        'x-pica-action-id': GMAIL_SEND_ACTION_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw, connectionKey }),
    })
  } catch (error) {
    return {
      success: false,
      error: `Pica request failed: ${error instanceof Error ? error.message : 'network error'}`,
    }
  }

  const bodyText = await resp.text()

  if (!resp.ok) {
    return {
      success: false,
      error: `Pica Gmail send failed (HTTP ${resp.status}): ${bodyText.slice(0, 500)}`,
    }
  }

  let parsed: { id?: string; threadId?: string } = {}
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    // Non-JSON 2xx body — still a real success, just no message id to report.
  }

  return { success: true, messageId: parsed.id }
}

/**
 * Build a base64url-encoded RFC 2822 message for the Gmail API's
 * `users.messages.send` `raw` field. `From` is intentionally omitted — Gmail
 * fills it in with the authenticated (connected) account automatically.
 */
function buildRawGmailMessage(
  to: string,
  subject: string,
  html: string,
  displayName?: string
): string {
  // Strip CR/LF from every value that lands in a raw header line. `to` and
  // `displayName` come from customer-supplied checkout fields (name/email) —
  // without this, a name like "Foo\r\nBcc: attacker@evil.com" would inject
  // arbitrary headers into the RFC2822 message we hand to Gmail.
  const safeTo = stripHeaderInjection(to)
  const safeSubject = stripHeaderInjection(subject)
  const toHeader = displayName
    ? `"${stripHeaderInjection(displayName).replace(/"/g, "'")}" <${safeTo}>`
    : safeTo

  const message = [
    `To: ${toHeader}`,
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

/** Removes CR/LF (and the header-continuation whitespace that follows them)
 *  so untrusted input can never inject additional RFC 2822 header lines. */
function stripHeaderInjection(value: string): string {
  return value.replace(/[\r\n]+\s*/g, ' ').trim()
}

/** MIME encoded-word for subjects containing non-ASCII characters. */
function encodeMimeSubject(subject: string): string {
  if (/^[\x00-\x7F]*$/.test(subject)) return subject
  return `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`
}

/**
 * Generate HTML for order confirmation email
 */
function generateOrderConfirmationHtml(data: OrderConfirmationData): string {
  const itemsHtml = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
        ${item.productName} x${item.quantity}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
        $${(item.unitPrice * item.quantity).toFixed(2)}
      </td>
    </tr>
  `
    )
    .join('')

  const totalCents = Math.round(data.totalAmount * 100)

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.domain} - Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table style="width: 100%; max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <!-- Header -->
    <tr>
      <td style="padding: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Order Confirmed!</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Thanks for your purchase</p>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 32px;">
        <p style="margin: 0 0 16px 0; color: #333; font-size: 14px;">Hi ${data.customerName},</p>

        <p style="margin: 0 0 24px 0; color: #666; font-size: 14px; line-height: 1.6;">
          Your order from <strong>${data.domain}</strong> has been confirmed and is now being processed.
          You'll receive another email when your items ship.
        </p>

        <!-- Order Details -->
        <div style="margin: 24px 0; padding: 16px; background: #f8f9fa; border-radius: 6px;">
          <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #333;">Order Items</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${itemsHtml}
          </table>
        </div>

        <!-- Order Total -->
        <div style="margin: 24px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee; padding: 16px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #333; font-size: 16px; font-weight: 600;">Order Total</td>
              <td style="padding: 8px 0; color: #333; font-size: 16px; font-weight: 600; text-align: right;">$${(totalCents / 100).toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <p style="margin: 24px 0 0 0; color: #666; font-size: 13px; line-height: 1.6;">
          If you have any questions about your order, please reply to this email or visit your account dashboard.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 24px; background: #f8f9fa; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
        <p style="margin: 0 0 8px 0;">Powered by <strong>Swagger AI</strong></p>
        <p style="margin: 0; opacity: 0.7;">© 2026 Swagger AI. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

/**
 * Generate HTML for fulfillment update email
 */
function generateFulfillmentUpdateHtml(data: FulfillmentUpdateData): string {
  const statusMessages: Record<string, { title: string; message: string; emoji: string }> = {
    confirmed: {
      title: 'Order Confirmed',
      message: 'Your order has been confirmed and is being prepared for production. We will send you another update when your items ship!',
      emoji: '✅',
    },
    in_progress: {
      title: 'In Production',
      message: 'Great news! Your items are now being printed and prepared for shipment. We will notify you as soon as they are on their way.',
      emoji: '🎨',
    },
    shipped: {
      title: 'Order Shipped!',
      message: 'Your order is on its way to you! Click the tracking link below to monitor your package journey.',
      emoji: '📦',
    },
    delivered: {
      title: 'Order Delivered',
      message: 'Your order has been delivered! We hope you love your new merchandise. Share your photos with us on social media!',
      emoji: '🎉',
    },
  }

  const status = data.status as keyof typeof statusMessages
  const { title, message, emoji } = statusMessages[status] || statusMessages.confirmed

  let trackingHtml = ''
  if (data.trackingNumber) {
    const trackingUrl = data.trackingUrl || `https://tracking.example.com/${data.trackingNumber}`
    trackingHtml = `
      <div style="margin: 24px 0; padding: 20px; background: linear-gradient(135deg, #e7f5ff 0%, #d5e8ff 100%); border-radius: 8px; border-left: 4px solid #1971c2;">
        <p style="margin: 0 0 12px 0; font-size: 13px; color: #1971c2; font-weight: 700; text-transform: uppercase;">📍 TRACKING INFORMATION</p>
        <table style="width: 100%; margin-bottom: 12px; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #333; font-weight: 500;">Carrier:</td>
            <td style="padding: 6px 0 6px 16px; font-size: 14px; color: #333;">${data.trackingCarrier || 'Standard Shipping'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #333; font-weight: 500;">Tracking Number:</td>
            <td style="padding: 6px 0 6px 16px; font-size: 14px; color: #1971c2; font-family: 'Courier New', monospace; font-weight: 600;">${data.trackingNumber}</td>
          </tr>
        </table>
        <a href="${trackingUrl}" style="display: inline-block; margin-top: 12px; padding: 12px 24px; background: #1971c2; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; transition: background 0.3s ease;">→ Track Your Package</a>
      </div>
    `
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Update - ${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa;">
  <table style="width: 100%; max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
    <!-- Header with Status Emoji -->
    <tr>
      <td style="padding: 40px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 12px;">${emoji}</div>
        <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">${title}</h1>
        ${data.orderId ? `<p style="margin: 8px 0 0 0; opacity: 0.95; font-size: 15px;">Order #${data.orderId.substring(0, 8).toUpperCase()}</p>` : ''}
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 32px;">
        <p style="margin: 0 0 20px 0; color: #333; font-size: 16px; font-weight: 500;">Hi ${data.customerName},</p>

        <p style="margin: 0 0 28px 0; color: #555; font-size: 15px; line-height: 1.7;">
          ${message}
        </p>

        ${trackingHtml}

        <hr style="margin: 28px 0; border: none; border-top: 1px solid #e5e7eb;" />

        <p style="margin: 0; color: #666; font-size: 13px; line-height: 1.6;">
          Questions about your order? Reply to this email or check your account dashboard for more details.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 24px 32px; background: #f8f9fa; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="margin: 0 0 8px 0; color: #666; font-size: 13px; font-weight: 500;">Powered by <strong style="color: #667eea;">Swagger AI</strong></p>
        <p style="margin: 0; color: #999; font-size: 12px;">© 2026 Swagger AI. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

/**
 * Generate subject line for fulfillment update based on status
 */
function generateFulfillmentSubject(status: string): string {
  const subjects: Record<string, string> = {
    confirmed: 'Your order has been confirmed',
    in_progress: 'Your order is in production',
    shipped: 'Your order is on the way',
    delivered: 'Your order has been delivered',
  }

  return subjects[status] || 'Order update'
}

/**
 * Retry failed email notifications
 * Can be called by a cron job or manually to retry failed sends
 */
export async function retryFailedNotifications(): Promise<{
  attempted: number
  successful: number
}> {
  try {
    // Get failed notifications from the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: failedNotifs, error: queryError } = await supabase
      .from('email_notifications')
      .select('id, order_id, recipient_email, notification_type')
      .eq('status', 'failed')
      .gte('created_at', twentyFourHoursAgo)

    if (queryError || !failedNotifs) {
      console.error('[Email Service] Failed to query failed notifications:', queryError)
      return { attempted: 0, successful: 0 }
    }

    let successful = 0

    for (const notif of failedNotifs) {
      // Attempt to resend - simplified retry
      console.log(
        `[Email Service] Retrying notification ${notif.id} for ${notif.recipient_email}`
      )

      // In a real implementation, you would:
      // 1. Fetch the full order/notification details
      // 2. Re-send the email
      // 3. Update the notification status
      // For now, just log
    }

    return {
      attempted: failedNotifs.length,
      successful,
    }
  } catch (error) {
    console.error('[Email Service] Error retrying failed notifications:', error)
    return { attempted: 0, successful: 0 }
  }
}
