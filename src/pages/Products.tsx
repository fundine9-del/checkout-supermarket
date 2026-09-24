import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Package, Pencil, Plus, ScanLine, Search, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ProductScanModal } from '../components/ProductScanModal'
import { formatMoney } from '../lib/api'
import type { Item } from '../lib/types'

const emptyDraft = { name: '', barcode: '', price: '', category: '', stock: '0' }

export function ProductsPage() {
  const { api } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [myStoreId, setMyStoreId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!api) return
    setError(null)
    try {
      const { items, my_store } = await api.myItems()
      setItems(items)
      setMyStoreId(my_store.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    // fetch-on-mount: load once when the page opens (setState happens post-await).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const filtered = items.filter(
    (item) =>
      search.trim() === '' ||
      item.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      item.barcode.includes(search.trim()),
  )

  function openCreate() {
    setEditing(null)
    setDraft(emptyDraft)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(item: Item) {
    setEditing(item)
    setDraft({
      name: item.name,
      barcode: item.barcode,
      price: String(item.price),
      category: item.category ?? '',
      stock: String(item.stock),
    })
    setFormError(null)
    setModalOpen(true)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!api) return
    setSaving(true)
    setFormError(null)
    try {
      const body = {
        name: draft.name.trim(),
        barcode: draft.barcode.trim(),
        price: Number(draft.price),
        category: draft.category.trim() === '' ? null : draft.category.trim(),
        stock: Number(draft.stock),
      }
      if (editing) {
        await api.updateItem(editing.id, body)
      } else {
        await api.createItem(body)
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save product')
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: Item) {
    if (!api) return
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    try {
      await api.deleteItem(item.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete product')
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            The shared catalogue plus the products you added.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          Add product
        </button>
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or barcode…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <Package className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            {search ? 'No products match your search.' : 'No products yet — add your first one.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Barcode</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 text-right font-medium">Price</th>
                <th className="px-5 py-3 text-right font-medium">Stock</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const mine = item.store_id === myStoreId
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{item.name}</span>
                        {!mine && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                            shared
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{item.barcode}</td>
                    <td className="px-5 py-3 text-slate-500">{item.category ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-800">
                      {formatMoney(item.price)}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">{item.stock}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(item)}
                          disabled={!mine}
                          title={mine ? 'Edit' : 'Shared catalogue item (read-only)'}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-teal-600 disabled:opacity-30"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => void remove(item)}
                          disabled={!mine}
                          title={mine ? 'Delete' : 'Shared catalogue item (read-only)'}
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={save}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              {editing ? 'Edit product' : 'Add product'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {editing
                ? 'Changes apply to your store only.'
                : 'The product is added to your store and is visible to scanners.'}
            </p>

            <label className="mt-5 block text-sm font-medium text-slate-700">
              Product name
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              />
            </label>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">Barcode</label>
                  <button
                    type="button"
                    onClick={() => setScanOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50"
                  >
                    <ScanLine className="h-3.5 w-3.5" />
                    Scan
                  </button>
                </div>
                <input
                  value={draft.barcode}
                  onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
                  required
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
                />
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Category
                <input
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium text-slate-700">
                Price (KSh)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  required
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Stock
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={draft.stock}
                  onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
                  required
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
                />
              </label>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {scanOpen && (
        <ProductScanModal
          onBarcode={(raw) => {
            setDraft({ ...draft, barcode: raw })
            setScanOpen(false)
          }}
          onClose={() => setScanOpen(false)}
        />
      )}
    </div>
  )
}