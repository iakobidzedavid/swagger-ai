import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

export async function POST(req: NextRequest) {
  let body: {
    domain_submission_id?: string
    domain?: string
    company_name?: string
    logo_url?: string | null
    primary_color?: string
    secondary_color?: string
    contact_name?: string
    contact_email?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const domain = (body.domain ?? '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/\/.*$/, '')

  if (!domain || !DOMAIN_RE.test(domain)) {
    return NextResponse.json({ error: 'Valid domain is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('storefront_requests')
    .insert({
      domain_submission_id: body.domain_submission_id ?? null,
      domain,
      company_name: body.company_name ?? null,
      logo_url: body.logo_url ?? null,
      primary_color: body.primary_color ?? null,
      secondary_color: body.secondary_color ?? null,
      contact_name: body.contact_name ?? null,
      contact_email: body.contact_email ?? null,
      status: 'queued',
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Supabase storefront request error:', error)
    return NextResponse.json({ error: 'Failed to queue storefront request' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
