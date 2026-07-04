import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { computeBrandFidelityScore } from '@/lib/design-feedback'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET(request: NextRequest) {
  try {
    // Get user from auth header (simplified — in production use NextAuth or Supabase auth session)
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authHeader.replace('Bearer ', '')

    // Fetch user's storefronts with aggregated order stats and brand data
    const { data: storefronts, error: storefrontError } = await supabase
      .from('storefront_requests')
      .select(
        `
        id,
        domain,
        company_name,
        logo_url,
        primary_color,
        secondary_color,
        status,
        created_at,
        orders:orders(id, total_amount_cents, swagger_fee_cents, status)
      `
      )
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })

    if (storefrontError) {
      console.error('Storefront fetch error:', storefrontError)
      return NextResponse.json({ error: 'Failed to fetch storefronts' }, { status: 500 })
    }

    // Aggregate stats for each storefront, including brand fidelity scores
    const storefrontStats = await Promise.all(
      (storefronts || []).map(async (sf: any) => {
        const completedOrders = (sf.orders || []).filter((o: any) => o.status === 'completed')
        const totalGmv = completedOrders.reduce((sum: number, o: any) => sum + o.total_amount_cents, 0)
        const swaggerFee = completedOrders.reduce((sum: number, o: any) => sum + o.swagger_fee_cents, 0)

        // Compute brand fidelity score from real design feedback
        const brandFidelity = await computeBrandFidelityScore(sf.domain)

        return {
          id: sf.id,
          domain: sf.domain,
          companyName: sf.company_name,
          logoUrl: sf.logo_url,
          primaryColor: sf.primary_color,
          secondaryColor: sf.secondary_color,
          status: sf.status,
          createdAt: sf.created_at,
          gmvCents: totalGmv,
          gmvDisplay: `$${(totalGmv / 100).toFixed(2)}`,
          swaggerFeeCents: swaggerFee,
          swaggerFeeDisplay: `$${(swaggerFee / 100).toFixed(2)}`,
          orderCount: completedOrders.length,
          brandFidelity: {
            responseCount: brandFidelity.responseCount,
            brandAccuracyPct: brandFidelity.brandAccuracyPct,
            reorderRatePct: brandFidelity.reorderRatePct,
          },
        }
      })
    )

    return NextResponse.json({
      storefronts: storefrontStats,
      totalGmvCents: storefrontStats.reduce((sum, s) => sum + s.gmvCents, 0),
      totalFeeCents: storefrontStats.reduce((sum, s) => sum + s.swaggerFeeCents, 0),
    })
  } catch (err) {
    console.error('Dashboard API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
