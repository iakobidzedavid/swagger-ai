import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { classifyAttribution, sanitizeAttribution } from '@/lib/attribution'
import { fetchBrandData, isPersonalDomain } from '@/lib/brandfetch'
import { supabase } from '@/lib/supabase'

// Brand extraction requires the Node.js runtime (zlib + Buffer for the
// keyless PNG-decode fallback in src/lib/keyless-brand.ts), not Edge.
export const runtime = 'nodejs'

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

export async function POST(req: NextRequest) {
  let body: {
    domain?: string
    contact_name?: string
    contact_email?: string
    utm_source?: string | null
    utm_medium?: string | null
    utm_campaign?: string | null
    referrer_host?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const raw = (body.domain ?? '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const contactName = (body.contact_name ?? '').trim() || null
  const contactEmail = (body.contact_email ?? '').trim().toLowerCase() || null

  if (!raw) {return NextResponse.json({ error: 'domain is required' }, { status: 400 })}
  if (!DOMAIN_RE.test(raw)) {return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 })}
  if (isPersonalDomain(raw)) {return NextResponse.json({ error: 'Please enter a company domain' }, { status: 400 })}

  // Revenue-engine attribution (DE-18): trust nothing from the client beyond
  // length-clipped strings — classify server-side into the same taxonomy the
  // channels admin page reads (supabase/migrations/0007_channel_attribution.sql).
  const attribution = sanitizeAttribution({
    utm_source: body.utm_source,
    utm_medium: body.utm_medium,
    utm_campaign: body.utm_campaign,
    referrer_host: body.referrer_host,
  })
  const attributionKey = classifyAttribution(attribution)

  // Insert with pending status first to immediately persist the submission
  const { data: inserted, error: insertErr } = await supabase
    .from('domain_submissions')
    .insert({
      domain: raw,
      status: 'fetching',
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      referrer_host: attribution.referrer_host,
      attribution_key: attributionKey,
      raw_brand_data: { contact_name: contactName, contact_email: contactEmail },
    })
    .select()
    .single()

  if (insertErr || !inserted) {
    console.error('Supabase insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
  }

  // Single canonical brand-extraction entrypoint (src/lib/brandfetch.ts):
  // Brandfetch API first, keyless fallback (favicon + theme-color) second.
  // Shared with /api/brand and /api/design-engine/mockup so all three stay
  // in lockstep.
  const brandData = await fetchBrandData(raw)

  // Update record with fetched brand data (Brandfetch or keyless)
  const { data: updated, error: updateErr } = await supabase
    .from('domain_submissions')
    .update({
      status: 'detected',
      company_name: brandData.companyName,
      logo_url: brandData.logoUrl,
      primary_color: brandData.primaryColor,
      secondary_color: brandData.secondaryColor,
      brand_source: brandData.source,
      color_count: brandData.colors?.length ?? 0,
      font_count: brandData.fonts?.length ?? 0,
      raw_brand_data: {
        ...brandData.raw,
        source: brandData.source,
        colors: brandData.colors,
        fonts: brandData.fonts,
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
      company_name: brandData.companyName,
      logo_url: brandData.logoUrl,
      primary_color: brandData.primaryColor,
      secondary_color: brandData.secondaryColor,
      status: 'detected',
      created_at: inserted.created_at,
    })
  }

  return NextResponse.json(updated)
}
