import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  getUserDocuments,
  deleteDocument,
  updateDocumentTags,
  searchDocuments,
  getStorageUsage,
} from "@/lib/rag"
import { getCustomerData, normalizePlanId } from "@/lib/subscription/autumn-client"

/**
 * GET /api/rag/documents
 * Get all documents for the authenticated user
 * Supports optional search query parameter
 */
export async function GET(request: Request) {
  try {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")

    // Get documents (with optional search)
    const documents = query
      ? await searchDocuments(user.id, query)
      : await getUserDocuments(user.id)

    // Get storage usage
    const usage = await getStorageUsage(user.id)

    return NextResponse.json({
      documents,
      usage,
    })
  } catch (error) {
    console.error("Get documents error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch documents",
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/rag/documents
 * Delete a document by ID
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get("id")

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      )
    }

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

    // Delete document (and cascade delete chunks)
    await deleteDocument(documentId, user.id)

    return NextResponse.json({
      message: "Document deleted successfully",
    })
  } catch (error) {
    console.error("Delete document error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete document",
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/rag/documents
 * Update document tags
 */
export async function PATCH(request: Request) {
  try {
    const { documentId, tags } = await request.json()

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      )
    }

    if (!Array.isArray(tags)) {
      return NextResponse.json(
        { error: "Tags must be an array" },
        { status: 400 }
      )
    }

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

    // Update tags
    await updateDocumentTags(documentId, user.id, tags)

    return NextResponse.json({
      message: "Tags updated successfully",
    })
  } catch (error) {
    console.error("Update tags error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update tags",
      },
      { status: 500 }
    )
  }
}
