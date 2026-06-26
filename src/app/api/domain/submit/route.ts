import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
  'gmx.com', 'live.com', 'msn.com', 'me.com', 'mac.com',
])

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

async function fetchBrandAssets(domain: string) {
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`https://${domain}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 SwaggerAI-BrandBot/1.0',
        Accept: 'text/html',
      },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = await res.text()
    const patterns = [
      /<meta[^>]+name=["']theme-color["'][^>]+content=["']([#\w]+)["']/i,
      /<meta[^>]+content=["']([#\w]+)["'][^>]+name=["']theme-color["']/i,
    ]
    for (const re of patterns) {
      const m = html.match(re)
      if (m) {
        const c = m[1].trim()
        if (/^#[0-9a-f]{3,8}$/i.test(c)) return c
      }
    }
  } catch {}
  return null
}

async function checkLogo(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 2000)
    const r = await fetch(`https://logo.clearbit.com/${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
    })
    return r.ok
  } catch {
    return false
  }
}

function lighten(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const f = 0.6
  return `#${Math.round(r + (255-r)*f).toString(16).padStart(2,'0')}${Math.round(g + (255-g)*f).toString(16).padStart(2,'0')}${Math.round(b + (255-b)*f).toString(16).padStart(2,'0')}`
}

function companyName(domain: string): string {
  const n = domain.replace(/^www\./, '').split('.')[0]
  return n.charAt(0).toUpperCase() + n.slice(1)
}

export async function POST(req: NextRequest) {
  let body: { domain?: string; contact_name?: string; contact_email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const raw = (body.domain ?? '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const contactName = (body.contact_name ?? '').trim() || null
  const contactEmail = (body.contact_email ?? '').trim().toLowerCase() || null

  if (!raw) return NextResponse.json({ error: 'domain is required' }, { status: 400 })
  if (!DOMAIN_RE.test(raw)) return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 })
  if (PERSONAL_DOMAINS.has(raw)) return NextResponse.json({ error: 'Please enter a company domain' }, { status: 400 })

  // Insert with pending status first to immediately persist the submission
  const { data: inserted, error: insertErr } = await supabase
    .from('domain_submissions')
    .insert({
      domain: raw,
      status: 'fetching',
      raw_brand_data: { contact_name: contactName, contact_email: contactEmail },
    })
    .select()
    .single()

  if (insertErr || !inserted) {
    console.error('Supabase insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
  }

  // Fetch brand assets in parallel
  const [themeColor, logoExists] = await Promise.all([
    fetchBrandAssets(raw),
    checkLogo(raw),
  ])

  const primaryColor = themeColor ?? '#7c3aed'
  const secondaryColor = themeColor ? lighten(themeColor) : '#8fa3b8'
  const logoUrl = logoExists ? `https://logo.clearbit.com/${raw}` : null
  const name = companyName(raw)

  // Update record with fetched brand data
  const { data: updated, error: updateErr } = await supabase
    .from('domain_submissions')
    .update({
      status: 'detected',
      company_name: name,
      logo_url: logoUrl,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      raw_brand_data: {
        themeColorFound: !!themeColor,
        logoFound: logoExists,
        source: logoExists ? 'clearbit' : 'fallback',
        contact_name: contactName,
        contact_email: contactEmail,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', inserted.id)
    .select()
    .single()

  if (updateErr || !updated) {
    console.error('Supabase update error:', updateErr)
    // Still return the inserted record with what we have
    return NextResponse.json({
      id: inserted.id,
      domain: raw,
      company_name: name,
      logo_url: logoUrl,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      status: 'detected',
      created_at: inserted.created_at,
    })
  }

  return NextResponse.json(updated)
}
