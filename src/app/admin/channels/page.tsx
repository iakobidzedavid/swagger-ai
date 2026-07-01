'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Horizon = 'short_term' | 'medium_term' | 'long_term'
type SpecFormat = 'openapi' | 'webhook' | 'utm'

interface Channel {
  id: string
  name: string
  horizon: Horizon
  channel_type: string
  description: string
  source_de_step: string | null
  status: string
  spec_count: number
  created_at: string
}

interface ParsedEndpoint {
  path: string
  method: string
  summary: string
}

interface ChannelSpec {
  id: string
  channel_id: string
  spec_format: SpecFormat
  file_name: string | null
  parsed_summary: string
  parsed_endpoints: ParsedEndpoint[]
  endpoint_count: number
  source_format?: 'json' | 'yaml'
  source_url?: string | null
  created_at: string
  acquisition_channels?: { name: string; horizon: Horizon } | null
}

const HORIZON_LABEL: Record<Horizon, string> = {
  short_term: 'Short-term',
  medium_term: 'Medium-term',
  long_term: 'Long-term',
}

const HORIZON_ORDER: Horizon[] = ['short_term', 'medium_term', 'long_term']

const SPEC_PLACEHOLDER: Record<SpecFormat, string> = {
  openapi: '{\n  "openapi": "3.0.0",\n  "info": { "title": "Partner HRIS API", "version": "1.0" },\n  "paths": {\n    "/webhooks/new-hire": {\n      "post": { "summary": "Fires when a new hire is added" }\n    }\n  }\n}',
  webhook: '{\n  "url": "https://hooks.slack.com/services/T000/B000/XXXX",\n  "method": "POST",\n  "events": ["new_hire_created"]\n}',
  utm: '{\n  "source": "peer-slack",\n  "medium": "referral",\n  "campaign": "people-ops-community",\n  "url": "https://swagger.ai/onboard"\n}',
}

