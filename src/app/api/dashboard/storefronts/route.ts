import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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

    // Fetch user's storefronts with aggregated order stats
    const { data: storefronts, error: storefrontError } = await supabase
      .from('storefront_requests')
      .select(
        `
        id,
        domain,
        company_name,
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

    // Aggregate stats for each storefront
    const storefrontStats = (storefronts || []).map((sf: any) => {
      const completedOrders = (sf.orders || []).filter((o: any) => o.status === 'completed')
      const totalGmv = completedOrders.reduce((sum: number, o: any) => sum + o.total_amount_cents, 0)
      const swaggerFee = completedOrders.reduce((sum: number, o: any) => sum + o.swagger_fee_cents, 0)

      return {
        id: sf.id,
        domain: sf.domain,
        companyName: sf.company_name,
        status: sf.status,
        createdAt: sf.created_at,
        gmvCents: totalGmv,
        gmvDisplay: `$${(totalGmv / 100).toFixed(2)}`,
        swaggerFeeCents: swaggerFee,
        swaggerFeeDisplay: `$${(swaggerFee / 100).toFixed(2)}`,
        orderCount: completedOrders.length,
      }
    })

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
