import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, MapPin, QrCode, ScanLine, Smartphone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const LINK_KEY = 'checkout.kiosk-link'
const DEFAULT_LINK = 'https://checkout-client.vercel.app'

/**
 * Accept only a production-ready kiosk link. Any value left over from an old
 * dev build (localhost / 127.0.0.1 / plain http) is rejected so browsers that
 * saved the local dev URL auto-heal to the deployed customer app on next load.
 */
function sanitizeLink(value: string | null): string | null {
  if (!value) return null
  if (value.includes('localhost') || value.includes('127.0.0.1') || value.includes('[::1]')) return null
  if (!value.startsWith('https://') && !value.startsWith('http://')) return null
  return value
}

export function StoreQRPage() {
  const { store } = useAuth()
  const [link, setLink] = useState(() => {
    const stored = localStorage.getItem(LINK_KEY)
    const cleaned = sanitizeLink(stored)
    if (cleaned === null && stored !== null) localStorage.removeItem(LINK_KEY)
    return cleaned ?? DEFAULT_LINK
  })
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const payload = store ? `${link.replace(/\/+$/, '')}?store=${store.id}` : ''

  // Regenerate the QR whenever the link or store changes. setState happens
  // post-await inside the promise chain, never synchronously in the effect.
  useEffect(() => {
    localStorage.setItem(LINK_KEY, link)
    if (!store) {
      setQr(null)
      return
    }
    let active = true
    setQr(null)
    QRCode.toDataURL(payload, {
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
  }, [link, store?.id, payload]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!store) return null // StoreGate guarantees a store inside the layout

  async function copyId() {
    if (!store) return
    try {
      await navigator.clipboard.writeText(store.id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Store QR code</h1>
      <p className="mt-1 text-sm text-slate-500">
        One code per supermarket — scan it in the Check Out app to start a checkout at{' '}
        <span className="font-medium text-slate-700">{store.name}</span> immediately.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-teal-600" />
            <h2 className="text-base font-semibold text-slate-900">Your code</h2>
          </div>

          <div className="mt-5 flex justify-center">
            {qr ? (
              <img
                src={qr}
                alt={`QR code for ${store.name}`}
                className="h-64 w-64 rounded-xl ring-1 ring-slate-200"
              />
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-xl bg-slate-50">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
              </div>
            )}
          </div>

          <p className="mt-5 text-center text-sm font-semibold text-slate-900">{store.name}</p>

          <div className="mt-2 flex items-center justify-center gap-2">
            <code className="max-w-full truncate rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
              {store.id}
            </code>
            <button
              onClick={() => void copyId()}
              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="mt-1.5 text-center text-xs text-slate-400">
            The store id is also valid on its own — customers can type/paste it instead of scanning.
          </p>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-teal-600" />
              <h2 className="text-base font-semibold text-slate-900">Kiosk app link</h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              The QR encodes this link plus your store id, so a phone camera scan opens the app
              directly at your store. Change it if the Check Out app lives at a different address.
            </p>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={DEFAULT_LINK}
              className="mt-4 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            />
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-teal-600" />
              <h2 className="text-base font-semibold text-slate-900">How customers use it</h2>
            </div>
            <ol className="mt-4 space-y-4">
              {[
                ['Print this code', 'Put it at the store entrance, on tills, or at the checkout counter.'],
                ['Scan it with the Check Out app', 'Open the app, tap "Scan QR" on the home screen, and point it at the code.'],
                [<span key="start">Start adding items</span>, 'A fresh checkout opens for your store right away — no setup needed. Every sale lands in this store’s dashboard and wallet.'],
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
            <div className="mt-5 flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-800">
              <ScanLine className="h-4 w-4 shrink-0" />
              Tip: also show the store id so customers on devices without a camera can type it.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}