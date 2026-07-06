import { NextResponse } from 'next/server'
import { gatherHealthMetrics } from '@/lib/health-metrics'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const metrics = await gatherHealthMetrics()

    // Return appropriate HTTP status based on health status
    const statusCode = metrics.status === 'healthy' ? 200 : 503

    return NextResponse.json(metrics, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': metrics.status,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
