import Exa from "exa-js"
import { tool } from "ai"
import { EXA_DEFAULTS, getExaApiKey, isExaEnabled } from "../exa/config"
import {
  exaSearchParametersSchema,
  type ExaSearchParameters,
  type ExaSearchResponse,
  type ExaSearchResult,
} from "./types"

// Timeout for Exa search requests (30 seconds)
const EXA_SEARCH_TIMEOUT_MS = 30000

/**
 * Helper to add timeout to a promise
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

/**
 * Exa Search Tool
 * Performs semantic web search using Exa's neural search engine
 *
 * Features:
 * - Neural search for semantic understanding
 * - Autoprompt for query enhancement
 * - Text content and highlights extraction
 * - Structured source format compatible with UI
 * - 30 second timeout to prevent hanging
 */
export const exaSearchTool = tool({
  description:
    "Search the web for current information, research, and real-time data. " +
    "IMPORTANT: Use this tool whenever the user asks you to 'search', 'look up', 'find', 'research', or requests current/recent information. " +
    "This provides high-quality results with full text content and sources. " +
    "The search automatically optimizes queries and uses semantic understanding. " +
    "CRITICAL: After receiving search results, you MUST synthesize the information and provide a comprehensive answer to the user's question. " +
    "Do not just call the tool - analyze the results and respond with relevant insights.",
  parameters: exaSearchParametersSchema,
  execute: async ({
    query,
    numResults = EXA_DEFAULTS.numResults,
    type = EXA_DEFAULTS.type,
  }: ExaSearchParameters): Promise<ExaSearchResponse> => {
    // Check if Exa is enabled
    if (!isExaEnabled()) {
      throw new Error(
        "Exa search is not configured. Please add EXA_API_KEY to your environment variables."
      )
    }

    try {
      // Initialize Exa client
      const exa = new Exa(getExaApiKey())

      // Perform search with enhanced configuration and timeout
      const searchResults = await withTimeout(
        exa.searchAndContents(query, {
          numResults,
          type,
          useAutoprompt: EXA_DEFAULTS.useAutoprompt,
          text: true,
          highlights: true,
        }),
        EXA_SEARCH_TIMEOUT_MS,
        `Exa search timed out after ${EXA_SEARCH_TIMEOUT_MS / 1000} seconds`
      )

      // Transform results to match expected format
      const results: ExaSearchResult[] = searchResults.results.map((result) => ({
        id: result.id,
        title: result.title || "Untitled",
        url: result.url,
        text: result.text,
        highlights: result.highlights,
        score: result.score,
        publishedDate: result.publishedDate,
        author: result.author,
      }))

      return {
        results,
        query,
        searchType: type,
      }
    } catch (error) {
      // Handle Exa API errors gracefully
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred"

      throw new Error(`Exa search failed: ${errorMessage}`)
    }
  },
})

/**
 * Check if Exa search tool should be enabled
 * Returns true if EXA_API_KEY is configured
 */
export function shouldEnableExaTool(): boolean {
  return isExaEnabled()
}
