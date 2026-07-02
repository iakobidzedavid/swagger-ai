import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getPrintifyClient } from '@/lib/printify'

export const runtime = 'nodejs'

/**
 * GET /api/printify/shop
 *
 * Get the Printify shop ID associated with a domain
 *
 * Query params:
 *   - domain: The company domain (e.g., acme.com)
 *
 * In production, this would:
 * 1. Check if domain has a cached shop ID in the database
 * 2. If not, use Printify OAuth to get the shop ID
 * 3. Cache the shop ID for future requests
 *
 * NOTE: Requires PRINTIFY_API_KEY environment variable
 */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')

  if (!domain) {
    return NextResponse.json({ error: 'domain query parameter is required' }, { status: 400 })
  }

  const printifyClient = getPrintifyClient()

  if (printifyClient.isMockMode()) {
    // In mock mode, generate a consistent mock shop ID based on domain
    const mockShopId = `mock-shop-${domain.replace(/\./g, '-')}`
    return NextResponse.json(
      {
        shopId: mockShopId,
        domain,
        status: 'mock',
        message:
          'Running in mock mode. Set PRINTIFY_API_KEY to use real Printify shops.',
      },
      { status: 200 }
    )
  }

  try {
    // TODO: In production, this would:
    // 1. Check if the user has authorized Printify via OAuth
    // 2. Get their real Printify shop ID
    // 3. Cache it in the database
    //
    // For now, we cannot get the real shop ID without OAuth
    return NextResponse.json(
      {
        error: 'Printify OAuth not yet configured. PRINTIFY_API_KEY is set but OAuth integration is required.',
        message:
          'To use real Printify shops, set up OAuth authentication and user account linking.',
      },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error getting Printify shop:', error)
    return NextResponse.json({ error: 'Failed to get or create shop' }, { status: 500 })
  }
}
