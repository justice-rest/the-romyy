/**
 * Extract RAG citations from message parts
 * Similar to get-sources.ts but for RAG tool results
 */

import type { Message } from "@/app/types/api.types"

export interface Citation {
  document: string
  page: number | null
  content: string
  similarity: number
  documentId: string
  chunkId: string
}

export function getCitations(message: Message): Citation[] {
  if (!message.parts || message.parts.length === 0) {
    return []
  }

  const citations: Citation[] = []

  for (const part of message.parts) {
    // Look for tool invocation parts with rag_search tool
    if (part.type === "tool-invocation" && part.toolName === "rag_search") {
      try {
        // The result is stored in the tool invocation result
        const result = part.result as any

        if (result?.success && Array.isArray(result?.results)) {
          for (const item of result.results) {
            citations.push({
              document: item.document || "Unknown Document",
              page: item.page || null,
              content: item.content || "",
              similarity: item.similarity || 0,
              documentId: item.documentId || "",
              chunkId: item.chunkId || "",
            })
          }
        }
      } catch (error) {
        console.error("Error parsing RAG citations:", error)
      }
    }
  }

  return citations
}
