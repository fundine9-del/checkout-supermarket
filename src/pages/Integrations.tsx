import { useEffect, useState } from 'react'
import {
  Cable,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Server,
  Terminal,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'

interface IntegrationInfo {
  store_id: string
  store_name: string
  api_key: string
  key_prefix: string
  base_url: string
  auth_header: string
  endpoints: string[]
}

export function IntegrationsPage() {
  const { api } = useAuth()
  const [info, setInfo] = useState<IntegrationInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState<'key' | 'auth' | 'none'>('none')

  useEffect(() => {
    if (!api) return
    api
      .integration()
      .then((data) => setInfo(data))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load integration settings'))
  }, [api])

  async function copy(text: string, which: 'key' | 'auth') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      window.setTimeout(() => setCopied('none'), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Integrations</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        Connect this store’s POS / inventory system to Check Out. Your developers build a small
        connector against this API — they push products, prices, stock and completed POS sales in,
        and everything lands in this dashboard and wallet. No direct database access is ever granted.
      </p>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {!info && !error && (
        <div className="mt-8 flex items-center justify-center rounded-2xl bg-white p-10 ring-1 ring-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      )}

      {info && (
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* API key */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-teal-600" />
              <h2 className="text-base font-semibold text-slate-900">Your API key</h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Unique to <span className="font-medium text-slate-700">{info.store_name}</span>. Every
              integration call must send it as a bearer token.
            </p>

            <div className="mt-4 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-900 px-3 py-2.5 text-xs text-teal-300">
                {revealed ? info.api_key : info.api_key.replace(/.(?=.{6}$)/g, '•')}
              </code>
              <button
                onClick={() => setRevealed((v) => !v)}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
                title={revealed ? 'Hide key' : 'Reveal key'}
              >
                {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                onClick={() => void copy(info.api_key, 'key')}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-xs font-medium text-white hover:bg-teal-700"
              >
                {copied === 'key' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === 'key' ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
              <code className="min-w-0 flex-1 truncate text-xs text-slate-600">{info.auth_header}</code>
              <button
                onClick={() => void copy(info.auth_header, 'auth')}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
              >
                {copied === 'auth' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === 'auth' ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-800">
              <Server className="h-4 w-4 shrink-0" />
              Store id: <code className="font-mono text-xs">{info.store_id}</code>
            </div>
          </div>

          {/* Endpoints */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-2">
              <Cable className="h-5 w-5 text-teal-600" />
              <h2 className="text-base font-semibold text-slate-900">API contract</h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Base URL{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                {info.base_url}
              </code>{' '}
              — every call needs{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                {info.auth_header}
              </code>
              .
            </p>
            <table className="mt-4 w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100">
                {info.endpoints.map((line) => {
                  const space = line.indexOf('   ')
                  const method = space === -1 ? line : line.slice(0, space)
                  const rest = space === -1 ? '' : line.slice(space).trim()
                  return (
                    <tr key={line}>
                      <td className="w-16 py-2 align-top text-xs font-semibold text-teal-700">{method}</td>
                      <td className="py-2 align-top font-mono text-xs text-slate-600">{rest}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Quick start */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 xl:col-span-2">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-teal-600" />
              <h2 className="text-base font-semibold text-slate-900">Quick start (curl)</h2>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-slate-700">1. Push your catalogue</p>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
{`curl -X POST ${info.base_url}/sync/products \\
  -H "Authorization: Bearer <api_key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "products": [
      { "barcode": "5449000000999", "name": "Coca-Cola 500ml",
        "price": 60, "stock": 127 }
    ]
  }'`}
                </pre>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">2. Record a POS sale</p>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
{`curl -X POST ${info.base_url}/orders \\
  -H "Authorization: Bearer <api_key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_name": "John Doe",
    "payment_method": "cash",
    "items": [
      { "barcode": "5449000000999", "quantity": 2 }
    ]
  }'`}
                </pre>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Full contract in <span className="font-mono">INTEGRATIONS.md</span>. Committed sales
              credit this store&apos;s wallet and appear in Overview &amp; Sales, exactly like till
              transactions.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}