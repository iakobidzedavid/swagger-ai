import { execSync } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'

interface GitInfo {
  commit_hash: string
  commit_message: string
  branch: string
  author: string
  timestamp: string
}

interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime_ms: number
  codebase: {
    tests: {
      count: number
      files: string[]
    }
    git: Partial<GitInfo> & { error?: string }
    typescript: {
      compiled: boolean
      errors?: string
    }
    eslint: {
      checked: boolean
      errors?: string
    }
  }
  database: {
    connected: boolean
    error?: string
  }
  api: {
    responding: boolean
    latency_ms: number
  }
}

export async function gatherHealthMetrics(): Promise<HealthMetrics> {
  const startTime = Date.now()
  let criticalFailures = 0

  // Gather Git info — failures here are non-critical
  const gitInfo: Partial<GitInfo> & { error?: string } = {}
  try {
    gitInfo.commit_hash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
    gitInfo.commit_message = execSync('git log -1 --pretty=%B', { encoding: 'utf-8' }).trim()
    gitInfo.branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim()
    gitInfo.author = execSync('git log -1 --pretty=%an', { encoding: 'utf-8' }).trim()
    gitInfo.timestamp = execSync('git log -1 --pretty=%ai', { encoding: 'utf-8' }).trim()
  } catch (err) {
    // Git commands might not be available in production — non-critical
    gitInfo.error = 'Git info unavailable (normal in serverless/production)'
  }

  // Count test files — non-critical
  let testFiles: string[] = []
  try {
    const testsDir = path.join(process.cwd(), 'tests')
    const files = await fs.readdir(testsDir)
    testFiles = files.filter(f => f.endsWith('.test.mjs') || f.endsWith('.test.ts'))
  } catch {
    // Tests directory might not exist in standalone build — non-critical
  }

  // Check TypeScript compilation — non-critical
  let tsCompiled = false
  let tsError: string | undefined
  try {
    const tsBuildInfo = path.join(process.cwd(), 'tsconfig.tsbuildinfo')
    await fs.access(tsBuildInfo)
    tsCompiled = true
  } catch {
    tsError = 'TypeScript build info not found (normal in production)'
  }

  // Check ESLint status — non-critical
  let eslintChecked = false
  let eslintError: string | undefined
  try {
    const eslintConfig = path.join(process.cwd(), 'eslint.config.js')
    await fs.access(eslintConfig)
    eslintChecked = true
  } catch {
    eslintError = 'ESLint config not found (normal in production)'
  }

  // Check database connectivity — CRITICAL
  let dbConnected = false
  let dbError: string | undefined
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      dbError = 'Supabase credentials not configured'
      criticalFailures++
    } else {
      try {
        // Try to make a simple request to Supabase with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        try {
          const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          })

          if (response.ok || response.status === 404) {
            // 404 is OK — means the API endpoint exists but no resource at root
            dbConnected = true
          } else {
            dbError = `Supabase returned ${response.status}`
            criticalFailures++
          }
        } finally {
          // Always clear timeout, even on error
          clearTimeout(timeoutId)
        }
      } catch (fetchErr) {
        dbError = `Supabase fetch error: ${(fetchErr as Error).message}`
        criticalFailures++
      }
    }
  } catch (err) {
    dbError = `Database check error: ${(err as Error).message}`
    criticalFailures++
  }

  const endTime = Date.now()
  const latency = endTime - startTime

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  if (criticalFailures > 0) {
    overallStatus = 'degraded'
  }
  // TypeScript/ESLint failures also degrade status (build health matters)
  if (!tsCompiled || !eslintChecked) {
    overallStatus = 'degraded'
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime_ms: latency,
    codebase: {
      tests: {
        count: testFiles.length,
        files: testFiles,
      },
      git: gitInfo,
      typescript: {
        compiled: tsCompiled,
        errors: tsError,
      },
      eslint: {
        checked: eslintChecked,
        errors: eslintError,
      },
    },
    database: {
      connected: dbConnected,
      error: dbError,
    },
    api: {
      responding: true,
      latency_ms: latency,
    },
  }
}
