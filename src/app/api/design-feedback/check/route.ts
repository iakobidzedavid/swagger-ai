import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

interface CheckResponse {
  success: boolean
  submitted?: boolean
  error?: string
}

/**
 * GET /api/design-feedback/check?orderId=...
 *
 * Tells the order-confirmation page whether feedback was already captured for
 * this order, so the rating widget doesn't re-prompt on refresh.
 */
export async function GET(req: NextRequest): Promise<NextResponse<CheckResponse>> {
  const orderId = req.nextUrl.searchParams.get('orderId')
  if (!orderId) {
    return NextResponse.json({ success: false, error: 'orderId query param is required' }, { status: 400 })
  }

  try {
    const { data, error } = await supabase
      .from('design_feedback')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle()

    if (error) {
      console.error('Failed to check design feedback:', error)
      return NextResponse.json({ success: false, error: 'Failed to check feedback' }, { status: 500 })
    }

    return NextResponse.json({ success: true, submitted: !!data })
  } catch (err) {
    console.error('design-feedback/check error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
