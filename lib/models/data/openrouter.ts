import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { ModelConfig } from "../types"

export const openrouterModels: ModelConfig[] = [
  {
    id: "openrouter:x-ai/grok-4-fast",
    name: "Speed",
    provider: "OpenRouter",
    providerId: "openrouter",
    modelFamily: "Grok",
    baseProviderId: "xai",
    description:
      "xAI's Grok model with fast response times and strong reasoning capabilities.",
    tags: ["fast", "reasoning", "efficient"],
    contextWindow: 131072,
    inputCost: 0.5,
    outputCost: 1.0,
    priceUnit: "per 1M tokens",
    vision: true,
    tools: true,
    audio: false,
    reasoning: true,
    webSearch: true,
    openSource: false,
    speed: "Fast",
    intelligence: "High",
    website: "https://openrouter.ai",
    apiDocs: "https://openrouter.ai/x-ai/grok-4-fast",
    modelPage: "https://x.ai/api",
    releasedAt: "2025-11-01",
    icon: "xai",
    apiSdk: (apiKey?: string, opts?: { enableSearch?: boolean }) =>
      createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
        ...(opts?.enableSearch && {
          extraBody: {
            plugins: [{ id: "web", engine: "exa", max_results: 35 }],
          },
        }),
      }).chat("x-ai/grok-4-fast"),
  },
  {
    id: "openrouter:x-ai/grok-4.1-fast",
    name: "Quick",
    provider: "OpenRouter",
    providerId: "openrouter",
    modelFamily: "Grok",
    baseProviderId: "xai",
    description:
      "xAI's latest Grok model with enhanced speed and reasoning capabilities, optimized for fast inference. Available for Ultra subscribers.",
    tags: ["fast", "reasoning", "efficient", "flagship", "ultra-only"],
    contextWindow: 131072,
    inputCost: 0.5,
    outputCost: 1.0,
    priceUnit: "per 1M tokens",
    vision: true,
    tools: true,
    audio: false,
    reasoning: true,
    webSearch: true,
    openSource: false,
    speed: "Fast",
    intelligence: "High",
    website: "https://openrouter.ai",
    apiDocs: "https://openrouter.ai/x-ai/grok-4.1-fast",
    modelPage: "https://x.ai/api",
    releasedAt: "2025-11-01",
    icon: "xai",
    isPro: true, // Only for Ultra subscribers
    apiSdk: (apiKey?: string, opts?: { enableSearch?: boolean }) =>
      createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
        ...(opts?.enableSearch && {
          extraBody: {
            plugins: [{ id: "web", engine: "exa", max_results: 35 }],
          },
        }),
      }).chat("x-ai/grok-4.1-fast"),
  },
]
