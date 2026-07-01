import Link from 'next/link'

export default function LandingPage() {
  return (
    <section className="section" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
      <div className="container content-narrow text-center">
        <h1 className="text-display" style={{ marginBottom: '24px' }}>
          Swagger AI
        </h1>
        <p className="text-body text-muted" style={{ fontSize: '1.125rem', maxWidth: '460px', margin: '0 auto 40px' }}>
          Branded employee swag stores, set up in minutes.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/onboard" className="btn btn-primary btn-lg">
            Get started
          </Link>
          <Link href="/design-engine?domain=stripe.com" className="btn btn-primary btn-lg" style={{ backgroundColor: '#6b21a8' }}>
            View sample mockup
          </Link>
        </div>
      </div>
    </section>
  )
}
