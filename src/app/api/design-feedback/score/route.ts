import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { normalizeDomain } from '@/lib/brand'

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
    const { data, error } = await supabase
      .from('design_feedback')
      .select('brand_accuracy_rating, would_reorder')
      .eq('domain', domain)

    if (error) {
      console.error('Failed to load design feedback score:', error)
      return NextResponse.json({ success: false, error: 'Failed to load score' }, { status: 500 })
    }

    const rows = data || []
    const responseCount = rows.length

    if (responseCount === 0) {
      return NextResponse.json({
        success: true,
        domain,
        responseCount: 0,
        brandAccuracyPct: null,
        reorderRatePct: null,
      })
    }

    const avgRating = rows.reduce((sum, r) => sum + r.brand_accuracy_rating, 0) / responseCount
    const brandAccuracyPct = Math.round((avgRating / 5) * 100)
    const reorderCount = rows.filter(r => r.would_reorder).length
    const reorderRatePct = Math.round((reorderCount / responseCount) * 100)

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
