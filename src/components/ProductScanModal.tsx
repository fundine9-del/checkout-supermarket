import { useEffect, useRef, useState } from 'react'
import { ScanLine, X } from 'lucide-react'
import { barcodeDetectorSupported } from '../lib/barcode'
import { barcodeFormats } from '../lib/barcode'

interface ProductScanModalProps {
  /** Called once a barcode is detected by the camera (or typed manually). */
  onBarcode: (raw: string) => void
  onClose: () => void
  /** Detector formats. Defaults to product barcodes (EAN/UPC); pass QR formats to scan printer QR codes. */
  formats?: string[]
  title?: string
  hint?: string
}

type CameraState = 'idle' | 'starting' | 'on' | 'unavailable'

/**
 * Camera barcode scanner for the supermarket's add-product form — the same
 * byte-proven detect loop the customer webapp ships in ScanPage/ScanStoreModal
 * (getUserMedia → video → BarcodeDetector.detect(canvas) → rawValue), so a
 * supermarket can scan a product's EAN/UPC barcode instead of typing it.
 * Also used to scan printer QR codes (pass `qrFormats`).
 */
export function ProductScanModal({
  onBarcode,
  onClose,
  formats = barcodeFormats,
  title = 'Scan product barcode',
  hint = 'Point the camera at the product barcode.',
}: ProductScanModalProps) {
  const [cameraState, setCameraState] = useState<CameraState>(
    barcodeDetectorSupported ? 'idle' : 'unavailable',
  )
  const [manual, setManual] = useState('')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const detectorRef = useRef<{
    detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
  } | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const cooldownRef = useRef(0)
  const processingRef = useRef(false)

  // helper: verify no double-fire from a burst of camera detections
  function resolve(raw: string) {
    if (processingRef.current) return
    processingRef.current = true
    void onBarcode(raw)
    onClose()
  }

  useEffect(() => {
    if (!barcodeDetectorSupported) return undefined
    let active = true

    async function startCamera() {
      setCameraState('starting')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play()
        }
        detectorRef.current = new window.BarcodeDetector!({
          formats,
        })
        setCameraState('on')
        scheduleFrame()
      } catch {
        if (!active) return
        setCameraState('unavailable')
      }
    }

    function scheduleFrame() {
      if (active) rafRef.current = requestAnimationFrame(loop)
    }

    function loop() {
      if (!active) return
      const video = videoRef.current
      const canvas = canvasRef.current
      const detector = detectorRef.current
      if (!video || !canvas || !detector || video.readyState < 2) {
        scheduleFrame()
        return
      }
      if (Date.now() - cooldownRef.current < 800) {
        scheduleFrame()
        return
      }
      const ctx = canvas.getContext('2d')
      if (ctx) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        void detector
          .detect(canvas)
          .then((codes) => {
            if (codes && codes.length > 0) {
              cooldownRef.current = Date.now()
              resolve(codes[0].rawValue)
            }
          })
          .catch(() => {
            /* transient detection error on a frame — keep scanning */
          })
      }
      scheduleFrame()
    }

    void startCamera()

    return () => {
      active = false
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  function addManual() {
    const raw = manual.trim()
    if (raw !== '') resolve(raw)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <header className="flex items-center justify-between px-4 py-4 text-white">
        <h1 className="text-lg font-semibold">{title}</h1>
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-white/80 hover:bg-white/10"
          aria-label="Close scanner"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {barcodeDetectorSupported ? (
        <>
          <div className="relative mx-4 flex-1 overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
            />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />
            {cameraState === 'starting' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
              </div>
            )}
          </div>
          <p className="mt-4 px-4 pb-2 text-center text-sm text-white/60">
            {hint}
          </p>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm text-white/70">
            Camera scanning isn&apos;t available in this browser — type the code below.
          </p>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addManual()
              }
            }}
            placeholder="Type the product code…"
            autoFocus
            className="w-full max-w-sm rounded-lg bg-white/10 px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-white/30 focus:bg-white/15"
          />
          <button
            onClick={addManual}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            <ScanLine className="h-4 w-4" />
            Use this code
          </button>
        </div>
      )}
    </div>
  )
}
