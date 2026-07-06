/**
 * Auth utilities for protecting API endpoints
 * Validates JWT tokens from Supabase and extracts user context
 *
 * Usage in API routes:
 * ```
 * const auth = await verifyAuth(req);
 * if (!auth.success) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 * const userId = auth.userId;
 * const email = auth.email;
 * ```
 */

import type { NextRequest } from 'next/server'

interface AuthResult {
  success: boolean
  userId?: string
  email?: string
  error?: string
}

/**
 * Extract and verify JWT token from Authorization header
 * Format: "Bearer <token>"
 */
function extractToken(authHeader: string | null): string | null {
  if (!authHeader) {return null}
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null
  }
  return parts[1]
}

/**
 * Decode JWT token payload (basic decode, no signature verification for MVP)
 * For a real implementation, integrate with Supabase's native session verification
 */
function decodeJwtToken(token: string): { sub?: string; email?: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    // Decode payload (second part) — base64url encoded
    const payload = parts[1]
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    const decoded = Buffer.from(padded, 'base64url').toString('utf-8')
    const data = JSON.parse(decoded) as { sub?: string; email?: string; exp?: number }

    // Check expiration
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return { sub: data.sub, email: data.email }
  } catch (err) {
    console.warn('JWT decode failed:', err)
    return null
  }
}

/**
 * Verify request has a valid authorization token
 * Returns user ID and email if token is valid
 */
export async function verifyAuth(req: NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization')
  const token = extractToken(authHeader)

  if (!token) {
    return {
      success: false,
      error: 'Missing Authorization header',
    }
  }

  const payload = decodeJwtToken(token)
  if (!payload || !payload.sub) {
    return {
      success: false,
      error: 'Invalid or expired token',
    }
  }

  return {
    success: true,
    userId: payload.sub,
    email: payload.email,
  }
}

/**
 * Middleware for API routes that require authentication
 * Usage:
 * ```
 * const auth = await requireAuth(req)
 * if (!auth.success) {
 *   return NextResponse.json(auth.error, { status: 401 })
 * }
 * ```
 */
async function requireAuth(req: NextRequest) {
  return verifyAuth(req)
}

/**
 * Check if a user has access to a specific storefront
 * Verifies ownership by comparing auth user ID with storefront owner_id
 */
export function hasStorefrontAccess(userId: string, storefrontOwnerId: string): boolean {
  return userId === storefrontOwnerId
}
