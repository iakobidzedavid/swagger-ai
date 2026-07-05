import { strict as assert } from 'assert'

// Import the function we're testing
import { isCacheFresh } from '../src/lib/brand.ts'

console.log('Testing brand cache fallback source detection...\n')

const now = Date.now()
const fresh24h = new Date(now - 12 * 60 * 60 * 1000).toISOString() // 12h old
const stale48h = new Date(now - 48 * 60 * 60 * 1000).toISOString() // 48h old

// Test 1: Brandfetch source should be fresh if within 24h
const test1 = isCacheFresh(fresh24h, now, 'brandfetch')
assert.equal(test1, true, 'Brandfetch source 12h old should be fresh')
console.log('✓ Test 1: Brandfetch source 12h old = FRESH')

// Test 2: Brandfetch source should be stale if older than 24h
const test2 = isCacheFresh(stale48h, now, 'brandfetch')
assert.equal(test2, false, 'Brandfetch source 48h old should be stale')
console.log('✓ Test 2: Brandfetch source 48h old = STALE')

// Test 3: Favicon source should ALWAYS be stale, even if fresh
const test3 = isCacheFresh(fresh24h, now, 'favicon')
assert.equal(test3, false, 'Favicon source should ALWAYS be stale for refetch')
console.log('✓ Test 3: Favicon source (even 12h old) = STALE (force refetch)')

// Test 4: Theme-color source should ALWAYS be stale
const test4 = isCacheFresh(fresh24h, now, 'theme-color')
assert.equal(test4, false, 'Theme-color source should ALWAYS be stale for refetch')
console.log('✓ Test 4: Theme-color source (even 12h old) = STALE (force refetch)')

// Test 5: Fallback source should ALWAYS be stale
const test5 = isCacheFresh(fresh24h, now, 'fallback')
assert.equal(test5, false, 'Fallback source should ALWAYS be stale for refetch')
console.log('✓ Test 5: Fallback source (even 12h old) = STALE (force refetch)')

// Test 6: Missing source (undefined) should behave like brandfetch (TTL-based)
const test6 = isCacheFresh(fresh24h, now)
assert.equal(test6, true, 'Missing source 12h old should be fresh (TTL-based)')
console.log('✓ Test 6: Missing source (12h old) = FRESH (TTL-based)')

// Test 7: Missing source but stale should return false
const test7 = isCacheFresh(stale48h, now)
assert.equal(test7, false, 'Missing source 48h old should be stale (TTL-based)')
console.log('✓ Test 7: Missing source (48h old) = STALE (TTL-based)')

console.log('\n✅ All brand cache fallback tests passed!')
console.log('\nFix Summary:')
console.log('- Fallback sources (favicon, theme-color) are now ALWAYS treated as stale')
console.log('- This forces refetch from Brandfetch even if the favicon cache is recent')
console.log('- Fixes cache poisoning where bmw.com might have a Google favicon stuck')
console.log('- /api/brand will now always refetch fallback-sourced entries from Brandfetch')
