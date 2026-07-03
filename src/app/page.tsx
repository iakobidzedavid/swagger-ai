import Link from 'next/link'
import AttributionCapture from '@/components/AttributionCapture'
import HomepageBrandPreview from '@/components/HomepageBrandPreview'

export default function LandingPage() {
  return (
    <section className="section" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
      <AttributionCapture />
      <div className="container content-narrow text-center">
        <h1 className="text-display" style={{ marginBottom: '24px' }}>
          Swagger AI
        </h1>
        <p className="text-body text-muted" style={{ fontSize: '1.125rem', maxWidth: '460px', margin: '0 auto 40px' }}>
          Branded employee swag stores, set up in minutes.
        </p>

        <div style={{ marginBottom: '40px' }}>
          <HomepageBrandPreview />
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/onboard" className="btn btn-secondary btn-lg">
            Get started
          </Link>
          <Link href="/design-engine?domain=stripe.com" className="btn btn-primary btn-lg" style={{ backgroundColor: 'var(--color-accent-hover)' }}>
            View sample mockup
          </Link>
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <Link href="/pricing" className="text-body" style={{ textDecoration: 'none', color: 'var(--color-accent)', fontSize: '0.9375rem' }}>
            View Pricing →
          </Link>
        </div>
      </div>
    </section>
  )
}
