'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Storefront {
  id: string
  domain: string
  company_name: string | null
  store_name: string | null
  store_description: string | null
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
  status: string
  created_at: string
  updated_at: string
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error'
type SaveState = 'idle' | 'saving' | 'success' | 'error'

function ColorSwatch({ color, label }: { color: string | null; label: string }) {
  if (!color) return null
  return (
    <div className="flex items-center gap-2" style={{ gap: '10px', padding: '8px 0' }}>
      <div
        style={{
          background: color,
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      />
      <div>
        <div className="text-small text-muted" style={{ fontSize: '0.75rem' }}>
          {label}
        </div>
        <div className="text-small font-semibold" style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
          {color}
        </div>
      </div>
    </div>
  )
}

function StorefrontPreview({ storefront }: { storefront: Storefront }) {
  const [showLogoError, setShowLogoError] = useState(false)

  // Safe gradient with fallback colors
  const primaryColor = storefront.primary_color && /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(storefront.primary_color)
    ? storefront.primary_color
    : '#102542'
  const secondaryColor = storefront.secondary_color && /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(storefront.secondary_color)
    ? storefront.secondary_color
    : '#8fa3b8'

  return (
    <div
      className="card"
      style={{
        background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`,
        padding: '32px',
        minHeight: '280px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        color: '#ecebf3',
      }}
    >
      {/* Logo preview */}
      {storefront.logo_url && !showLogoError ? (
        <img
          src={storefront.logo_url}
          alt={storefront.company_name || 'Logo'}
          style={{
            width: '80px',
            height: '80px',
            objectFit: 'contain',
            marginBottom: '16px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.1)',
            padding: '8px',
          }}
          onError={() => setShowLogoError(true)}
        />
      ) : storefront.company_name ? (
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 800,
            marginBottom: '16px',
          }}
        >
          {storefront.company_name.charAt(0).toUpperCase()}
        </div>
      ) : null}

      {/* Store name */}
      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '8px' }}>
        {storefront.store_name || storefront.company_name || 'Your Store'}
      </h2>

      {/* Store description */}
      {storefront.store_description && (
        <p style={{ fontSize: '0.95rem', marginBottom: '16px', maxWidth: '400px', opacity: 0.9 }}>
          {storefront.store_description}
        </p>
      )}

      {/* CTA button */}
      <button
        style={{
          marginTop: '16px',
          padding: '10px 24px',
          background: 'rgba(255,255,255,0.2)',
          color: '#ecebf3',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 'var(--radius-md)',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Shop Now
      </button>
    </div>
  )
}

export default function StorefrontSettingsPage() {
  const [storefronts, setStorefronts] = useState<Storefront[]>([])
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedStorefront, setSelectedStorefront] = useState<Storefront | null>(null)
  const [editData, setEditData] = useState<Partial<Storefront>>({})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const [searchDomain, setSearchDomain] = useState('')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (successTimer.current) clearTimeout(successTimer.current)
    }
  }, [])

  // Load storefronts (only re-run when searchDomain changes)
  useEffect(() => {
    const loadStorefronts = async () => {
      setLoadState('loading')
      setLoadError(null)
      try {
        const url = new URL('/api/admin/storefronts', window.location.origin)
        if (searchDomain) {
          url.searchParams.set('domain', searchDomain)
        }

        const res = await fetch(url.toString())
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load storefronts')
        }

        setStorefronts(data.storefronts || [])
        setLoadState('loaded')

        // Auto-select first if available and nothing is selected
        if (data.storefronts && data.storefronts.length > 0 && !selectedStorefront) {
          selectStorefront(data.storefronts[0])
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load storefronts')
        setLoadState('error')
      }
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(loadStorefronts, 300)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [searchDomain])

  const selectStorefront = (sf: Storefront) => {
    setSelectedStorefront(sf)
    setEditData({
      id: sf.id,
      company_name: sf.company_name,
      store_name: sf.store_name,
      store_description: sf.store_description,
      logo_url: sf.logo_url,
      primary_color: sf.primary_color,
      secondary_color: sf.secondary_color,
    })
    setSaveState('idle')
    setSaveError(null)
  }

  const isValidHexColor = (color: string): boolean => {
    if (!color) return true // Allow empty
    const hexRegex = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/
    return hexRegex.test(color.trim())
  }

  const handleInputChange = useCallback(
    (field: keyof Storefront, value: string | null) => {
      const trimmedValue = value?.trim() || null
      setEditData((prev) => ({
        ...prev,
        [field]: trimmedValue,
      }))
    },
    []
  )

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStorefront) return

    // Validate colors before saving
    if (editData.primary_color && !isValidHexColor(editData.primary_color)) {
      setSaveError('Primary color must be a valid hex color (e.g., #102542)')
      return
    }
    if (editData.secondary_color && !isValidHexColor(editData.secondary_color)) {
      setSaveError('Secondary color must be a valid hex color (e.g., #8fa3b8)')
      return
    }

    setSaveState('saving')
    setSaveError(null)

    try {
      const res = await fetch('/api/admin/storefronts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedStorefront.id,
          company_name: editData.company_name || undefined,
          store_name: editData.store_name || undefined,
          store_description: editData.store_description || undefined,
          logo_url: editData.logo_url || undefined,
          primary_color: editData.primary_color || undefined,
          secondary_color: editData.secondary_color || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save storefront settings')
      }

      setSaveState('success')
      setSelectedStorefront(data.storefront)
      setEditData(data.storefront)

      // Reset success message after 2 seconds
      if (successTimer.current) clearTimeout(successTimer.current)
      successTimer.current = setTimeout(() => setSaveState('idle'), 2000)
    } catch (err) {
      setSaveState('error')
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  return (
    <div className="section">
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <span className="badge badge-accent" style={{ marginBottom: '12px' }}>
            Store Management
          </span>
          <h1 className="text-h1" style={{ marginBottom: '10px', marginTop: '12px' }}>
            Storefront Branding Settings
          </h1>
          <p className="text-body text-muted">
            Manage and customize your storefront's branding, colors, logo, and store information.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          {/* Left column: storefront list and edit form */}
          <div>
            {/* Search */}
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="domain-search" style={{ display: 'block', marginBottom: '8px' }}>
                <span className="text-small font-semibold">Search storefronts</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="domain-search"
                  type="text"
                  className="input-field"
                  placeholder="Search by domain..."
                  value={searchDomain}
                  onChange={(e) => setSearchDomain(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Storefronts list */}
            {loadState === 'loading' && (
              <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
                <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
                <p className="text-small text-muted" style={{ marginTop: '8px' }}>
                  Loading storefronts...
                </p>
              </div>
            )}

            {loadState === 'loaded' && storefronts.length === 0 && (
              <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
                <p className="text-small text-muted">No storefronts found. Create one from the onboard page.</p>
              </div>
            )}

            {loadError && (
              <div className="error-banner" style={{ marginBottom: '16px' }}>
                {loadError}
              </div>
            )}

            {storefronts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {storefronts.map((sf) => (
                  <div
                    key={sf.id}
                    className="card"
                    style={{
                      cursor: 'pointer',
                      padding: '16px',
                      background: selectedStorefront?.id === sf.id ? 'var(--color-surface)' : undefined,
                      borderColor: selectedStorefront?.id === sf.id ? 'var(--color-accent)' : undefined,
                      borderWidth: selectedStorefront?.id === sf.id ? '1px' : undefined,
                    }}
                    onClick={() => selectStorefront(sf)}
                  >
                    <div className="flex items-center gap-3" style={{ marginBottom: '8px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: 'var(--radius-sm)',
                          background: `linear-gradient(135deg, ${sf.secondary_color || '#8fa3b8'} 0%, ${sf.primary_color || '#102542'} 100%)`,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="text-small font-semibold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sf.store_name || sf.company_name || sf.domain}
                        </div>
                        <div className="text-small text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8rem' }}>
                          {sf.domain}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Edit form */}
            {selectedStorefront && (
              <form onSubmit={handleSave} className="card">
                <div style={{ marginBottom: '24px' }}>
                  <label htmlFor="store-name" style={{ display: 'block', marginBottom: '6px' }}>
                    <span className="text-small font-semibold">Store Name</span>
                  </label>
                  <input
                    id="store-name"
                    type="text"
                    className="input-field"
                    placeholder="e.g., Acme Company Store"
                    value={editData.store_name || ''}
                    onChange={(e) => handleInputChange('store_name', e.target.value)}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label htmlFor="company-name" style={{ display: 'block', marginBottom: '6px' }}>
                    <span className="text-small font-semibold">Company Name</span>
                  </label>
                  <input
                    id="company-name"
                    type="text"
                    className="input-field"
                    placeholder="e.g., Acme Inc."
                    value={editData.company_name || ''}
                    onChange={(e) => handleInputChange('company_name', e.target.value)}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label htmlFor="store-description" style={{ display: 'block', marginBottom: '6px' }}>
                    <span className="text-small font-semibold">Store Description</span>
                  </label>
                  <textarea
                    id="store-description"
                    className="input-field"
                    placeholder="Describe your store in a few words..."
                    value={editData.store_description || ''}
                    onChange={(e) => handleInputChange('store_description', e.target.value)}
                    style={{ resize: 'vertical', minHeight: '80px' }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label htmlFor="logo-url" style={{ display: 'block', marginBottom: '6px' }}>
                    <span className="text-small font-semibold">Logo URL</span>
                  </label>
                  <input
                    id="logo-url"
                    type="url"
                    className="input-field"
                    placeholder="https://example.com/logo.png"
                    value={editData.logo_url || ''}
                    onChange={(e) => handleInputChange('logo_url', e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <label htmlFor="primary-color" style={{ display: 'block', marginBottom: '6px' }}>
                      <span className="text-small font-semibold">Primary Color</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        id="primary-color"
                        type="text"
                        className={`input-field${editData.primary_color && !isValidHexColor(editData.primary_color) ? ' input-error' : ''}`}
                        placeholder="#102542"
                        value={editData.primary_color || ''}
                        onChange={(e) => handleInputChange('primary_color', e.target.value)}
                        style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                      />
                      {editData.primary_color && isValidHexColor(editData.primary_color) && (
                        <div
                          style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            border: '1px solid var(--color-border)',
                            background: editData.primary_color,
                          }}
                        />
                      )}
                    </div>
                    {editData.primary_color && !isValidHexColor(editData.primary_color) && (
                      <p className="text-small text-danger" style={{ marginTop: '4px' }}>Invalid hex color (e.g., #102542)</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="secondary-color" style={{ display: 'block', marginBottom: '6px' }}>
                      <span className="text-small font-semibold">Secondary Color</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        id="secondary-color"
                        type="text"
                        className={`input-field${editData.secondary_color && !isValidHexColor(editData.secondary_color) ? ' input-error' : ''}`}
                        placeholder="#8fa3b8"
                        value={editData.secondary_color || ''}
                        onChange={(e) => handleInputChange('secondary_color', e.target.value)}
                        style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                      />
                      {editData.secondary_color && isValidHexColor(editData.secondary_color) && (
                        <div
                          style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            border: '1px solid var(--color-border)',
                            background: editData.secondary_color,
                          }}
                        />
                      )}
                    </div>
                    {editData.secondary_color && !isValidHexColor(editData.secondary_color) && (
                      <p className="text-small text-danger" style={{ marginTop: '4px' }}>Invalid hex color (e.g., #8fa3b8)</p>
                    )}
                  </div>
                </div>

                {saveError && (
                  <div className="error-banner" style={{ marginBottom: '16px' }}>
                    {saveError}
                  </div>
                )}

                {saveState === 'success' && (
                  <div className="success-banner" style={{ marginBottom: '16px' }}>
                    Storefront settings saved successfully
                  </div>
                )}

                <button type="submit" className="btn btn-primary btn-full" disabled={saveState === 'saving'}>
                  {saveState === 'saving' ? (
                    <>
                      <span className="spinner" style={{ width: 16, height: 16 }} />
                      Saving...
                    </>
                  ) : (
                    'Save Settings'
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Right column: preview */}
          {selectedStorefront && (
            <div>
              <h2 className="text-h2" style={{ marginBottom: '16px' }}>
                Preview
              </h2>
              <StorefrontPreview
                storefront={{
                  ...selectedStorefront,
                  ...editData,
                  id: selectedStorefront.id,
                }}
              />

              <div className="card" style={{ marginTop: '24px', padding: '20px' }}>
                <h3 className="text-h3" style={{ marginBottom: '16px' }}>
                  Brand Details
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {editData.primary_color && <ColorSwatch color={editData.primary_color} label="Primary" />}
                  {editData.secondary_color && <ColorSwatch color={editData.secondary_color} label="Secondary" />}
                </div>

                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
                  <div className="text-small text-muted" style={{ marginBottom: '8px' }}>
                    <strong>Domain:</strong> {selectedStorefront.domain}
                  </div>
                  <div className="text-small text-muted" style={{ marginBottom: '8px' }}>
                    <strong>Status:</strong> {selectedStorefront.status}
                  </div>
                  <div className="text-small text-muted">
                    <strong>Created:</strong> {new Date(selectedStorefront.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
