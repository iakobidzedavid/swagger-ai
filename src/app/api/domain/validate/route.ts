import { NextRequest, NextResponse } from 'next/server'

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
  'gmx.com', 'live.com', 'msn.com', 'me.com', 'mac.com',
  'googlemail.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de',
])

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

function validateFormat(domain: string): { valid: boolean; reason?: string } {
  const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!d) return { valid: false, reason: 'Domain is required' }
  if (!DOMAIN_RE.test(d)) return { valid: false, reason: 'Enter a valid domain (e.g., acme.com)' }
  if (PERSONAL_DOMAINS.has(d)) return { valid: false, reason: 'Enter a company domain, not a personal email provider' }
  return { valid: true }
}

/**
 * Check if domain is available and reachable via HTTP/HTTPS.
 * Uses a simple HEAD request (no redirect following) to avoid bot detection,
 * SSL renegotiation, or redirect-loop complications that can cause timeouts.
 *
 * Returns true if domain responds with ANY HTTP status code (2xx, 3xx, 4xx, 5xx),
 * indicating the domain exists and is configured. Returns false only if the domain
 * fails to respond due to DNS errors, connection refused, or timeout.
 */
async function checkDomainAvailability(domain: string): Promise<{ available: boolean; details?: string }> {
  try {
    // Use 'manual' redirect handling to avoid bot detection timeouts and redirect loops.
    // Accept any HTTP response as proof the domain exists (including 3xx, 4xx, 5xx).
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    try {
      const headRes = await fetch(`https://${domain}`, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'manual', // Don't follow redirects — any response = domain exists
      })
      clearTimeout(timeoutId)

      // Any HTTP response means the domain is live and configured
      // (2xx OK, 3xx redirect, 4xx client error, 5xx server error all indicate existence)
      return { available: true }
    } catch (headErr) {
      clearTimeout(timeoutId)

      // HEAD failed. Try GET as fallback (some servers disable HEAD).
      const getController = new AbortController()
      const getTimeoutId = setTimeout(() => getController.abort(), 2000)

      try {
        const getRes = await fetch(`https://${domain}`, {
          method: 'GET',
          signal: getController.signal,
          redirect: 'manual',
        })
        clearTimeout(getTimeoutId)

        // Any HTTP response means domain exists
        return { available: true }
      } catch (getErr) {
        clearTimeout(getTimeoutId)

        // Both HEAD and GET failed. Check if it's a DNS/network error or timeout.
        const errorMsg = String(getErr)
        const isNetworkError = /ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|AbortError|getaddrinfo/i.test(
          errorMsg
        )

        if (isNetworkError) {
          return {
            available: false,
            details: 'Domain did not respond. It may be offline or misconfigured.',
          }
        }

        // Other error (TLS, etc.) — be generous and assume domain exists
        return { available: true }
      }
    }
  } catch {
    // Catch-all: if in doubt, assume domain might exist (be generous)
    return { available: true }
  }
}

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain') ?? ''
  const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')

  const format = validateFormat(normalized)
  if (!format.valid) {
    return NextResponse.json({ valid: false, domain: normalized, reason: format.reason }, { status: 200 })
  }

  // Check domain availability
  const { available, details } = await checkDomainAvailability(normalized)

  return NextResponse.json({
    valid: available,
    domain: normalized,
    reason: details,
  })
}
