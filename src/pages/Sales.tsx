import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, ReceiptText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { formatMoney, formatTime, shortId } from '../lib/api'
import type { Sale } from '../lib/types'

const methodLabels: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  mobile: 'Mobile Money',
}

export function SalesPage() {
  const { api } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!api) return
    setError(null)
    try {
      const { sales } = await api.sales()
      setSales(sales)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    // fetch-on-mount: load once when the page opens (setState happens post-await).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Sales</h1>
      <p className="mt-1 text-sm text-slate-500">
        {sales.length > 0
          ? `${sales.length} completed order${sales.length === 1 ? '' : 's'} — newest first.`
          : 'No paid orders yet.'}
      </p>

      {sales.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <ReceiptText className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            Paid orders will appear here once customers check out.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {sales.map((sale) => {
            const isOpen = expanded.has(sale.id)
            const itemCount = sale.items.reduce((sum, i) => sum + i.quantity, 0)
            return (
              <div
                key={sale.id}
                className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
              >
                <button
                  onClick={() => toggle(sale.id)}
                  className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">
                      #{shortId(sale.id)} · {sale.customer_name ?? 'Walk-in customer'}
                    </p>
                    <p className="text-xs text-slate-400">{formatTime(sale.created_at)}</p>
                  </div>
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                    {methodLabels[sale.payment_method ?? ''] ?? sale.payment_method}
                  </span>
                  <span className="text-xs text-slate-400">{itemCount} items</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatMoney(sale.total)}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-5 py-3">
                    <ul className="divide-y divide-slate-100">
                      {sale.items.map((line) => (
                        <li key={line.id} className="flex items-center gap-3 py-2 text-sm">
                          <span className="min-w-0 flex-1 truncate text-slate-700">
                            {line.name}
                          </span>
                          <span className="text-slate-400">
                            {line.quantity} × {formatMoney(line.price)}
                          </span>
                          <span className="w-20 text-right font-medium text-slate-800">
                            {formatMoney(line.price * line.quantity)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}