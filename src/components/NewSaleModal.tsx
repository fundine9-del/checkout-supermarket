import { useEffect, useState } from 'react'
import {
  CircleCheck,
  Minus,
  Plus,
  Printer,
  ScanLine,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { formatMoney, formatTime, shortId } from '../lib/api'
import { getConnectedPrinter } from '../lib/printers'
import type { OrderWithItems, Receipt } from '../lib/types'
import { ProductScanModal } from './ProductScanModal'

type PaymentMethod = 'cash' | 'card' | 'mobile'

const methodLabels: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  mobile: 'Mobile Money',
}

// ------------------------------------------------------------------ fiscal
// KRA-style monospace receipt layout (mirrors printer-agent/agent.mjs).
const RECEIPT_W = 46

function padReceipt(text: string | null | undefined, width: number): string {
  const t = String(text ?? '')
  return t.length >= width ? t.slice(0, width) : t.padEnd(width, ' ')
}

function padReceiptStart(text: string | null | undefined, width: number): string {
  return String(text ?? '').padStart(width, ' ')
}

function centerReceipt(text: string, width: number): string {
  const left = Math.max(0, Math.floor((width - text.length) / 2))
  return ' '.repeat(left) + text.slice(0, width - left)
}

function moneyPlain(value: number): string {
  return value.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function receiptStamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`
}

function receiptLines(receipt: Receipt): string[] {
  const W = RECEIPT_W
  const DASH = '-'.repeat(W)
  const EQ = '='.repeat(W)
  const lines: string[] = []

  lines.push(EQ)
  lines.push(centerReceipt((receipt.store_name ?? 'Check Out').toUpperCase(), W))
  if (receipt.vat_number) lines.push(centerReceipt(`VAT #: ${receipt.vat_number}`, W))
  if (receipt.pin) lines.push(centerReceipt(`PIN: ${receipt.pin}`, W))
  lines.push('')
  const saleLine = `Sale # ${shortId(receipt.order_id)}`
  lines.push(
    (receipt.till_number ? `${saleLine}  Till No: ${receipt.till_number}` : saleLine).trimEnd(),
  )
  lines.push(`DateTime:${receiptStamp(receipt.paid_at)}`)
  lines.push(EQ)

  lines.push(`ITEM${' '.repeat(12)}QTY${' '.repeat(8)}PRICE${' '.repeat(8)}AMOUNT`)
  lines.push(DASH)
  for (const line of receipt.items) {
    const barcode = line.barcode ? String(line.barcode) : ''
    lines.push(
      padReceipt(barcode || ' ', 26) +
        padReceiptStart(`${line.quantity} x ${moneyPlain(line.unit_price)}`, 20),
    )
    lines.push(
      padReceipt(line.name, 26) +
        padReceiptStart(moneyPlain(line.line_total), 13) +
        padReceiptStart(` ${line.tax_code ?? 'A'}`, 7),
    )
  }
  lines.push(DASH)

  lines.push(padReceipt('TOTAL', 26) + padReceiptStart(moneyPlain(receipt.total), 20))
  if (receipt.tendered != null) {
    lines.push(padReceipt('CASH', 26) + padReceiptStart(moneyPlain(receipt.tendered), 20))
    lines.push(padReceipt('CHANGE', 26) + padReceiptStart(moneyPlain(receipt.change ?? 0), 20))
  }
  lines.push(DASH)

  lines.push(`TOTAL ITEMS: ${receipt.item_count ?? receipt.items.length}`)
  if ((receipt.vat_rows ?? []).length > 0) {
    lines.push(
      padReceipt('CODE', 8) +
        padReceiptStart('RATE', 11) +
        padReceiptStart('VATABLE AMT', 14) +
        padReceiptStart('VAT AMT', 13),
    )
    lines.push(DASH)
    for (const row of receipt.vat_rows) {
      lines.push(
        padReceipt(` ${row.code}`, 8) +
          padReceiptStart(`${row.rate.toFixed(2)}%`, 11) +
          padReceiptStart(moneyPlain(row.vatable), 14) +
          padReceiptStart(moneyPlain(row.vat), 13),
      )
    }
    lines.push(DASH)
  }

  const paidBy =
    receipt.payment_method === 'cash'
      ? 'Cash'
      : receipt.payment_method === 'mobile'
        ? 'Mobile Money'
        : receipt.payment_method
  lines.push(
    receipt.tendered != null
      ? `Cash             :  ${moneyPlain(receipt.tendered)}`
      : `PAID BY         :  ${paidBy.toUpperCase()}`,
  )
  lines.push(DASH)
  lines.push(padReceipt(' PRICES INCLUSIVE OF VAT WHERE APPLICABLE', W))
  lines.push('')
  lines.push(centerReceipt('Thank You !', W))
  lines.push(
    padReceipt(`RECEIPT # ${shortId(receipt.order_id)}`, 22) +
      padReceiptStart(receiptStamp(receipt.paid_at), 24),
  )
  lines.push(EQ)
  return lines
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
  const [tendered, setTendered] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  // Whether the receipt was dispatched to the bonded till printer (Printer Agent).
  const [printState, setPrintState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

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
      const cashTendered =
        method === 'cash' && tendered.trim() !== '' ? Number(tendered) : undefined
      const { receipt: paid } = await api.checkout(order.id, method, cashTendered)
      setReceipt(paid)
      setBusy(false)
      void dispatchToPrinter()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setBusy(false)
    }
  }

  /** Queue the receipt for the printer this till is bonded to (if any). */
  async function dispatchToPrinter() {
    if (!api || !order) return
    const printer = getConnectedPrinter()
    if (!printer) return
    setPrintState('sending')
    try {
      await api.enqueuePrintJob(printer.id, order.id)
      setPrintState('sent')
    } catch {
      setPrintState('failed')
    }
  }

  const lineCount = order?.items?.reduce((sum, line) => sum + line.quantity, 0) ?? 0
  const connectedPrinter = getConnectedPrinter()

  // Sale paid — show the printable receipt instead of the cart.
  if (receipt) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 print:bg-white">
        <div className="flex max-h-full w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:overflow-visible print:rounded-none print:p-0 print:shadow-none">
          <div className="text-center print:hidden">
            <CircleCheck className="mx-auto h-14 w-14 text-emerald-500" />
            <h2 className="mt-3 text-xl font-semibold text-slate-900">Sale completed!</h2>
            <p className="mt-1 text-sm text-slate-500">
              Order #{shortId(receipt.order_id)} · {formatTime(receipt.paid_at)}
            </p>
          </div>

          {connectedPrinter && printState !== 'idle' && (
            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm print:hidden ${
                printState === 'failed' ? 'bg-amber-50 text-amber-800' : 'bg-teal-50 text-teal-800'
              }`}
            >
              {printState === 'sending' && (
                <p className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-teal-500" />
                  Sending the receipt to {connectedPrinter.till}&apos;s printer…
                </p>
              )}
              {printState === 'sent' && (
                <p className="flex items-center justify-between gap-3">
                  <span>✓ Receipt sent to {connectedPrinter.till}&apos;s printer.</span>
                  <button
                    onClick={() => void dispatchToPrinter()}
                    className="shrink-0 font-medium underline"
                  >
                    Send again
                  </button>
                </p>
              )}
              {printState === 'failed' && (
                <p className="flex items-center justify-between gap-3">
                  <span>Couldn&apos;t reach the {connectedPrinter.till} printer agent.</span>
                  <button
                    onClick={() => void dispatchToPrinter()}
                    className="shrink-0 font-medium underline"
                  >
                    Try again
                  </button>
                </p>
              )}
            </div>
          )}

          {/* The printable receipt — KRA-style fiscal layout */}
          <div className="print-receipt mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 print:mt-0 print:max-w-none print:rounded-none print:p-4 print:shadow-none print:ring-0">
            <pre className="whitespace-pre font-mono text-[11px] leading-snug text-slate-900">
              {receiptLines(receipt).join('\n')}
            </pre>
            {receipt.qr_data && (
              <div className="mt-3 flex flex-col items-center gap-1 border-t border-dashed border-slate-300 pt-3">
                <img src={receipt.qr_data} alt="Receipt QR code" className="h-24 w-24" />
                <p className="text-[10px] text-slate-400">Scan at the till to reprint this receipt</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-teal-600 px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50"
            >
              <Printer className="h-4 w-4" /> Print receipt
            </button>
            <button
              onClick={onComplete}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

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

          {method === 'cash' && (
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Amount received (KSh)
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                placeholder="Cash tendered — prints CASH / CHANGE on the receipt"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              />
            </label>
          )}
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