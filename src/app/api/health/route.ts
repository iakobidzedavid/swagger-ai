import { NextResponse } from 'next/server'
import { gatherHealthMetrics } from '@/lib/health-metrics'
import { logHealthAlert } from '@/lib/health-alert'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const metrics = await gatherHealthMetrics()

    // Return appropriate HTTP status based on health status
    // Uptime monitors (Datadog, PagerDuty, etc.) rely on 503 to trigger alerts
    const statusCode = metrics.status === 'healthy' ? 200 : 503

    // Log alert if returning 5xx (degraded/unhealthy)
    if (statusCode >= 500) {
      // Fire-and-forget logging (don't block response)
      logHealthAlert({
        status_code: statusCode,
        error_message: metrics.status,
        endpoint: '/health',
      }).catch(err => console.error('[health] Alert logging error:', err))
    }

    return NextResponse.json(metrics, {
      status: statusCode,
      headers: {
        // Cache for 30s to reduce load, but short enough to catch issues quickly
        'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
        'X-Health-Status': metrics.status,
      },
    })
  } catch (error) {
    const errorMessage = (error as Error).message

    // Log error as 5xx alert
    logHealthAlert({
      status_code: 503,
      error_message: errorMessage,
      endpoint: '/health',
    }).catch(err => console.error('[health] Alert logging error:', err))

    // On error, return 503 and degraded status
    // Ensures uptime monitors detect failures
    return NextResponse.json(
      {
        status: 'degraded',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Health-Status': 'degraded',
        },
      }
    )
  }
}
