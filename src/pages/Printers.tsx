import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import {
  Cable,
  Copy,
  Info,
  Pencil,
  Plus,
  Printer as PrinterIcon,
  QrCode,
  ScanLine,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { formatTime } from '../lib/api'
import { qrFormats } from '../lib/barcode'
import {
  decodePrinterLink,
  encodePrinterLink,
  getConnectedPrinter,
  setConnectedPrinter,
  type ConnectedPrinter,
} from '../lib/printers'
import type { Printer } from '../lib/types'
import { ProductScanModal } from '../components/ProductScanModal'

/** Overlay showing a printer's QR code (print it, stick it at that till). */
function QrModal({ printer, onClose }: { printer: Printer; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    QRCode.toDataURL(encodePrinterLink(printer.id, printer.token), {
      width: 720,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setQr(url)
      })
      .catch(() => {
        /* QR rendering failed — keep the empty state visible */
      })
    return () => {
      active = false
    }
  }, [printer.id, printer.token])

  async function copyId() {
    try {
      await navigator.clipboard.writeText(printer.id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Printer QR</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close printer QR"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex justify-center">
          {qr ? (
            <img
              src={qr}
              alt={`QR code for printer ${printer.id}`}
              className="h-56 w-56 rounded-xl ring-1 ring-slate-200"
            />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-xl bg-slate-50">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-base font-semibold text-slate-900">{printer.id}</p>
        <p className="text-center text-sm text-slate-500">{printer.till}</p>

        <div className="mt-3 flex items-center justify-center gap-2">
          <code className="max-w-full truncate rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
            {printer.id}
          </code>
          <button
            onClick={() => void copyId()}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Scan this QR with the <span className="font-medium">Connect by QR</span> button on the
          till that uses this printer — it bonds that till to the printer.
        </p>
      </div>
    </div>
  )
}

export function PrintersPage() {
  const { api } = useAuth()
  const [printers, setPrinters] = useState<Printer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState<ConnectedPrinter | null>(() => getConnectedPrinter())
  const [tillInput, setTillInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [qrPrinter, setQrPrinter] = useState<Printer | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editTill, setEditTill] = useState('')

  const load = useCallback(async () => {
    if (!api) return
    setError(null)
    try {
      const { printers } = await api.myPrinters()
      setPrinters(printers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load printers')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    // fetch-on-mount (setState happens post-await).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function addPrinter() {
    const till = tillInput.trim()
    if (!api || till === '') return
    setAdding(true)
    setActionError(null)
    try {
      await api.createPrinter(till)
      setTillInput('')
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not add the printer')
    } finally {
      setAdding(false)
    }
  }

  async function saveRename(printer: Printer) {
    const till = editTill.trim()
    if (!api || till === '') return
    setActionError(null)
    try {
      await api.updatePrinter(printer.id, till)
      if (connected?.id === printer.id) {
        setConnectedPrinter({ id: printer.id, till })
        setConnected({ id: printer.id, till })
      }
      setEditId(null)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not rename the printer')
    }
  }

  async function removePrinter(printer: Printer) {
    if (!api) return
    setActionError(null)
    try {
      await api.deletePrinter(printer.id)
      if (connected?.id === printer.id) {
        setConnectedPrinter(null)
        setConnected(null)
      }
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not remove the printer')
    }
  }

  async function bondPrinter(printer: Printer, device: string) {
    if (!api) return
    setActionError(null)
    try {
      await api.connectPrinter(printer.id, device)
      const next: ConnectedPrinter = { id: printer.id, till: printer.till }
      setConnectedPrinter(next)
      setConnected(next)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not connect to the printer')
    }
  }

  function disconnectPrinter() {
    setConnectedPrinter(null)
    setConnected(null)
  }

  function handleScan(raw: string) {
    const link = decodePrinterLink(raw)
    if (!link) {
      setActionError('That QR is not a Check Out printer QR — register the printer on this page first.')
      return
    }
    const printer = printers.find((p) => p.id === link.printerId && p.token === link.token)
    if (!printer) {
      setActionError('That printer is not registered to your supermarket — check the QR or register it on this page.')
      return
    }
    void bondPrinter(printer, 'Scanned at this till')
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
          <h1 className="text-2xl font-semibold text-slate-900">Printers</h1>
          <p className="mt-1 text-sm text-slate-500">
            One receipt printer per till — the server knows which printer belongs to which till.
          </p>
        </div>
        <button
          onClick={() => setScanOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          <ScanLine className="h-4 w-4" />
          Connect by QR
        </button>
      </div>

      {connected && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 p-5 text-white">
          <div className="flex items-center gap-3">
            <PrinterIcon className="h-6 w-6" />
            <div>
              <p className="text-sm font-medium">This till prints to {connected.till}</p>
              <p className="text-xs text-teal-50">
                {connected.id} — receipts from the new-sale flow are queued to it automatically.
              </p>
            </div>
          </div>
          <button
            onClick={disconnectPrinter}
            className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25"
          >
            Stop using this printer
          </button>
        </div>
      )}

      {actionError && (
        <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
          {actionError}
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Plus className="h-4.5 w-4.5 text-teal-600" />
          Register a printer
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          One printer per till — give it the till name, then print its QR and put it at that till.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            value={tillInput}
            onChange={(e) => setTillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void addPrinter()
              }
            }}
            placeholder="e.g. Till 04"
            maxLength={60}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
          />
          <button
            onClick={() => void addPrinter()}
            disabled={adding || tillInput.trim() === ''}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {adding ? 'Adding…' : 'Add printer'}
          </button>
        </div>
      </div>

      {printers.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <PrinterIcon className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            No printers yet — add your first till printer above.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {printers.map((p) => {
            const inUse = connected?.id === p.id
            return (
              <div key={p.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        inUse ? 'bg-teal-600 text-white' : 'bg-teal-50 text-teal-700'
                      }`}
                    >
                      <PrinterIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-semibold text-slate-900">{p.id}</p>
                      {editId === p.id ? (
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            value={editTill}
                            onChange={(e) => setEditTill(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                void saveRename(p)
                              }
                            }}
                            autoFocus
                            maxLength={60}
                            className="rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
                          />
                          <button
                            onClick={() => void saveRename(p)}
                            className="text-xs font-medium text-teal-700 hover:underline"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="text-xs font-medium text-slate-500 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-slate-700">{p.till}</p>
                      )}
                      <p className="text-xs text-slate-400">Registered {formatTime(p.created_at)}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {inUse ? (
                      <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                        In use at this till
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                        Not in use here
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {p.connection
                        ? `Agent: ${p.connection.device ?? 'bonded'} · seen ${formatTime(p.connection.last_seen)}`
                        : 'No printer agent bonded yet'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => setQrPrinter(p)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <QrCode className="h-4 w-4" />
                    Show QR
                  </button>
                  <button
                    onClick={() => void bondPrinter(p, 'Checkout till')}
                    disabled={inUse}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PrinterIcon className="h-4 w-4" />
                    {inUse ? 'In use here' : 'Use at this till'}
                  </button>
                  <button
                    onClick={() => {
                      setEditId(p.id)
                      setEditTill(p.till)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Pencil className="h-4 w-4" />
                    Rename
                  </button>
                  <button
                    onClick={() => void removePrinter(p)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-semibold text-slate-900">How receipts get printed</h2>
          <ol className="mt-4 space-y-4">
            {[
              ['Register one printer per till', 'The server issues a PRN-XXXXXX id and a secure token, and shows a QR you can print for that till.'],
              ['Run the Printer Agent', 'Install the small Check Out Printer Agent on the PC/device the printer is plugged into (USB, Bluetooth or LAN) and point it at the server with the printer id + token — see printer-agent/README.md.'],
              ['Bond the till', 'On the till that uses the printer, tap "Connect by QR" and scan its code (or one-tap "Use at this till").'],
              ['Complete a sale', 'After checkout in the new-sale flow, the receipt is queued to that printer automatically and the agent prints it.'],
            ].map(([title, body], i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{title}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              A QR code alone can&apos;t make a thermal printer print — something physically
              connected to the printer must run the agent. This page only identifies which printer
              belongs to which till; the Printer Agent does the actual printing.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Cable className="h-4.5 w-4.5 text-teal-600" />
            Printer Agent
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            The agent runs on the supermarket PC next to the physical printer — it polls the server
            for receipt jobs and hands them to the local printer. It needs the printer&apos;s id and
            token from the QR.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>Open a printer&apos;s <span className="font-medium">Show QR</span> and copy its PRN id.</li>
            <li>Get the token from that QR (the payload is <code className="rounded bg-slate-100 px-1 font-mono text-xs">checkout-printer:connect:&lt;id&gt;:&lt;token&gt;</code>).</li>
            <li>Start the agent with <code className="rounded bg-slate-100 px-1 font-mono text-xs">PRINTER_ID</code> and <code className="rounded bg-slate-100 px-1 font-mono text-xs">PRINTER_TOKEN</code> set.</li>
            <li>The till finds the printer by QR — the server routes receipt jobs to that printer&apos;s queue.</li>
          </ol>
          <div className="mt-5 flex items-start gap-2 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-800">
            <ScanLine className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Tip: every till can have its own printer — Till 01 → Printer A, Till 02 → Printer B —
              each prints its own receipts.
            </p>
          </div>
        </div>
      </div>

      {scanOpen && (
        <ProductScanModal
          title="Scan printer QR"
          hint="Point the camera at the printer's QR code to connect this till to it."
          formats={qrFormats}
          onBarcode={handleScan}
          onClose={() => setScanOpen(false)}
        />
      )}
      {qrPrinter && <QrModal printer={qrPrinter} onClose={() => setQrPrinter(null)} />}
    </div>
  )
}