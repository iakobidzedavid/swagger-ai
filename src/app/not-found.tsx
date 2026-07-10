'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function NotFound() {
  useEffect(() => {
    // Track 404 event for analytics (broken link identification)
    // Called on page load to log the attempted path and referrer
    const trackNotFound = async () => {
      try {
        // Get the attempted path from referrer or window location
        const attemptedPath = window.location.pathname
        const referrer = document.referrer || null

        // Extract UTM params from referrer if present
        const urlParams = new URLSearchParams(window.location.search)
        const utmSource = urlParams.get('utm_source') || null
        const utmMedium = urlParams.get('utm_medium') || null
        const utmCampaign = urlParams.get('utm_campaign') || null

        // Send to analytics endpoint
        const response = await fetch('/api/analytics/track-404', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attempted_path: attemptedPath,
            referrer: referrer,
            user_agent: navigator.userAgent,
            utm_source: utmSource,
            utm_medium: utmMedium,
            utm_campaign: utmCampaign,
          }),
        })

        if (!response.ok) {
          console.warn(`404 tracking failed: ${response.status}`)
        }
      } catch (err) {
        // Silently fail — don't break the page if analytics fails
        console.warn('Failed to track 404 event:', err)
      }
    }

    trackNotFound()
  }, [])

  return (
    <>
      {/* 404 Hero Section */}
      <section className="section" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
        <div className="container content-narrow text-center">
          {/* Large 404 number with accent gradient */}
          <div style={{ marginBottom: '48px' }}>
            <div
              className="text-display"
              style={{
                fontSize: 'clamp(4rem, 15vw, 8rem)',
                fontWeight: 800,
                background: 'linear-gradient(135deg, var(--color-accent) 0%, #a78bfa 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                lineHeight: 1.1,
                marginBottom: '32px',
              }}
            >
              404
            </div>
          </div>

          {/* Headline */}
          <h1
            className="text-h1"
            style={{
              marginBottom: '16px',
              fontSize: '1.875rem',
              fontWeight: 700,
              color: 'var(--color-text)',
            }}
          >
            Page not found
          </h1>

          {/* Subheadline */}
          <p
            className="text-body"
            style={{
              fontSize: '1rem',
              color: 'var(--color-text-muted)',
              maxWidth: '420px',
              margin: '0 auto 48px',
              lineHeight: '1.6',
            }}
          >
            Oops! It looks like the page you're looking for doesn't exist. Don't worry—let's get you back on track.
          </p>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" className="btn btn-primary btn-lg">
              Back to home
            </Link>
            <Link href="/onboard" className="btn btn-secondary btn-lg">
              Get started
            </Link>
          </div>

          {/* Decorative divider */}
          <div
            style={{
              marginTop: '64px',
              paddingTop: '48px',
              borderTop: `1px solid var(--color-border)`,
            }}
          >
            <p className="text-small text-muted">
              Lost? Try the{' '}
              <Link href="/" style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                homepage
              </Link>{' '}
              or{' '}
              <Link href="/gallery" style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                browse gallery
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
