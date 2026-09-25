// Printer-bond helpers for the receipt-printer feature. Each till PC bonds to
// one printer; completing a sale then dispatches a print job to that printer
// through the server (see NewSaleModal).

const CONNECTED_KEY = 'checkout.connected-printer'

export interface ConnectedPrinter {
  id: string
  till: string
}

export interface PrinterLink {
  printerId: string
  token: string
}

/** The QR payload for a printer — a compact, colon-parsable string. */
export function encodePrinterLink(printerId: string, token: string): string {
  return `checkout-printer:connect:${printerId}:${token}`
}

/** Parse a scanned printer QR payload; null when it isn't one of ours. */
export function decodePrinterLink(raw: string): PrinterLink | null {
  const parts = raw.split(':')
  if (parts.length !== 4 || parts[0] !== 'checkout-printer' || parts[1] !== 'connect') return null
  const printerId = parts[2]
  const token = parts[3]
  if (!printerId || !token) return null
  return { printerId, token }
}

/** The printer this till is currently bonded to, or null. */
export function getConnectedPrinter(): ConnectedPrinter | null {
  try {
    const raw = localStorage.getItem(CONNECTED_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ConnectedPrinter>
    if (typeof parsed.id !== 'string' || typeof parsed.till !== 'string') return null
    return { id: parsed.id, till: parsed.till }
  } catch {
    return null
  }
}

export function setConnectedPrinter(printer: ConnectedPrinter | null): void {
  if (printer) localStorage.setItem(CONNECTED_KEY, JSON.stringify(printer))
  else localStorage.removeItem(CONNECTED_KEY)
}

/**
 * The QR on the customer's digital receipt (customer webapp ReceiptPage) — the
 * till scans it to reprint that receipt on the bonded printer.
 * Shape: checkout-receipt:<order_id>  ->  the order id, or null.
 */
export function decodeReceiptLink(raw: string): string | null {
  const match = /^checkout-receipt:([0-9a-f-]+)$/i.exec(raw.trim())
  const orderId = match?.[1]
  if (!orderId) return null
  return orderId
}