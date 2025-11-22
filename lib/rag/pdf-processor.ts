/**
 * PDF Processing Module
 * Extracts text and metadata from PDF files
 */

import type { PDFProcessingResult } from "./types"

// Module-scoped jsdom instance to keep DOM APIs alive across function calls
// This prevents the polyfills from becoming invalid when jsdom goes out of scope
let jsdomInstance: any = null

// Set up DOM polyfills for Node.js environment (required by pdfjs-dist)
// Uses a multi-layer strategy: @napi-rs/canvas → jsdom → fail with clear error
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
    // Strategy 1: Try @napi-rs/canvas first (provides native DOMMatrix + Canvas)
    try {
      const Canvas = require("@napi-rs/canvas")

      // Install DOM APIs from @napi-rs/canvas with proper wrappers
      // We need wrappers to ensure they work correctly when called from different contexts
      const domApis = ["DOMMatrix", "DOMRect", "DOMPoint"] as const

      for (const apiName of domApis) {
        if (Canvas[apiName] && typeof globalThis[apiName] === "undefined") {
          const OriginalConstructor = Canvas[apiName]

          // Create a wrapper that properly handles constructor calls
          // This ensures the constructor works when called from pdfjs-dist
          const WrappedConstructor = function (this: any, ...args: any[]) {
            // Handle both 'new' and direct calls
            if (new.target) {
              // Called with 'new' - create instance and return it
              return new OriginalConstructor(...args)
            } else {
              // Called without 'new' - also create instance
              return new OriginalConstructor(...args)
            }
          }

          // Preserve prototype chain and static methods
          Object.setPrototypeOf(WrappedConstructor, OriginalConstructor)
          WrappedConstructor.prototype = OriginalConstructor.prototype

          // Copy any static methods/properties
          Object.getOwnPropertyNames(OriginalConstructor).forEach((key) => {
            if (key !== "prototype" && key !== "length" && key !== "name") {
              try {
                const descriptor = Object.getOwnPropertyDescriptor(OriginalConstructor, key)
                if (descriptor) {
                  Object.defineProperty(WrappedConstructor, key, descriptor)
                }
              } catch (e) {
                // Ignore non-configurable properties
              }
            }
          })

          ;(globalThis as any)[apiName] = WrappedConstructor
          console.log(`[PDF Processor] Installed ${apiName} from @napi-rs/canvas`)
        }
      }

      // Set up Canvas factory for pdfjs-dist
      if (Canvas.createCanvas) {
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
        console.log("[PDF Processor] Canvas factory from @napi-rs/canvas configured")
      }
    } catch (canvasError) {
      console.warn("[PDF Processor] @napi-rs/canvas not available:", canvasError instanceof Error ? canvasError.message : String(canvasError))
      // Continue to fallback strategies
    }

    // Strategy 2: Use jsdom for DOM APIs if still needed
    // Keep instance in module scope so DOM APIs remain valid
    if (typeof globalThis.DOMMatrix === "undefined") {
      try {
        const { JSDOM } = require("jsdom")

        // Create jsdom instance and keep it alive in module scope
        jsdomInstance = new JSDOM("<!DOCTYPE html>", {
          url: "http://localhost",
          pretendToBeVisual: true,
        })

        console.log("[PDF Processor] jsdom instance created")

        // Install DOM APIs with proper wrappers
        const domApis = ["DOMMatrix", "DOMRect", "DOMPoint", "DOMQuad"] as const

        for (const apiName of domApis) {
          if (typeof globalThis[apiName] === "undefined" && jsdomInstance.window[apiName]) {
            const OriginalConstructor = jsdomInstance.window[apiName]

            // Create a wrapper that properly forwards to jsdom constructor
            const WrappedConstructor = function (this: any, ...args: any[]) {
              if (new.target) {
                return new OriginalConstructor(...args)
              } else {
                return new OriginalConstructor(...args)
              }
            }

            // Preserve prototype chain
            Object.setPrototypeOf(WrappedConstructor, OriginalConstructor)
            WrappedConstructor.prototype = OriginalConstructor.prototype

            // Copy static methods
            Object.getOwnPropertyNames(OriginalConstructor).forEach((key) => {
              if (key !== "prototype" && key !== "length" && key !== "name") {
                try {
                  const descriptor = Object.getOwnPropertyDescriptor(OriginalConstructor, key)
                  if (descriptor) {
                    Object.defineProperty(WrappedConstructor, key, descriptor)
                  }
                } catch (e) {
                  // Ignore non-configurable properties
                }
              }
            })

            ;(globalThis as any)[apiName] = WrappedConstructor
            console.log(`[PDF Processor] Installed ${apiName} from jsdom`)
          }
        }

        // Add document if needed
        if (typeof globalThis.document === "undefined") {
          ;(globalThis as any).document = jsdomInstance.window.document
        }

        console.log("[PDF Processor] jsdom polyfills installed successfully")
      } catch (jsdomError) {
        // If both @napi-rs/canvas and jsdom fail, we have a critical error
        const errorMsg = jsdomError instanceof Error ? jsdomError.message : String(jsdomError)
        console.error("[PDF Processor] jsdom initialization failed:", errorMsg)
        throw new Error(
          `Cannot initialize DOM polyfills. Both @napi-rs/canvas and jsdom failed. ` +
          `Ensure dependencies are installed: npm install. Error: ${errorMsg}`
        )
      }
    }

    // Verify DOMMatrix is actually functional (not just defined)
    if (typeof globalThis.DOMMatrix !== "undefined") {
      try {
        // Test instantiation with 6-element array (common pdfjs-dist usage)
        const testMatrix = new (globalThis as any).DOMMatrix([1, 0, 0, 1, 0, 0])

        // Verify the matrix has the expected properties
        if (typeof testMatrix.a !== "number" || testMatrix.a !== 1) {
          throw new Error("DOMMatrix polyfill is non-functional (properties missing)")
        }

        console.log("[PDF Processor] DOMMatrix verification passed")
      } catch (verifyError) {
        const errorMsg = verifyError instanceof Error ? verifyError.message : String(verifyError)
        console.error("[PDF Processor] DOMMatrix verification failed:", errorMsg)
        throw new Error(
          `DOMMatrix polyfill installed but non-functional: ${errorMsg}. ` +
          `This may indicate a dependency issue. Try: npm install`
        )
      }
    } else {
      throw new Error(
        "Failed to install DOMMatrix polyfill. PDF processing requires either " +
        "@napi-rs/canvas or jsdom. Ensure dependencies are installed: npm install"
      )
    }

    // Mark as initialized
    ;(globalThis as any).__DOM_POLYFILLS_READY__ = true

    console.log("[PDF Processor] DOM polyfills ready and verified")
  } catch (error) {
    console.error("[PDF Processor] Critical error initializing polyfills:", error)
    // Re-throw with context - this is a fatal error
    throw error
  }
}

