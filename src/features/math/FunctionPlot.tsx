import { useMemo } from 'react'
import { compileFunction } from '@/lib/mathcheck'

const COLORS = ['var(--accent-solid)', 'var(--s1)', 'var(--s2)']

function niceStep(range: number) {
  const raw = range / 10
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / p
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p
}

/** Draws up to three functions on a coordinate grid (one consistent scale for marks and labels). */
export function FunctionPlot({ functions, xMin, xMax, yMin, yMax }: { functions: string[]; xMin: number; xMax: number; yMin: number; yMax: number }) {
  const W = 560
  const H = 380
  const pad = 28
  const sx = (x: number) => pad + ((x - xMin) / (xMax - xMin)) * (W - 2 * pad)
  const sy = (y: number) => H - pad - ((y - yMin) / (yMax - yMin)) * (H - 2 * pad)
  const compiled = useMemo(() => functions.map((f) => (f.trim() ? compileFunction(f) : null)), [functions])
  const paths = compiled.map((fn) => {
    if (!fn) return null
    const N = 400
    let d = ''
    let pen = false
    for (let i = 0; i <= N; i++) {
      const x = xMin + ((xMax - xMin) * i) / N
      const y = fn(x)
      if (y === null || y < yMin - (yMax - yMin) * 2 || y > yMax + (yMax - yMin) * 2) {
        pen = false
        continue
      }
      d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`
      pen = true
    }
    return d
  })
  const xs = niceStep(xMax - xMin)
  const ys = niceStep(yMax - yMin)
  const xTicks: number[] = []
  for (let x = Math.ceil(xMin / xs) * xs; x <= xMax + 1e-9; x += xs) xTicks.push(Math.round(x * 1e6) / 1e6)
  const yTicks: number[] = []
  for (let y = Math.ceil(yMin / ys) * ys; y <= yMax + 1e-9; y += ys) yTicks.push(Math.round(y * 1e6) / 1e6)
  const x0 = Math.min(Math.max(0, xMin), xMax)
  const y0 = Math.min(Math.max(0, yMin), yMax)
  const fmt = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 2 })

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full min-w-[320px]" role="img" aria-label={`Graph von ${functions.filter(Boolean).join(', ')}`}>
        <rect x={0} y={0} width={W} height={H} fill="var(--surface)" />
        <defs>
          <clipPath id="plot-area"><rect x={pad} y={pad} width={W - 2 * pad} height={H - 2 * pad} /></clipPath>
        </defs>
        {xTicks.map((x) => <line key={`gx${x}`} x1={sx(x)} x2={sx(x)} y1={pad} y2={H - pad} stroke="var(--border)" strokeWidth={1} />)}
        {yTicks.map((y) => <line key={`gy${y}`} x1={pad} x2={W - pad} y1={sy(y)} y2={sy(y)} stroke="var(--border)" strokeWidth={1} />)}
        <line x1={pad} x2={W - pad} y1={sy(y0)} y2={sy(y0)} stroke="var(--fg-subtle)" strokeWidth={1.2} />
        <line x1={sx(x0)} x2={sx(x0)} y1={pad} y2={H - pad} stroke="var(--fg-subtle)" strokeWidth={1.2} />
        {xTicks.filter((x) => x !== 0).map((x) => <text key={`tx${x}`} x={sx(x)} y={Math.min(H - 8, sy(y0) + 14)} fontSize={10} textAnchor="middle" fill="var(--fg-muted)">{fmt(x)}</text>)}
        {yTicks.filter((y) => y !== 0).map((y) => <text key={`ty${y}`} x={Math.max(pad - 4, sx(x0) - 5)} y={sy(y) + 3} fontSize={10} textAnchor="end" fill="var(--fg-muted)">{fmt(y)}</text>)}
        <text x={W - pad + 4} y={sy(y0) + 4} fontSize={11} fill="var(--fg-muted)">x</text>
        <text x={sx(x0) + 5} y={pad - 8} fontSize={11} fill="var(--fg-muted)">y</text>
        <g clipPath="url(#plot-area)">
          {paths.map((d, i) => d && <path key={i} d={d} fill="none" stroke={COLORS[i]} strokeWidth={2.4} strokeLinejoin="round" />)}
        </g>
      </svg>
    </div>
  )
}

export const PLOT_COLORS = COLORS
