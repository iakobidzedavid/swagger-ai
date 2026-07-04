import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeBrandFidelityScore } from '@/lib/design-feedback'

export const runtime = 'nodejs'

interface SubmitBody {
  orderId?: string
  brandAccuracyRating?: number
  wouldReorder?: boolean
  comment?: string
}

interface SubmitResponse {
  success: boolean
  id?: string
  score?: number | null
  error?: string
}

/**
 * POST /api/design-feedback/submit
 *
 * Persists a real employee response linking a completed order to a brand-accuracy
 * rating and reorder intent. This is the raw signal behind Swagger AI's core
 * (DE Step 10): the closed-loop outcome dataset that compounds with every order.
 */
export async function POST(req: NextRequest): Promise<NextResponse<SubmitResponse>> {
  let body: SubmitBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { orderId, brandAccuracyRating, wouldReorder, comment } = body

  if (!orderId || typeof orderId !== 'string') {
    return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 })
  }
  if (
    typeof brandAccuracyRating !== 'number' ||
    !Number.isInteger(brandAccuracyRating) ||
    brandAccuracyRating < 1 ||
    brandAccuracyRating > 5
  ) {
    return NextResponse.json(
      { success: false, error: 'brandAccuracyRating must be an integer between 1 and 5' },
      { status: 400 }
    )
  }
  if (typeof wouldReorder !== 'boolean') {
    return NextResponse.json({ success: false, error: 'wouldReorder must be a boolean' }, { status: 400 })
  }
  if (comment && (typeof comment !== 'string' || comment.length > 1000)) {
    return NextResponse.json({ success: false, error: 'comment must be a string under 1000 characters' }, { status: 400 })
  }

  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, domain')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('design_feedback')
      .upsert(
        {
          order_id: order.id,
          domain: order.domain,
          brand_accuracy_rating: brandAccuracyRating,
          would_reorder: wouldReorder,
          comment: comment?.trim() || null,
        },
        { onConflict: 'order_id' }
      )
      .select('id')
      .single()

    if (error || !data) {
      console.error('Failed to persist design feedback:', error)
      return NextResponse.json({ success: false, error: 'Failed to save feedback' }, { status: 500 })
    }

    const { brandAccuracyPct } = await computeBrandFidelityScore(order.domain)

    return NextResponse.json({ success: true, id: data.id, score: brandAccuracyPct })
  } catch (err) {
    console.error('design-feedback/submit error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
