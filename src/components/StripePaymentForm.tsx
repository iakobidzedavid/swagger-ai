'use client'

import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useState } from 'react'

interface StripePaymentFormProps {
  paymentIntentId: string | null
  processing: boolean
  error: string | null
  onPaymentConfirmed: (success: boolean, error?: string) => void
}

export function StripePaymentForm({
  paymentIntentId,
  processing,
  error,
  onPaymentConfirmed,
}: StripePaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [cardError, setCardError] = useState<string | null>(null)

  // Card element styling
  const cardElementOptions = {
    style: {
      base: {
        fontSize: '14px',
        color: 'var(--color-text)',
        '::placeholder': {
          color: 'var(--color-border)',
        },
      },
      invalid: {
        color: 'var(--color-danger)',
      },
    },
  }

  const handleConfirmPayment = async () => {
    if (!stripe || !elements || !paymentIntentId) {
      setCardError('Payment not initialized')
      onPaymentConfirmed(false, 'Payment not initialized')
      return
    }

    setCardError(null)

    try {
      // Confirm payment with the card element
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        paymentIntentId,
        {
          payment_method: {
            card: elements.getElement(CardElement)!,
          },
        }
      )

      if (confirmError) {
        setCardError(confirmError.message || 'Payment failed')
        onPaymentConfirmed(false, confirmError.message)
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onPaymentConfirmed(true)
      } else {
        setCardError('Payment was not successful')
        onPaymentConfirmed(false, 'Payment was not successful')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed'
      setCardError(message)
      onPaymentConfirmed(false, message)
    }
  }

  if (!stripe || !elements) {
    return <div className="text-small text-muted">Loading payment form...</div>
  }

  return (
    <div>
      <div
        style={{
          padding: '10px 12px',
          borderRadius: '4px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
        }}
      >
        <CardElement options={cardElementOptions} />
      </div>
      {(cardError || error) && (
        <div className="text-small" style={{ color: 'var(--color-danger)', marginTop: '8px' }}>
          {cardError || error}
        </div>
      )}
      <button
        onClick={handleConfirmPayment}
        disabled={processing || !stripe}
        style={{
          marginTop: '16px',
          width: '100%',
          padding: '10px 12px',
          background: 'var(--color-accent)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: processing ? 'not-allowed' : 'pointer',
          opacity: processing ? 0.6 : 1,
        }}
      >
        {processing ? 'Processing...' : 'Confirm Payment'}
      </button>
    </div>
  )
}
