import { NextRequest, NextResponse } from 'next/server'
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

  const channels = (data ?? []).map((row: Record<string, unknown>) => {
    const specs = row.swag_channel_api_specs as Array<{ count: number }> | undefined
    const { swag_channel_api_specs: _omit, ...rest } = row
    void _omit
    return { ...rest, spec_count: specs?.[0]?.count ?? 0 }
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

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!HORIZONS.has(horizon)) {
    return NextResponse.json({ error: 'horizon must be one of short_term, medium_term, long_term' }, { status: 400 })
  }
  if (!channelType) return NextResponse.json({ error: 'channel_type is required' }, { status: 400 })
  if (!description) return NextResponse.json({ error: 'description is required' }, { status: 400 })

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