export default function ChannelsAdminPage() {
  const [channels, setChannels] = useState<Channel[] | null>(null)
  const [specs, setSpecs] = useState<ChannelSpec[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedChannelId, setSelectedChannelId] = useState('')
  const [specFormat, setSpecFormat] = useState<SpecFormat>('openapi')
  const [fileName, setFileName] = useState('')
  const [specText, setSpecText] = useState(SPEC_PLACEHOLDER.openapi)
  const [importMode, setImportMode] = useState<'paste' | 'url'>('paste')
  const [specUrl, setSpecUrl] = useState('')
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [lastParsed, setLastParsed] = useState<ChannelSpec | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/channels')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load channels')
      setChannels(data.channels)
      if (data.channels?.length && !selectedChannelId) {
        setSelectedChannelId(data.channels[0].id)
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load channels')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSpecs = useCallback(async () => {
    try {
      const res = await fetch('/api/channels/spec')
      const data = await res.json()
      if (res.ok) setSpecs(data.specs)
    } catch {
      // non-fatal — the upload form still works without the history list
    }
  }, [])

  useEffect(() => {
    loadChannels()
    loadSpecs()
  }, [loadChannels, loadSpecs])

  const handleFormatChange = (fmt: SpecFormat) => {
    setSpecFormat(fmt)
    setSpecText(SPEC_PLACEHOLDER[fmt])
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setSpecText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedChannelId) {
      setSubmitError('Select a channel first')
      setSubmitState('error')
      return
    }

    if (importMode === 'url' && !specUrl.trim()) {
      setSubmitState('error')
      setSubmitError('Enter a URL to import from first')
      return
    }
    if (importMode === 'paste' && !specText.trim()) {
      setSubmitState('error')
      setSubmitError('Paste or upload a spec first')
      return
    }

    setSubmitState('submitting')
    setSubmitError(null)

    try {
      // In URL mode the server fetches and parses the live doc directly
      // (real partner API docs are usually hosted, e.g. an /openapi.json
      // endpoint). In paste mode the raw text is sent as-is — the server
      // parses it as JSON or YAML (real OpenAPI docs are frequently YAML)
      // and reports back whichever format/source it detected.
      const res = await fetch('/api/channels/spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          importMode === 'url'
            ? { channel_id: selectedChannelId, spec_format: specFormat, spec_url: specUrl.trim() }
            : { channel_id: selectedChannelId, spec_format: specFormat, file_name: fileName || undefined, spec_text: specText }
        ),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitState('error')
        setSubmitError(data.error ?? 'Failed to parse and save spec')
        return
      }
      setSubmitState('success')
      setLastParsed(data)
      loadChannels()
      loadSpecs()
    } catch {
      setSubmitState('error')
      setSubmitError('Network error. Please try again.')
    }
  }

  const grouped = HORIZON_ORDER.map(h => ({
    horizon: h,
    items: (channels ?? []).filter(c => c.horizon === h),
  }))

  return (
    <div className="section">
      <div className="container">
        <div style={{ marginBottom: '40px' }}>
          <span className="badge badge-accent" style={{ marginBottom: '12px' }}>Revenue engine</span>
          <h1 className="text-h1" style={{ marginBottom: '10px', marginTop: '12px' }}>Acquisition channels</h1>
          <p className="text-body text-muted">
            Short, medium, and long-term acquisition channels from the sales process map, plus the API,
            webhook, or UTM specs that wire each channel into Swagger AI.
          </p>
        </div>

        {loadError && (
          <div className="error-banner" style={{ marginBottom: '24px' }}>{loadError}</div>
        )}

        {/* Channel columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '48px' }}>
          {grouped.map(group => (
            <div key={group.horizon}>
              <div className="text-small font-semibold text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem', marginBottom: '12px' }}>
                {HORIZON_LABEL[group.horizon]}
              </div>
              <div className="flex-col" style={{ gap: '12px' }}>
                {group.items.length === 0 && channels !== null && (
                  <p className="text-small text-muted">No channels yet</p>
                )}
                {group.items.map(c => (
                  <div key={c.id} className="card" style={{ padding: '16px' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: '6px', gap: '8px' }}>
                      <span className="text-small font-semibold">{c.name}</span>
                      <span className="badge" style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.7rem', padding: '2px 8px' }}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-small text-muted" style={{ marginBottom: '8px' }}>{c.description}</p>
                    <div className="flex items-center" style={{ gap: '8px', flexWrap: 'wrap' }}>
                      <span className="text-small" style={{ color: 'var(--color-accent)' }}>{c.channel_type}</span>
                      {c.source_de_step && <span className="text-small text-muted">· {c.source_de_step}</span>}
                      <span className="text-small text-muted">· {c.spec_count} spec{c.spec_count === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="divider" />

        {/* Upload form */}
        <div style={{ marginTop: '32px', marginBottom: '32px' }}>
          <h2 className="text-h2" style={{ marginBottom: '8px' }}>Register an integration spec</h2>
          <p className="text-small text-muted" style={{ marginBottom: '20px' }}>
            Import a live OpenAPI document by URL, or upload/paste an OpenAPI document (JSON or YAML), a
            webhook config, or a UTM link-tracking config for one of the channels above. It is fetched,
            parsed, and stored immediately — no external service required.
          </p>

          <form onSubmit={handleSubmit} className="card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label htmlFor="channel-select" style={{ display: 'block', marginBottom: '6px' }}>
                  <span className="text-small font-semibold">Channel</span>
                </label>
                <select
                  id="channel-select"
                  className="input-field"
                  value={selectedChannelId}
                  onChange={e => setSelectedChannelId(e.target.value)}
                >
                  {(channels ?? []).map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({HORIZON_LABEL[c.horizon]})</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="format-select" style={{ display: 'block', marginBottom: '6px' }}>
                  <span className="text-small font-semibold">Spec format</span>
                </label>
                <select
                  id="format-select"
                  className="input-field"
                  value={specFormat}
                  onChange={e => handleFormatChange(e.target.value as SpecFormat)}
                >
                  <option value="openapi">OpenAPI / Swagger</option>
                  <option value="webhook">Webhook config</option>
                  <option value="utm">UTM tracking config</option>
                </select>
              </div>
            </div>

            <div className="flex items-center" style={{ gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                className={importMode === 'url' ? 'btn btn-primary' : 'btn'}
                style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
                onClick={() => setImportMode('url')}
              >
                Import from URL
              </button>
              <button
                type="button"
                className={importMode === 'paste' ? 'btn btn-primary' : 'btn'}
                style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
                onClick={() => setImportMode('paste')}
              >
                Upload / paste
              </button>
            </div>

            {importMode === 'url' ? (
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="spec-url" style={{ display: 'block', marginBottom: '6px' }}>
                  <span className="text-small font-semibold">Documentation URL</span>
                  <span className="text-small text-muted" style={{ marginLeft: '6px' }}>
                    (e.g. https://api.partner.com/openapi.json — fetched and parsed server-side)
                  </span>
                </label>
                <input
                  id="spec-url"
                  type="url"
                  className="input-field"
                  placeholder="https://api.partner.com/openapi.json"
                  value={specUrl}
                  onChange={e => setSpecUrl(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label htmlFor="spec-file" style={{ display: 'block', marginBottom: '6px' }}>
                    <span className="text-small font-semibold">Upload a file</span>
                    <span className="text-small text-muted" style={{ marginLeft: '6px' }}>(optional — or paste JSON/YAML below)</span>
                  </label>
                  <input
                    id="spec-file"
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json,.yaml,.yml,application/x-yaml,text/plain"
                    onChange={handleFileUpload}
                    className="input-field"
                    style={{ padding: '10px' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label htmlFor="spec-text" style={{ display: 'block', marginBottom: '6px' }}>
                    <span className="text-small font-semibold">Spec JSON or YAML</span>
                  </label>
                  <textarea
                    id="spec-text"
                    className="input-field"
                    style={{ fontFamily: 'monospace', fontSize: '0.8125rem', minHeight: '180px', resize: 'vertical' }}
                    value={specText}
                    onChange={e => setSpecText(e.target.value)}
                    spellCheck={false}
                  />
                </div>
              </>
            )}

            {submitError && (
              <div className="error-banner" style={{ marginBottom: '16px' }}>{submitError}</div>
            )}

            <button type="submit" className="btn btn-primary" disabled={submitState === 'submitting' || !channels?.length}>
              {submitState === 'submitting' ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                  {importMode === 'url' ? 'Fetching & parsing…' : 'Parsing…'}
                </>
              ) : importMode === 'url' ? 'Fetch & parse' : 'Upload & parse'}
            </button>
          </form>

          {submitState === 'success' && lastParsed && (
            <div className="card" style={{ marginTop: '16px', borderColor: 'var(--color-success)' }}>
              <div className="success-banner" style={{ marginBottom: '16px' }}>
                {lastParsed.source_url ? `Imported from ${lastParsed.source_url}` : 'Parsed and saved'}
                {lastParsed.source_format ? ` (detected as ${lastParsed.source_format.toUpperCase()})` : ''} — {lastParsed.parsed_summary}
              </div>
              <div className="text-small font-semibold text-muted" style={{ marginBottom: '8px' }}>
                {lastParsed.endpoint_count} endpoint(s)
              </div>
              <div className="flex-col" style={{ gap: '6px' }}>
                {lastParsed.parsed_endpoints.map((ep, i) => (
                  <div key={i} className="text-small" style={{ fontFamily: 'monospace' }}>
                    <span className="text-accent">{ep.method}</span> {ep.path} — <span className="text-muted">{ep.summary}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="divider" />

        {/* Spec history */}
        <div style={{ marginTop: '32px' }}>
          <h2 className="text-h2" style={{ marginBottom: '16px' }}>Registered specs</h2>
          {specs.length === 0 ? (
            <p className="text-small text-muted">No specs uploaded yet.</p>
          ) : (
            <div className="flex-col" style={{ gap: '10px' }}>
              {specs.map(s => (
                <div key={s.id} className="card" style={{ padding: '14px 16px' }}>
                  <div className="flex items-center justify-between" style={{ gap: '8px', flexWrap: 'wrap' }}>
                    <span className="text-small font-semibold">{s.acquisition_channels?.name ?? 'Unknown channel'}</span>
                    <span className="badge" style={{ background: 'var(--color-accent-light)', color: '#a78bfa', fontSize: '0.7rem', padding: '2px 8px' }}>
                      {s.spec_format}{s.source_format ? ` · ${s.source_format}` : ''}
                    </span>
                  </div>
                  <p className="text-small text-muted" style={{ marginTop: '4px' }}>{s.parsed_summary}</p>
                  {s.source_url && (
                    <p className="text-small text-muted" style={{ marginTop: '4px', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                      Imported from {s.source_url}
                    </p>
                  )}
                  <p className="text-small text-muted" style={{ marginTop: '4px', fontSize: '0.75rem' }}>
                    {s.endpoint_count} endpoint(s) · {new Date(s.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
