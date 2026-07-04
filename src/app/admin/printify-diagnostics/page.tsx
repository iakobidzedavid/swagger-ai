'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface OverviewState {
  status: 'loading' | 'loaded' | 'error'
  shopsStatus?: number
  shops?: Array<{ id: number; title: string; sales_channel?: string }>
  blueprintsCount?: number
  error?: string
}

interface PipelineStep {
  step: string
  label: string
  startedAt: string
  completedAt: string
  durationMs: number
  detail: Record<string, unknown>
}

interface SkuResult {
  label: string
  category: string
  blueprintId: number
  blueprintTitle: string
  printProviderId: number
  printProviderTitle: string
  variantId: number
  status: 'created' | 'failed'
  printifyProductId?: string
  title?: string
  mockupImageUrl?: string
  priceUsd?: number
  error?: string
}

interface GenerateResult {
  success: boolean
  domain: string
  companyName: string
  shop: { id: number; title: string }
  storefrontRequestId: string | null
  pipeline: PipelineStep[]
  skus: SkuResult[]
  skusCreated: number
  skusAttempted: number
  totalDurationMs: number
  underFiveMinutes: boolean
  error?: string
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function PrintifyDiagnosticsPage() {
  const [overview, setOverview] = useState<OverviewState>({ status: 'loading' })
  const [domain, setDomain] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadOverview() {
      try {
        const res = await fetch('/api/admin/printify-diagnostics?mode=overview')
        const data = await res.json()
        if (!res.ok || data.error) {
          setOverview({ status: 'error', error: data.error || `HTTP ${res.status}` })
          return
        }
        setOverview({
          status: 'loaded',
          shopsStatus: data.shopsStatus,
          shops: data.shops,
          blueprintsCount: data.blueprintsCount,
        })
      } catch (err) {
        setOverview({ status: 'error', error: err instanceof Error ? err.message : String(err) })
      }
    }
    loadOverview()
  }, [])

  async function runGenerate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/printify-diagnostics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, skuCount: 10 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
        if (data.pipeline) setResult(data)
        return
      }
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '60px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 className="text-display" style={{ marginBottom: '8px' }}>
          Printify Diagnostics
        </h1>
        <p className="text-body text-muted">
          Live connectivity check against the real Printify API, plus an end-to-end test run of the
          domain → brand extraction → SKU design → Printify integration pipeline.
        </p>
      </div>

      {/* Connectivity overview */}
      <div className="card" style={{ marginBottom: '32px', padding: '24px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Live Connectivity</h2>
        {overview.status === 'loading' && <p className="text-muted">Checking Printify API connection...</p>}
        {overview.status === 'error' && (
          <div style={{ color: 'var(--color-danger)' }}>
            <strong>Not connected:</strong> {overview.error}
          </div>
        )}
        {overview.status === 'loaded' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <div className="text-muted" style={{ fontSize: '0.8rem' }}>Shops connectivity</div>
              <div style={{ fontWeight: 700, color: overview.shopsStatus === 200 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                HTTP {overview.shopsStatus}
              </div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: '0.8rem' }}>Connected shop</div>
              <div style={{ fontWeight: 700 }}>
                {overview.shops?.[0]?.title || 'none'} {overview.shops?.[0]?.id ? `(#${overview.shops[0].id})` : ''}
              </div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: '0.8rem' }}>Live blueprint catalog</div>
              <div style={{ fontWeight: 700 }}>{overview.blueprintsCount ?? '—'} products available</div>
            </div>
          </div>
        )}
      </div>

      {/* Domain -> SKU generation test flow */}
      <div className="card" style={{ marginBottom: '32px', padding: '24px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>
          Test the Brand-to-Storefront Pipeline
        </h2>
        <form onSubmit={runGenerate} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={domain}
            onChange={e => setDomain(e.target.value)}
            placeholder="acme.com"
            required
            style={{
              flex: '1 1 240px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          />
          <button type="submit" className="btn btn-primary" disabled={generating}>
            {generating ? 'Running pipeline…' : 'Generate 8–12 SKUs on real Printify'}
          </button>
        </form>
        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '8px' }}>
          This creates real draft products in the connected Printify shop via the live Printify API —
          each one is a genuine, print-ready SKU with a real Printify product ID.
        </p>
      </div>

      {error && (
        <div
          className="card"
          style={{
            marginBottom: '32px',
            padding: '16px',
            borderColor: 'var(--color-danger)',
            color: 'var(--color-danger)',
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Pipeline timeline */}
          <div className="card" style={{ marginBottom: '32px', padding: '24px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>
              Pipeline Execution — {fmtMs(result.totalDurationMs)} total
              {result.underFiveMinutes ? ' (under 5 minutes ✓)' : ' (over 5 minutes ✗)'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {result.pipeline.map(step => (
                <div
                  key={step.step}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.85rem',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{step.label}</span>
                  <span className="text-muted">{fmtMs(step.durationMs)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SKU results */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>
              {result.skusCreated}/{result.skusAttempted} SKUs created for {result.companyName} ({result.domain})
            </h2>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '16px' }}>
              Printify shop: {result.shop.title} (#{result.shop.id})
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              {result.skus.map((sku, idx) => (
                <div
                  key={idx}
                  className="card"
                  style={{
                    padding: '16px',
                    borderColor: sku.status === 'created' ? 'var(--color-border)' : 'var(--color-danger)',
                  }}
                >
                  {sku.mockupImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sku.mockupImageUrl}
                      alt={sku.title || sku.label}
                      style={{ width: '100%', height: '140px', objectFit: 'contain', marginBottom: '10px', backgroundColor: '#fff', borderRadius: 'var(--radius-sm)' }}
                    />
                  )}
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{sku.label}</div>
                  <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '8px' }}>
                    {sku.blueprintTitle}
                  </div>
                  {sku.status === 'created' ? (
                    <>
                      <div style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                        Printify ID: <code>{sku.printifyProductId}</code>
                      </div>
                      {sku.priceUsd && (
                        <div style={{ fontSize: '0.75rem', marginBottom: '8px' }}>${sku.priceUsd.toFixed(2)}</div>
                      )}
                      <Link
                        href={`/admin/printify-diagnostics/product?shopId=${result.shop.id}&productId=${sku.printifyProductId}`}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '6px 10px', display: 'inline-block' }}
                      >
                        View real Printify product →
                      </Link>
                    </>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)' }}>{sku.error}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
