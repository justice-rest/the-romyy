/**
 * Exa Search Configuration
 * Centralized configuration for Exa search integration
 */

/**
 * Check if Exa API key is configured
 */
export function isExaEnabled(): boolean {
  return !!process.env.EXA_API_KEY
}

/**
 * Get Exa API key from environment
 * @throws Error if EXA_API_KEY is not configured
 */
export function getExaApiKey(): string {
  const apiKey = process.env.EXA_API_KEY

  if (!apiKey) {
    throw new Error(
      "EXA_API_KEY is not configured. Please add it to your environment variables."
    )
  }

  return apiKey
}

/**
 * Get Exa API key if available, otherwise return null
 */
export function getExaApiKeyOptional(): string | null {
  return process.env.EXA_API_KEY || null
}

/**
 * Default configuration for Exa search
 */
export const EXA_DEFAULTS = {
  numResults: 35,
  type: "auto" as const, // Auto search for optimal results
  useAutoprompt: true, // Let Exa enhance the query
  text: true, // Include full text
  highlights: true, // Include key passages
} as const

/**
 * Maximum number of results Exa can return
 */
export const EXA_MAX_RESULTS = 35
