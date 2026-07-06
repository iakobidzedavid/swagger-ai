import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

/**
 * GET /api/auth/printify/callback?code=...&state=...
 *
 * Handles the OAuth callback from Printify.
 * Exchanges the authorization code for access/refresh tokens and stores them in the database.
 *
 * Environment variables required:
 * - PRINTIFY_OAUTH_CLIENT_ID: Your Printify app's client ID
 * - PRINTIFY_OAUTH_CLIENT_SECRET: Your Printify app's client secret
 * - NEXT_PUBLIC_APP_URL: Base URL for the callback
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')
  const errorDescription = req.nextUrl.searchParams.get('error_description')

  // Handle OAuth errors from Printify
  if (error) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    console.error(`Printify OAuth error: ${error} - ${errorDescription}`)
    return NextResponse.redirect(
      new URL(`/connect-shop?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || '')}`, appUrl).toString()
    )
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: 'Missing authorization code or state' },
      { status: 400 }
    )
  }

  const clientId = process.env.PRINTIFY_OAUTH_CLIENT_ID
  const clientSecret = process.env.PRINTIFY_OAUTH_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!clientId || !clientSecret) {
    console.error('Printify OAuth credentials not configured')
    return NextResponse.redirect(
      new URL('/connect-shop?error=not_configured&message=Printify OAuth is not configured on this server', appUrl).toString()
    )
  }

  // Decode and verify state
  let stateData: { domain: string; nonce: number }
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64').toString())
  } catch {
    console.error('Invalid state parameter')
    return NextResponse.redirect(
      new URL('/connect-shop?error=invalid_state&message=Invalid state parameter', appUrl).toString()
    )
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://www.printify.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${appUrl}/api/auth/printify/callback`,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}))
      console.error('Printify token exchange failed:', errorData)
      return NextResponse.redirect(
        new URL(`/connect-shop?error=token_exchange_failed&message=Failed to exchange authorization code`, appUrl).toString()
      )
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string
      refresh_token?: string
      expires_in: number
    }

    // Get user's shops from Printify
    const shopsResponse = await fetch('https://api.printify.com/v1/shops.json', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!shopsResponse.ok) {
      console.error('Failed to fetch shops from Printify')
      return NextResponse.redirect(
        new URL(`/connect-shop?error=shops_fetch_failed&message=Failed to retrieve your Printify shops`, appUrl).toString()
      )
    }

    const shopsData = await shopsResponse.json() as { data: Array<{ id: string; title: string }> }

    if (!shopsData.data || shopsData.data.length === 0) {
      return NextResponse.redirect(
        new URL(`/connect-shop?error=no_shops&message=You%20don't%20have%20any%20Printify%20shops%20yet.%20Create%20one%20at%20printify.com`, appUrl).toString()
      )
    }

    // Use the first shop (or let the user select later)
    const firstShop = shopsData.data[0]
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

    // Store the OAuth tokens and shop info in the database
    // Try insert first; if unique constraint fails, update instead
    const now = new Date().toISOString()
    let storeResult = await supabase
      .from('printify_accounts')
      .insert([
        {
          domain: stateData.domain,
          shop_id: firstShop.id,
          shop_title: firstShop.title,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          token_expires_at: tokenExpiresAt.toISOString(),
          is_active: true,
          created_at: now,
          updated_at: now,
        },
      ])
      .select()

    // If insert failed due to unique constraint, try update
    if (storeResult.error && storeResult.error.code === '23505') {
      // 23505 = unique constraint violation
      storeResult = await supabase
        .from('printify_accounts')
        .update({
          shop_id: firstShop.id,
          shop_title: firstShop.title,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          token_expires_at: tokenExpiresAt.toISOString(),
          is_active: true,
          updated_at: now,
        })
        .eq('domain', stateData.domain)
        .select()
    }

    if (storeResult.error) {
      console.error('Supabase insert/update error:', storeResult.error)
      return NextResponse.redirect(
        new URL(`/connect-shop?error=storage_failed&message=Failed to save your Printify connection`, appUrl).toString()
      )
    }

    // Success! Redirect to connect-shop page with success message
    return NextResponse.redirect(
      new URL(`/connect-shop?success=true&domain=${encodeURIComponent(stateData.domain)}&shopId=${encodeURIComponent(firstShop.id)}&shopTitle=${encodeURIComponent(firstShop.title)}`, appUrl).toString()
    )
  } catch (error) {
    console.error('Printify OAuth callback error:', error)
    return NextResponse.redirect(
      new URL(`/connect-shop?error=internal_error&message=An unexpected error occurred`, appUrl).toString()
    )
  }
}
