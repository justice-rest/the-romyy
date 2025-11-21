import Exa from "exa-js"
import { tool } from "ai"
import { EXA_DEFAULTS, getExaApiKey, isExaEnabled } from "../exa/config"
import {
  exaSearchParametersSchema,
  type ExaSearchParameters,
  type ExaSearchResponse,
  type ExaSearchResult,
} from "./types"

/**
 * Exa Search Tool
 * Performs semantic web search using Exa's neural search engine
 *
 * Features:
 * - Neural search for semantic understanding
 * - Autoprompt for query enhancement
 * - Text content and highlights extraction
 * - Structured source format compatible with UI
 */
export const exaSearchTool = tool({
  description:
    "Search the web using Exa's neural search engine for high-quality, relevant results. " +
    "Use this when you need to find current information, research topics, or gather sources. " +
    "Neural search understands context and semantics, not just keywords.",
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

      // Perform search with enhanced configuration
      const searchResults = await exa.searchAndContents(query, {
        numResults,
        type,
        useAutoprompt: EXA_DEFAULTS.useAutoprompt,
        text: true,
        highlights: true,
      })

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
