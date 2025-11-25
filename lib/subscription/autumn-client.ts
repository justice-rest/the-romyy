import { Autumn } from "autumn-js"

/**
 * Autumn Client Utility
 *
 * Provides a server-side Autumn client for:
 * - Checking feature access
 * - Tracking usage
 * - Managing subscriptions
 *
 * This is used in API routes to enforce subscription limits.
 *
 * OPTIMIZED: Added caching and timeouts to reduce latency
 */

// ============================================================================
// CACHING LAYER - Reduces API calls dramatically
// ============================================================================

interface CachedAccess {
  allowed: boolean
  balance?: number
  limit?: number
  timestamp: number
}

interface CachedCustomer {
  data: any
  timestamp: number
}

// Cache access checks for 30 seconds (most users send multiple messages)
const accessCache = new Map<string, CachedAccess>()
const ACCESS_CACHE_TTL = 30 * 1000 // 30 seconds

// Cache customer data for 5 minutes (subscription status rarely changes)
const customerCache = new Map<string, CachedCustomer>()
const CUSTOMER_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Timeout for Autumn API calls (prevents blocking)
const AUTUMN_API_TIMEOUT = 150 // 150ms max

/**
 * Promise.race with timeout - returns fallback if API is slow
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  const timeout = new Promise<T>((resolve) =>
    setTimeout(() => resolve(fallback), timeoutMs)
  )
  return Promise.race([promise, timeout])
}

/**
 * Circuit Breaker for Autumn API
 * Tracks failures and switches to degraded mode after threshold
 */
class AutumnCircuitBreaker {
  private failureCount = 0
  private lastFailureTime = 0
  private readonly FAILURE_THRESHOLD = 5 // Number of consecutive failures before circuit opens
  private readonly RESET_TIMEOUT = 60000 // 1 minute - time to reset failure count
  private readonly DEGRADED_LIMIT = 10 // Limit in degraded mode (10 messages)

  recordFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()
  }

  recordSuccess() {
    this.failureCount = 0
  }

  isCircuitOpen(): boolean {
    // Reset if enough time has passed
    if (Date.now() - this.lastFailureTime > this.RESET_TIMEOUT) {
      this.failureCount = 0
      return false
    }
    return this.failureCount >= this.FAILURE_THRESHOLD
  }

  getDegradedLimit(): number {
    return this.DEGRADED_LIMIT
  }
}

const circuitBreaker = new AutumnCircuitBreaker()

/**
 * Normalize plan ID by removing billing cycle suffixes
 * Handles variations like "-yearly", "-annual", "-monthly", etc.
 *
 * Examples:
 * - "growth-yearly" → "growth"
 * - "pro-annual" → "pro"
 * - "scale" → "scale"
 */
export function normalizePlanId(productId?: string): string | null {
  if (!productId) return null

  // Remove common billing cycle suffixes
  return productId
    .replace(/-yearly$/i, "")
    .replace(/-annual$/i, "")
    .replace(/-monthly$/i, "")
    .toLowerCase()
}

/**
 * Check if Autumn is enabled
 */
export function isAutumnEnabled(): boolean {
  return !!process.env.AUTUMN_SECRET_KEY
}

/**
 * Get the Autumn client instance
 */
export function getAutumnClient(): Autumn | null {
  if (!isAutumnEnabled()) {
    return null
  }

  return new Autumn({
    secretKey: process.env.AUTUMN_SECRET_KEY!,
  })
}

/**
 * Check if a user has access to send messages
 * Returns the allowed status and current balance
 *
 * OPTIMIZED:
 * - Caches access checks for 30 seconds (most users send multiple messages quickly)
 * - Uses timeout to prevent blocking if Autumn API is slow
 * - Implements circuit breaker pattern for resilience
 */
