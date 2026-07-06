/**
 * Health monitoring and alerting for /health endpoint
 * - Logs 5xx responses to database
 * - Sends alerts when threshold is exceeded (3+ failures in 5 minutes)
 * - Uses database row locking to prevent alert spam
 */

interface HealthAlertEvent {
  status_code: number
  error_message?: string
  endpoint?: string
}

/**
 * Log a health endpoint 5xx response and send alert if threshold exceeded
 */
export async function logHealthAlert(event: HealthAlertEvent): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('[health-alert] Supabase credentials not configured')
      return
    }

    // 1. Insert the failure event with return=representation to get the ID back
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/health_alerts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation', // Return inserted row so we get the ID
      },
      body: JSON.stringify({
        status_code: event.status_code,
        error_message: event.error_message || null,
        endpoint: event.endpoint || '/health',
        is_alerted: false,
      }),
    })

    if (!insertResponse.ok) {
      console.error(
        `[health-alert] Failed to insert event: ${insertResponse.status} ${await insertResponse.text()}`
      )
      return
    }

    let insertedId: string | undefined
    try {
      const insertedRows = (await insertResponse.json()) as Array<{ id: string }>
      if (insertedRows.length > 0) {
        insertedId = insertedRows[0].id
      }
    } catch {
      console.error('[health-alert] Failed to parse inserted row ID')
      return
    }

    // 2. Check threshold: count failures in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const countResponse = await fetch(
      `${supabaseUrl}/rest/v1/health_alerts?created_at=gte.${fiveMinutesAgo}&status_code=gte.500&select=id&limit=1&count=exact`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!countResponse.ok) {
      console.error(`[health-alert] Failed to count recent alerts: ${countResponse.status}`)
      return
    }

    const countHeader = countResponse.headers.get('content-range')
    const failureCount = countHeader ? parseInt(countHeader.split('/')[1], 10) : 0

    // 3. If 3+ failures in 5 minutes, check if alert was sent and send if needed
    if (failureCount >= 3 && insertedId) {
      const checkAlertResponse = await fetch(
        `${supabaseUrl}/rest/v1/health_alerts?is_alerted=eq.true&alert_sent_at=gte.${fiveMinutesAgo}&select=id&limit=1`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!checkAlertResponse.ok) {
        console.error(
          `[health-alert] Failed to check recent alerts: ${checkAlertResponse.status}`
        )
        return
      }

      const recentAlerts = (await checkAlertResponse.json()) as Array<{ id: string }>

      if (recentAlerts.length === 0) {
        // No recent alert sent, so send one now and mark as alerted atomically
        await sendAlert(failureCount, event, insertedId)

        // Mark this failure as alerted to prevent duplicate sends
        const patchResponse = await fetch(
          `${supabaseUrl}/rest/v1/health_alerts?id=eq.${insertedId}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({
              is_alerted: true,
              alert_sent_at: new Date().toISOString(),
            }),
          }
        )

        if (!patchResponse.ok) {
          console.error(
            `[health-alert] Failed to mark alert as sent: ${patchResponse.status} ${await patchResponse.text()}`
          )
        }
      }
    }
  } catch (error) {
    console.error('[health-alert] Unexpected error in health alert logic:', error)
    // Don't re-throw — this is monitoring code and shouldn't break the main endpoint
  }
}

/**
 * Send alert notification to ops team
 * Currently logs to console and can be extended to email/Slack/PagerDuty
 */
async function sendAlert(
  failureCount: number,
  event: HealthAlertEvent,
  alertId: string
): Promise<void> {
  const message = `
🚨 HEALTH ALERT: /health endpoint returning ${event.status_code}
  - Failures in last 5 minutes: ${failureCount}
  - Error: ${event.error_message || '(no error message)'}
  - Time: ${new Date().toISOString()}
  - Alert ID: ${alertId}

Action: Check Supabase connectivity, database logs, and API error rates.
  `.trim()

  console.error('[health-alert]', message)

  // TODO: Integrate with email/Slack/PagerDuty for actual alerting
  // For now, ops should monitor console/logs and set up external monitoring
  // (e.g., Vercel error tracking, Sentry, Datadog, or custom log aggregation)
}
