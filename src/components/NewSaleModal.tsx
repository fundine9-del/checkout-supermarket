import { useEffect, useState } from 'react'
import { Minus, Plus, ScanLine, ShoppingCart, Trash2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { formatMoney } from '../lib/api'
import type { OrderWithItems } from '../lib/types'
import { ProductScanModal } from './ProductScanModal'

type PaymentMethod = 'cash' | 'card' | 'mobile'

const methodLabels: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  mobile: 'Mobile Money',
}

interface NewSaleModalProps {
  onClose: () => void
  onComplete: () => void
}

/**
 * Manual sale flow for the supermarket's Sales page. The seller scans a
 * product barcode (or types it), edits the quantity line by line, picks a
 * payment method, then checks the whole cart out — the same server-side
 * order pipeline the customer webapp uses (create order → scan items →
 * checkout), so stock is decremented and the wallet is credited automatically.
 */
export function NewSaleModal({ onClose, onComplete }: NewSaleModalProps) {
  const { api } = useAuth()
  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Start an open order for this supermarket on mount.
  useEffect(() => {
    let active = true
    async function start() {
      if (!api) return
      try {
        const { my_store } = await api.myItems()
        const { order: started } = await api.createOrder(my_store.id)
        // POST /orders returns the order without line items (normOrder only);
        // re-fetch via GET /orders/:id so `items` is populated (attachItems).
        const { order: fresh } = await api.fetchOrder(started.id)
        if (active) setOrder(fresh)
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not start the sale')
        }
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void start()
    return () => {
      active = false
    }
  }, [api])

  async function addBarcode(barcode: string) {
    const raw = barcode.trim()
    if (!api || !order || raw === '') return
    setError(null)
    try {
      const { order: updated } = await api.addItem(order.id, raw)
      setOrder(updated)
      setManualBarcode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the item')
    }
  }

  async function setQuantity(itemId: string, quantity: number) {
    if (!api || !order) return
    setError(null)
    try {
      const { order: updated } = await api.updateItemQuantity(order.id, itemId, quantity)
      setOrder(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the quantity')
    }
  }

  async function removeLine(itemId: string) {
    if (!api || !order) return
    setError(null)
    try {
      const { order: updated } = await api.removeItem(order.id, itemId)
      setOrder(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the item')
    }
  }

  async function checkout() {
    if (!api || !order) return
    setBusy(true)
    setError(null)
    try {
      await api.checkout(order.id, method)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setBusy(false)
    }
  }

  const lineCount = order?.items?.reduce((sum, line) => sum + line.quantity, 0) ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-full w-full max-w-md flex-col rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">New sale</h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            aria-label="Close new sale"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scan / type a barcode to add an item. */}
        <div className="mt-4 flex gap-2">
          <input
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void addBarcode(manualBarcode)
              }
            }}
            placeholder="Scan or type a barcode…"
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
          />
          <button
            onClick={() => setScanOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            <ScanLine className="h-4 w-4" />
            Scan
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {/* Cart lines. */}
        <div className="mt-4 flex-1 overflow-y-auto">
          {(!order || order.items.length === 0) && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 py-8 text-center">
              <ShoppingCart className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">
                No items yet — scan a product to add it to the sale.
              </p>
            </div>
          )}

          {order && order.items.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {order.items.map((line) => (
                <li key={line.id} className="flex items-center gap-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{line.name}</p>
                    <p className="text-xs text-slate-400">
                      {formatMoney(line.price)} each
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => void setQuantity(line.id, line.quantity - 1)}
                      disabled={busy}
                      className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                      aria-label={`Decrease quantity of ${line.name}`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center font-mono text-slate-700">
                      {line.quantity}
                    </span>
                    <button
                      onClick={() => void setQuantity(line.id, line.quantity + 1)}
                      disabled={busy}
                      className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                      aria-label={`Increase quantity of ${line.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => void removeLine(line.id)}
                      disabled={busy}
                      className="ml-1 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      aria-label={`Remove ${line.name} from sale`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="w-20 shrink-0 text-right font-medium text-slate-800">
                    {formatMoney(line.price * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Payment method. */}
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700">Payment method</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(['cash', 'card', 'mobile'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                disabled={busy}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-40 ${
                  method === m
                    ? 'border-teal-500 bg-teal-50 text-teal-700 ring-2 ring-teal-500/30'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {methodLabels[m]}
              </button>
            ))}
          </div>
        </div>

        {/* Totals + checkout. */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <div>
            <p className="text-xs text-slate-400">
              {lineCount} item{lineCount === 1 ? '' : 's'}
            </p>
            <p className="text-lg font-semibold text-slate-900">
              {formatMoney(order?.total ?? 0)}
            </p>
          </div>
          <button
            onClick={() => void checkout()}
            disabled={busy || !order || order.items.length === 0}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? 'Completing…' : 'Complete sale'}
          </button>
        </div>
      </div>

      {scanOpen && (
        <ProductScanModal
          onBarcode={(raw) => {
            void addBarcode(raw)
            setScanOpen(false)
          }}
          onClose={() => setScanOpen(false)}
        />
      )}
    </div>
  )
}