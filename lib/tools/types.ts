import { z } from "zod"

/**
 * Schema for Exa search parameters
 */
export const exaSearchParametersSchema = z.object({
  query: z.string().describe("The search query to execute"),
  numResults: z
    .number()
    .min(1)
    .max(35)
    .optional()
    .default(35)
    .describe("Number of search results to return (1-35)"),
  type: z
    .enum(["keyword", "neural", "auto"])
    .optional()
    .default("auto")
    .describe("Search type: 'keyword' for exact matching, 'neural' for semantic search, or 'auto' for optimal results"),
})

export type ExaSearchParameters = z.infer<typeof exaSearchParametersSchema>

/**
 * Single search result from Exa
 */
export interface ExaSearchResult {
  id: string
  title: string
  url: string
  text?: string
  highlights?: string[]
  score?: number
  publishedDate?: string
  author?: string
}

/**
 * Response from Exa search tool
 */
export interface ExaSearchResponse {
  results: ExaSearchResult[]
  query: string
  searchType: "keyword" | "neural" | "auto"
}

/**
 * Tool definition type for Vercel AI SDK
 */
export interface ToolDefinition<TParameters = unknown, TResult = unknown> {
  description: string
  parameters: z.ZodType<TParameters>
  execute: (params: TParameters) => Promise<TResult>
}
