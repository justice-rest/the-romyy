/**
 * PDF Processing Module
 * Extracts text and metadata from PDF files
 */

import type { PDFProcessingResult } from "./types"

// Set up DOM polyfills for Node.js environment (required by @napi-rs/canvas)
// Initialize immediately to ensure they're available before any dependencies load
function initializeDOMPolyfills() {
  // Only run in Node.js (server-side)
  if (typeof window !== "undefined") {
    return // Running in browser, no polyfills needed
  }

  // Check if already initialized
  if ((globalThis as any).__DOM_POLYFILLS_READY__) {
    return
  }

  try {
    // Try jsdom first for full DOM support
    try {
      const { JSDOM } = require("jsdom")
      const dom = new JSDOM("<!DOCTYPE html>", {
        url: "http://localhost",
        pretendToBeVisual: true,
      })

      // Install polyfills using jsdom's implementations
      const domApis = ["DOMMatrix", "DOMRect", "DOMPoint", "DOMQuad"] as const

      for (const apiName of domApis) {
        if (typeof globalThis[apiName] === "undefined" && dom.window[apiName]) {
          // Get the constructor from jsdom
          const JSDOMConstructor = dom.window[apiName]

          // Create a proper wrapper function
          const PolyfillConstructor = function (this: any, ...args: any[]) {
            // Handle both 'new' and direct calls
            if (new.target) {
              // Called with 'new' - create instance
              const instance = Reflect.construct(JSDOMConstructor, args, new.target)
              // Copy properties to 'this'
              Object.setPrototypeOf(this, instance as object)
              return this
            } else {
              // Called without 'new' - call original constructor
              return JSDOMConstructor(...args)
            }
          }

          // Set up prototype chain
          PolyfillConstructor.prototype = JSDOMConstructor.prototype

          // Copy static methods
          for (const key of Object.getOwnPropertyNames(JSDOMConstructor)) {
            if (key !== "prototype" && key !== "length" && key !== "name") {
              try {
                ;(PolyfillConstructor as any)[key] = (JSDOMConstructor as any)[key]
              } catch (e) {
                // Ignore non-writable properties
              }
            }
          }

          // Install the polyfill
          ;(globalThis as any)[apiName] = PolyfillConstructor
        }
      }

      // Additional global properties that might be needed
      if (typeof globalThis.document === "undefined") {
        ;(globalThis as any).document = dom.window.document
      }

      console.log("[PDF Processor] jsdom polyfills installed successfully")
    } catch (jsdomError) {
      console.warn("[PDF Processor] jsdom initialization failed, using minimal polyfills:", jsdomError)

      // Fallback: Create minimal polyfills that just satisfy basic requirements
      // pdfjs-dist might just be checking that these constructors exist
      if (typeof globalThis.DOMMatrix === "undefined") {
        ;(globalThis as any).DOMMatrix = class DOMMatrix {
          a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
          m11 = 1; m12 = 0; m13 = 0; m14 = 0
          m21 = 0; m22 = 1; m23 = 0; m24 = 0
          m31 = 0; m32 = 0; m33 = 1; m34 = 0
          m41 = 0; m42 = 0; m43 = 0; m44 = 1
          is2D = true
          isIdentity = true

          constructor(init?: any) {
            if (Array.isArray(init)) {
              if (init.length === 6) {
                [this.a, this.b, this.c, this.d, this.e, this.f] = init
                this.m11 = this.a; this.m12 = this.b
                this.m21 = this.c; this.m22 = this.d
                this.m41 = this.e; this.m42 = this.f
              }
            }
          }

          translate(tx: number, ty: number) { return this }
          scale(sx: number, sy?: number) { return this }
          rotate(angle: number) { return this }
          multiply(other: any) { return this }
        }
      }

      if (typeof globalThis.DOMRect === "undefined") {
        ;(globalThis as any).DOMRect = class DOMRect {
          constructor(
            public x = 0,
            public y = 0,
            public width = 0,
            public height = 0
          ) {}
          get top() { return this.y }
          get bottom() { return this.y + this.height }
          get left() { return this.x }
          get right() { return this.x + this.width }
        }
      }

      if (typeof globalThis.DOMPoint === "undefined") {
        ;(globalThis as any).DOMPoint = class DOMPoint {
          constructor(
            public x = 0,
            public y = 0,
            public z = 0,
            public w = 1
          ) {}
        }
      }

      console.log("[PDF Processor] Minimal polyfills installed")
    }

    // Mark as initialized
    ;(globalThis as any).__DOM_POLYFILLS_READY__ = true

    console.log("[PDF Processor] DOM polyfills ready")
  } catch (error) {
    console.error("[PDF Processor] Critical error initializing polyfills:", error)
    // Continue anyway
  }
}

// Initialize polyfills immediately when module loads
initializeDOMPolyfills()

