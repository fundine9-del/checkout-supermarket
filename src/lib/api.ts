import type {
  Item,
  ItemDraft,
  OrderWithItems,
  PrintJob,
  Printer,
  Receipt,
  Sale,
  Stats,
  Supermarket,
  Transaction,
} from './types'

// API base. In dev, Vite can proxy `/api` to the server (see vite.config.ts);
// in production builds VITE_API_URL points straight at the deployed server.
const BASE = import.meta.env.VITE_API_URL ?? 'https://checkout-production-bbfe.up.railway.app/api'

export class ApiError extends Error {}

interface RequestOptions {
  method?: string
  body?: unknown
  token?: string
}

async function req<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.token) headers.Authorization = `Bearer ${options.token}`

  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // non-JSON response
  }

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (HTTP ${res.status})`
    throw new ApiError(message)
  }
  return data as T
}

/** API client bound to a Supabase session token. */
export function createApi(token: string) {
  const auth = { token }
  return {
    mySupermarket: () => req<{ supermarket: Supermarket }>('/supermarkets/me', auth),
    createSupermarket: (name: string) =>
      req<{ supermarket: Supermarket }>('/supermarkets', {
        method: 'POST',
        body: { name },
        ...auth,
      }),

    myItems: () =>
      req<{ items: Item[]; my_store: { id: string; name: string } }>(
        '/supermarkets/me/items',
        auth,
      ),
    createItem: (item: ItemDraft) =>
      req<{ item: Item }>('/supermarkets/me/items', { method: 'POST', body: item, ...auth }),
    updateItem: (id: string, patch: Partial<ItemDraft>) =>
      req<{ item: Item }>(`/supermarkets/me/items/${id}`, {
        method: 'PATCH',
        body: patch,
        ...auth,
      }),
    deleteItem: (id: string) =>
      req<{ deleted: string }>(`/supermarkets/me/items/${id}`, { method: 'DELETE', ...auth }),

    sales: () => req<{ sales: Sale[] }>('/supermarkets/me/sales', auth),
    stats: () => req<{ stats: Stats }>('/supermarkets/me/stats', auth),
    transactions: () =>
      req<{ transactions: Transaction[] }>('/supermarkets/me/transactions', auth),

    // Receipt printers (Printer Agent feature): register a printer per till,
    // bond this till to a printer, and queue paid-order receipts for printing.
    myPrinters: () => req<{ printers: Printer[] }>('/supermarkets/me/printers', auth),
    createPrinter: (till: string) =>
      req<{ printer: Printer }>('/supermarkets/me/printers', {
        method: 'POST',
        body: { till },
        ...auth,
      }),
    updatePrinter: (id: string, till: string) =>
      req<{ printer: Printer }>(`/supermarkets/me/printers/${id}`, {
        method: 'PATCH',
        body: { till },
        ...auth,
      }),
    deletePrinter: (id: string) =>
      req<{ ok: true }>(`/supermarkets/me/printers/${id}`, {
        method: 'DELETE',
        ...auth,
      }),
    connectPrinter: (id: string, device: string) =>
      req<{ printer: Printer }>(`/supermarkets/me/printers/${id}/connect`, {
        method: 'POST',
        body: { device },
        ...auth,
      }),
    enqueuePrintJob: (printerId: string, orderId: string) =>
      req<{ job: PrintJob }>(`/supermarkets/me/printers/${printerId}/jobs`, {
        method: 'POST',
        body: { order_id: orderId },
        ...auth,
      }),

    // Manual-sale flow: create an open order for this supermarket, scan items
    // in by barcode, adjust quantities, then check out with a payment method.
    // The server scopes barcode resolution to the store's catalogue and
    // decrements stock + credits the wallet on checkout (customer-flow parity).
    createOrder: (storeId: string) =>
      req<{ order: OrderWithItems }>('/orders', {
        method: 'POST',
        body: { store_id: storeId },
        ...auth,
      }),
    fetchOrder: (orderId: string) =>
      req<{ order: OrderWithItems }>(`/orders/${orderId}`, auth),
    addItem: (orderId: string, barcode: string, quantity = 1) =>
      req<{ order: OrderWithItems }>(`/orders/${orderId}/items`, {
        method: 'POST',
        body: { barcode, quantity },
        ...auth,
      }),
    updateItemQuantity: (orderId: string, itemId: string, quantity: number) =>
      req<{ order: OrderWithItems }>(`/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        body: { quantity },
        ...auth,
      }),
    removeItem: (orderId: string, itemId: string) =>
      req<{ order: OrderWithItems }>(`/orders/${orderId}/items/${itemId}`, {
        method: 'DELETE',
        ...auth,
      }),
    checkout: (orderId: string, paymentMethod: string) =>
      req<{ order: OrderWithItems; receipt: Receipt }>(
        `/orders/${orderId}/checkout`,
        { method: 'POST', body: { payment_method: paymentMethod }, ...auth },
      ),

    integration: () =>
      req<{
        store_id: string
        store_name: string
        api_key: string
        key_prefix: string
        base_url: string
        auth_header: string
        endpoints: string[]
      }>('/supermarkets/me/integration', auth),
  }
}

export type Api = ReturnType<typeof createApi>

export function formatMoney(value: number): string {
  return `KSh ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`
}

export function shortId(id: string): string {
  return id.length <= 8 ? id : id.slice(0, 8)
}

export function formatTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}