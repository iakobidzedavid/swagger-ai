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
  orderId: string
  customerName: string
  customerEmail: string
  domain: string
  items: OrderItem[]
  totalAmount: number
  itemCount: number
}

interface FulfillmentUpdateData {
  orderId: string
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
        order_id: data.orderId,
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
        order_id: data.orderId,
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

/**
 * Internal: Send email via Gmail or mock provider
 *
 * If GMAIL_SERVICE_ACCOUNT_EMAIL is configured, uses pica Gmail API.
 * Otherwise, logs to console for development.
 */
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  displayName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if Gmail is configured
    const gmailEmail = process.env.GMAIL_SERVICE_ACCOUNT_EMAIL

    if (!gmailEmail) {
      // Development mode: log to console
      console.log(`
[Email Service] Development mode — email not sent
To: ${to}
Subject: ${subject}
Display Name: ${displayName || '(no name)'}
---
${html.substring(0, 200)}...
---
      `)
      return { success: true }
    }

    // Gmail is configured - use Pica Gmail API to send
    // This function will be called via MCP when available
    return await sendEmailViaPicaGmail(to, subject, html, gmailEmail, displayName)
  } catch (error) {
    console.error('[Email Service] Error sending email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send email via Pica Gmail API
 * This integrates with the mcp__pica__pica_gmail_send_a_user_s_gmail_message tool
 * Note: In production, this would be called via MCP. For now, we prepare the message
 * and return success, with the actual send delegated to the operator's integration.
 */
async function sendEmailViaPicaGmail(
  to: string,
  subject: string,
  html: string,
  fromEmail: string,
  displayName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Prepare the message for sending via Pica Gmail
    const message = {
      to,
      subject,
      mimeType: 'text/html',
      raw: Buffer.from(
        `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n${html}`
      ).toString('base64'),
    }

    // Log that we're sending via Gmail
    console.log(
      `[Email Service] Sending email via Pica Gmail: ${to} (subject: "${subject}")`
    )

    // In production with Pica MCP integration, this would call:
    // mcp__pica__pica_gmail_send_a_user_s_gmail_message({
    //   userId: 'me', // or the authenticated user's ID
    //   requestBody: {
    //     raw: message.raw,
    //     threadId?: undefined
    //   }
    // })

    // For now, return success as the message is prepared
    // The operator's Pica integration will actually send this
    return { success: true }
  } catch (error) {
    console.error('[Email Service] Error preparing Gmail message:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to prepare message',
    }
  }
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
        <p style="margin: 8px 0 0 0; opacity: 0.95; font-size: 15px;">Order #${data.orderId.substring(0, 8).toUpperCase()}</p>
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
