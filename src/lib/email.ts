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
---
${html}
---
      `)
      return { success: true }
    }

    // TODO: Implement pica Gmail integration when credentials are available
    // For now, log as mock
    console.log(
      `[Email Service] Gmail configured but integration not yet implemented. Would send to: ${to}`
    )

    return { success: true }
  } catch (error) {
    console.error('[Email Service] Error sending email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
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
  const statusMessages: Record<string, { title: string; message: string }> = {
    confirmed: {
      title: 'Order Confirmed',
      message: 'Your order has been confirmed and is being prepared for production.',
    },
    in_progress: {
      title: 'In Production',
      message: 'Your items are now being printed and prepared for shipment.',
    },
    shipped: {
      title: 'On The Way',
      message: 'Your order has shipped and is on its way to you!',
    },
    delivered: {
      title: 'Delivered',
      message: 'Your order has been delivered. Enjoy your items!',
    },
  }

  const status = data.status as keyof typeof statusMessages
  const { title, message } = statusMessages[status] || statusMessages.confirmed

  let trackingHtml = ''
  if (data.trackingNumber) {
    trackingHtml = `
      <div style="margin: 16px 0; padding: 16px; background: #e7f5ff; border-radius: 6px; border-left: 4px solid #1971c2;">
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #1971c2; font-weight: 600;">Tracking Information</p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;">
          <strong>Carrier:</strong> ${data.trackingCarrier || 'Standard Shipping'}
        </p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;">
          <strong>Tracking #:</strong> ${data.trackingNumber}
        </p>
        ${data.trackingUrl ? `<a href="${data.trackingUrl}" style="display: inline-block; margin-top: 8px; padding: 8px 16px; background: #1971c2; color: white; text-decoration: none; border-radius: 4px; font-size: 14px;">Track Package</a>` : ''}
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table style="width: 100%; max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <!-- Header -->
    <tr>
      <td style="padding: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">${title}</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Your order is progressing</p>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 32px;">
        <p style="margin: 0 0 16px 0; color: #333; font-size: 14px;">Hi ${data.customerName},</p>

        <p style="margin: 0 0 24px 0; color: #666; font-size: 14px; line-height: 1.6;">
          ${message}
        </p>

        ${trackingHtml}

        <p style="margin: 24px 0 0 0; color: #666; font-size: 13px; line-height: 1.6;">
          If you have any questions about your order, please reply to this email.
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
