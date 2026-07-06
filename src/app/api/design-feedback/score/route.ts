import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { normalizeDomain } from '@/lib/brand'
import { computeBrandFidelityScore } from '@/lib/design-feedback'

export const runtime = 'nodejs'

interface ScoreResponse {
  success: boolean
  domain?: string
  responseCount?: number
  brandAccuracyPct?: number | null
  reorderRatePct?: number | null
  error?: string
}

/**
 * GET /api/design-feedback/score?domain=example.com
 *
 * Aggregates REAL design_feedback rows for a storefront domain into a live
 * Brand Fidelity Score. Returns responseCount=0 with null percentages when no
 * feedback has been captured yet — never a fabricated number.
 */
export async function GET(req: NextRequest): Promise<NextResponse<ScoreResponse>> {
  const domainParam = req.nextUrl.searchParams.get('domain')
  if (!domainParam) {
    return NextResponse.json({ success: false, error: 'domain query param is required' }, { status: 400 })
  }
  const domain = normalizeDomain(domainParam)

  try {
    const { responseCount, brandAccuracyPct, reorderRatePct } = await computeBrandFidelityScore(domain)

    return NextResponse.json({
      success: true,
      domain,
      responseCount,
      brandAccuracyPct,
      reorderRatePct,
    })
  } catch (err) {
    console.error('design-feedback/score error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
