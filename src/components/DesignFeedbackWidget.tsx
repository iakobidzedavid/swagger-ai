'use client'

import { useEffect, useState } from 'react'

interface DesignFeedbackWidgetProps {
  orderId: string
}

type WidgetState = 'checking' | 'prompt' | 'submitting' | 'submitted' | 'already-submitted' | 'error'

/**
 * Captures the real outcome signal behind Swagger AI's core (DE Step 10): does this
 * generated swag actually look on-brand, and would the employee reorder it. Every
 * submission is a real Supabase row that feeds the storefront's live Brand Fidelity Score.
 */
export function DesignFeedbackWidget({ orderId }: DesignFeedbackWidgetProps) {
  const [state, setState] = useState<WidgetState>('checking')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [wouldReorder, setWouldReorder] = useState<boolean | null>(null)
  const [comment, setComment] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetch(`/api/design-feedback/check?orderId=${encodeURIComponent(orderId)}`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.submitted) {
          setState('already-submitted')
        } else {
          setState('prompt')
        }
      })
      .catch(() => setState('prompt'))
  }, [orderId])

  const handleSubmit = async () => {
    if (rating < 1 || wouldReorder === null) {
      setErrorMsg('Please rate the brand match and answer the reorder question')
      return
    }
    setErrorMsg('')
    setState('submitting')
    try {
      const res = await fetch('/api/design-feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          brandAccuracyRating: rating,
          wouldReorder,
          comment: comment.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to submit feedback')
      }
      setState('submitted')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit feedback')
      setState('prompt')
    }
  }

  if (state === 'checking') {
    return null
  }

  if (state === 'already-submitted' || state === 'submitted') {
    return (
      <div className="card" style={{ marginBottom: '32px', background: 'var(--color-surface)' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '20px' }}>✓</span>
          <div>
            <h3 className="text-h3" style={{ marginBottom: '6px' }}>
              Thanks for the feedback
            </h3>
            <p className="text-small text-muted" style={{ margin: 0 }}>
              Your rating feeds Swagger AI's brand-fidelity engine — every response sharpens how future
              storefronts are generated for this company.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: '32px' }}>
      <h3 className="text-h3" style={{ marginBottom: '8px' }}>
        Rate the Brand Match
      </h3>
      <p className="text-small text-muted" style={{ marginBottom: '20px' }}>
        Does this swag look like it actually came from your company's own brand?
      </p>

      <div style={{ marginBottom: '20px' }}>
        <div className="text-small font-semibold" style={{ marginBottom: '10px' }}>
          Brand accuracy
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                fontSize: '28px',
                lineHeight: 1,
                color: (hoverRating || rating) >= star ? 'var(--color-accent)' : 'var(--color-border)',
                transition: 'color 0.1s ease',
              }}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div className="text-small font-semibold" style={{ marginBottom: '10px' }}>
          Would you reorder this for the next new hire?
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setWouldReorder(true)}
            className="btn"
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-md)',
              border: wouldReorder === true ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
              background: wouldReorder === true ? 'var(--color-accent-subtle)' : 'var(--color-surface)',
              color: wouldReorder === true ? 'var(--color-accent)' : 'var(--color-text)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setWouldReorder(false)}
            className="btn"
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-md)',
              border: wouldReorder === false ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
              background: wouldReorder === false ? 'var(--color-accent-subtle)' : 'var(--color-surface)',
              color: wouldReorder === false ? 'var(--color-accent)' : 'var(--color-text)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            No
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="feedback-comment" className="text-small font-semibold" style={{ display: 'block', marginBottom: '10px' }}>
          Anything else? (optional)
        </label>
        <textarea
          id="feedback-comment"
          value={comment}
          onChange={e => setComment(e.target.value)}
          maxLength={1000}
          rows={3}
          className="input-field"
          style={{ resize: 'vertical', marginBottom: 0 }}
          placeholder="E.g. colors were slightly off, or the logo placement was perfect"
        />
      </div>

      {errorMsg && (
        <div className="error-banner" style={{ marginBottom: '16px' }}>
          {errorMsg}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={state === 'submitting'}
        className="btn btn-primary btn-full"
        style={{ cursor: state === 'submitting' ? 'default' : 'pointer', opacity: state === 'submitting' ? 0.7 : 1 }}
      >
        {state === 'submitting' ? 'Submitting…' : 'Submit Feedback'}
      </button>
    </div>
  )
}