// Lazy load pdf-parse to avoid module resolution issues
let pdfParse: any = null
async function getPdfParse() {
  if (!pdfParse) {
    try {
      // Ensure polyfills are initialized (in case module was loaded in different context)
      initializeDOMPolyfills()

      // Verify critical polyfills are available
      console.log("[PDF Processor] Checking polyfills...")
      console.log(`  DOMMatrix available: ${typeof globalThis.DOMMatrix !== "undefined"}`)
      console.log(`  DOMMatrix is constructor: ${typeof globalThis.DOMMatrix === "function"}`)

      // Set up canvas for Node.js environment
      // pdfjs-dist (used by pdf-parse) needs a canvas implementation
      try {
        const Canvas = require("@napi-rs/canvas")

        // Create canvas factory for pdfjs-dist
        if (!globalThis.document?.createElement) {
          const canvasFactory = {
            create: (width: number, height: number) => {
              const canvas = Canvas.createCanvas(width, height)
              return {
                canvas,
                context: canvas.getContext("2d"),
              }
            },
            reset: (canvasAndContext: any, width: number, height: number) => {
              canvasAndContext.canvas.width = width
              canvasAndContext.canvas.height = height
            },
            destroy: (canvasAndContext: any) => {
              canvasAndContext.canvas.width = 0
              canvasAndContext.canvas.height = 0
              canvasAndContext.canvas = null
              canvasAndContext.context = null
            },
          }

          // Store for pdfjs-dist to use
          ;(globalThis as any).__PDF_CANVAS_FACTORY__ = canvasFactory
        }

        console.log("[PDF Processor] Canvas setup completed")
      } catch (canvasError) {
        console.warn("[PDF Processor] Canvas setup failed:", canvasError)
        // Continue - pdf-parse might work without full canvas support
      }

      pdfParse = require("pdf-parse")
      console.log("[PDF Processor] pdf-parse loaded successfully")
    } catch (error) {
      console.error("[PDF Processor] Failed to load pdf-parse:", error)
      console.error("[PDF Processor] Error details:", {
        name: error instanceof Error ? error.name : "Unknown",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw new Error(
        `Failed to load PDF parsing library: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }
  return pdfParse
}

/**
 * Detect language from text (simple heuristic)
 * Returns ISO 639-1 language code
 */
function detectLanguage(text: string): string {
  // Simple heuristic: if text is mostly ASCII, assume English
  // For more robust detection, consider using a library like franc
  const asciiRatio =
    text.split("").filter((char) => char.charCodeAt(0) < 128).length /
    text.length

  // If > 90% ASCII characters, assume English
  return asciiRatio > 0.9 ? "en" : "multilingual"
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  // Remove extra whitespace and split by word boundaries
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length
}

/**
 * Extract text and metadata from PDF buffer
 *
 * @param buffer - PDF file as Buffer or Uint8Array
 * @returns Extracted text, page count, word count, and detected language
 */
export async function processPDF(
  buffer: Buffer | Uint8Array
): Promise<PDFProcessingResult> {
  console.log(`[PDF Processor] Starting PDF processing, buffer size: ${buffer.length} bytes`)

  try {
    // Parse PDF using pdf-parse (lazy loaded)
    console.log("[PDF Processor] Loading pdf-parse library...")
    const parser = await getPdfParse()

    console.log("[PDF Processor] Parsing PDF buffer...")
    const data = await parser(buffer)

    console.log(`[PDF Processor] PDF parsed successfully, pages: ${data.numpages}`)

    // Extract text from all pages
    const text = data.text

    if (!text || text.trim().length === 0) {
      throw new Error(
        "No text content found in PDF. The file may be image-only or corrupted."
      )
    }

    // Get page count from PDF metadata
    const pageCount = data.numpages

    // Count words
    const wordCount = countWords(text)
    console.log(`[PDF Processor] Text extracted: ${wordCount} words`)

    // Detect language
    const language = detectLanguage(text)
    console.log(`[PDF Processor] Language detected: ${language}`)

    return {
      text,
      pageCount,
      wordCount,
      language,
    }
  } catch (error) {
    console.error("[PDF Processor] Processing failed:", error)
    console.error("[PDF Processor] Error stack:", error instanceof Error ? error.stack : "No stack")

    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`PDF processing failed: ${error.message}`)
    }
    throw new Error("PDF processing failed: Unknown error")
  }
}

/**
 * Validate PDF file before processing
 *
 * @param buffer - File buffer to validate
 * @returns true if valid PDF, false otherwise
 */
export function isValidPDF(buffer: Buffer | Uint8Array): boolean {
  // Check PDF magic bytes: %PDF-
  const magicBytes = buffer.slice(0, 5)
  const pdfSignature = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]) // %PDF-

  return Buffer.compare(magicBytes, pdfSignature) === 0
}

/**
 * Extract text from specific page range
 * Note: pdf-parse doesn't support page ranges natively,
 * so this is a placeholder for future enhancement
 *
 * @param buffer - PDF file buffer
 * @param startPage - Starting page number (1-based)
 * @param endPage - Ending page number (1-based)
 * @returns Extracted text from specified pages
 */
export async function extractPageRange(
  buffer: Buffer | Uint8Array,
  startPage: number,
  endPage: number
): Promise<string> {
  // pdf-parse doesn't support page-by-page extraction easily
  // For now, extract all text and note this limitation
  const result = await processPDF(buffer)

  // TODO: Implement page-specific extraction using a different library
  // (e.g., pdf-lib or pdfjs-dist) if needed

  console.warn(
    `Page range extraction (${startPage}-${endPage}) not yet implemented. Returning full text.`
  )
  return result.text
}
