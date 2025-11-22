/**
 * RAG Search Tool
 * Allows AI to search user's uploaded documents using vector similarity
 */

import { tool } from "ai"
import { z } from "zod"

export const ragSearchTool = tool({
  description:
    "Search the user's uploaded documents for relevant information. Use this when the user's question relates to their uploaded PDFs (annual reports, research papers, donor data, fundraising documents, etc.). This tool performs semantic search across all documents the user has uploaded.",
  parameters: z.object({
    query: z
      .string()
      .describe(
        "The search query. Can be the user's full question or specific keywords to search for in their documents."
      ),
    documentIds: z
      .array(z.string())
      .optional()
      .describe(
        "Optional: Specific document IDs to search within. If not provided, searches across all user documents."
      ),
  }),
  execute: async ({ query, documentIds }, { toolContext }) => {
    try {
      // Get OpenRouter API key from environment
      const openrouterKey = process.env.OPENROUTER_API_KEY
      if (!openrouterKey) {
        return {
          success: false,
          error: "RAG search is not configured (missing API key)",
          results: [],
        }
      }

      // Import dynamically to avoid circular dependencies
      const { generateEmbedding } = await import("@/lib/rag/embeddings")
      const { searchDocumentChunks } = await import("@/lib/rag/search")

      // Get user ID from tool context (provided by chat API)
      const userId = (toolContext as any)?.userId

      if (!userId) {
        return {
          success: false,
          error: "User authentication required for RAG search",
          results: [],
        }
      }

      // Generate embedding for the search query
      const embeddingResponse = await generateEmbedding(query, openrouterKey)

      // Search for similar chunks
      const results = await searchDocumentChunks(
        embeddingResponse.embedding,
        userId,
        {
          maxResults: 5,
          similarityThreshold: 0.7,
          documentIds: documentIds || null,
        }
      )

      if (results.length === 0) {
        return {
          success: true,
          message: "No relevant information found in your documents.",
          results: [],
          query,
        }
      }

      // Format results for the AI
      const formattedResults = results.map((result) => ({
        document: result.document_name,
        page: result.page_number,
        content: result.content,
        similarity: Math.round(result.similarity * 100),
        documentId: result.document_id,
        chunkId: result.id,
      }))

      return {
        success: true,
        results: formattedResults,
        query,
        resultsCount: results.length,
        message: `Found ${results.length} relevant passage${results.length > 1 ? "s" : ""} from your documents.`,
      }
    } catch (error) {
      console.error("RAG search error:", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to search documents",
        results: [],
      }
    }
  },
})
