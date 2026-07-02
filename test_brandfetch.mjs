#!/usr/bin/env node

/**
 * Test script to verify Brandfetch integration
 * Tests the /api/brand endpoint with real domains
 */

import { fetchFromBrandfetch } from './src/lib/brandfetch.ts'

const TEST_DOMAINS = [
  'linear.app',
  'retool.com',
  'stripe.com',
  'notion.so',
]

async function testBrandfetchClient() {
  console.log('Testing Brandfetch client library directly...\n')

  const apiKey = process.env.BRANDFETCH_API_KEY
  if (!apiKey) {
    console.log('❌ BRANDFETCH_API_KEY not set')
    return false
  }

  console.log('✓ BRANDFETCH_API_KEY is set')
  console.log('')

  let successCount = 0
  for (const domain of TEST_DOMAINS) {
    console.log(`Testing domain: ${domain}`)
    try {
      const result = await fetchFromBrandfetch(domain)

      if (!result) {
        console.log(`  ⚠️  Brandfetch returned null (may fall back to keyless mode)`)
        continue
      }

      console.log(`  ✓ Company: ${result.companyName}`)
      console.log(`  ✓ Source: ${result.source}`)
      console.log(`  ✓ Logo: ${result.logoUrl ? '✓ found' : 'not found'}`)
      console.log(`  ✓ Primary color: ${result.primaryColor}`)
      console.log(`  ✓ Secondary color: ${result.secondaryColor}`)

      if (result.colors?.length) {
        console.log(`  ✓ Colors palette: ${result.colors.length} colors`)
      }
      if (result.fonts?.length) {
        console.log(`  ✓ Fonts: ${result.fonts.length} fonts`)
      }

      successCount++
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`)
    }
    console.log('')
  }

  console.log(`\nResults: ${successCount}/${TEST_DOMAINS.length} successful`)
  return successCount > 0
}

// Run the test
testBrandfetchClient()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Test error:', error)
    process.exit(1)
  })
