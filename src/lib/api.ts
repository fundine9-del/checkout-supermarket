import type { Item, ItemDraft, Sale, Stats, Supermarket, Transaction } from './types'

const BASE = '/api'

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