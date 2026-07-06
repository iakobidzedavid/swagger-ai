import { execSync } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'

interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime_ms: number
  codebase: {
    tests: {
      count: number
      files: string[]
    }
    git: {
      commit_hash: string
      commit_message: string
      branch: string
      author: string
      timestamp: string
    }
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
  const status_details: string[] = []

  // Gather Git info
  const gitInfo = {
    commit_hash: 'unknown',
    commit_message: 'unknown',
    branch: 'unknown',
    author: 'unknown',
    timestamp: 'unknown',
  }
  try {
    gitInfo.commit_hash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
    gitInfo.commit_message = execSync('git log -1 --pretty=%B', { encoding: 'utf-8' }).trim()
    gitInfo.branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim()
    gitInfo.author = execSync('git log -1 --pretty=%an', { encoding: 'utf-8' }).trim()
    gitInfo.timestamp = execSync('git log -1 --pretty=%ai', { encoding: 'utf-8' }).trim()
  } catch {
    status_details.push('Git info unavailable')
  }

  // Count test files
  let testFiles: string[] = []
  try {
    const testsDir = path.join(process.cwd(), 'tests')
    const files = await fs.readdir(testsDir)
    testFiles = files.filter(f => f.endsWith('.test.mjs') || f.endsWith('.test.ts'))
  } catch {
    status_details.push('Could not read tests directory')
  }

  // Check TypeScript compilation
  let tsCompiled = false
  let tsError: string | undefined
  try {
    const tsBuildInfo = path.join(process.cwd(), 'tsconfig.tsbuildinfo')
    await fs.access(tsBuildInfo)
    tsCompiled = true
  } catch {
    tsError = 'tsconfig.tsbuildinfo not found'
    status_details.push('TypeScript build info not available')
  }

  // Check ESLint status
  let eslintChecked = false
  let eslintError: string | undefined
  try {
    // Try to read eslint config
    const eslintConfig = path.join(process.cwd(), 'eslint.config.js')
    await fs.access(eslintConfig)
    eslintChecked = true
  } catch {
    eslintError = 'ESLint config not found'
    status_details.push('ESLint config not available')
  }

  // Check database connectivity
  let dbConnected = false
  let dbError: string | undefined
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      dbError = 'Supabase credentials not configured'
      status_details.push('Supabase not configured')
    } else {
      // Try to make a simple request to Supabase
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok || response.status === 404) {
        // 404 is OK — means the API endpoint exists but no resource at root
        dbConnected = true
      } else {
        dbError = `Supabase returned ${response.status}`
        status_details.push(`Supabase connectivity issue: ${response.status}`)
      }
    }
  } catch (err) {
    dbError = (err as Error).message
    status_details.push(`Database error: ${(err as Error).message}`)
  }

  const endTime = Date.now()
  const latency = endTime - startTime

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  if (!dbConnected) {
    overallStatus = 'degraded'
  }
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
