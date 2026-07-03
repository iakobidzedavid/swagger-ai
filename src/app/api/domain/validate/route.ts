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
 * Uses multiple checks to determine availability:
 * 1. HTTP HEAD request (2s timeout) — checks if domain is live and configured
 * 2. HTTP GET request (2s timeout) — fallback if HEAD fails
 *
 * Returns true if domain responds with any status code (2xx, 3xx, 4xx),
 * indicating the domain exists and is configured. Returns false only if
 * the domain doesn't respond within timeout or has severe connectivity issues.
 */
async function checkDomainAvailability(domain: string): Promise<{ available: boolean; details?: string }> {
  try {
    // First, try HEAD request (faster, no body download)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    try {
      const headRes = await fetch(`https://${domain}`, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      })
      clearTimeout(timeoutId)

      // If we got any response, domain is available
      if (headRes.ok || (headRes.status >= 300 && headRes.status < 500)) {
        return { available: true }
      }

      // 5xx means server error — domain exists but has issues
      if (headRes.status >= 500) {
        return {
          available: false,
          details: 'Domain responded with server error. It may be temporarily unavailable.',
        }
      }

      return { available: true }
    } catch (headErr) {
      // HEAD failed, try GET with a fresh controller
      const getController = new AbortController()
      const getTimeoutId = setTimeout(() => getController.abort(), 2000)

      try {
        const getRes = await fetch(`https://${domain}`, {
          method: 'GET',
          signal: getController.signal,
          redirect: 'follow',
        })
        clearTimeout(getTimeoutId)

        // If we got any response, domain is available
        return { available: getRes.ok || (getRes.status >= 300 && getRes.status < 500) }
      } catch {
        clearTimeout(getTimeoutId)
        // Both HEAD and GET failed — domain is likely unavailable
        return {
          available: false,
          details: 'Domain did not respond to availability check. It may be offline or misconfigured.',
        }
      }
    }
  } catch {
    // Catch-all for any other errors
    return {
      available: false,
      details: 'Could not verify domain availability. Try again in a moment.',
    }
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
