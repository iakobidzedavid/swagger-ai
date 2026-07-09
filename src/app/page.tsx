import Link from 'next/link'

import AttributionCapture from '@/components/AttributionCapture'
import HomepageBrandPreview from '@/components/HomepageBrandPreview'

export default function LandingPage() {
  return (
    <>
      <AttributionCapture />
      {/* Hero section */}
      <section className="section" style={{ paddingTop: '140px', paddingBottom: '80px' }}>
        <div className="container content-narrow text-center">
          <div style={{ marginBottom: '32px' }}>
            <span className="badge badge-accent" style={{ marginBottom: '16px', display: 'inline-block' }}>
              Built for People Ops teams
            </span>
          </div>

          <h1 className="text-display" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #ecebf3 0%, #a78bfa 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent' }}>
            Swag in minutes, not months
          </h1>

          <p className="text-body" style={{ fontSize: '1.125rem', color: 'var(--color-text-muted)', maxWidth: '520px', margin: '0 auto 48px', lineHeight: '1.7' }}>
            Transform a company domain into a branded merchandise storefront with AI-powered brand accuracy. No design skills. No setup fees.
          </p>

          <div style={{ marginBottom: '64px' }}>
            <HomepageBrandPreview />
          </div>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '32px' }}>
            <Link href="/onboard" className="btn btn-primary btn-lg">
              Get started free
            </Link>
            <Link href="/gallery" className="btn btn-secondary btn-lg">
              Browse gallery
            </Link>
          </div>

          <p className="text-small text-muted">No credit card required · 5-minute setup</p>
        </div>
      </section>

      {/* Features section */}
      <section className="section-sm section-subtle section-bordered">
        <div className="container">
          <h2 className="text-h2" style={{ textAlign: 'center', marginBottom: '48px' }}>Why Swagger AI</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '140px', height: '140px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/hoodie-mockup.svg" alt="Branded hoodie mockup - Lightning fast storefront generation" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <h3 className="text-h3" style={{ marginBottom: '8px', textAlign: 'center' }}>Lightning fast</h3>
              <p className="text-body text-muted" style={{ lineHeight: '1.6', textAlign: 'center' }}>Domain paste → branded store in under 5 minutes. No waiting for designers or vendors.</p>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '140px', height: '140px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/cap-mockup.svg" alt="Branded cap mockup - AI-powered brand accuracy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <h3 className="text-h3" style={{ marginBottom: '8px', textAlign: 'center' }}>AI-powered brand accuracy</h3>
              <p className="text-body text-muted" style={{ lineHeight: '1.6', textAlign: 'center' }}>Automatic color extraction and logo detection. Your brand, perfectly applied to every product.</p>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '140px', height: '140px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/mug-mockup.svg" alt="Branded mug mockup - Self-serve storefronts" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <h3 className="text-h3" style={{ marginBottom: '8px', textAlign: 'center' }}>Self-serve storefronts</h3>
              <p className="text-body text-muted" style={{ lineHeight: '1.6', textAlign: 'center' }}>Employees browse, customize, and buy. You earn a margin on every order with zero inventory.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section className="section">
        <div className="container content-narrow">
          <h2 className="text-h2" style={{ textAlign: 'center', marginBottom: '48px' }}>How it works</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-accent)', color: '#fff', flexShrink: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>1</div>
              <div>
                <h3 className="text-h3" style={{ marginBottom: '8px' }}>Enter your domain</h3>
                <p className="text-body text-muted">Paste your company's domain (e.g., acme.com). We'll auto-detect your brand colors and logo.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-accent)', color: '#fff', flexShrink: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>2</div>
              <div>
                <h3 className="text-h3" style={{ marginBottom: '8px' }}>Curate products</h3>
                <p className="text-body text-muted">We generate 8–12 on-brand products. Review mockups and hand-pick what your team will love.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-accent)', color: '#fff', flexShrink: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>3</div>
              <div>
                <h3 className="text-h3" style={{ marginBottom: '8px' }}>Share & earn</h3>
                <p className="text-body text-muted">Your live store is ready. Share a link with your team. We handle fulfillment; you earn margin on every order.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="section section-gradient-bg" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="container content-narrow text-center">
          <h2 className="text-h2" style={{ marginBottom: '24px' }}>Ready to launch?</h2>
          <p className="text-body text-muted" style={{ marginBottom: '32px', fontSize: '1.0625rem' }}>Join early adopters and start your branded swag store today.</p>
          <Link href="/onboard" className="btn btn-primary btn-lg">
            Get started free
          </Link>
        </div>
      </section>
    </>
  )
}
