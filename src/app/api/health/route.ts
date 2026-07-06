import { NextResponse } from 'next/server'
import { gatherHealthMetrics } from '@/lib/health-metrics'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const metrics = await gatherHealthMetrics()

    // Return appropriate HTTP status based on health status
    // Uptime monitors (Datadog, PagerDuty, etc.) rely on 503 to trigger alerts
    const statusCode = metrics.status === 'healthy' ? 200 : 503

    return NextResponse.json(metrics, {
      status: statusCode,
      headers: {
        // Cache for 30s to reduce load, but short enough to catch issues quickly
        'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
        'X-Health-Status': metrics.status,
      },
    })
  } catch (error) {
    // On error, return 503 and degraded status
    // Ensures uptime monitors detect failures
    return NextResponse.json(
      {
        status: 'degraded',
        error: (error as Error).message,
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
