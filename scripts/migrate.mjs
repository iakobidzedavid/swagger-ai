import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

let Client
try {
  const pg = await import('pg')
  Client = pg.default?.Client || pg.Client
} catch (err) {
  console.warn('WARNING: pg module not available (requires Node 18+) — skipping migrations')
}
const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations')

// Load .env.local so DATABASE_URL is available when run directly via node
const envLocal = join(__dirname, '..', '.env.local')
if (existsSync(envLocal)) {
  const lines = (await readFile(envLocal, 'utf8')).split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key && !(key in process.env)) process.env[key] = val
  }
}

async function migrate() {
  if (!Client) {
    console.warn('WARNING: pg module unavailable — skipping migrations')
    return
  }

  const url = process.env.DATABASE_URL
  if (!url) {
    console.warn('WARNING: DATABASE_URL is not set — skipping migrations (set in Vercel env vars to run automatically)')
    return
  }

  let client
  try {
    client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
    await client.connect()
    console.log('Connected to database')
  } catch (err) {
    console.warn('WARNING: Could not connect to database — skipping migrations:', err.message)
    return
  }

  // Ensure migration tracking table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const files = (await readdir(MIGRATIONS_DIR))
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const { rows } = await client.query(
      'SELECT 1 FROM _migrations WHERE filename = $1',
      [file]
    )
    if (rows.length > 0) {
      console.log(`  skip  ${file} (already applied)`)
      continue
    }

    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
    console.log(`  apply ${file}`)
    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`  done  ${file}`)
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`  FAIL  ${file}: ${err.message}`)
      await client.end()
      process.exit(1)
    }
  }

  await client.end()
  console.log('Migrations complete')
}

migrate().catch(err => {
  console.warn('Migration error (non-fatal — build will continue):', err.message)
})
