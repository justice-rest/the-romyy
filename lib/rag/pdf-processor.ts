/**
 * PDF Processing Module
 * Extracts text and metadata from PDF files
 */

import type { PDFProcessingResult } from "./types"

// Lazy load pdf-parse to avoid module resolution issues
let pdfParse: any = null
async function getPdfParse() {
  if (!pdfParse) {
    try {
      pdfParse = require("pdf-parse")
      console.log("[PDF Processor] pdf-parse loaded successfully")
    } catch (error) {
      console.error("[PDF Processor] Failed to load pdf-parse:", error)
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
