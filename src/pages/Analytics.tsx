import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Banknote,
  CalendarDays,
  Clock3,
  History,
  Package,
  ReceiptText,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { formatMoney, formatTime } from '../lib/api'
import type { Sale, Stats, Transaction } from '../lib/types'

const methodLabels: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  mobile: 'Mobile Money',
}

const methodColors: Record<string, string> = {
  cash: '#10b981',
  card: '#0ea5e9',
  mobile: '#8b5cf6',
}

const METHOD_ORDER = ['cash', 'card', 'mobile'] as const

const RANGES = [
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'All', days: null },
] as const

const txMeta: Record<string, { label: string; sign: '+' | '-' }> = {
  payment: { label: 'Payment', sign: '+' },
  deposit: { label: 'Deposit', sign: '+' },
  refund: { label: 'Refund', sign: '-' },
  withdrawal: { label: 'Withdrawal', sign: '-' },
}

interface TrendPoint {
  label: string
  value: number
}

interface Segment {
  label: string
  color: string
  value: number
}

/** Rounds a positive number up to a clean axis maximum (1/2/3/5 × 10^n). */
function niceMax(value: number): number {
  if (value <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(value))
  const n = value / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 3 ? 3 : n <= 5 ? 5 : 10
  return step * pow
}

/** Compact money for chart axes: 15200 -> "15.2K", 2100000 -> "2.1M". */
function compactMoney(value: number): string {
  if (value >= 1_000_000) {
    const v = value / 1_000_000
    return `${Number.isInteger(v) ? v : v.toFixed(1)}M`
  }
  if (value >= 1_000) {
    const v = value / 1_000
    return `${Number.isInteger(v) ? v : v.toFixed(1)}K`
  }
  return String(Math.round(value))
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}

/** SVG area chart of revenue over time (hand-rolled, no chart library). */
function AreaChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-400">
        No sales in this period yet.
      </div>
    )
  }

  const W = 680
  const H = 240
  const L = 56
  const R = 16
  const T = 14
  const B = 28
  const innerW = W - L - R
  const innerH = H - T - B
  const max = niceMax(Math.max(...points.map((p) => p.value), 0))

  const x = (i: number) =>
    points.length === 1 ? L + innerW / 2 : L + (i / (points.length - 1)) * innerW
  const y = (v: number) => T + innerH * (1 - v / max)

  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')
  const area = `${L},${T + innerH} ${line} ${x(points.length - 1)},${T + innerH}`

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)

  const labelStep = Math.max(1, Math.ceil(points.length / 6))
  const labelIdx: number[] = []
  for (let i = 0; i < points.length; i += labelStep) labelIdx.push(i)
  if (labelIdx[labelIdx.length - 1] !== points.length - 1) labelIdx.push(points.length - 1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Revenue over time">
      <defs>
        <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-400 text-[11px]">
            {compactMoney(t)}
          </text>
        </g>
      ))}

      <polygon points={area} fill="url(#revArea)" />
      <polyline
        points={line}
        fill="none"
        stroke="#0d9488"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {points.length <= 31 &&
        points.map((p, i) => (
          <circle key={`${p.label}-${i}`} cx={x(i)} cy={y(p.value)} r={3} fill="#0d9488" />
        ))}

      {labelIdx.map((i) => (
        <text
          key={`${points[i].label}-${i}`}
          x={x(i)}
          y={H - 8}
          textAnchor="middle"
          className="fill-slate-400 text-[11px]"
        >
          {points[i].label}
        </text>
      ))}
    </svg>
  )
}

