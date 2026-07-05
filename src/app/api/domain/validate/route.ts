import { NextRequest, NextResponse } from 'next/server'
import { promises as dns } from 'dns'

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
 * Check if domain is available by:
 * 1. First checking DNS resolution to catch NXDOMAIN errors early
 * 2. Then attempting HTTP/HTTPS requests to verify HTTP availability
 *
 * Returns true if domain:
 * - Resolves via DNS AND
 * - Responds with ANY HTTP status code (2xx, 3xx, 4xx, 5xx)
 *
 * Returns false if:
 * - Domain fails DNS resolution (NXDOMAIN, ENOTFOUND)
 * - Domain doesn't respond to HTTP requests due to network/connection errors
 */
async function checkDomainAvailability(domain: string): Promise<{ available: boolean; details?: string }> {
  try {
    // STEP 1: Check DNS resolution first to catch NXDOMAIN early
    try {
      await dns.resolveSoa(domain)
      // DNS resolution succeeded, domain exists
    } catch (dnsErr: any) {
      const dnsErrCode = (dnsErr as any)?.code
      const dnsErrMsg = String(dnsErr)

      // Check for DNS errors that indicate the domain doesn't exist
      if (dnsErrCode === 'ENOTFOUND' ||
          dnsErrCode === 'ENODATA' ||
          /NXDOMAIN|ENOTFOUND|ENODATA/i.test(dnsErrMsg)) {
        return {
          available: false,
          details: 'Domain does not exist (DNS resolution failed).',
        }
      }

      // For other DNS errors (timeouts, temporary failures), continue to HTTP check
      // Some domains might be configured to not respond to DNS SOA queries
    }

    // STEP 2: Check HTTP availability as secondary verification
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
        const isNetworkError = /ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|AbortError|getaddrinfo|NXDOMAIN/i.test(
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
