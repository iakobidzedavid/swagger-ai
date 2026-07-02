import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

/**
 * GET /api/printify/account?domain=acme.com
 *
 * Retrieves the Printify account connected to a domain.
 */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')

  if (!domain) {
    return NextResponse.json(
      { error: 'domain query parameter is required' },
      { status: 400 }
    )
  }

  try {
    const { data, error } = await supabase
      .from('printify_accounts')
      .select('id, domain, shop_id, shop_title, is_active, created_at')
      .eq('domain', domain)
      .eq('is_active', true)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine
      throw error
    }

    if (!data) {
      return NextResponse.json(
        { error: 'No connected account for this domain' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching Printify account:', error)
    return NextResponse.json(
      { error: 'Failed to fetch account' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/printify/account?domain=acme.com
 *
 * Disconnects the Printify account for a domain (soft delete).
 * Requires Authorization header with a valid admin token.
 */
export async function DELETE(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')
  const authHeader = req.headers.get('authorization')

  if (!domain) {
    return NextResponse.json(
      { error: 'domain query parameter is required' },
      { status: 400 }
    )
  }

  // Require admin token for DELETE operations
  const adminSecret = process.env.PRINTIFY_ADMIN_SECRET
  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { error } = await supabase
      .from('printify_accounts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('domain', domain)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting Printify account:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect account' },
      { status: 500 }
    )
  }
}
