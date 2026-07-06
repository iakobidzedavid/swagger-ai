/**
 * Health monitoring dashboard API
 * GET /api/health/monitoring — returns recent 5xx events and alert status
 * Used by ops to monitor service health and check if alerts have been triggered
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Monitoring unavailable: Supabase not configured' },
        { status: 503 }
      )
    }

    // Get recent 5xx events (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const alertsResponse = await fetch(
      `${supabaseUrl}/rest/v1/health_alerts?created_at=gte.${oneDayAgo}&order=created_at.desc&limit=100`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!alertsResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch alerts: ${alertsResponse.status}` },
        { status: 502 }
      )
    }

    const alerts = (await alertsResponse.json()) as Array<{
      id: string
      status_code: number
      error_message: string | null
      endpoint: string
      is_alerted: boolean
      alert_sent_at: string | null
      created_at: string
    }>

    // Calculate summary stats
    const failureCount = alerts.length
    const criticalAlerts = alerts.filter(a => a.is_alerted).length
    const latestFailure = alerts[0]
    const recentFailures = alerts.filter(
      a =>
        new Date(a.created_at).getTime() >
        Date.now() - 5 * 60 * 1000 // Last 5 minutes
    )

    return NextResponse.json({
      status: 'ok',
      monitoring: {
        last_24h: {
          total_5xx_events: failureCount,
          critical_alerts_sent: criticalAlerts,
          events: alerts.slice(0, 20), // Return top 20
        },
        last_5m: {
          failure_count: recentFailures.length,
          threshold_for_alert: 3,
          should_alert: recentFailures.length >= 3,
        },
        latest_event: latestFailure || null,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[health/monitoring] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch monitoring data' },
      { status: 500 }
    )
  }
}
