'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface PrintifyAccount {
  id: string
  domain: string
  shop_id: string
  shop_title: string
  is_active: boolean
  created_at: string
}

function ConnectShopContent() {
  const searchParams = useSearchParams()
  const [domain, setDomain] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [account, setAccount] = useState<PrintifyAccount | null>(null)
  const [loading, setLoading] = useState(false)

  // Get status messages from query params
  const success = searchParams.get('success')
  const error = searchParams.get('error')
  const message = searchParams.get('message')
  const returnedDomain = searchParams.get('domain')

  useEffect(() => {
    if (returnedDomain) {
      setDomain(returnedDomain)
      loadAccount(returnedDomain)
    }
  }, [returnedDomain])

  const loadAccount = async (d: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/printify/account?domain=${encodeURIComponent(d)}`)
      if (response.ok) {
        const data = await response.json() as PrintifyAccount
        setAccount(data)
      }
    } catch (err) {
      console.error('Failed to load account:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    if (!domain.trim()) {
      alert('Please enter a domain')
      return
    }

    setConnecting(true)
    try {
      // Redirect to OAuth authorize endpoint
      window.location.href = `/api/auth/printify/authorize?domain=${encodeURIComponent(domain)}`
    } catch (err) {
      console.error('Failed to initiate OAuth:', err)
      setConnecting(false)
    }
  }

  const handleReconnect = async () => {
    if (!domain.trim()) {
      alert('Please enter a domain')
      return
    }

    setConnecting(true)
    try {
      // Redirect to OAuth authorize endpoint to refresh the connection
      window.location.href = `/api/auth/printify/authorize?domain=${encodeURIComponent(domain)}`
    } catch (err) {
      console.error('Failed to initiate OAuth:', err)
      setConnecting(false)
    }
  }

  return (
    <section className="section">
      <div className="container content-narrow">
        <h1 className="text-display" style={{ marginBottom: '24px', marginTop: '40px' }}>
          Connect Your Printify Shop
        </h1>
        <p className="text-body text-muted" style={{ marginBottom: '32px' }}>
          Link your Printify account to start generating branded storefronts. We'll use your shop to create and manage products.
        </p>

        {/* Success message */}
        {success === 'true' && (
          <div style={{
            padding: '16px',
            marginBottom: '24px',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderLeft: '4px solid rgb(34, 197, 94)',
            borderRadius: 'var(--radius-md)',
          }}>
            <p style={{ margin: 0, color: 'rgb(34, 197, 94)', fontWeight: 500 }}>
              ✓ Printify shop connected successfully!
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.875rem', color: 'rgb(34, 197, 94)' }}>
              You can now generate storefronts for <strong>{returnedDomain}</strong>.
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{
            padding: '16px',
            marginBottom: '24px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderLeft: '4px solid rgb(239, 68, 68)',
            borderRadius: 'var(--radius-md)',
          }}>
            <p style={{ margin: 0, color: 'rgb(239, 68, 68)', fontWeight: 500 }}>
              ✗ Connection failed: {error}
            </p>
            {message && (
              <p style={{ margin: '8px 0 0 0', fontSize: '0.875rem', color: 'rgb(239, 68, 68)' }}>
                {message}
              </p>
            )}
          </div>
        )}

        {/* Connection form */}
        <div style={{
          padding: '24px',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-surface)',
          marginBottom: '32px',
        }}>
          <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Enter Your Domain</h2>
          <p style={{ marginBottom: '16px', fontSize: '0.875rem' }}>
            Start by entering the domain of your company. Your Printify account must be set up before connecting.
          </p>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}>
              Company Domain
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g., acme.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontSize: '1rem',
                fontFamily: 'monospace',
              }}
              disabled={connecting || loading}
            />
          </div>

          <button
            onClick={handleConnect}
            disabled={connecting || loading || !domain.trim()}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            {connecting ? 'Connecting...' : 'Connect with Printify'}
          </button>
        </div>

        {/* Connected shop info */}
        {account && (
          <div style={{
            padding: '24px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface)',
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Connected Shop</h2>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Domain</div>
              <div style={{ fontSize: '1rem', fontWeight: 500, fontFamily: 'monospace' }}>{account.domain}</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Shop ID</div>
              <div style={{ fontSize: '1rem', fontWeight: 500, fontFamily: 'monospace' }}>{account.shop_id}</div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Shop Title</div>
              <div style={{ fontSize: '1rem', fontWeight: 500 }}>{account.shop_title}</div>
            </div>

            <button
              onClick={handleReconnect}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              Update/Reconnect Shop
            </button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <p className="text-body text-muted">Loading shop info...</p>
          </div>
        )}
      </div>
    </section>
  )
}

export default function ConnectShopPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>}>
      <ConnectShopContent />
    </Suspense>
  )
}
