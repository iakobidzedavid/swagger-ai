import Link from 'next/link'

export default function NotFound() {
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
