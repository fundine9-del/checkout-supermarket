import { useState, type FormEvent, type ReactNode } from 'react'
import { Outlet, NavLink, Navigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  QrCode,
  ReceiptText,
  Plug,
  LogOut,
  Store as StoreIcon,
  ShoppingBasket,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
    </div>
  )
}

/** Redirects to /login when there's no session. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** After signup with confirmation enabled, prompt the store name. */
function StoreGate({ children }: { children: ReactNode }) {
  const { store, storeLoading, createStore } = useAuth()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (storeLoading) return <Spinner />
  if (store) return <>{children}</>

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createStore(name.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the supermarket')
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-white">
          <ShoppingBasket className="h-6 w-6" />
        </div>
        <h1 className="text-center text-xl font-semibold text-slate-900">Name your supermarket</h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          One small step left — give your store a name to see the dashboard.
        </p>
        <label className="mt-6 block text-sm font-medium text-slate-700">
          Supermarket name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            placeholder="e.g. QuickMart Supermarket"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
          />
        </label>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving || name.trim() === ''}
          className="mt-6 w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create store'}
        </button>
      </form>
    </div>
  )
}

const navItems = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/sales', label: 'Sales', icon: ReceiptText },
  { to: '/qr', label: 'QR code', icon: QrCode },
  { to: '/integrations', label: 'Integrations', icon: Plug },
]

/** Sidebar shell for the signed-in dashboard. */
export function DashboardLayout() {
  const { store, signOut } = useAuth()
  const location = useLocation()

  return (
    <StoreGate>
      <div className="flex min-h-screen bg-slate-50">
        <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-slate-200 bg-white">
          <div className="flex items-center gap-2.5 px-5 py-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
              <StoreIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {store?.name ?? 'Supermarket'}
              </p>
              <p className="text-xs text-slate-500">Checkout dashboard</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <Icon className="h-4.5 w-4.5" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-slate-200 p-3">
            <button
              onClick={() => void signOut()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <LogOut className="h-4.5 w-4.5" />
              Sign out
            </button>
          </div>
        </aside>

        <main className="ml-60 flex-1 p-8">
          {/* Keep the route keyed so pages refetch after navigation */}
          <Outlet key={location.pathname} />
        </main>
      </div>
    </StoreGate>
  )
}