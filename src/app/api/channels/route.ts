import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { supabase } from '@/lib/supabase'

const HORIZONS = new Set(['short_term', 'medium_term', 'long_term'])

export async function GET() {
  const { data, error } = await supabase
    .from('swag_acquisition_channels')
    .select('*, swag_channel_api_specs(count)')
    .order('horizon', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Supabase channels list error:', error)
    return NextResponse.json({ error: 'Failed to load acquisition channels' }, { status: 500 })
  }

  const rows = data ?? []

  // Revenue-engine attribution (DE-18): real domain_submissions counts per
  // channel, matched on attribution_key (see supabase/migrations/0007_channel_attribution.sql).
  // Channels without an attribution_key (custom/manually-added ones) get 0 —
  // an honest count, not a fabricated one.
  const attributionKeys = rows
    .map((r: Record<string, unknown>) => r.attribution_key as string | null)
    .filter((k): k is string => Boolean(k))

  const submissionCounts = new Map<string, number>()
  if (attributionKeys.length > 0) {
    const { data: submissionRows, error: submissionErr } = await supabase
      .from('domain_submissions')
      .select('attribution_key')
      .in('attribution_key', attributionKeys)

    if (submissionErr) {
      console.error('Supabase submission-count error:', submissionErr)
      // Non-fatal — channel list still renders, just without live counts
    } else {
      for (const row of submissionRows ?? []) {
        const key = (row as { attribution_key: string | null }).attribution_key
        if (!key) {continue}
        submissionCounts.set(key, (submissionCounts.get(key) ?? 0) + 1)
      }
    }
  }

  const channels = rows.map((row: Record<string, unknown>) => {
    const specs = row.swag_channel_api_specs as Array<{ count: number }> | undefined
    const { swag_channel_api_specs: _omit, ...rest } = row
    void _omit
    const attributionKey = row.attribution_key as string | null
    return {
      ...rest,
      spec_count: specs?.[0]?.count ?? 0,
      submission_count: attributionKey ? submissionCounts.get(attributionKey) ?? 0 : 0,
    }
  })

  return NextResponse.json({ channels })
}

export async function POST(req: NextRequest) {
  let body: {
    name?: string
    horizon?: string
    channel_type?: string
    description?: string
    source_de_step?: string
    status?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  const horizon = (body.horizon ?? '').trim()
  const channelType = (body.channel_type ?? '').trim()
  const description = (body.description ?? '').trim()

  if (!name) {return NextResponse.json({ error: 'name is required' }, { status: 400 })}
  if (!HORIZONS.has(horizon)) {
    return NextResponse.json({ error: 'horizon must be one of short_term, medium_term, long_term' }, { status: 400 })
  }
  if (!channelType) {return NextResponse.json({ error: 'channel_type is required' }, { status: 400 })}
  if (!description) {return NextResponse.json({ error: 'description is required' }, { status: 400 })}

  const { data, error } = await supabase
    .from('swag_acquisition_channels')
    .insert({
      name,
      horizon,
      channel_type: channelType,
      description,
      source_de_step: body.source_de_step?.trim() || null,
      status: body.status?.trim() || 'planned',
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Supabase channel insert error:', error)
    const isDuplicate = error?.code === '23505'
    return NextResponse.json(
      { error: isDuplicate ? 'A channel with this name already exists' : 'Failed to create acquisition channel' },
      { status: isDuplicate ? 409 : 500 }
    )
  }

  return NextResponse.json(data, { status: 201 })
}