export async function checkMessageAccess(
  userId: string,
  dailyMessageCount?: number // Optional Supabase message count for degraded mode
): Promise<{ allowed: boolean; balance?: number; limit?: number }> {
  const autumn = getAutumnClient()

  if (!autumn) {
    // If Autumn is not enabled, allow access (fallback to existing rate limits)
    return { allowed: true }
  }

  // OPTIMIZATION: Check cache first (30 second TTL)
  const cached = accessCache.get(userId)
  if (cached && Date.now() - cached.timestamp < ACCESS_CACHE_TTL) {
    return {
      allowed: cached.allowed,
      balance: cached.balance,
      limit: cached.limit,
    }
  }

  // Check circuit breaker state
  if (circuitBreaker.isCircuitOpen()) {
    console.warn("[Autumn Circuit Breaker] Circuit OPEN - using degraded mode", {
      userId,
      degradedLimit: circuitBreaker.getDegradedLimit(),
    })

    // Degraded mode: allow limited access based on daily message count
    const currentCount = dailyMessageCount ?? 0
    const degradedLimit = circuitBreaker.getDegradedLimit()

    return {
      allowed: currentCount < degradedLimit,
      balance: currentCount,
      limit: degradedLimit,
    }
  }

  // OPTIMIZATION: Wrap in timeout - if Autumn is slow, allow access
  const fallbackResult = { allowed: true }

  try {
    const result = await withTimeout(
      (async () => {
        // First check if customer has any past_due subscriptions
        const customerData = await getCustomerData(userId)
        const hasPastDueSubscription = customerData?.products?.some(
          (product: { status: string }) => product.status === "past_due"
        )

        // Block access if payment is past due
        if (hasPastDueSubscription) {
          console.log("[Autumn] Blocking access due to past_due payment", { userId })
          circuitBreaker.recordSuccess()
          return { allowed: false, balance: 0, limit: 0 }
        }

        const { data, error } = await autumn.check({
          customer_id: userId,
          feature_id: "messages",
        })

        if (error) {
          console.error("[Autumn] Check error:", error)
          circuitBreaker.recordFailure()
          return fallbackResult
        }

        // Success - reset circuit breaker
        circuitBreaker.recordSuccess()

        const accessResult = {
          allowed: data.allowed,
          balance: data.balance ?? undefined,
          limit: undefined,
        }

        // Cache the result
        accessCache.set(userId, { ...accessResult, timestamp: Date.now() })

        return accessResult
      })(),
      AUTUMN_API_TIMEOUT,
      fallbackResult
    )

    return result
  } catch (error) {
    console.error("[Autumn] Exception checking message access:", error)
    circuitBreaker.recordFailure()

    // If circuit opened, use degraded mode
    if (circuitBreaker.isCircuitOpen()) {
      const currentCount = dailyMessageCount ?? 0
      const degradedLimit = circuitBreaker.getDegradedLimit()
      return {
        allowed: currentCount < degradedLimit,
        balance: currentCount,
        limit: degradedLimit,
      }
    }

    // Still within failure threshold, fail open but record failure
    return { allowed: true }
  }
}

/**
 * Track a message usage event
 *
 * IMPORTANT: This tracks usage for ALL authenticated users, including unlimited plans.
 * This ensures accurate balance when users downgrade from unlimited (Max/Ultra) to
 * limited (Pro) plans mid-billing period, preventing sudden lockout.
 */
export async function trackMessageUsage(userId: string): Promise<void> {
  const autumn = getAutumnClient()

  if (!autumn) {
    return
  }

  try {
    await autumn.track({
      customer_id: userId,
      feature_id: "messages",
      value: 1,
    })
  } catch (error) {
    console.error("Error tracking message usage:", error)
    // Don't throw - we don't want to block the user if tracking fails
  }
}

/**
 * Get customer subscription data
 * OPTIMIZED: Cached for 5 minutes to reduce API calls
 */
export async function getCustomerData(userId: string) {
  const autumn = getAutumnClient()

  if (!autumn) {
    return null
  }

  // OPTIMIZATION: Check cache first (5 minute TTL)
  const cached = customerCache.get(userId)
  if (cached && Date.now() - cached.timestamp < CUSTOMER_CACHE_TTL) {
    return cached.data
  }

  try {
    // OPTIMIZATION: Use timeout to prevent blocking
    const result = await withTimeout(
      autumn.customers.get(userId),
      AUTUMN_API_TIMEOUT,
      { data: null, error: undefined } as any
    )

    if (result.error) {
      console.error("Error fetching customer data:", result.error)
      return null
    }

    // Cache the result
    if (result.data) {
      customerCache.set(userId, { data: result.data, timestamp: Date.now() })
    }

    return result.data
  } catch (error) {
    console.error("Error fetching customer data:", error)
    return null
  }
}
