import { NextResponse } from 'next/server'
import { gatherHealthMetrics } from '@/lib/health-metrics'

export const runtime = 'nodejs'
export const revalidate = 60 // ISR revalidation every 60 seconds

export async function GET() {
  try {
    const metrics = await gatherHealthMetrics()

    // Always return 200 with status field for reliability
    // Uptime monitors check the status field, not HTTP status
    return NextResponse.json(metrics, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'X-Health-Status': metrics.status,
        'CDN-Cache-Control': 'max-age=60',
      },
    })
  } catch (error) {
    // Even on error, return 200 with degraded status
    // Prevents CDN 500 errors from breaking uptime monitoring
    return NextResponse.json(
      {
        status: 'degraded',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
        uptime_ms: 0,
        codebase: {
          tests: { count: 0, files: [] },
          git: { error: 'Error gathering metrics' },
          typescript: { compiled: false },
          eslint: { checked: false },
        },
        database: { connected: false, error: (error as Error).message },
        api: { responding: true, latency_ms: 0 },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=10, s-maxage=10',
          'X-Health-Status': 'degraded',
        },
      }
    )
  }
}