// Initialize polyfills immediately when module loads
initializeDOMPolyfills()

// Lazy load PDFParse class to avoid module resolution issues
let PDFParseClass: any = null
let workerConfigured = false

async function getPDFParseClass() {
  if (!PDFParseClass) {
    try {
      // Ensure polyfills are initialized
      // This is idempotent - safe to call multiple times
      initializeDOMPolyfills()

      // Verify polyfills are ready
      console.log("[PDF Processor] Pre-flight check before loading pdf-parse...")
      console.log(`  DOMMatrix available: ${typeof globalThis.DOMMatrix !== "undefined"}`)
      console.log(`  DOMMatrix is function: ${typeof globalThis.DOMMatrix === "function"}`)
      console.log(`  Canvas factory ready: ${typeof (globalThis as any).__PDF_CANVAS_FACTORY__ !== "undefined"}`)

      // Verify DOMMatrix can be instantiated
      if (typeof globalThis.DOMMatrix === "undefined") {
        throw new Error(
          "DOMMatrix is not available. Polyfill initialization may have failed. " +
          "Check console logs above for errors."
        )
      }

      // Load pdf-parse v2.x (which will load pdfjs-dist)
      // At this point, all polyfills should be ready
      console.log("[PDF Processor] Loading pdf-parse library...")
      const pdfParseModule = require("pdf-parse")

      // pdf-parse v2.x exports PDFParse as a class
      PDFParseClass = pdfParseModule.PDFParse

      if (!PDFParseClass || typeof PDFParseClass !== "function") {
        throw new Error("PDFParse class not found in pdf-parse module")
      }

      console.log("[PDF Processor] pdf-parse v2.x loaded successfully")

      // Configure worker for Node.js environment
      // pdf-parse tries to load a worker file but the path is not exported in package.json
      // We need to set it manually with an absolute path
      if (!workerConfigured && typeof PDFParseClass.setWorker === "function") {
        try {
          const path = require("path")

          // Find the pdf-parse module directory
          // This works in both development and production (including serverless)
          const pdfParseDir = require.resolve("pdf-parse").split("node_modules")[0] + "node_modules/pdf-parse"
          const workerPath = path.join(pdfParseDir, "dist/pdf-parse/cjs/pdf.worker.mjs")

          console.log("[PDF Processor] Configuring worker path:", workerPath)
          PDFParseClass.setWorker(workerPath)
          workerConfigured = true
          console.log("[PDF Processor] Worker configured successfully")
        } catch (workerError) {
          console.warn("[PDF Processor] Failed to configure worker:", workerError)
          console.warn("[PDF Processor] PDF parsing will attempt to continue without worker configuration")
          // Non-fatal - pdf-parse should still work
        }
      }
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
  return PDFParseClass
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

  let parser: any = null

  try {
    // Get PDFParse class (lazy loaded)
    console.log("[PDF Processor] Loading PDFParse class...")
    const PDFParse = await getPDFParseClass()

    // Try multiple strategies to create parser instance
    // Strategy 1: Default with pre-configured worker (should work in most cases)
    console.log("[PDF Processor] Strategy 1: Creating PDFParse with default config...")
    try {
      parser = new PDFParse({ data: buffer })
      console.log("[PDF Processor] ✓ Strategy 1 succeeded")
    } catch (strategy1Error) {
      console.warn("[PDF Processor] ✗ Strategy 1 failed:",
        strategy1Error instanceof Error ? strategy1Error.message : String(strategy1Error))

      // Strategy 2: Explicitly disable worker fetch
      console.log("[PDF Processor] Strategy 2: Disabling worker fetch...")
      try {
        parser = new PDFParse({
          data: buffer,
          useWorkerFetch: false,
        })
        console.log("[PDF Processor] ✓ Strategy 2 succeeded")
      } catch (strategy2Error) {
        console.warn("[PDF Processor] ✗ Strategy 2 failed:",
          strategy2Error instanceof Error ? strategy2Error.message : String(strategy2Error))

        // Strategy 3: Full worker disable + minimal options
        console.log("[PDF Processor] Strategy 3: Full worker disable...")
        try {
          parser = new PDFParse({
            data: buffer,
            useWorkerFetch: false,
            isEvalSupported: false,
            useSystemFonts: true,
          })
          console.log("[PDF Processor] ✓ Strategy 3 succeeded")
        } catch (strategy3Error) {
          console.error("[PDF Processor] ✗ All strategies failed")
          console.error("[PDF Processor] Strategy 3 error:",
            strategy3Error instanceof Error ? strategy3Error.message : String(strategy3Error))

          // Re-throw the most recent error
          throw strategy3Error
        }
      }
    }

    if (!parser) {
      throw new Error("Failed to create PDFParse instance after trying all strategies")
    }

    // Extract text using the getText() method
    console.log("[PDF Processor] Extracting text from PDF...")
    const result = await parser.getText()

    console.log(`[PDF Processor] PDF parsed successfully, pages: ${result.total}`)

    // Extract text from result
    // result.text contains all text, result.pages is an array of page objects
    const text = result.text

    if (!text || text.trim().length === 0) {
      throw new Error(
        "No text content found in PDF. The file may be image-only or corrupted."
      )
    }

    // Get page count from result
    const pageCount = result.total || result.pages?.length || 1

    // Count words
    const wordCount = countWords(text)
    console.log(`[PDF Processor] Text extracted: ${wordCount} words from ${pageCount} page(s)`)

    // Detect language
    const language = detectLanguage(text)
    console.log(`[PDF Processor] Language detected: ${language}`)

    // Clean up parser resources
    if (parser && typeof parser.destroy === "function") {
      await parser.destroy().catch((destroyError: unknown) => {
        console.warn("[PDF Processor] Cleanup warning:", destroyError)
      })
    }

    return {
      text,
      pageCount,
      wordCount,
      language,
    }
  } catch (error) {
    console.error("[PDF Processor] Processing failed:", error)
    console.error("[PDF Processor] Error stack:", error instanceof Error ? error.stack : "No stack")
    console.error("[PDF Processor] Error type:", error instanceof Error ? error.constructor.name : typeof error)

    // Attempt cleanup even on error
    if (parser && typeof parser.destroy === "function") {
      await parser.destroy().catch(() => {
        // Ignore cleanup errors when already in error state
      })
    }

    // Re-throw with more context including stack trace
    if (error instanceof Error) {
      const detailedError = new Error(`PDF processing failed: ${error.message}`)
      detailedError.stack = error.stack
      throw detailedError
    }
    throw new Error(`PDF processing failed: ${String(error)}`)
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
