'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

function ProSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<any>(null)

  useEffect(() => {
    const verifySubscription = async () => {
      if (!sessionId) {
        setError('Invalid session')
        setLoading(false)
        return
      }

      try {
        // Verify the Stripe session and sync to database
        const response = await fetch('/api/stripe/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to verify subscription')
        }

        setSubscription(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process subscription')
      } finally {
        setLoading(false)
      }
    }

    verifySubscription()
  }, [sessionId])

  if (loading) {
    return (
      <div className="section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--color-border)',
            borderTop: '3px solid var(--color-accent)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p className="text-body text-muted">Processing your subscription...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="section">
        <div className="container content-narrow">
          <div style={{
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            borderLeft: '4px solid #dc2626',
            padding: '24px',
            borderRadius: '4px',
            marginBottom: '32px',
          }}>
            <h2 className="text-h2" style={{ margin: '0 0 12px 0', color: '#fca5a5' }}>
              Subscription Error
            </h2>
            <p className="text-body text-muted" style={{ margin: 0 }}>
              {error}. Please try again or contact support@swagger.ai for assistance.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link href="/pricing" className="btn btn-secondary">
              Back to Pricing
            </Link>
            <Link href="/onboard" className="btn btn-primary">
              Get Started Free
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="section" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <div className="container content-narrow">
        {/* Success Card */}
        <div className="card" style={{
          textAlign: 'center',
          borderTop: '4px solid var(--color-accent)',
        }}>
          {/* Success Icon */}
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: 'rgba(167, 139, 250, 0.1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ color: 'var(--color-accent)' }}>
              <path
                d="M26.67 9.33L13.33 22.67L5.33 14.67"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1 className="text-display" style={{ marginBottom: '12px' }}>
            Welcome to Pro! 🎉
          </h1>

          <p className="text-body text-muted" style={{ fontSize: '1.125rem', marginBottom: '32px' }}>
            Your Pro subscription is active. You now have access to premium features, dedicated support, and advanced analytics.
          </p>

          {subscription && (
            <div style={{
              backgroundColor: 'var(--color-bg)',
              padding: '24px',
              borderRadius: '6px',
              marginBottom: '32px',
              textAlign: 'left',
              border: '1px solid var(--color-border)',
            }}>
              <div style={{ marginBottom: '16px' }}>
                <div className="text-small font-semibold text-muted" style={{ marginBottom: '4px', textTransform: 'uppercase' }}>
                  Subscription Details
                </div>
                <div className="text-body" style={{ fontSize: '0.9375rem' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <span className="text-muted">Tier: </span>
                    <span className="font-semibold">Pro ($1,000/year)</span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span className="text-muted">Status: </span>
                    <span style={{ color: '#34d399', fontWeight: 600 }}>Active</span>
                  </div>
                  {subscription.current_period_end && (
                    <div>
                      <span className="text-muted">Renews: </span>
                      <span>{new Date(subscription.current_period_end * 1000).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* What's Next */}
          <div style={{
            backgroundColor: 'rgba(167, 139, 250, 0.05)',
            padding: '24px',
            borderRadius: '6px',
            marginBottom: '32px',
            border: '1px solid var(--color-border)',
          }}>
            <h3 className="text-h3" style={{ marginBottom: '16px', textAlign: 'left' }}>
              What's Next?
            </h3>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              textAlign: 'left',
            }}>
              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--color-accent)', fontWeight: 600, marginTop: '2px' }}>1.</span>
                <span className="text-body">
                  Start creating your first branded storefront with our domain-paste wizard
                </span>
              </li>
              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--color-accent)', fontWeight: 600, marginTop: '2px' }}>2.</span>
                <span className="text-body">
                  Access your Pro dashboard for analytics and team management
                </span>
              </li>
              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--color-accent)', fontWeight: 600, marginTop: '2px' }}>3.</span>
                <span className="text-body">
                  Reach out to our dedicated Slack support channel for assistance
                </span>
              </li>
            </ul>
          </div>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/onboard" className="btn btn-primary btn-lg">
              Create First Storefront
            </Link>
            <Link href="/" className="btn btn-secondary btn-lg">
              Back to Home
            </Link>
          </div>

          {/* Support Line */}
          <p className="text-body text-muted" style={{ marginTop: '24px', fontSize: '0.875rem' }}>
            Need help? Email <a href="mailto:support@swagger.ai" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>support@swagger.ai</a> or use your dedicated Slack channel
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default function ProSuccessPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ProSuccessContent />
    </Suspense>
  )
}
