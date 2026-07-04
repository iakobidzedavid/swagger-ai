import { COMPETITOR_BENCHMARKS, SWAGGER_AI_TYPICAL, formatSpeedLabel } from '@/lib/competitive-position'

interface CompetitivePositionChartProps {
  /** Real, persisted generation time for this exact storefront (seconds). */
  yourSpeedSeconds: number
  /** Real, persisted brand-fidelity score for this exact storefront (0-100). */
  yourBrandFidelityPct: number
}

const CHART_W = 640
const CHART_H = 340
const PAD_L = 44
const PAD_R = 24
const PAD_T = 20
const PAD_B = 40
const PLOT_W = CHART_W - PAD_L - PAD_R
const PLOT_H = CHART_H - PAD_T - PAD_B

// Log scale on the speed axis: 0.01 hr (fast) .. 700 hr (~1 month), fast side on the right
// so the winning quadrant (fast + accurate) reads as upper-right, matching the DE Step 11 chart.
const MIN_H = 0.01
const MAX_H = 700
function xForHours(hours: number): number {
  const clamped = Math.min(MAX_H, Math.max(MIN_H, hours))
  const t = (Math.log10(clamped) - Math.log10(MIN_H)) / (Math.log10(MAX_H) - Math.log10(MIN_H))
  return PAD_L + (1 - t) * PLOT_W
}
function yForAccuracy(pct: number): number {
  const clamped = Math.min(100, Math.max(0, pct))
  return PAD_T + (1 - clamped / 100) * PLOT_H
}

/**
 * DE Step 11 (Chart Your Competitive Position), made real: plots this buyer's
 * OWN just-generated store — real elapsed generation time + real brand-fidelity
 * score, both computed server-side and persisted to storefront_requests — next
 * to the researched competitor categories, on Maya's own top-2 ranked criteria.
 */
export function CompetitivePositionChart({ yourSpeedSeconds, yourBrandFidelityPct }: CompetitivePositionChartProps) {
  const yourSpeedHours = yourSpeedSeconds / 3600
  const yourX = xForHours(yourSpeedHours)
  const yourY = yForAccuracy(yourBrandFidelityPct)
  const dividerX = xForHours(24) // 1-day threshold
  const dividerY = yForAccuracy(85)

  const fastestCompetitorLabel = COMPETITOR_BENCHMARKS
    .filter(c => c.speedHours > 0)
    .sort((a, b) => a.speedHours - b.speedHours)[0]

  return (
    <div className="card" style={{ marginBottom: '32px' }}>
      <div style={{ marginBottom: '8px' }}>
        <h3 className="text-h3" style={{ marginBottom: '4px' }}>Your Competitive Position</h3>
        <p className="text-small text-muted">
          Brand accuracy vs. speed-to-launch — the two things Maya-style buyers rank #1 and #2. Your point below is real: computed
          from this exact generation, not a demo number.
        </p>
      </div>

      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Competitive position chart: brand accuracy vs speed to launch">
        {/* Winning quadrant tint (upper-right: fast + high fidelity) */}
        <rect
          x={dividerX < PAD_L + PLOT_W ? dividerX : PAD_L}
          y={PAD_T}
          width={Math.max(0, PAD_L + PLOT_W - dividerX)}
          height={Math.max(0, dividerY - PAD_T)}
          fill="var(--color-accent-light)"
        />

        {/* Axes */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="var(--color-border)" strokeWidth={1} />

        {/* Quadrant dividers */}
        <line x1={dividerX} y1={PAD_T} x2={dividerX} y2={PAD_T + PLOT_H} stroke="var(--color-border)" strokeWidth={1} strokeDasharray="4 4" />
        <line x1={PAD_L} y1={dividerY} x2={PAD_L + PLOT_W} y2={dividerY} stroke="var(--color-border)" strokeWidth={1} strokeDasharray="4 4" />

        <text x={PAD_L + PLOT_W - 6} y={PAD_T + 14} textAnchor="end" fontSize="10" fill="var(--color-accent-tint)" fontWeight={700}>
          WINNING ZONE
        </text>

        {/* Axis labels */}
        <text x={PAD_L + PLOT_W / 2} y={CHART_H - 6} textAnchor="middle" fontSize="11" fill="var(--color-text-muted)">
          Speed to launch (log scale, right = faster) →
        </text>
        <text
          x={-(PAD_T + PLOT_H / 2)}
          y={14}
          textAnchor="middle"
          fontSize="11"
          fill="var(--color-text-muted)"
          transform="rotate(-90)"
        >
          Brand accuracy →
        </text>

        {/* Competitor reference points */}
        {COMPETITOR_BENCHMARKS.map(c => {
          const cx = xForHours(Math.max(c.speedHours, MIN_H))
          const cy = yForAccuracy(c.brandAccuracyPct)
          return (
            <g key={c.name}>
              <circle cx={cx} cy={cy} r={5} fill="var(--color-neutral)" opacity={0.85} />
              <text x={cx} y={cy - 10} textAnchor="middle" fontSize="9" fill="var(--color-text-muted)">
                {c.name}
              </text>
            </g>
          )
        })}

        {/* Swagger AI typical (research-based reference, dashed) */}
        <circle
          cx={xForHours(SWAGGER_AI_TYPICAL.speedHours)}
          cy={yForAccuracy(SWAGGER_AI_TYPICAL.brandAccuracyPct)}
          r={5}
          fill="none"
          stroke="var(--color-accent-tint)"
          strokeWidth={1.5}
          strokeDasharray="2 2"
        />
        <text
          x={xForHours(SWAGGER_AI_TYPICAL.speedHours)}
          y={yForAccuracy(SWAGGER_AI_TYPICAL.brandAccuracyPct) - 10}
          textAnchor="middle"
          fontSize="9"
          fill="var(--color-accent-tint)"
        >
          Swagger AI (typical)
        </text>

        {/* Your real, persisted result — the headline point */}
        <circle cx={yourX} cy={yourY} r={10} fill="var(--color-accent)" opacity={0.25} />
        <circle cx={yourX} cy={yourY} r={6} fill="var(--color-accent)" stroke="#fff" strokeWidth={1.5} />
        <text x={yourX} y={yourY - 14} textAnchor="middle" fontSize="11" fontWeight={700} fill="var(--color-text)">
          You: {formatSpeedLabel(yourSpeedSeconds)} · {Math.round(yourBrandFidelityPct)}%
        </text>
      </svg>

      <p className="text-small text-muted" style={{ marginTop: '8px' }}>
        You just launched in <strong style={{ color: 'var(--color-text)' }}>{formatSpeedLabel(yourSpeedSeconds)}</strong> at{' '}
        <strong style={{ color: 'var(--color-text)' }}>{Math.round(yourBrandFidelityPct)}% brand accuracy</strong> — {fastestCompetitorLabel?.name.toLowerCase()}{' '}
        typically take {fastestCompetitorLabel?.speedLabel} at ~{fastestCompetitorLabel?.brandAccuracyPct}% (based on Swagger AI's
        competitive research).
      </p>
    </div>
  )
}
