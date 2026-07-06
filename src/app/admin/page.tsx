'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

interface AdminLink {
  href: string
  title: string
  description: string
  icon: string
}

const ADMIN_LINKS: AdminLink[] = [
  {
    href: '/dashboard',
    title: 'Dashboard',
    description: 'Monitor orders, GMV, revenue, and brand extractions',
    icon: '📊',
  },
  {
    href: '/admin/channels',
    title: 'Acquisition Channels',
    description: 'Manage acquisition channels and API integrations',
    icon: '🔗',
  },
  {
    href: '/admin/printify-diagnostics',
    title: 'Printify Diagnostics',
    description: 'Debug Printify product sync and inventory',
    icon: '🔧',
  },
  {
    href: '/admin/product-generation',
    title: 'Product Generation',
    description: 'Monitor and trigger product generation jobs',
    icon: '⚙️',
  },
  {
    href: '/admin/brandfetch',
    title: 'Brand Fetch',
    description: 'View brand detection and Clearbit integration',
    icon: '🎨',
  },
  {
    href: '/admin/storefront-settings',
    title: 'Storefront Settings',
    description: 'Configure global storefront defaults',
    icon: '🏪',
  },
]

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Check if user has auth token in localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('supabase_auth_token') : null
    setIsAuthenticated(Boolean(token))
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <div className="text-center">
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ paddingTop: '60px', paddingBottom: '60px' }}>
        <div style={{
          maxWidth: '500px',
          margin: '0 auto',
          padding: '40px',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          textAlign: 'center'
        }}>
          <h2 className="text-h2" style={{ marginBottom: '16px', fontSize: '1.5rem' }}>
            Admin Dashboard
          </h2>
          <p className="text-body text-muted" style={{ marginBottom: '24px' }}>
            This section requires authentication to access admin features.
          </p>
          <p className="text-body text-muted" style={{ marginBottom: '24px', fontSize: '0.875rem' }}>
            To authenticate, create a storefront first and look for the auth token in your browser's local storage.
          </p>
          <Link href="/onboard" className="btn btn-primary">
            Create Your First Storefront
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '60px' }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 className="text-display" style={{ marginBottom: '8px' }}>Admin Hub</h1>
        <p className="text-body text-muted">Manage Swagger AI operations, configurations, and monitoring</p>
      </div>

      {/* Links Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {ADMIN_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              display: 'block',
              padding: '24px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.05)'
              e.currentTarget.style.borderColor = 'var(--color-accent)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface)'
              e.currentTarget.style.borderColor = 'var(--color-border)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{
              fontSize: '2rem',
              marginBottom: '12px',
              lineHeight: 1,
            }}>
              {link.icon}
            </div>
            <h3 style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              marginBottom: '8px',
              color: 'var(--color-text)',
            }}>
              {link.title}
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
              lineHeight: 1.5,
            }}>
              {link.description}
            </p>
          </Link>
        ))}
      </div>

      {/* Quick Help */}
      <div style={{
        marginTop: '60px',
        padding: '24px',
        backgroundColor: 'var(--color-accent-subtle)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid rgba(124, 58, 237, 0.2)',
      }}>
        <h3 style={{
          fontSize: '1rem',
          fontWeight: 600,
          marginBottom: '12px',
          color: 'var(--color-accent-tint)',
        }}>
          💡 Quick Tips
        </h3>
        <ul style={{
          fontSize: '0.875rem',
          color: 'var(--color-text-muted)',
          listStyle: 'none',
          lineHeight: 1.8,
        }}>
          <li>• Monitor all orders and brand extractions in the Dashboard</li>
          <li>• Check Printify diagnostics to verify product sync status</li>
          <li>• Review brand detection results and Clearbit integration</li>
          <li>• Track acquisition channels and API integrations</li>
        </ul>
      </div>
    </div>
  )
}
