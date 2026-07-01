import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseSpec, parseSpecSource, SpecFormat } from '@/lib/specParser'

const FORMATS: SpecFormat[] = ['openapi', 'webhook', 'utm']

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get('channel_id')

  let query = supabase
    .from('swag_channel_api_specs')
    .select('*, swag_acquisition_channels(name, horizon)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (channelId) query = query.eq('channel_id', channelId)

  const { data, error } = await query

  if (error) {
    console.error('Supabase spec list error:', error)
    return NextResponse.json({ error: 'Failed to load API specs' }, { status: 500 })
  }

  return NextResponse.json({ specs: data ?? [] })
}

export async function POST(req: NextRequest) {
  let body: {
    channel_id?: string
    spec_format?: string
    file_name?: string
    spec?: unknown
    spec_text?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const channelId = (body.channel_id ?? '').trim()
  const specFormat = (body.spec_format ?? '').trim() as SpecFormat

  if (!channelId) {
    return NextResponse.json({ error: 'channel_id is required' }, { status: 400 })
  }
  if (!FORMATS.includes(specFormat)) {
    return NextResponse.json({ error: `spec_format must be one of: ${FORMATS.join(', ')}` }, { status: 400 })
  }

  // Uploaded/pasted specs arrive as raw text (spec_text) so both JSON and
  // YAML documents are accepted — real OpenAPI specs are frequently YAML.
  // spec (an already-parsed JSON object) is still accepted for API callers
  // that prefer to send structured JSON directly.
  let parsedInput: unknown
  let sourceFormat: 'json' | 'yaml' = 'json'

  if (typeof body.spec_text === 'string' && body.spec_text.trim()) {
    const sourceResult = parseSpecSource(body.spec_text)
    if (!sourceResult.ok) {
      return NextResponse.json({ error: sourceResult.error }, { status: 422 })
    }
    parsedInput = sourceResult.value
    sourceFormat = sourceResult.sourceFormat
  } else if (body.spec !== undefined && body.spec !== null) {
    parsedInput = body.spec
  } else {
    return NextResponse.json({ error: 'spec_text (raw JSON or YAML) or spec (a JSON object) is required' }, { status: 400 })
  }

  // Confirm the channel exists before we attach a spec to it.
  const { data: channel, error: channelErr } = await supabase
    .from('swag_acquisition_channels')
    .select('id')
    .eq('id', channelId)
    .maybeSingle()

  if (channelErr) {
    console.error('Supabase channel lookup error:', channelErr)
    return NextResponse.json({ error: 'Failed to verify channel' }, { status: 500 })
  }
  if (!channel) {
    return NextResponse.json({ error: 'Unknown channel_id' }, { status: 404 })
  }

  const result = parseSpec(specFormat, parsedInput)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('swag_channel_api_specs')
    .insert({
      channel_id: channelId,
      spec_format: specFormat,
      file_name: body.file_name?.trim() || null,
      raw_spec: parsedInput,
      source_format: sourceFormat,
      parsed_summary: result.parsedSummary,
      parsed_endpoints: result.parsedEndpoints,
      endpoint_count: result.endpointCount,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Supabase spec insert error:', error)
    return NextResponse.json({ error: 'Failed to save parsed spec' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