/** SVG donut of revenue split by payment method. */
function DonutChart({ segments, total }: { segments: Segment[]; total: number }) {
  if (segments.length === 0 || total <= 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-400">
        No paid sales yet.
      </div>
    )
  }

  const R = 54
  const STROKE = 32
  const CIR = 2 * Math.PI * R

  let running = 0
  const arcs = segments.map((s) => {
    const arc = { ...s, offset: running }
    running += s.value / total
    return arc
  })

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0" role="img" aria-label="Payment methods">
        <g transform="rotate(-90 80 80)">
          <circle cx="80" cy="80" r={R} fill="none" stroke="#e2e8f0" strokeWidth={STROKE} />
          {arcs.map((s) => (
            <circle
              key={s.label}
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={STROKE}
              strokeDasharray={`${(s.value / total) * CIR} ${CIR}`}
              strokeDashoffset={-s.offset * CIR}
            />
          ))}
        </g>
        <text x="80" y="82" textAnchor="middle" className="fill-slate-900 text-lg font-semibold">
          {compactMoney(total)}
        </text>
        <text x="80" y="100" textAnchor="middle" className="fill-slate-400 text-[11px]">
          revenue
        </text>
      </svg>

      <ul className="w-full space-y-2.5">
        {arcs.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="flex-1 text-slate-600">{s.label}</span>
            <span className="font-medium text-slate-800">{formatMoney(s.value)}</span>
            <span className="w-11 text-right text-xs text-slate-400">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** SVG column chart of revenue per hour of day (24 buckets). */
function HourChart({ values }: { values: number[] }) {
  const W = 680
  const H = 190
  const L = 56
  const R = 16
  const T = 14
  const B = 28
  const innerW = W - L - R
  const innerH = H - T - B
  const max = niceMax(Math.max(...values, 0))
  const bw = innerW / values.length
  const y = (v: number) => T + innerH * (1 - v / max)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const hourLabels = values.map((_, i) => i).filter((h) => h % 6 === 0 || h === 23)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Sales by hour">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-400 text-[11px]">
            {compactMoney(t)}
          </text>
        </g>
      ))}

      {values.map((v, i) => (
        <rect
          key={i}
          x={L + i * bw + bw * 0.22}
          y={y(v)}
          width={bw * 0.56}
          height={v > 0 ? T + innerH - y(v) : 0}
          rx={3}
          fill={v > 0 ? '#0d9488' : 'none'}
        />
      ))}

      {hourLabels.map((h) => (
        <text
          key={h}
          x={L + h * bw + bw / 2}
          y={H - 8}
          textAnchor="middle"
          className="fill-slate-400 text-[11px]"
        >
          {h === 23 ? '23h' : `${h}h`}
        </text>
      ))}
    </svg>
  )
}

