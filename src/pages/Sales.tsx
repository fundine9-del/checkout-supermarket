import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, ReceiptText, ScanLine } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { formatMoney, formatTime, shortId } from '../lib/api'
import { qrFormats } from '../lib/barcode'
import { decodeReceiptLink, getConnectedPrinter } from '../lib/printers'
import type { Sale } from '../lib/types'
import { NewSaleModal } from '../components/NewSaleModal'
import { ProductScanModal } from '../components/ProductScanModal'

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
  const [saleOpen, setSaleOpen] = useState(false)
  const [printScanOpen, setPrintScanOpen] = useState(false)
  const [printState, setPrintState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [printMessage, setPrintMessage] = useState<string | null>(null)
  const lastQrRef = useRef<string | null>(null)

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

  /** Reprint a customer's receipt on the bonded till printer from its QR. */
  async function printReceiptFromQr(raw: string) {
    const orderId = decodeReceiptLink(raw)
    if (!orderId) {
      setPrintState('failed')
      setPrintMessage('That QR is not a Check Out receipt — scan the code on the customer\u2019s digital receipt.')
      return
    }
    const printer = getConnectedPrinter()
    if (!printer) {
      setPrintState('failed')
      setPrintMessage('Connect a till printer first — Printers page \u2192 "Use at this till".')
      return
    }
    if (!api) return
    setPrintState('sending')
    setPrintMessage(null)
    try {
      await api.enqueuePrintJob(printer.id, orderId)
      setPrintState('sent')
      setPrintMessage(`Receipt #${shortId(orderId)} sent to ${printer.till}.`)
    } catch (err) {
      setPrintState('failed')
      setPrintMessage(err instanceof Error ? err.message : 'Could not print that receipt.')
    }
  }

  function handleScan(raw: string) {
    lastQrRef.current = raw
    void printReceiptFromQr(raw)
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sales</h1>
          <p className="mt-1 text-sm text-slate-500">
            {sales.length > 0
              ? `${sales.length} completed order${sales.length === 1 ? '' : 's'} — newest first.`
              : 'No paid orders yet.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPrintScanOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100"
          >
            <ScanLine className="h-4 w-4" />
            Print receipt by QR
          </button>
          <button
            onClick={() => setSaleOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            New sale
          </button>
        </div>
      </div>

      {printState !== 'idle' && printMessage && (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            printState === 'failed'
              ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
              : 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>{printMessage}</p>
            {printState === 'failed' && (
              <button
                onClick={() => {
                  const raw = lastQrRef.current
                  if (raw) void printReceiptFromQr(raw)
                }}
                className="shrink-0 font-medium underline"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}

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

      {saleOpen && (
        <NewSaleModal
          onClose={() => setSaleOpen(false)}
          onComplete={() => {
            setSaleOpen(false)
            void load()
          }}
        />
      )}

      {printScanOpen && (
        <ProductScanModal
          title="Scan customer receipt"
          hint="Point the camera at the QR on the customer's digital receipt to print it here."
          formats={qrFormats}
          onBarcode={handleScan}
          onClose={() => setPrintScanOpen(false)}
        />
      )}
    </div>
  )
}