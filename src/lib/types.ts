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

/** An open or completed order — mirrors the server's order row (customer-flow parity). */
export interface Order {
  id: string
  customer_name: string | null
  status: 'open' | 'paid' | 'cancelled'
  payment_method: 'cash' | 'card' | 'mobile' | null
  total: number
  store_id: string | null
  created_at: string
  paid_at: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  item_id: string | null
  barcode: string | null
  name: string
  price: number
  quantity: number
  created_at: string
}

export interface OrderWithItems extends Order {
  items: OrderItem[]
}

export interface ReceiptLine {
  barcode: string | null
  name: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface Receipt {
  store_name?: string | null
  customer_name?: string | null
  order_id: string
  payment_method: string
  total: number
  paid_at: string
  items: ReceiptLine[]
}

export interface Sale {
  id: string
  customer_name: string | null
  total: number
  payment_method: string | null
  created_at: string
  items: OrderLine[]
}

// ------------------------------------------------------------ printers

export interface PrinterConnection {
  device: string | null
  last_seen: string
}

/** A registered receipt printer (PRN-XXXXXX) for one supermarket till. */
export interface Printer {
  id: string
  till: string
  /** Token used to build the setup QR (the Printer Agent's credential). */
  token: string
  created_at: string
  connection: PrinterConnection | null
}

export interface PrintJob {
  id: string
  printer_id: string
  order_id: string
  status: 'pending' | 'printing' | 'done' | 'failed'
  created_at: string
}

export interface Stats {
  revenue: number
  today_revenue: number
  orders_count: number
  today_orders_count: number
  avg_order_value: number
  top_products: { name: string; quantity: number; revenue: number }[]
  wallet: {
    balance: number
    currency: string
    total_in: number
    total_out: number
  } | null
}

export type TransactionType = 'payment' | 'refund' | 'withdrawal' | 'deposit'

export interface Transaction {
  id: string
  order_id: string | null
  type: TransactionType
  amount: number
  balance_after: number
  payment_method: string | null
  status: 'pending' | 'completed' | 'failed'
  reference: string | null
  description: string | null
  created_at: string
}