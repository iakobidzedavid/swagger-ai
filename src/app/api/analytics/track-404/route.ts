import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { classifyAttribution, sanitizeAttribution } from '@/lib/attribution'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: {
    attempted_path?: string
    referrer?: string | null
    user_agent?: string | null
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

  const attemptedPath = (body.attempted_path ?? '').trim() || '/'
  const referrer = (body.referrer ?? '').trim() || null
  const userAgent = (body.user_agent ?? '').trim() || null

  // Extract IP from forwarded headers (common in Next.js/Vercel deployments)
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                    req.headers.get('x-real-ip') ||
                    null

  // Sanitize and classify attribution (same as domain/submit)
  const attribution = sanitizeAttribution({
    utm_source: body.utm_source,
    utm_medium: body.utm_medium,
    utm_campaign: body.utm_campaign,
    referrer_host: body.referrer_host,
  })
  const attributionKey = classifyAttribution(attribution)

  // Insert 404 event into analytics table
  const { data: inserted, error: insertErr } = await supabase
    .from('not_found_events')
    .insert({
      attempted_path: attemptedPath,
      referrer: referrer,
      user_agent: userAgent,
      ip_address: ipAddress,
      status_code: 404,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      referrer_host: attribution.referrer_host,
      attribution_key: attributionKey,
    })
    .select()
    .single()

  if (insertErr || !inserted) {
    console.error('Supabase 404 event insert error:', insertErr)
    // Return success even if logging fails (graceful degradation)
    // The 404 page should not break if analytics fails
    return NextResponse.json(
      { success: true, warning: 'Event logged partially' },
      { status: 202 }
    )
  }

  return NextResponse.json({
    success: true,
    event_id: inserted.id,
    attempted_path: inserted.attempted_path,
  })
}
