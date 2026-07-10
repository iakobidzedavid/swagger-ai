'use client'

import QRCode from 'qrcode'
import { useState, useEffect } from 'react'

interface QRCodeGeneratorProps {
  url: string
  fileName?: string
}

export function QRCodeGenerator({ url, fileName = 'store-qr-code' }: QRCodeGeneratorProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Generate QR code on mount or when URL changes
  useEffect(() => {
    async function generateQR() {
      try {
        setLoading(true)
        setError(null)
        const dataUrl = await QRCode.toDataURL(url, {
          width: 300,
          margin: 2,
          errorCorrectionLevel: 'H',
        })
        setQrDataUrl(dataUrl)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('QR code generation failed:', err)
        setError('Failed to generate QR code')
      } finally {
        setLoading(false)
      }
    }

    generateQR()
  }, [url])

  const downloadQRCode = async () => {
    if (!qrDataUrl) {
      return
    }

    try {
      // Create a link element and trigger download
      const link = document.createElement('a')
      link.href = qrDataUrl
      link.download = `${fileName}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Download failed:', err)
      setError('Failed to download QR code')
    }
  }

  const copyQRToClipboard = async () => {
    if (!qrDataUrl) {
      return
    }

    try {
      // Convert data URL to blob
      const response = await fetch(qrDataUrl)
      const blob = await response.blob()

      // Copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ])

      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Copy to clipboard failed:', err)
      setError('Failed to copy QR code')
    }
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
        <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
        <p className="text-body text-muted">Generating QR code…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ padding: '24px', background: 'var(--color-surface)' }}>
        <div className="text-body" style={{ color: 'var(--color-danger)', marginBottom: '12px' }}>
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
      <h3 className="text-h3" style={{ marginBottom: '16px' }}>
        Share Your Store
      </h3>

      {/* QR Code Display */}
      <div
        style={{
          display: 'inline-block',
          padding: '16px',
          background: 'white',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          marginBottom: '20px',
        }}
      >
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt="Store URL QR Code"
            style={{
              width: '200px',
              height: '200px',
              display: 'block',
            }}
          />
        )}
      </div>

      {/* Instructions */}
      <p className="text-small text-muted" style={{ marginBottom: '20px' }}>
        Scan with a phone camera or QR code reader to visit your store
      </p>

      {/* Action Buttons */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
        }}
      >
        <button
          onClick={downloadQRCode}
          className="btn btn-primary"
          style={{ padding: '10px 16px', fontSize: '14px' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 12v-8M4 8l4 4 4-4" />
            <path d="M2 14h12" />
          </svg>
          Download
        </button>
        <button
          onClick={copyQRToClipboard}
          className="btn btn-secondary"
          style={{ padding: '10px 16px', fontSize: '14px' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="10" height="10" rx="1" />
            <path d="M6.5 2.5v-1A1.5 1.5 0 0 1 8 0h4.5A1.5 1.5 0 0 1 14 1.5V6a1.5 1.5 0 0 1-1.5 1.5h-1" />
          </svg>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
