'use client'

import { useEffect } from 'react'
import { captureAttribution } from '@/lib/attribution'

/** Drop this on any landing surface (homepage, /onboard) to record first-touch
 * UTM/referrer attribution for the revenue engine (DE-18). Renders nothing. */
export default function AttributionCapture() {
  useEffect(() => {
    captureAttribution()
  }, [])
  return null
}
