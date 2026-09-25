// Minimal typings + support probe for the BarcodeDetector API (Chromium).
// https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector
// Byte-parity with `checkout client`'s lib/barcode.ts — same helper the
// customer scanner uses, so supermarkets can camera-scan a product barcode
// when adding it to the catalogue.

export interface DetectedBarcode {
  rawValue: string
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
    }
  }
}

/** Chrome/Android browsers support camera scanning; others fall back to manual entry. */
export const barcodeDetectorSupported: boolean =
  typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function'

export const barcodeFormats = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'codabar',
]

/** QR codes are read with the same detector for the printer-bond flow. */
export const qrFormats = ['qr_code']

/** The Chromium gate covers QR too — BarcodeDetector ships QR support wherever it exists. */
export const qrDetectorSupported: boolean = barcodeDetectorSupported
