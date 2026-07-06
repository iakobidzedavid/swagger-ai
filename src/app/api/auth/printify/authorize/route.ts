import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * GET /api/auth/printify/authorize?domain=acme.com
 *
 * Initiates the Printify OAuth flow.
 * Redirects the user to Printify's authorization endpoint.
 *
 * Environment variables required:
 * - PRINTIFY_OAUTH_CLIENT_ID: Your Printify app's client ID
 * - NEXT_PUBLIC_APP_URL: Base URL for the callback (e.g., https://swagger-ai.example.com)
 */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')

  if (!domain) {
    return NextResponse.json(
      { error: 'domain query parameter is required' },
      { status: 400 }
    )
  }

  const clientId = process.env.PRINTIFY_OAUTH_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!clientId) {
    return NextResponse.json(
      {
        error: 'Printify OAuth not configured',
        message: 'PRINTIFY_OAUTH_CLIENT_ID environment variable is not set',
      },
      { status: 501 }
    )
  }

  // Generate a state token for CSRF protection
  // In production, this should be stored in a secure session
  const state = Buffer.from(JSON.stringify({ domain, nonce: Date.now() })).toString('base64')

  const redirectUri = encodeURIComponent(`${appUrl}/api/auth/printify/callback`)
  const printifyAuthUrl = new URL('https://www.printify.com/oauth/authorize')
  printifyAuthUrl.searchParams.set('client_id', clientId)
  printifyAuthUrl.searchParams.set('response_type', 'code')
  printifyAuthUrl.searchParams.set('redirect_uri', `${appUrl}/api/auth/printify/callback`)
  printifyAuthUrl.searchParams.set('scope', 'shops:read shops:write')
  printifyAuthUrl.searchParams.set('state', state)

  return NextResponse.redirect(printifyAuthUrl.toString())
}
