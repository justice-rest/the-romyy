import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  processPDF,
  isValidPDF,
  chunkText,
  generateEmbeddingsInBatches,
  checkUploadLimit,
  RAG_MAX_FILE_SIZE,
  RAG_ALLOWED_FILE_TYPES,
  RAG_EMBEDDING_BATCH_SIZE,
} from "@/lib/rag"
import { getCustomerData, normalizePlanId } from "@/lib/subscription/autumn-client"

// Ensure Node.js runtime for long-running operations
export const runtime = "nodejs"
export const maxDuration = 300 // 5 minutes for large PDF processing

export async function POST(request: Request) {
  try {
    // Parse form data
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const tags = formData.get("tags") as string | null

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > RAG_MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${RAG_MAX_FILE_SIZE / (1024 * 1024)}MB`,
        },
        { status: 400 }
      )
    }

    // Validate file type
    if (!RAG_ALLOWED_FILE_TYPES.includes(file.type as any)) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      )
    }

    // Get authenticated user
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has Ultra plan
    const customerData = await getCustomerData(user.id)
    const currentProductId = customerData?.products?.[0]?.id
    const planType = normalizePlanId(currentProductId)

    if (planType !== "ultra") {
      return NextResponse.json(
        { error: "Ultra plan required for RAG features" },
        { status: 403 }
      )
    }

    // Check upload limits
    await checkUploadLimit(user.id, file.size)

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Validate PDF magic bytes
    if (!isValidPDF(buffer)) {
      return NextResponse.json(
        { error: "Invalid PDF file" },
        { status: 400 }
      )
    }

    // Parse tags
    const tagArray = tags
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : []

    // Upload file to Supabase storage
    const fileName = `${user.id}/${Date.now()}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("rag-documents")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`)
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("rag-documents").getPublicUrl(fileName)

    // Create document record with 'processing' status
    const { data: document, error: docError } = await supabase
      .from("rag_documents")
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        file_type: file.type,
        tags: tagArray,
        status: "processing",
      })
      .select()
      .single()

    if (docError) {
      throw new Error(`Failed to create document record: ${docError.message}`)
    }

    // Process PDF (extract text and metadata)
    let pdfData
    try {
      pdfData = await processPDF(buffer)
    } catch (error) {
      // Update document status to failed
      await supabase
        .from("rag_documents")
        .update({
          status: "failed",
          error_message:
            error instanceof Error ? error.message : "PDF processing failed",
        })
        .eq("id", document.id)

      throw error
    }

    // Chunk the text
    const chunks = chunkText(pdfData.text, pdfData.pageCount)

    if (chunks.length === 0) {
      await supabase
        .from("rag_documents")
        .update({
          status: "failed",
          error_message: "No text content found in PDF",
        })
        .eq("id", document.id)

      return NextResponse.json(
        { error: "No text content found in PDF" },
        { status: 400 }
      )
    }

    // Get OpenRouter API key
    const openrouterKey = process.env.OPENROUTER_API_KEY
    if (!openrouterKey) {
      throw new Error("OpenRouter API key not configured")
    }

    // Generate embeddings for all chunks
    let embeddings: number[][]
    try {
      const chunkTexts = chunks.map((c) => c.content)
      embeddings = await generateEmbeddingsInBatches(
        chunkTexts,
        openrouterKey,
        RAG_EMBEDDING_BATCH_SIZE
      )
    } catch (error) {
      // Update document status to failed
      await supabase
        .from("rag_documents")
        .update({
          status: "failed",
          error_message:
            error instanceof Error
              ? error.message
              : "Failed to generate embeddings",
        })
        .eq("id", document.id)

      throw new Error(
        `Failed to generate embeddings: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }

    // Insert chunks with embeddings into database
    const chunkRecords = chunks.map((chunk, index) => ({
      document_id: document.id,
      user_id: user.id,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      page_number: chunk.pageNumber,
      embedding: JSON.stringify(embeddings[index]), // Convert number[] to JSON string
      token_count: chunk.tokenCount,
    }))

    const { error: chunksError } = await supabase
      .from("rag_document_chunks")
      .insert(chunkRecords)

    if (chunksError) {
      // Update document status to failed
      await supabase
        .from("rag_documents")
        .update({
          status: "failed",
          error_message: `Failed to save chunks: ${chunksError.message}`,
        })
        .eq("id", document.id)

      throw new Error(`Failed to insert chunks: ${chunksError.message}`)
    }

    // Update document with metadata and status
    const { data: finalDocument, error: updateError } = await supabase
      .from("rag_documents")
      .update({
        page_count: pdfData.pageCount,
        word_count: pdfData.wordCount,
        language: pdfData.language,
        status: "ready",
        processed_at: new Date().toISOString(),
      })
      .eq("id", document.id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`)
    }

    // Return success response with explicit JSON serialization
    const responseData = {
      document: finalDocument,
      chunks_created: chunks.length,
      message: "Document uploaded and processed successfully",
    }

    return new NextResponse(JSON.stringify(responseData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    console.error("RAG upload error:", error)

    // Ensure error response is always valid JSON
    const errorMessage =
      error instanceof Error ? error.message : "Failed to upload document"

    const errorResponse = {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }

    return new NextResponse(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    })
  }
}
