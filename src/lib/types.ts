export interface Supermarket {
  id: string
  name: string
  is_default: boolean
  created_at: string
}

export interface Item {
  id: string
  barcode: string
  name: string
  price: number
  category: string | null
  stock: number
  store_id: string | null
}

export interface ItemDraft {
  barcode: string
  name: string
  price: number
  category?: string | null
  stock?: number
}

export interface OrderLine {
  id: string
  name: string
  price: number
  quantity: number
  barcode: string | null
}

export interface Sale {
  id: string
  customer_name: string | null
  total: number
  payment_method: string | null
  created_at: string
  items: OrderLine[]
}

export interface Stats {
  revenue: number
  today_revenue: number
  orders_count: number
  today_orders_count: number
  avg_order_value: number
  top_products: { name: string; quantity: number; revenue: number }[]
}