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
 * This endpoint:
 * 1. Checks if the domain has a connected Printify account via OAuth
 * 2. Returns the shop ID if found
 * 3. Falls back to mock mode if not connected
 *
 * NOTE: Requires OAuth setup for real Printify integration
 */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')

  if (!domain) {
    return NextResponse.json({ error: 'domain query parameter is required' }, { status: 400 })
  }

  try {
    // Check if this domain has a connected Printify account
    const { data: account, error } = await supabase
      .from('printify_accounts')
      .select('shop_id, shop_title, is_active')
      .eq('domain', domain)
      .eq('is_active', true)
      .single()

    if (!error && account) {
      // Domain has a connected OAuth account
      return NextResponse.json(
        {
          shopId: account.shop_id,
          shopTitle: account.shop_title,
          domain,
          status: 'connected',
          message: 'Shop connected via OAuth',
        },
        { status: 200 }
      )
    }

    // No OAuth connection found, check if we're in mock mode
    const printifyClient = getPrintifyClient()

    if (printifyClient.isMockMode()) {
      // In mock mode, generate a consistent mock shop ID based on domain
      const mockShopId = `mock-shop-${domain.replace(/\./g, '-')}`
      return NextResponse.json(
        {
          shopId: mockShopId,
          domain,
          status: 'mock',
          message: 'Running in mock mode. Set PRINTIFY_API_KEY and OAuth to use real Printify shops.',
        },
        { status: 200 }
      )
    }

    // Real API key is set but no OAuth connection found
    return NextResponse.json(
      {
        error: 'No Printify shop connected',
        message: 'Please connect your Printify account first',
        connectUrl: `/connect-shop?domain=${encodeURIComponent(domain)}`,
      },
      { status: 401 }
    )
  } catch (error) {
    console.error('Error getting Printify shop:', error)
    return NextResponse.json({ error: 'Failed to get shop' }, { status: 500 })
  }
}
