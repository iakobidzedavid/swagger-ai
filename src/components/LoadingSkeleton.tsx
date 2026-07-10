'use client'

/**
 * LoadingSkeleton — visual feedback component for loading states
 * Shows placeholder animations while content is being fetched
 */

interface LoadingSkeletonProps {
  type?: 'gallery' | 'form' | 'card'
  count?: number
}

const SkeletonPulse = ({ width = '100%', height = '20px', style = {} }) => (
  <div
    className="skeleton-pulse"
    style={{
      width,
      height,
      backgroundColor: 'var(--color-border)',
      borderRadius: 'var(--radius-md)',
      ...style,
    }}
  />
)

export function LoadingSkeletonGallery() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Logo section skeleton */}
      <div>
        <SkeletonPulse height="12px" width="60px" style={{ marginBottom: '12px' }} />
        <div
          style={{
            width: '100%',
            aspectRatio: '1',
            backgroundColor: 'var(--color-border)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
          }}
          className="skeleton-pulse"
        />
      </div>

      {/* Colors section skeleton */}
      <div>
        <SkeletonPulse height="12px" width="80px" style={{ marginBottom: '12px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: '100%',
                aspectRatio: '1',
                backgroundColor: 'var(--color-border)',
                borderRadius: 'var(--radius-md)',
              }}
              className="skeleton-pulse"
            />
          ))}
        </div>
      </div>

      {/* Info section skeleton */}
      <div style={{ gridColumn: '1 / -1' }}>
        <SkeletonPulse height="12px" width="100px" style={{ marginBottom: '12px' }} />
        <SkeletonPulse height="16px" style={{ marginBottom: '8px' }} />
        <SkeletonPulse height="16px" width="80%" />
      </div>
    </div>
  )
}

export function LoadingSkeletonForm() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      <SkeletonPulse height="44px" />
      <SkeletonPulse height="44px" />
      <div style={{ gridColumn: '1 / -1' }}>
        <SkeletonPulse height="44px" />
      </div>
    </div>
  )
}

export function LoadingSkeleton({ type = 'gallery', count = 1 }: LoadingSkeletonProps) {
  if (type === 'gallery') {
    return (
      <div style={{ padding: '24px' }}>
        <LoadingSkeletonGallery />
      </div>
    )
  }

  if (type === 'form') {
    return (
      <div style={{ padding: '24px' }}>
        <LoadingSkeletonForm />
      </div>
    )
  }

  return null
}

/**
 * LoadingOverlay — full-screen loading state with spinner and message
 */
interface LoadingOverlayProps {
  visible: boolean
  message?: string
}

export function LoadingOverlay({ visible, message = 'Processing...' }: LoadingOverlayProps) {
  if (!visible) {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(13, 31, 51, 0.8)',
        backdropFilter: 'blur(4px)',
        zIndex: 9998,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <span className="spinner" style={{ width: 32, height: 32 }} />
        <p className="text-body text-muted">{message}</p>
      </div>
    </div>
  )
}
