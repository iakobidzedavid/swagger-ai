import Link from 'next/link'

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="section" style={{ paddingTop: '96px', paddingBottom: '80px' }}>
        <div className="container content-narrow text-center">
          <div className="badge badge-accent" style={{ marginBottom: '24px', display: 'inline-flex' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <circle cx="6" cy="6" r="5" />
            </svg>
            Early access · Built for People Ops teams
          </div>

          <h1 className="text-display" style={{ marginBottom: '24px' }}>
            Paste your domain.<br />
            <span style={{ color: 'var(--color-accent)' }}>Get a branded storefront.</span>
          </h1>

          <p className="text-body text-muted" style={{ fontSize: '1.125rem', maxWidth: '540px', margin: '0 auto 40px' }}>
            Swagger AI reads your brand assets, curates on-brand swag products, and
            launches your employee storefront — in minutes, not months.
          </p>

          <Link href="/onboard" className="btn btn-primary btn-lg">
            Generate your store
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4"/>
            </svg>
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="section section-sm" style={{ paddingTop: 0 }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
            <div className="card">
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="10" cy="10" r="8"/><path d="M10 6v4l3 3"/>
                </svg>
              </div>
              <h3 className="text-h3" style={{ marginBottom: '8px' }}>Paste your domain</h3>
              <p className="text-small text-muted">Enter your company domain and Swagger AI instantly fetches your logo, brand colors, and identity.</p>
            </div>

            <div className="card">
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 10h6M10 7v6"/>
                </svg>
              </div>
              <h3 className="text-h3" style={{ marginBottom: '8px' }}>AI-powered brand accuracy</h3>
              <p className="text-small text-muted">Our AI curates 8–12 on-brand swag products with your exact colors and logo applied to every item.</p>
            </div>

            <div className="card">
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2l2.4 7.4H20l-6.2 4.5 2.4 7.4L10 17l-6.2 4.3 2.4-7.4L0 9.4h7.6z"/>
                </svg>
              </div>
              <h3 className="text-h3" style={{ marginBottom: '8px' }}>Self-serve branded storefronts</h3>
              <p className="text-small text-muted">Your branded swag store goes live in minutes — share it with employees and start collecting orders right away.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="section section-sm">
        <div className="container">
          <div className="card text-center" style={{ padding: '48px 32px' }}>
            <h2 className="text-h2" style={{ marginBottom: '12px' }}>Simplifying employee swag</h2>
            <p className="text-body text-muted" style={{ marginBottom: '32px', maxWidth: '480px', margin: '0 auto 32px' }}>
              No agencies. No spreadsheets. No six-week timelines. Just your domain and five minutes.
            </p>
            <Link href="/onboard" className="btn btn-primary btn-lg">
              Start with your domain
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
