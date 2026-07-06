/**
 * POST /api/auth/signin
 *
 * Create or verify a user account using email.
 * Returns a JWT token for use in subsequent API calls.
 *
 * Request body:
 * {
 *   email: string (required)
 *   companyName?: string (optional, used on first signin)
 * }
 *
 * Response:
 * {
 *   success: boolean
 *   token?: string (JWT token for Authorization header)
 *   user?: { id: string, email: string, companyName?: string }
 *   error?: string
 * }
 *
 * NOTE: This is a simplified sign-in endpoint for the MVP.
 * In production, integrate with Supabase Auth's official sign-in flow.
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

interface SigninRequest {
  email: string
  companyName?: string
}

interface SigninResponse {
  success: boolean
  token?: string
  user?: {
    id: string
    email: string
    companyName?: string
  }
  error?: string
}

export async function POST(req: NextRequest) {
  let body: SigninRequest

  try {
    body = await req.json()
  } catch {
    return NextResponse.json<SigninResponse>(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { email, companyName } = body

  if (!email || !email.includes('@')) {
    return NextResponse.json<SigninResponse>(
      { success: false, error: 'Valid email is required' },
      { status: 400 }
    )
  }

  try {
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, company_name')
      .eq('email', email)
      .maybeSingle()

    let userId: string
    let userEmail: string
    let userCompanyName: string | null = null

    if (existingUser) {
      // User exists — use existing ID
      userId = existingUser.id
      userEmail = existingUser.email
      userCompanyName = existingUser.company_name
    } else {
      // Create new user — generate UUID for user ID
      // In production, use Supabase Auth's native signup flow
      const newUserId = generateUuid()

      // Create user record in users table
      const { error: insertError } = await supabase.from('users').insert({
        id: newUserId,
        email,
        company_name: companyName || null,
        subscription_tier: 'free',
        status: 'active',
      })

      if (insertError) {
        console.error('User table insert error:', insertError)
        return NextResponse.json<SigninResponse>(
          { success: false, error: 'Failed to create user record' },
          { status: 500 }
        )
      }

      userId = newUserId
      userEmail = email
      userCompanyName = companyName || null
    }

    // Generate JWT token for the user
    // In production, use Supabase's native session tokens
    const token = generateJwtToken(userId, userEmail)

    return NextResponse.json<SigninResponse>(
      {
        success: true,
        token,
        user: {
          id: userId,
          email: userEmail,
          companyName: userCompanyName || undefined,
        },
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('Signin error:', err)
    return NextResponse.json<SigninResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Generate a UUID v4 for user ID
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Generate a JWT token for the user
 * This is a simplified implementation; in production use Supabase's native tokens
 */
function generateJwtToken(userId: string, email: string): string {
  // Create a simple JWT with sub and email claims
  // In production, sign this with your JWT_SECRET using a proper library
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = 7 * 24 * 60 * 60 // 7 days
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      email,
      exp: now + expiresIn,
      iat: now,
    })
  ).toString('base64url')

  // For a real implementation, compute HMAC-SHA256 signature
  // For this MVP, use a placeholder signature
  const signature = 'placeholder'

  return `${header}.${payload}.${signature}`
}
