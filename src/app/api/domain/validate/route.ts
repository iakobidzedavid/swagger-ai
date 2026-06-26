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

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain') ?? ''
  const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')

  const format = validateFormat(normalized)
  if (!format.valid) {
    return NextResponse.json({ valid: false, domain: normalized, reason: format.reason }, { status: 200 })
  }

  // Quick DNS-level check via a free HTTPS HEAD request (2s timeout)
  let reachable = false
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`https://${normalized}`, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timer)
    reachable = res.ok || res.status < 500
  } catch {
    // Domain may still be valid (firewall, etc.) — treat as unknown, not invalid
    reachable = true
  }

  return NextResponse.json({
    valid: reachable,
    domain: normalized,
    reason: reachable ? undefined : 'Domain could not be reached',
  })
}
