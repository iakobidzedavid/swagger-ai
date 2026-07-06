'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface PricingTier {
  name: string
  price: string
  billingPeriod: string
  description: string
  cta: string
  features: string[]
  highlighted: boolean
}

const pricingTiers: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    billingPeriod: 'forever',
    description: 'Generate branded storefronts and start selling swag immediately.',
    cta: 'Get Started',
    features: [
      'Unlimited storefront generation',
      'AI-powered brand detection via domain',
      '8-12 curated on-brand products',
      'Branded Shopify storefront',
      'Employee self-checkout',
      '18% commission on GMV',
      'Email & community support',
    ],
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$1,000',
    billingPeriod: 'per year',
    description: 'Advanced features for scaling your swag program across teams.',
    cta: 'Subscribe Now',
    features: [
      'Everything in Free, plus:',
      'Premium onboarding & setup',
      'Dedicated Slack support channel',
      'Advanced analytics & reporting',
      'Custom product curation',
      'API access for integrations',
      'SSO/SAML authentication',
      'Priority feature requests',
      'White-label storefront option',
    ],
    highlighted: true,
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFreeTierClick = () => {
    router.push('/onboard')
  }

  const handleProTierClick = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get user email from a form input or auth context
      // For now, prompt the user
      const userEmail = prompt('Please enter your email address:')
      if (!userEmail) {
        setLoading(false)
        return
      }

      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'pro', userEmail }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Stripe Checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process subscription')
      setLoading(false)
    }
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '100vh', paddingTop: '80px', paddingBottom: '80px' }}>
      <div className="container" style={{ maxWidth: '1200px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <h1 className="text-display" style={{ marginBottom: '16px' }}>
            Simple, Value-Based Pricing
          </h1>
          <p className="text-body text-muted" style={{ fontSize: '1.125rem', maxWidth: '600px', margin: '0 auto' }}>
            Scale your company swag program from free storefront generation to enterprise-ready management
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="error-banner" style={{ marginBottom: '40px', alignItems: 'flex-start' }}>
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: '2px' }}>
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <div>
              <div className="text-small font-semibold" style={{ marginBottom: '4px' }}>
                Something went wrong
              </div>
              <p className="text-small" style={{ margin: 0 }}>
                {error}. Please try again or contact support.
              </p>
            </div>
          </div>
        )}

        {/* Pricing Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '32px',
          marginBottom: '60px',
        }}>
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className="card"
              style={{
                position: 'relative',
                border: tier.highlighted ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                backgroundColor: tier.highlighted ? 'var(--color-accent-subtle)' : 'var(--color-surface)',
                transform: tier.highlighted ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.3s ease',
              }}
            >
              {tier.highlighted && (
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-on-accent)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  Most Popular
                </div>
              )}

              <div style={{ marginBottom: '24px', paddingTop: tier.highlighted ? '16px' : '0' }}>
                <h2 className="text-h2" style={{ marginBottom: '8px' }}>
                  {tier.name}
                </h2>
                <p className="text-body text-muted" style={{ margin: '0 0 24px 0', fontSize: '0.9375rem' }}>
                  {tier.description}
                </p>

                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span className="text-display" style={{ color: tier.highlighted ? 'var(--color-accent)' : 'var(--color-text)' }}>
                      {tier.price}
                    </span>
                    <span className="text-body text-muted">
                      {tier.billingPeriod}
                    </span>
                  </div>
                </div>

                <button
                  onClick={tier.name === 'Free' ? handleFreeTierClick : handleProTierClick}
                  disabled={loading && tier.name === 'Pro'}
                  className={tier.highlighted ? 'btn btn-primary btn-full' : 'btn btn-secondary btn-full'}
                  style={{
                    opacity: loading && tier.name === 'Pro' ? 0.6 : 1,
                    cursor: loading && tier.name === 'Pro' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading && tier.name === 'Pro' ? 'Processing...' : tier.cta}
                </button>
              </div>

              <div style={{
                borderTop: '1px solid var(--color-border)',
                paddingTop: '24px',
              }}>
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}>
                  {tier.features.map((feature, i) => (
                    <li key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        style={{ flexShrink: 0, marginTop: '4px', color: 'var(--color-accent)' }}
                      >
                        <path
                          d="M13.5 4.5L6 12L2.5 8.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="text-body" style={{ fontSize: '0.9375rem' }}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div style={{
          maxWidth: '700px',
          margin: '0 auto',
          backgroundColor: 'var(--color-accent-subtle)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '40px',
        }}>
          <h3 className="text-h3" style={{ marginBottom: '24px', textAlign: 'center' }}>
            Frequently Asked Questions
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h4 className="text-body font-semibold" style={{ marginBottom: '8px' }}>
                Do I have to pay to start?
              </h4>
              <p className="text-body text-muted" style={{ margin: 0, fontSize: '0.9375rem' }}>
                No! Swagger AI's Free tier is fully featured. You can generate unlimited storefronts, detect brands, and start selling swag immediately at no cost. The 18% GMV commission kicks in only when your team orders.
              </p>
            </div>

            <div>
              <h4 className="text-body font-semibold" style={{ marginBottom: '8px' }}>
                When should I upgrade to Pro?
              </h4>
              <p className="text-body text-muted" style={{ margin: 0, fontSize: '0.9375rem' }}>
                Pro is ideal if you're running 5+ storefronts per year, need dedicated support, or want advanced analytics and API access. At $1,000/yr, Pro becomes cost-effective once you're generating $5,500+ in GMV annually (the 18% commission would equal the subscription cost).
              </p>
            </div>

            <div>
              <h4 className="text-body font-semibold" style={{ marginBottom: '8px' }}>
                Can I cancel or change plans anytime?
              </h4>
              <p className="text-body text-muted" style={{ margin: 0, fontSize: '0.9375rem' }}>
                Yes. You can cancel your Pro subscription at any time. Your access continues through the end of your current billing period, and there are no long-term contracts or early termination fees.
              </p>
            </div>

            <div>
              <h4 className="text-body font-semibold" style={{ marginBottom: '8px' }}>
                How does the 18% commission work?
              </h4>
              <p className="text-body text-muted" style={{ margin: 0, fontSize: '0.9375rem' }}>
                We take 18% of the total order value (GMV) from every purchase made through your Swagger-generated storefront. This aligns our interests: we succeed when your team buys more swag. No hidden fees or per-product charges.
              </p>
            </div>

            <div>
              <h4 className="text-body font-semibold" style={{ marginBottom: '8px' }}>
                Do you offer volume discounts or custom plans?
              </h4>
              <p className="text-body text-muted" style={{ margin: 0, fontSize: '0.9375rem' }}>
                For large enterprises or special use cases, we can discuss custom pricing. Contact our sales team for details. Everyone starts with Free or Pro, but we can grow together.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Footer */}
        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <p className="text-body text-muted" style={{ marginBottom: '20px' }}>
            Questions? Contact us or start with Free — no credit card required.
          </p>
          <Link href="/" className="btn btn-secondary">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
