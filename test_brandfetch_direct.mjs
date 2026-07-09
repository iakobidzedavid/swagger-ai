#!/usr/bin/env node

/**
 * Test Brandfetch API integration directly
 * This tests the Brandfetch API endpoint in isolation
 */

const API_KEY = process.env.BRANDFETCH_API_KEY;
const TEST_DOMAINS = ['linear.app', 'retool.com', 'stripe.com'];

console.log('Brandfetch API Direct Test');
console.log('===========================\n');

if (!API_KEY) {
  console.error('❌ BRANDFETCH_API_KEY environment variable not set');
  process.exit(1);
}

console.log('✓ API Key is set');
console.log(`  Key starts with: ${API_KEY.substring(0, 10)}...`);
console.log(`  Key length: ${API_KEY.length}`);

async function testBrandfetch() {
  let passed = 0;
  let failed = 0;

  for (const domain of TEST_DOMAINS) {
    try {
      console.log(`\nTesting domain: ${domain}`);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`https://api.brandfetch.io/v2/brands/${domain}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const text = await response.text();
        console.error(`  ❌ API returned ${response.status}`);
        console.error(`     Response: ${text.slice(0, 200)}`);
        failed++;
        continue;
      }

      const data = await response.json();

      // Check for critical fields
      if (!data.name) {
        console.error(`  ❌ Response missing 'name' field`);
        console.error(`     Full response: ${JSON.stringify(data).slice(0, 200)}`);
        failed++;
        continue;
      }

      const logoUrl = data.logos?.[0]?.formats?.[0]?.src;
      const colorCount = data.colors?.length ?? 0;
      const fontCount = data.fonts?.length ?? 0;

      console.log(`  ✓ Success: ${data.name}`);
      console.log(`    - Has logo: ${logoUrl ? 'yes' : 'no'}`);
      console.log(`    - Colors: ${colorCount}`);
      console.log(`    - Fonts: ${fontCount}`);

      if (colorCount === 0) {
        console.warn(`    ⚠️  Warning: No colors returned for ${domain}`);
      }
      if (fontCount === 0) {
        console.warn(`    ⚠️  Warning: No fonts returned for ${domain}`);
      }

      passed++;
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n===========================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

testBrandfetch();