export function AnalyticsPage() {
  const { api } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [days, setDays] = useState<number | null>(14)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!api) return
    setError(null)
    try {
      const [{ stats }, { sales }, { transactions }] = await Promise.all([
        api.stats(),
        api.sales(),
        api.transactions(),
      ])
      setStats(stats)
      setSales(sales)
      setTransactions(transactions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    // fetch-on-mount (setState happens post-await).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const unitsSold = useMemo(
    () => sales.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.quantity, 0), 0),
    [sales],
  )

  const trend = useMemo(() => {
    const byDate = new Map<string, number>()
    for (const sale of sales) {
      const d = new Date(sale.created_at)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      byDate.set(key, (byDate.get(key) ?? 0) + sale.total)
    }

    const out: TrendPoint[] = []
    if (days === null) {
      const keys = [...byDate.keys()].sort((a, b) => a.localeCompare(b))
      for (const key of keys) {
        const [year, month, date] = key.split('-').map(Number)
        out.push({
          label: shortDate(new Date(year, month, date)),
          value: byDate.get(key) ?? 0,
        })
      }
    } else {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        out.push({ label: shortDate(d), value: byDate.get(key) ?? 0 })
      }
    }
    return out
  }, [sales, days])

  const hourly = useMemo(() => {
    const buckets = new Array<number>(24).fill(0)
    for (const sale of sales) {
      const h = new Date(sale.created_at).getHours()
      buckets[h] += sale.total
    }
    return buckets
  }, [sales])

  const topProducts = useMemo(() => {
    const byName = new Map<string, { quantity: number; revenue: number }>()
    for (const sale of sales) {
      for (const line of sale.items) {
        const entry = byName.get(line.name) ?? { quantity: 0, revenue: 0 }
        entry.quantity += line.quantity
        entry.revenue += line.price * line.quantity
        byName.set(line.name, entry)
      }
    }
    return [...byName.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
  }, [sales])

  const paymentTotal = useMemo(() => sales.reduce((sum, s) => sum + s.total, 0), [sales])

  const paymentSegments = useMemo<Segment[]>(() => {
    const byMethod = new Map<string, number>()
    for (const sale of sales) {
      const m = sale.payment_method ?? 'unknown'
      byMethod.set(m, (byMethod.get(m) ?? 0) + sale.total)
    }
    return METHOD_ORDER.map((m) => ({
      label: methodLabels[m] ?? m,
      color: methodColors[m] ?? '#94a3b8',
      value: byMethod.get(m) ?? 0,
    })).filter((s) => s.value > 0)
  }, [sales])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-red-700 ring-1 ring-red-200">
        <p>{error}</p>
        <button onClick={() => void load()} className="mt-3 text-sm font-medium underline">
          Retry
        </button>
      </div>
    )
  }

  if (!stats) return null

  const cards = [
    {
      label: 'Total revenue',
      value: formatMoney(stats.revenue),
      sub: `${stats.orders_count} paid orders`,
      icon: Banknote,
    },
    {
      label: "Today's revenue",
      value: formatMoney(stats.today_revenue),
      sub: `${stats.today_orders_count} orders today`,
      icon: CalendarDays,
    },
    {
      label: 'Average order',
      value: formatMoney(stats.avg_order_value),
      sub: 'per paid order',
      icon: TrendingUp,
    },
    {
      label: 'Units sold',
      value: String(unitsSold),
      sub: 'across all orders',
      icon: Package,
    },
    {
      label: 'Paid orders',
      value: String(stats.orders_count),
      sub: 'all time',
      icon: ReceiptText,
    },
    {
      label: 'Wallet balance',
      value: stats.wallet ? formatMoney(stats.wallet.balance) : '—',
      sub: stats.wallet ? stats.wallet.currency : 'not available',
      icon: Wallet,
    },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your point-of-sale performance, computed live from paid orders.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Refresh
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <Icon className="h-5 w-5 text-teal-600" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <TrendingUp className="h-4.5 w-4.5 text-teal-600" />
              Revenue over time
            </h2>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {RANGES.map((r) => (
                <button
                  key={r.label}
                  onClick={() => setDays(r.days)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    days === r.days ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <AreaChart points={trend} />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <ReceiptText className="h-4.5 w-4.5 text-teal-600" />
            Payment methods
          </h2>
          <div className="mt-4">
            <DonutChart segments={paymentSegments} total={paymentTotal} />
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Package className="h-4.5 w-4.5 text-teal-600" />
            Top products
          </h2>
          {topProducts.length === 0 ? (
            <p className="mt-6 text-sm text-slate-400">
              No sales yet — complete a checkout and it shows up here.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {topProducts.map((p, i) => (
                <li key={p.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[11px] font-semibold text-teal-700">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium text-slate-800">{p.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {p.quantity} sold · <span className="font-medium text-slate-700">{formatMoney(p.revenue)}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-teal-600"
                      style={{
                        width: `${topProducts[0].revenue > 0 ? (p.revenue / topProducts[0].revenue) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Clock3 className="h-4.5 w-4.5 text-teal-600" />
            Sales by hour of day
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Revenue across the 24-hour clock — spot your busiest times.
          </p>
          <div className="mt-4">
            <HourChart values={hourly} />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <History className="h-4.5 w-4.5 text-teal-600" />
          Recent transactions
        </h2>
        {transactions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            Nothing here yet — every paid checkout is recorded in the wallet ledger automatically.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {transactions.slice(0, 8).map((tx) => {
              const meta = txMeta[tx.type] ?? { label: tx.type, sign: '+' }
              const signed =
                meta.sign === '+' ? `+${formatMoney(tx.amount)}` : `-${formatMoney(tx.amount)}`
              return (
                <li key={tx.id} className="flex items-center gap-3 py-3">
                  <span
                    className={
                      meta.sign === '+'
                        ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700'
                        : 'rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600'
                    }
                  >
                    {meta.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {tx.description ?? tx.type}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatTime(tx.created_at)} · balance {formatMoney(tx.balance_after)}
                    </p>
                  </div>
                  <p
                    className={
                      meta.sign === '+'
                        ? 'text-sm font-semibold text-emerald-600'
                        : 'text-sm font-semibold text-red-600'
                    }
                  >
                    {signed}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}