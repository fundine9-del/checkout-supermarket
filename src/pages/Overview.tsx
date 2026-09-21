import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, CalendarDays, ReceiptText, TrendingUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { formatMoney, formatTime, shortId } from '../lib/api'
import type { Sale, Stats } from '../lib/types'

export function OverviewPage() {
  const { api } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recent, setRecent] = useState<Sale[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!api) return
    setError(null)
    try {
      const [{ stats }, { sales }] = await Promise.all([api.stats(), api.sales()])
      setStats(stats)
      setRecent(sales.slice(0, 5))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    // fetch-on-mount: load once when the page opens (setState happens post-await).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

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
      label: 'Total earnings',
      value: formatMoney(stats.revenue),
      icon: Banknote,
      sub: `${stats.orders_count} paid orders`,
    },
    {
      label: "Today's earnings",
      value: formatMoney(stats.today_revenue),
      icon: CalendarDays,
      sub: `${stats.today_orders_count} orders today`,
    },
    {
      label: 'Average order',
      value: formatMoney(stats.avg_order_value),
      icon: TrendingUp,
      sub: 'per paid order',
    },
    {
      label: 'Paid orders',
      value: String(stats.orders_count),
      icon: ReceiptText,
      sub: 'all time',
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
      <p className="mt-1 text-sm text-slate-500">Your supermarket at a glance.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, sub }) => (
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

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Top products</h2>
            <Link to="/sales" className="text-sm font-medium text-teal-600 hover:underline">
              View all sales
            </Link>
          </div>
          {stats.top_products.length === 0 ? (
            <p className="mt-6 text-sm text-slate-400">
              No sales yet — complete a checkout and it shows up here.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {stats.top_products.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.quantity} sold</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{formatMoney(p.revenue)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent sales</h2>
            <Link to="/sales" className="text-sm font-medium text-teal-600 hover:underline">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="mt-6 text-sm text-slate-400">
              No sales yet — complete a checkout and it shows up here.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {recent.map((sale) => (
                <li key={sale.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      #{shortId(sale.id)} · {sale.customer_name ?? 'Walk-in customer'}
                    </p>
                    <p className="text-xs text-slate-400">{formatTime(sale.created_at)}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{formatMoney(sale.total)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}